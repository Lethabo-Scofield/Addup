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
