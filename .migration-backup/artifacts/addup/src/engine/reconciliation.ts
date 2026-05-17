import type { Tx, ReconRow, Candidate, ScoreBreakdown, TxStatus } from "./types";
import { scorePair } from "./matcher";

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
// Matches bank transactions against ledger entries using a greedy best-first
// assignment strategy. Each bank transaction gets at most one ledger entry;
// each ledger entry is used at most once.
//
// Complexity: O(B × L) for scoring, O(B log B) for sorting.
// For large datasets (B, L > 5000) consider chunked or worker-thread execution.
//
// Classification thresholds (all subject to tuning — see docs/KNOWN_ISSUES.md):
//
//   MATCHED        final >= 0.75 AND amtPct <= 10% AND dateDiff <= 7d AND no critical
//   POSSIBLE MATCH final >= 0.60 AND no critical
//                  OR final >= 0.70 AND no critical  (force-upgrade)
//   MANUAL REVIEW  final 0.40–0.60 OR any critical warning
//   UNMATCHED      best candidate < 0.40
//
// ENGINEERS: The classification block is the primary place to tune sensitivity.
// See docs/KNOWN_ISSUES.md §2 for why results still skew toward Manual Review.

export function runReconciliation(bank: Tx[], ledger: Tx[]): ReconRow[] {
  const rows: ReconRow[] = [];
  const usedLedger = new Set<string>();
  let rowN = 0;
  const rid = () => `R${String(++rowN).padStart(3, "0")}`;

  // ── Separate valid from invalid rows ──────────────────────────────────────
  const validBank     = bank.filter(t => t.qualityStatus !== "invalid");
  const invalidBank   = bank.filter(t => t.qualityStatus === "invalid");
  const validLedger   = ledger.filter(t => t.qualityStatus !== "invalid");
  const invalidLedger = ledger.filter(t => t.qualityStatus === "invalid");

  // Emit invalid rows immediately — they never enter matching
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

  // ── Score all valid bank × ledger pairs ───────────────────────────────────
  const bankCandidateMap = new Map<string, ReturnType<typeof scorePair>[]>();
  for (const b of validBank) {
    const scored = validLedger
      .map(l => scorePair(b, l))
      .filter((c): c is NonNullable<ReturnType<typeof scorePair>> => c !== null && c.final_score > 0);
    scored.sort((a, b) => b.final_score - a.final_score);
    bankCandidateMap.set(b.id, scored);
  }

  // ── Greedy assignment: highest-scoring bank transaction picks first ────────
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
      date_score: c.date_score,
      description_score: c.description_score,
      reasons: c.reasons,
      warnings: c.warnings,
      criticalWarnings: c.criticalWarnings,
      softWarnings: c.softWarnings,
    }));

    if (!best || best.final_score < 0.38) {
      rows.push({
        id: rid(), status: "unmatched_bank", bank: b,
        confidence: 0, dateDiff: 0, amtDiff: 0, descSim: 0,
        reasons: [], warnings: ["No matching ledger entry found"],
        criticalWarnings: [], softWarnings: [],
        action: "create_entry", candidates: topCandidates,
      });
      continue;
    }

    // ── Competing candidate analysis ──────────────────────────────────────
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
      date_score:        best.date_score,
      description_score: best.description_score,
      final_score:       best.final_score,
    };

    const dateDiffDays = Math.abs(
      new Date(b.date).getTime() - new Date(best.ledger.date).getTime(),
    ) / 86400000;
    const amtPct      = Math.abs(b.amt) > 0.01 ? Math.abs(b.amt - best.ledger.amt) / Math.abs(b.amt) : 0;
    const hasCritical = criticalWarnings.length > 0;

    // ── Classification ────────────────────────────────────────────────────
    const isMatched =
      best.final_score >= 0.75 &&
      amtPct           <= 0.10 &&
      dateDiffDays     <= 7    &&
      !hasCritical;

    const forceUpgradeToPossible =
      best.final_score >= 0.70 &&
      !hasCritical;

    const isPossible =
      best.final_score >= 0.60 &&
      !hasCritical;

    let status: TxStatus;
    if (isMatched) {
      status = "matched";
    } else if (isPossible || forceUpgradeToPossible) {
      status = "possible_match";
    } else if (best.final_score >= 0.40) {
      status = "manual_review";
    } else {
      status = "unmatched_bank";
    }

    if (status !== "unmatched_bank") usedLedger.add(best.ledger.id);

    rows.push({
      id: rid(), status, bank: b, ledger: best.ledger,
      confidence: Math.round(best.final_score * 100),
      dateDiff:   Math.round(dateDiffDays),
      amtDiff:    Math.abs(b.amt - best.ledger.amt),
      descSim:    best.description_score,
      reasons:    best.reasons,
      warnings:   best.warnings,
      criticalWarnings,
      softWarnings,
      action:         status === "matched" ? "auto_approve" : "review",
      scoreBreakdown,
      candidates:     topCandidates,
    });
  }

  // ── Unmatched valid ledger entries ────────────────────────────────────────
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
