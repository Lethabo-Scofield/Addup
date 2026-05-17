import type { Tx, ReconRow, Candidate, ScoreBreakdown, TxStatus, ReconcileOptions, CandidateInternal } from "./types";
import { scorePair } from "./matcher";

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_BANK_ACCOUNT_NAMES = [
  "bank",
  "cash at bank",
  "business bank account",
  "current account",
  "cheque account",
  "checking account",
  "bank account",
  "main bank",
];

function isBankAccountName(account: string | undefined, names: string[]): boolean {
  if (!account) return false;
  const norm = account.trim().toLowerCase();
  if (!norm) return false;
  return names.some(n => {
    const a = n.trim().toLowerCase();
    return !!a && (norm === a || norm.includes(a));
  });
}

// ── Period helper ─────────────────────────────────────────────────────────────

export function derivePeriod(txns: Tx[]): string {
  const dates = txns.map(t => t.date).filter(Boolean).sort();
  if (!dates.length) return "";
  return new Date(dates[0]).toLocaleDateString("en-ZA", {
    month: "long",
    year: "numeric",
  });
}

// ── Reconciliation engine ─────────────────────────────────────────────────────
//
// Bank-only reconciliation:
//
//   • Bank statement rows are matched against ledger rows whose account is a
//     configured bank account (e.g. "Bank", "Cash at Bank"). Non-bank ledger
//     rows (Office Supplies, VAT, Revenue, etc.) are EXCLUDED from matching
//     and never produce "Missing Bank" cases.
//
//   • Opening-balance rows on either side are emitted as `excluded_from_matching`
//     and never enter the matching pool.
//
//   • Tier-based matching (the score weights ensure tier ordering naturally):
//       Priority 1 — exact amount + exact reference + exact date
//       Priority 2 — exact amount + exact reference + date within tolerance
//       Priority 3 — exact amount + fuzzy description + date within tolerance
//       Priority 4 — exact amount only           (→ proposed_match, not auto)
//
// Backward compatibility:
//   If NO ledger row carries an `account` field (legacy fixtures / older
//   callers), the bank-account filter is skipped so existing flows keep
//   working.

export function runReconciliation(
  bank: Tx[],
  ledger: Tx[],
  opts: ReconcileOptions = {},
): ReconRow[] {
  const bankAccountNames = (opts.bankAccountNames?.length
    ? opts.bankAccountNames
    : DEFAULT_BANK_ACCOUNT_NAMES).map(s => s.trim().toLowerCase()).filter(Boolean);

  const rows: ReconRow[] = [];
  const usedLedger = new Set<string>();
  let rowN = 0;
  const rid = () => `R${String(++rowN).padStart(3, "0")}`;

  // ── Stage 1: split each side into invalid / opening-balance / candidates ──
  const validBank:   Tx[] = [];
  const invalidBank: Tx[] = [];
  const openingBank: Tx[] = [];
  for (const b of bank) {
    if (b.qualityStatus === "invalid") invalidBank.push(b);
    else if (b.isOpeningBalance)       openingBank.push(b);
    else                                validBank.push(b);
  }

  const hasAnyLedgerAccount = ledger.some(l => !!l.account);

  const validLedger:    Tx[] = [];
  const invalidLedger:  Tx[] = [];
  const openingLedger:  Tx[] = [];
  const nonBankLedger:  Tx[] = [];   // valid but not a bank account row
  for (const l of ledger) {
    if (l.qualityStatus === "invalid") { invalidLedger.push(l); continue; }
    if (l.isOpeningBalance)            { openingLedger.push(l); continue; }
    if (hasAnyLedgerAccount && !isBankAccountName(l.account, bankAccountNames)) {
      nonBankLedger.push(l);
      continue;
    }
    validLedger.push(l);
  }

  // ── Stage 2: emit non-matching rows ──────────────────────────────────────
  for (const b of invalidBank) {
    rows.push({
      id: rid(), status: "invalid_row", bank: b,
      confidence: 0, dateDiff: 0, amtDiff: 0, descSim: 0,
      reasons: [], warnings: b.qualityIssues ?? ["Invalid data"],
      criticalWarnings: b.qualityIssues ?? ["Invalid data"], softWarnings: [],
      action: "fix_data",
    });
  }
  for (const l of invalidLedger) {
    rows.push({
      id: rid(), status: "invalid_row", ledger: l,
      confidence: 0, dateDiff: 0, amtDiff: 0, descSim: 0,
      reasons: [], warnings: l.qualityIssues ?? ["Invalid data"],
      criticalWarnings: l.qualityIssues ?? ["Invalid data"], softWarnings: [],
      action: "fix_data",
    });
  }
  for (const b of openingBank) {
    rows.push({
      id: rid(), status: "excluded_from_matching", bank: b,
      confidence: 0, dateDiff: 0, amtDiff: 0, descSim: 0,
      reasons: ["Opening balance — excluded from reconciliation"],
      warnings: [], criticalWarnings: [], softWarnings: [],
      action: "no_action_required",
    });
  }
  for (const l of openingLedger) {
    rows.push({
      id: rid(), status: "excluded_from_matching", ledger: l,
      confidence: 0, dateDiff: 0, amtDiff: 0, descSim: 0,
      reasons: ["Opening balance — excluded from reconciliation"],
      warnings: [], criticalWarnings: [], softWarnings: [],
      action: "no_action_required",
    });
  }
  // Non-bank ledger rows are silently ignored (per spec: they must NOT
  // create reconciliation cases). They are intentionally NOT added to `rows`.

  // ── Stage 3: score all valid bank × bank-ledger pairs ────────────────────
  const bankCandidateMap = new Map<string, CandidateInternal[]>();
  for (const b of validBank) {
    const scored: CandidateInternal[] = validLedger
      .map(l => scorePair(b, l))
      .filter((c): c is CandidateInternal => c !== null && c.final_score > 0);
    scored.sort((a, b) => b.final_score - a.final_score);
    bankCandidateMap.set(b.id, scored);
  }

  // ── Stage 4: greedy assignment — highest-scoring bank tx picks first ─────
  const sortedBank = [...validBank].sort((a, b) => {
    const as = bankCandidateMap.get(a.id)?.[0]?.final_score ?? 0;
    const bs = bankCandidateMap.get(b.id)?.[0]?.final_score ?? 0;
    return bs - as;
  });

  for (const b of sortedBank) {
    const allCandidates = bankCandidateMap.get(b.id) ?? [];
    const available     = allCandidates.filter(c => !usedLedger.has(c.ledger.id));
    const best          = available[0];

    const topCandidates: Candidate[] = available.slice(0, 3).map(c => ({
      ledger_id: c.ledger.id,
      final_score: c.final_score,
      amount_score: c.amount_score,
      reference_score: c.reference_score,
      date_score: c.date_score,
      description_score: c.description_score,
      reasons: c.reasons,
      warnings: c.warnings,
      criticalWarnings: c.criticalWarnings,
      softWarnings: c.softWarnings,
    }));

    if (!best || best.final_score < 0.30) {
      rows.push({
        id: rid(), status: "unmatched_bank", bank: b,
        confidence: best ? Math.round(best.final_score * 100) : 0,
        dateDiff: 0, amtDiff: 0, descSim: 0,
        reasons: [], warnings: ["No matching ledger entry found"],
        criticalWarnings: [], softWarnings: [],
        action: "create_entry", candidates: topCandidates,
      });
      continue;
    }

    // Competing-candidate analysis
    const clearlyBetter = available.length <= 1 || (best.final_score - available[1].final_score >= 0.08);
    const hasCompeting  = available.length > 1   && (best.final_score - available[1].final_score < 0.05);

    const criticalWarnings = [...best.criticalWarnings];
    const softWarnings     = [...best.softWarnings];
    if (hasCompeting && !clearlyBetter) {
      criticalWarnings.push("Duplicate candidate conflict: multiple similar matches found");
    } else if (hasCompeting && clearlyBetter) {
      softWarnings.push("Multiple similar candidates found — best selected");
    }

    const scoreBreakdown: ScoreBreakdown = {
      amount_score:      best.amount_score,
      reference_score:   best.reference_score,
      date_score:        best.date_score,
      description_score: best.description_score,
      final_score:       best.final_score,
    };

    const dateDiffDays = Math.abs(
      new Date(b.date).getTime() - new Date(best.ledger.date).getTime(),
    ) / 86400000;
    const amtDiff     = Math.abs(b.amt - best.ledger.amt);
    const hasCritical = criticalWarnings.length > 0;

    // ── Classification by confidence thresholds (spec) ─────────────────────
    //   ≥ 0.90 → matched         (auto_matched)
    //   ≥ 0.70 → possible_match  (proposed_match)
    //   ≥ 0.50 → manual_review   (needs_review)
    //   < 0.50 → unmatched_bank  (unknown_discrepancy / missing_ledger)
    let status: TxStatus;
    if (best.final_score >= 0.90 && !hasCritical) status = "matched";
    else if (best.final_score >= 0.70 && !hasCritical) status = "possible_match";
    else if (best.final_score >= 0.50) status = "manual_review";
    else status = "unmatched_bank";

    if (status !== "unmatched_bank") usedLedger.add(best.ledger.id);

    rows.push({
      id: rid(),
      status,
      bank: b,
      ledger: status === "unmatched_bank" ? undefined : best.ledger,
      confidence: Math.round(best.final_score * 100),
      dateDiff:   Math.round(dateDiffDays),
      amtDiff,
      descSim:    best.description_score,
      reasons:    best.reasons,
      warnings:   best.warnings,
      criticalWarnings,
      softWarnings,
      action: status === "matched" ? "auto_approve"
            : status === "possible_match" ? "approve"
            : "review",
      scoreBreakdown,
      candidates: topCandidates,
    });
  }

  // ── Stage 5: unmatched bank-side ledger entries ──────────────────────────
  for (const l of validLedger) {
    if (!usedLedger.has(l.id)) {
      rows.push({
        id: rid(), status: "unmatched_ledger", ledger: l,
        confidence: 0, dateDiff: 0, amtDiff: 0, descSim: 0,
        reasons: [], warnings: ["No matching bank transaction found"],
        criticalWarnings: [], softWarnings: [],
        action: "create_entry",
      });
    }
  }

  return rows;
}
