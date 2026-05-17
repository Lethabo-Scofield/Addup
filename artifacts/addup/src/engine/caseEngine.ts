import Decimal from "decimal.js";
import type {
  ReconRow, Tx, DiscrepancyCase, CaseType, RiskLevel,
  CaseStatus,
} from "./types";
import { now } from "./utils";
import { buildExplanation } from "./explanationEngine";
import { proposeAction } from "./actionEngine";
import { jaroWinkler } from "./similarity";
import { normalizeDesc } from "./normalizer";

// ── Fee keyword detection ─────────────────────────────────────────────────────

const FEE_KEYWORDS = [
  "fee", "charge", "charges", "monthly service", "account maintenance",
  "service fee", "bank fee", "bank charge", "transaction fee", "admin fee",
  "administration fee", "management fee", "annual fee", "penalty",
  "interest charge", "bank charges", "monthly fee",
];

function isFeeTransaction(desc: string): boolean {
  const lower = desc.toLowerCase();
  return FEE_KEYWORDS.some(kw => lower.includes(kw));
}

// ── Case ID counter ───────────────────────────────────────────────────────────

let caseCounter = 0;
function nextCaseId(): string {
  return `CASE-${String(++caseCounter).padStart(3, "0")}`;
}

function sumAmt(txs: Tx[]): number {
  return txs.reduce((s, t) => s + Math.abs(t.amt), 0);
}

// ── Case title generator ──────────────────────────────────────────────────────

function caseTitle(type: CaseType, row: ReconRow): string {
  const desc = ((row.bank?.desc ?? row.ledger?.desc) ?? "").slice(0, 45);
  switch (type) {
    case "AUTO_MATCHED":               return `Matched — ${desc}`;
    case "PROPOSED_MATCH":             return `Proposed match — ${desc}`;
    case "NEEDS_REVIEW":               return `Needs review — ${desc}`;
    case "TIMING_DIFFERENCE":          return `Timing difference — ${desc}`;
    case "MISSING_LEDGER_ENTRY":       return `No ledger entry — ${desc}`;
    case "MISSING_BANK_ENTRY":         return `No bank transaction — ${desc}`;
    case "BANK_FEES":                  return `Bank fee — ${desc}`;
    case "DUPLICATE_ENTRY":            return `Possible duplicate — ${desc}`;
    case "DUPLICATE_BANK_TRANSACTION": return `Duplicate bank transaction — ${desc}`;
    case "DUPLICATE_LEDGER_ENTRY":     return `Duplicate ledger entry — ${desc}`;
    case "OPENING_BALANCE":            return `Opening balance — ${desc || "excluded from matching"}`;
    case "UNKNOWN_DISCREPANCY":        return `Unknown discrepancy — ${desc}`;
    case "AMOUNT_VARIANCE":            return `Amount variance — ${desc}`;
    case "DESCRIPTION_MISMATCH":       return `Description mismatch — ${desc}`;
    case "MANY_TO_ONE_MATCH":          return `Grouped match — multiple bank → one ledger`;
    case "ONE_TO_MANY_MATCH":          return `Split match — one bank → multiple ledger`;
    case "FX_OR_ROUNDING_DIFFERENCE":  return `Rounding difference — ${desc}`;
    default:                           return `Unknown discrepancy — ${desc}`;
  }
}

function makeCase(
  type: CaseType,
  rows: ReconRow[],
  bankTxs: Tx[],
  ledgerTxs: Tx[],
  risk: RiskLevel,
  status: CaseStatus,
  amount: number,
): DiscrepancyCase {
  const exp    = buildExplanation(type, rows, risk);
  const action = proposeAction(type, amount);
  // The score breakdown lives on the underlying ReconRow when the case
  // came from a matching attempt. Only surface it for case types where
  // a match was actually scored — for missing / duplicate / opening
  // cases the breakdown would be meaningless or absent.
  const scoreBreakdown =
    (type === "AUTO_MATCHED" || type === "PROPOSED_MATCH" || type === "NEEDS_REVIEW")
      ? rows[0]?.scoreBreakdown
      : undefined;
  return {
    case_id:          nextCaseId(),
    type,
    title:            caseTitle(type, rows[0]),
    row_ids:          rows.map(r => r.id),
    bank_txs:         bankTxs,
    ledger_txs:       ledgerTxs,
    hypothesis:       exp.hypothesis,
    evidence:         exp.evidence,
    confidence:
      (type === "AUTO_MATCHED" || type === "PROPOSED_MATCH" || type === "NEEDS_REVIEW")
        ? (rows[0]?.confidence ?? exp.confidence)
        : exp.confidence,
    risk,
    suggested_action: action,
    audit_narrative:  exp.audit_narrative,
    status,
    amount,
    created_at:       now(),
    scoreBreakdown,
  };
}

// ── Duplicate detection helpers ───────────────────────────────────────────────
//
// Two rows on the same side are considered duplicates when they share:
//   • the same date
//   • the same signed amount (to 2 dp)
//   • the same normalised reference (when present)
//   • AND highly similar normalised descriptions (≥ 0.85 Jaro-Winkler)

function refKey(ref: string | undefined): string {
  return (ref ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function descsAreSimilar(a: string, b: string): boolean {
  const na = normalizeDesc(a);
  const nb = normalizeDesc(b);
  if (!na && !nb) return true;
  if (na === nb)  return true;
  return jaroWinkler(na, nb) >= 0.85;
}

function makeDuplicateOnlyCase(
  type: "DUPLICATE_BANK_TRANSACTION" | "DUPLICATE_LEDGER_ENTRY",
  group: Tx[],
): DiscrepancyCase {
  const synthRow: ReconRow = {
    id: `DUP-${group[0].id}`,
    status: "manual_review",
    bank:   type === "DUPLICATE_BANK_TRANSACTION" ? group[0] : undefined,
    ledger: type === "DUPLICATE_LEDGER_ENTRY"     ? group[0] : undefined,
    confidence: 85, dateDiff: 0, amtDiff: 0, descSim: 1,
    reasons: [], warnings: [], criticalWarnings: [], softWarnings: [],
    action: "flag_duplicate",
  };
  const amount = sumAmt(group);
  return makeCase(
    type,
    [synthRow],
    type === "DUPLICATE_BANK_TRANSACTION" ? group : [],
    type === "DUPLICATE_LEDGER_ENTRY"     ? group : [],
    "high",
    "needs_review",
    amount,
  );
}

function bucketDuplicates(txs: Tx[]): Tx[][] {
  const map = new Map<string, Tx[]>();
  for (const t of txs) {
    const k = `${t.date}|${t.amt.toFixed(2)}|${refKey(t.reference)}`;
    const arr = map.get(k) ?? [];
    arr.push(t);
    map.set(k, arr);
  }
  const groups: Tx[][] = [];
  for (const [, bucket] of map) {
    if (bucket.length < 2) continue;
    // Within bucket, group by description similarity
    const seen = new Set<number>();
    for (let i = 0; i < bucket.length; i++) {
      if (seen.has(i)) continue;
      const group: Tx[] = [bucket[i]];
      seen.add(i);
      for (let j = i + 1; j < bucket.length; j++) {
        if (seen.has(j)) continue;
        if (descsAreSimilar(bucket[i].desc, bucket[j].desc)) {
          group.push(bucket[j]);
          seen.add(j);
        }
      }
      if (group.length >= 2) groups.push(group);
    }
  }
  return groups;
}

// ── Main case builder ─────────────────────────────────────────────────────────
//
// Converts ReconRows into structured DiscrepancyCases:
//   1. Opening-balance rows         → OPENING_BALANCE (excluded_from_matching)
//   2. Duplicate detection           → DUPLICATE_BANK_TRANSACTION / DUPLICATE_LEDGER_ENTRY
//   3. Group matching (many-to-one)
//   4. Individual row classification (auto / proposed / needs_review / missing / unknown)

export function buildCases(
  rows: ReconRow[],
  ctx?: { allBank?: Tx[]; allLedger?: Tx[] },
): DiscrepancyCase[] {
  caseCounter = 0;
  const cases: DiscrepancyCase[] = [];
  const used  = new Set<string>();

  // ── 0. Input-level duplicate detection ──────────────────────────────────
  // Run BEFORE matching-state-based duplicate detection so duplicates that
  // were "consumed" by matching are still surfaced. Duplication is a
  // property of the input data, not of the match result.
  const dedupedTxIds = new Set<string>();
  if (ctx?.allBank?.length) {
    for (const group of bucketDuplicates(ctx.allBank)) {
      cases.push(makeDuplicateOnlyCase("DUPLICATE_BANK_TRANSACTION", group));
      group.forEach(t => dedupedTxIds.add(t.id));
    }
  }
  if (ctx?.allLedger?.length) {
    for (const group of bucketDuplicates(ctx.allLedger)) {
      cases.push(makeDuplicateOnlyCase("DUPLICATE_LEDGER_ENTRY", group));
      group.forEach(t => dedupedTxIds.add(t.id));
    }
  }
  // Suppress per-row cases for rows whose tx was already flagged as a duplicate.
  for (const r of rows) {
    const bId = r.bank?.id, lId = r.ledger?.id;
    if ((bId && dedupedTxIds.has(bId)) || (lId && dedupedTxIds.has(lId))) {
      used.add(r.id);
    }
  }

  // ── 1. Opening-balance rows ──────────────────────────────────────────────
  for (const row of rows) {
    if (used.has(row.id)) continue;
    if (row.status !== "excluded_from_matching") continue;
    const tx = row.bank ?? row.ledger;
    if (!tx?.isOpeningBalance) continue;
    cases.push(makeCase(
      "OPENING_BALANCE",
      [row],
      row.bank ? [row.bank] : [],
      row.ledger ? [row.ledger] : [],
      "low",
      "excluded_from_matching",
      0,
    ));
    used.add(row.id);
  }

  // ── 2. Duplicate detection — separate bank vs ledger ─────────────────────
  const bankSideRows: ReconRow[] = [];
  const ledgerSideRows: ReconRow[] = [];
  for (const r of rows) {
    if (used.has(r.id)) continue;
    if (r.status === "invalid_row" || r.status === "excluded_from_matching") continue;
    if (r.bank   && !r.ledger) bankSideRows.push(r);
    if (r.ledger && !r.bank)   ledgerSideRows.push(r);
  }

  const flagDuplicates = (
    type: "DUPLICATE_BANK_TRANSACTION" | "DUPLICATE_LEDGER_ENTRY",
    sideRows: ReconRow[],
    sidePick: (r: ReconRow) => Tx | undefined,
  ) => {
    const txToRow = new Map<string, ReconRow>();
    for (const r of sideRows) {
      const t = sidePick(r);
      if (t) txToRow.set(t.id, r);
    }
    const groups = bucketDuplicates(sideRows.map(sidePick).filter(Boolean) as Tx[]);
    for (const group of groups) {
      const groupRows = group.map(t => txToRow.get(t.id)).filter(Boolean) as ReconRow[];
      if (groupRows.some(r => used.has(r.id))) continue;
      const amount = sumAmt(group);
      const bankTxs   = type === "DUPLICATE_BANK_TRANSACTION" ? group : [];
      const ledgerTxs = type === "DUPLICATE_LEDGER_ENTRY"     ? group : [];
      cases.push(makeCase(type, groupRows, bankTxs, ledgerTxs, "high", "needs_review", amount));
      groupRows.forEach(r => used.add(r.id));
    }
  };

  flagDuplicates("DUPLICATE_LEDGER_ENTRY",     ledgerSideRows, r => r.ledger);
  flagDuplicates("DUPLICATE_BANK_TRANSACTION", bankSideRows,   r => r.bank);

  // ── 3. Group matching: many bank → one ledger (kept from previous impl) ──
  const freeBank   = rows.filter(r => r.status === "unmatched_bank"   && !used.has(r.id));
  const freeLedger = rows.filter(r => r.status === "unmatched_ledger" && !used.has(r.id));

  for (const lRow of freeLedger) {
    if (!lRow.ledger || used.has(lRow.id)) continue;
    const target = new Decimal(Math.abs(lRow.ledger.amt));
    const avail  = freeBank.filter(r => r.bank && !used.has(r.id));

    outer_pair:
    for (let i = 0; i < avail.length; i++) {
      for (let j = i + 1; j < avail.length; j++) {
        const sum = new Decimal(Math.abs(avail[i].bank!.amt))
          .plus(Math.abs(avail[j].bank!.amt));
        if (sum.minus(target).abs().lessThanOrEqualTo(0.02)) {
          const groupRows = [avail[i], avail[j], lRow];
          const bankTxs   = [avail[i].bank!, avail[j].bank!];
          cases.push(makeCase(
            "MANY_TO_ONE_MATCH", groupRows, bankTxs, [lRow.ledger!],
            "medium", "proposed", target.toNumber(),
          ));
          groupRows.forEach(r => used.add(r.id));
          break outer_pair;
        }
      }
    }
  }

  // ── 4. Individual row classification ─────────────────────────────────────
  for (const row of rows) {
    if (used.has(row.id)) continue;

    let type:   CaseType;
    let risk:   RiskLevel;
    let status: CaseStatus;

    switch (row.status) {
      case "matched": {
        type   = "AUTO_MATCHED";
        risk   = "low";
        status = "resolved";
        break;
      }

      case "possible_match": {
        type   = "PROPOSED_MATCH";
        risk   = row.dateDiff > 5 ? "medium" : "low";
        status = "proposed";
        break;
      }

      case "manual_review": {
        type   = "NEEDS_REVIEW";
        risk   = (row.criticalWarnings ?? []).length > 0 ? "high" : "medium";
        status = "needs_review";
        break;
      }

      case "unmatched_bank": {
        const desc = row.bank?.desc ?? "";
        if (isFeeTransaction(desc)) {
          type = "BANK_FEES";
          risk = "medium";
        } else {
          type = "MISSING_LEDGER_ENTRY";
          risk = Math.abs(row.bank?.amt ?? 0) > 10_000 ? "high" : "medium";
        }
        status = "needs_review";
        break;
      }

      case "unmatched_ledger": {
        type   = "MISSING_BANK_ENTRY";
        risk   = Math.abs(row.ledger?.amt ?? 0) > 10_000 ? "high" : "medium";
        status = "needs_review";
        break;
      }

      case "excluded_from_matching": {
        // Opening balances already handled above; any other excluded row
        // is an unknown_discrepancy we don't want to silently drop.
        type   = "UNKNOWN_DISCREPANCY";
        risk   = "low";
        status = "excluded_from_matching";
        break;
      }

      case "invalid_row": {
        type   = "UNKNOWN_DISCREPANCY";
        risk   = "medium";
        status = "needs_review";
        break;
      }

      default:
        type   = "UNKNOWN_DISCREPANCY";
        risk   = "low";
        status = "proposed";
    }

    const bankTxs   = row.bank   ? [row.bank]   : [];
    const ledgerTxs = row.ledger ? [row.ledger] : [];
    // Case `amount` represents the transaction value (bank or ledger side),
    // never the variance. Variance-style reporting is reserved for the
    // legacy AMOUNT_VARIANCE / FX_OR_ROUNDING_DIFFERENCE flows produced by
    // the older group-matching pipeline.
    const amount = Math.abs((row.bank?.amt ?? row.ledger?.amt) ?? 0);

    cases.push(makeCase(type, [row], bankTxs, ledgerTxs, risk, status, amount));
    used.add(row.id);
  }

  return cases;
}

// ── Case summary helpers ──────────────────────────────────────────────────────

// ── Integrity checks ──────────────────────────────────────────────────────────
//
// These are the audit-grade "did the books balance, and is the data
// trustworthy?" assertions a controller would want to verify before
// signing off on a reconciliation. Each check is binary (pass / fail)
// with a human-readable detail string. We deliberately surface these
// as a separate concern from the case stream — cases describe *what
// happened*, integrity checks describe *whether the file itself is
// structurally sound*.
//
// Tolerance: matched-totals comparison uses a 1% relative tolerance
// (or $1.00 absolute, whichever is larger). This absorbs floating
// point + currency-conversion rounding without masking real variance.
// $1.00 is the conventional reconciliation floor in industry tooling
// — tightening below that produces false positives on multi-currency
// books where penny-level FX drift across many transactions easily
// exceeds 10c.
//
// TODO (future integrity check): sign / polarity consistency. If a
// user uploads files where bank debits / credits have been swapped
// (or where the ledger account convention is inverted), the matcher
// will silently pair money-in with money-out. Detection idea:
// for matched pairs, the dominant relationship between sign(bank.amt)
// and sign(ledger.amt) should be consistent across the file; if a
// significant minority of pairs flip polarity vs the majority, flag
// it. Requires deciding on the expected sign convention per side.

export type IntegrityStatus = "pass" | "fail" | "info";

export interface IntegrityCheck {
  id:      string;
  label:   string;
  status:  IntegrityStatus;
  detail:  string;
  /** Auditor-facing rationale: *why* this check matters. */
  rationale: string;
}

export interface IntegritySummary {
  checks:        IntegrityCheck[];
  passCount:     number;
  failCount:     number;
  overallStatus: IntegrityStatus;
}

export function computeIntegrityChecks(
  cases:     DiscrepancyCase[],
  bankTxs:   Tx[],
  ledgerTxs: Tx[],
): IntegritySummary {
  const checks: IntegrityCheck[] = [];

  // 1. Matched-totals balance — for cases the engine paired up
  //    (AUTO_MATCHED / PROPOSED_MATCH / NEEDS_REVIEW), the sum of
  //    bank-side amounts should equal the sum of ledger-side amounts
  //    within tolerance. If it doesn't, the matching is internally
  //    inconsistent and downstream accounting will be off.
  const matchedCases = cases.filter(c =>
    (c.type === "AUTO_MATCHED" || c.type === "PROPOSED_MATCH" || c.type === "NEEDS_REVIEW")
    && c.bank_txs.length > 0 && c.ledger_txs.length > 0
  );
  const matchedBankTotal   = matchedCases.reduce((s, c) => s + sumAmt(c.bank_txs),   0);
  const matchedLedgerTotal = matchedCases.reduce((s, c) => s + sumAmt(c.ledger_txs), 0);
  const matchedDiff        = Math.abs(matchedBankTotal - matchedLedgerTotal);
  const matchedTolerance   = Math.max(1.00, matchedBankTotal * 0.01);
  checks.push({
    id:        "matched_totals_balance",
    label:     "Matched totals balance",
    status:    matchedCases.length === 0 ? "info"
             : matchedDiff <= matchedTolerance ? "pass" : "fail",
    detail:    matchedCases.length === 0
               ? "No matched pairs yet."
               : matchedDiff <= matchedTolerance
                 ? `Bank and ledger sides agree across ${matchedCases.length} matched pair${matchedCases.length === 1 ? "" : "s"}.`
                 : `Bank-side total $${matchedBankTotal.toFixed(2)} vs ledger-side $${matchedLedgerTotal.toFixed(2)} — $${matchedDiff.toFixed(2)} variance.`,
    rationale: "Matched pairs must reconcile down to the dollar — any divergence means one side was paired with the wrong counterparty.",
  });

  // 2. No duplicate bank transactions detected
  const dupBank = cases.filter(c => c.type === "DUPLICATE_BANK_TRANSACTION").length;
  checks.push({
    id:        "no_duplicate_bank",
    label:     "No duplicate bank transactions",
    status:    dupBank === 0 ? "pass" : "fail",
    detail:    dupBank === 0
               ? "Bank statement contains no duplicates."
               : `${dupBank} duplicate bank transaction${dupBank === 1 ? "" : "s"} detected — likely double-imported.`,
    rationale: "Duplicate bank entries inflate reconciled totals and corrupt period-end balances.",
  });

  // 3. No duplicate ledger postings
  const dupLedger = cases.filter(c => c.type === "DUPLICATE_LEDGER_ENTRY").length;
  checks.push({
    id:        "no_duplicate_ledger",
    label:     "No duplicate ledger postings",
    status:    dupLedger === 0 ? "pass" : "fail",
    detail:    dupLedger === 0
               ? "Ledger contains no duplicate postings."
               : `${dupLedger} duplicate ledger posting${dupLedger === 1 ? "" : "s"} detected — likely double-recorded.`,
    rationale: "Duplicate ledger postings overstate expenses or revenue and must be reversed before close.",
  });

  // 4. All bank transactions accounted for (every bank tx appears in
  //    exactly one case — either matched, duplicate-flagged, opening
  //    balance, or missing-ledger). Anything missing is a coverage
  //    gap that suggests the engine dropped a row.
  const accountedBankIds = new Set<string>();
  for (const c of cases) for (const t of c.bank_txs) accountedBankIds.add(t.id);
  const orphanedBankCount = bankTxs.filter(t => !accountedBankIds.has(t.id)).length;
  checks.push({
    id:        "bank_coverage",
    label:     "All bank transactions accounted for",
    status:    orphanedBankCount === 0 ? "pass" : "fail",
    detail:    orphanedBankCount === 0
               ? `All ${bankTxs.length} bank transaction${bankTxs.length === 1 ? "" : "s"} appear in a case.`
               : `${orphanedBankCount} bank transaction${orphanedBankCount === 1 ? "" : "s"} not represented in any case.`,
    rationale: "Every bank line must be classified — silently dropping rows would understate reconciled activity.",
  });

  // 5. All ledger entries accounted for (mirror of #4 for the ledger side)
  const accountedLedgerIds = new Set<string>();
  for (const c of cases) for (const t of c.ledger_txs) accountedLedgerIds.add(t.id);
  const orphanedLedgerCount = ledgerTxs.filter(t => !accountedLedgerIds.has(t.id)).length;
  checks.push({
    id:        "ledger_coverage",
    label:     "All ledger entries accounted for",
    status:    orphanedLedgerCount === 0 ? "pass" : "fail",
    detail:    orphanedLedgerCount === 0
               ? `All ${ledgerTxs.length} ledger entr${ledgerTxs.length === 1 ? "y" : "ies"} appear in a case.`
               : `${orphanedLedgerCount} ledger entr${orphanedLedgerCount === 1 ? "y" : "ies"} not represented in any case.`,
    rationale: "Every ledger posting must be classified — silently dropping rows would mask un-reconciled activity.",
  });

  // 6. Opening / carry-forward balances correctly excluded (informational —
  //    presence is normal, we just want auditors to see we recognised
  //    and isolated them rather than reconciling them as transactions).
  const openingCount = cases.filter(c => c.type === "OPENING_BALANCE").length;
  checks.push({
    id:        "opening_balance_isolated",
    label:     "Opening balances correctly isolated",
    status:    "info",
    detail:    openingCount === 0
               ? "No opening or carry-forward balances detected."
               : `${openingCount} opening / carry-forward balance${openingCount === 1 ? "" : "s"} excluded from matching.`,
    rationale: "Opening balances are not transactions — counting them as reconcilable would distort the match rate.",
  });

  const passCount = checks.filter(c => c.status === "pass").length;
  const failCount = checks.filter(c => c.status === "fail").length;
  const overallStatus: IntegrityStatus = failCount > 0 ? "fail"
                                       : checks.some(c => c.status === "pass") ? "pass"
                                       : "info";
  return { checks, passCount, failCount, overallStatus };
}

// ── Reconciliation health (completion state) ──────────────────────────────────
//
// Audit-grade summary of where the period stands. "Match rate" is
// computed against *reconcilable* bank transactions only — i.e.
// excluding opening / carry-forward balances — so the number can't be
// gamed by ignoring real movement. Status tiers (Complete / In Progress
// / Has Discrepancies) replace the old "engine automation rate"
// framing, which conflated engine performance with reconciliation
// closeness.

export type ReconciliationHealthStatus = "complete" | "in_progress" | "has_discrepancies";

export interface ReconciliationHealth {
  status:                 ReconciliationHealthStatus;
  /** Bank-side count, excluding opening/carry-forward balances. */
  reconcilableBankCount:  number;
  /** Bank-side txs that landed in a closed matched pair (auto or user-approved). */
  reconciledCount:        number;
  /** Open items still pending a human decision. */
  unresolvedCount:        number;
  /** Opening/carry-forward txs explicitly excluded from matching. */
  excludedCount:          number;
  /** High-risk discrepancies (missing entries, duplicates, large variance). */
  discrepancyCount:       number;
  /** 0–100, reconciled / reconcilable. 100 if nothing is reconcilable. */
  matchRatePct:           number;
}

export function computeReconciliationHealth(
  cases:    DiscrepancyCase[],
  bankTxs:  Tx[],
): ReconciliationHealth {
  const excludedBankIds = new Set<string>();
  for (const c of cases.filter(x => x.type === "OPENING_BALANCE")) {
    for (const t of c.bank_txs) excludedBankIds.add(t.id);
  }
  const reconcilableBankCount = bankTxs.filter(t => !excludedBankIds.has(t.id)).length;

  // A bank tx is "reconciled" if it appears in an AUTO_MATCHED case
  // OR in any case the user has explicitly approved. The
  // userDecision === "approved" branch deliberately catches more than
  // just PROPOSED_MATCH / NEEDS_REVIEW — approving a BANK_FEES,
  // MISSING_LEDGER_ENTRY (with a "create journal entry" action), or
  // TIMING_DIFFERENCE case all genuinely close out the underlying
  // bank tx from the controller's perspective.
  //
  // We intentionally do NOT count "rejected" or "escalated" cases as
  // reconciled. From an accounting standpoint, rejecting a
  // missing-ledger case ("I don't have a ledger entry for this and
  // I'm not going to record one") leaves the bank vs ledger
  // balances unequal — the books are not reconciled. Surfacing this
  // as "in_progress" is correct behaviour, not a bug.
  const reconciledBankIds = new Set<string>();
  for (const c of cases) {
    const isClosed = c.type === "AUTO_MATCHED" || c.userDecision === "approved";
    if (!isClosed) continue;
    for (const t of c.bank_txs) {
      if (!excludedBankIds.has(t.id)) reconciledBankIds.add(t.id);
    }
  }
  const reconciledCount = reconciledBankIds.size;

  const unresolvedCount = cases.filter(c =>
    c.type !== "AUTO_MATCHED"
    && c.type !== "OPENING_BALANCE"
    && !c.userDecision
  ).length;

  const discrepancyCount = cases.filter(c =>
    (c.type === "MISSING_LEDGER_ENTRY"
      || c.type === "MISSING_BANK_ENTRY"
      || c.type === "DUPLICATE_BANK_TRANSACTION"
      || c.type === "DUPLICATE_LEDGER_ENTRY"
      || c.type === "AMOUNT_VARIANCE")
    && !c.userDecision
  ).length;

  const matchRatePct = reconcilableBankCount === 0
    ? 100
    : Math.round((reconciledCount / reconcilableBankCount) * 100);

  const status: ReconciliationHealthStatus =
    discrepancyCount > 0                                  ? "has_discrepancies"
    : unresolvedCount > 0 || reconciledCount < reconcilableBankCount ? "in_progress"
    :                                                       "complete";

  return {
    status,
    reconcilableBankCount,
    reconciledCount,
    unresolvedCount,
    excludedCount: excludedBankIds.size,
    discrepancyCount,
    matchRatePct,
  };
}

// ── Settlement analytics ──────────────────────────────────────────────────────
//
// Operational metrics that give controllers a sense of the engine's
// throughput and quality at a glance: average posting lag (bank vs
// ledger date) and a histogram of confidence bands. Buckets match
// the certainty labels surfaced on each case (Exact / Strong /
// Probable / Weak) so the dashboard tile and the per-case chip tell
// the same story.

export interface SettlementAnalytics {
  /** Pairs the engine had enough info to time (both dates present). */
  timedPairCount: number;
  /** Mean absolute days between bank-side and ledger-side post dates. */
  avgPostingLagDays: number;
  exactMatches:    number;  // confidence >= 98
  strongMatches:   number;  // 85-97
  probableMatches: number;  // 65-84
  weakMatches:     number;  // < 65 — needs human eyes
}

export function computeSettlementAnalytics(cases: DiscrepancyCase[]): SettlementAnalytics {
  // Only matched pairs (auto + proposed + needs-review) contribute —
  // duplicates / missing / opening cases have no meaningful lag.
  const paired = cases.filter(c =>
    (c.type === "AUTO_MATCHED" || c.type === "PROPOSED_MATCH" || c.type === "NEEDS_REVIEW")
    && c.bank_txs.length > 0 && c.ledger_txs.length > 0
  );

  let lagSum = 0;
  let timedPairCount = 0;
  for (const c of paired) {
    const b = Date.parse(c.bank_txs[0].date);
    const l = Date.parse(c.ledger_txs[0].date);
    if (!isFinite(b) || !isFinite(l)) continue;
    lagSum += Math.abs(b - l) / 86_400_000;
    timedPairCount++;
  }
  const avgPostingLagDays = timedPairCount === 0 ? 0 : lagSum / timedPairCount;

  let exact = 0, strong = 0, probable = 0, weak = 0;
  for (const c of paired) {
    if      (c.confidence >= 98) exact++;
    else if (c.confidence >= 85) strong++;
    else if (c.confidence >= 65) probable++;
    else                         weak++;
  }

  return {
    timedPairCount,
    avgPostingLagDays: Math.round(avgPostingLagDays * 10) / 10,
    exactMatches:    exact,
    strongMatches:   strong,
    probableMatches: probable,
    weakMatches:     weak,
  };
}

// ── Per-case integrity status ─────────────────────────────────────────────────
//
// The case-level analogue of the global IntegritySummary. Lets the
// case detail panel show a "PASSED / WARNING" chip at the top so a
// reviewer can decide at a glance whether the engine is signalling
// structural confidence or asking for human eyes. Pure function of
// the case itself — does not consult cross-case state.

export type CaseIntegrityStatus = "passed" | "warning";

export interface CaseIntegrity {
  status:  CaseIntegrityStatus;
  reasons: string[];
}

export function computeCaseIntegrity(c: DiscrepancyCase): CaseIntegrity {
  // Cases the engine already considers closed.
  if (c.type === "AUTO_MATCHED")     return { status:"passed", reasons:["Engine cleared automatically — all signals exact."] };
  if (c.type === "OPENING_BALANCE")  return { status:"passed", reasons:["Opening balance — correctly excluded from matching."] };
  if (c.userDecision === "approved") return { status:"passed", reasons:["Reviewer-approved — counted as reconciled."] };

  const reasons: string[] = [];

  // Structural exception types always warrant a warning.
  if (c.type === "DUPLICATE_BANK_TRANSACTION")   reasons.push("Possible duplicate bank entry.");
  if (c.type === "DUPLICATE_LEDGER_ENTRY")       reasons.push("Possible duplicate ledger posting.");
  if (c.type === "MISSING_LEDGER_ENTRY")         reasons.push("No matching ledger entry found.");
  if (c.type === "MISSING_BANK_ENTRY")           reasons.push("No matching bank transaction found.");
  if (c.type === "AMOUNT_VARIANCE")              reasons.push("Amount variance between bank and ledger sides.");
  if (c.type === "TIMING_DIFFERENCE")            reasons.push("Posting dates differ beyond the typical settlement window.");

  if (c.risk === "high")                         reasons.push("Flagged high-risk by the engine.");
  if (c.confidence < 65)                         reasons.push(`Confidence below threshold (${c.confidence}%).`);

  // Surface failing signals on PROPOSED / NEEDS_REVIEW so reviewers
  // know exactly which dimension didn't agree.
  const sb = c.scoreBreakdown;
  if (sb) {
    if (sb.amount_score      < 0.95) reasons.push("Amount signal below match threshold.");
    if (sb.reference_score   < 0.85) reasons.push("Reference signal below match threshold.");
    if (sb.date_score        < 0.70) reasons.push("Date signal below match threshold.");
    if (sb.description_score < 0.60) reasons.push("Description similarity below match threshold.");
  }

  return reasons.length === 0
    ? { status:"passed",  reasons:["All structural checks passed."] }
    : { status:"warning", reasons };
}

export function caseSummary(cases: DiscrepancyCase[]) {
  const autoResolved    = cases.filter(c => c.type === "AUTO_MATCHED");
  const needsAttention  = cases.filter(c => c.type !== "AUTO_MATCHED" && c.type !== "OPENING_BALANCE" && !c.userDecision);
  const approved        = cases.filter(c => c.userDecision === "approved");
  const rejected        = cases.filter(c => c.userDecision === "rejected");
  const escalated       = cases.filter(c => c.userDecision === "escalated");
  const highRisk        = cases.filter(c => c.risk === "high" && c.type !== "AUTO_MATCHED");
  const unresolved      = cases.filter(c => c.status !== "resolved" && c.status !== "excluded_from_matching" && !c.userDecision && c.type !== "AUTO_MATCHED");

  return {
    total:         cases.length,
    autoResolved:  autoResolved.length,
    needsAttention: needsAttention.length,
    approved:      approved.length,
    rejected:      rejected.length,
    escalated:     escalated.length,
    highRisk:      highRisk.length,
    unresolved:    unresolved.length,
  };
}
