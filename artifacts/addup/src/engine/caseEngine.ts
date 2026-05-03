import Decimal from "decimal.js";
import type {
  ReconRow, Tx, DiscrepancyCase, CaseType, RiskLevel,
  SuggestedAction, CaseStatus,
} from "./types";
import { now } from "./utils";
import { buildExplanation } from "./explanationEngine";
import { proposeAction } from "./actionEngine";

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
    case "AUTO_MATCHED":              return `Matched — ${desc}`;
    case "TIMING_DIFFERENCE":        return `Timing difference — ${desc}`;
    case "MISSING_LEDGER_ENTRY":     return `No ledger entry — ${desc}`;
    case "MISSING_BANK_ENTRY":       return `No bank transaction — ${desc}`;
    case "BANK_FEES":                return `Bank fee — ${desc}`;
    case "DUPLICATE_ENTRY":          return `Possible duplicate — ${desc}`;
    case "AMOUNT_VARIANCE":          return `Amount variance — ${desc}`;
    case "DESCRIPTION_MISMATCH":     return `Description mismatch — ${desc}`;
    case "MANY_TO_ONE_MATCH":        return `Grouped match — multiple bank → one ledger`;
    case "ONE_TO_MANY_MATCH":        return `Split match — one bank → multiple ledger`;
    case "FX_OR_ROUNDING_DIFFERENCE":return `Rounding difference — ${desc}`;
    default:                         return `Unknown discrepancy — ${desc}`;
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
    confidence:       type === "AUTO_MATCHED" ? (rows[0]?.confidence ?? exp.confidence) : exp.confidence,
    risk,
    suggested_action: action,
    audit_narrative:  exp.audit_narrative,
    status,
    amount,
    created_at:       now(),
  };
}

// ── Main case builder ─────────────────────────────────────────────────────────
//
// Converts the flat array of ReconRows produced by runReconciliation() into
// structured DiscrepancyCases ordered by priority:
//
//   1. Duplicate detection   (cross-row, highest risk)
//   2. Group matching        (many-to-one)
//   3. Individual rows       (all remaining)

export function buildCases(rows: ReconRow[]): DiscrepancyCase[] {
  caseCounter = 0;
  const cases: DiscrepancyCase[] = [];
  const used  = new Set<string>();

  // ── 1. Duplicate detection ─────────────────────────────────────────────────
  // Two or more rows share the same ledger date + amount → probable duplicate.

  const ledgerKeyMap = new Map<string, ReconRow[]>();
  for (const row of rows) {
    if (!row.ledger || row.status === "invalid_row") continue;
    const key = `${row.ledger.date}|${row.ledger.amt.toFixed(2)}`;
    const bucket = ledgerKeyMap.get(key) ?? [];
    bucket.push(row);
    ledgerKeyMap.set(key, bucket);
  }

  for (const [, dupeRows] of ledgerKeyMap) {
    if (dupeRows.length < 2) continue;
    if (dupeRows.some(r => used.has(r.id))) continue;
    const bankTxs   = dupeRows.map(r => r.bank).filter(Boolean) as Tx[];
    const ledgerTxs = dupeRows.map(r => r.ledger).filter(Boolean) as Tx[];
    const amount    = sumAmt(ledgerTxs);
    cases.push(makeCase("DUPLICATE_ENTRY", dupeRows, bankTxs, ledgerTxs, "high", "needs_review", amount));
    dupeRows.forEach(r => used.add(r.id));
  }

  // ── 2. Group matching: many bank → one ledger ──────────────────────────────
  // Two or three unmatched bank rows whose absolute amounts sum exactly to one
  // unmatched ledger row amount (within ± R0.02 tolerance).

  const freeBank   = rows.filter(r => r.status === "unmatched_bank"   && !used.has(r.id));
  const freeLedger = rows.filter(r => r.status === "unmatched_ledger" && !used.has(r.id));

  for (const lRow of freeLedger) {
    if (!lRow.ledger || used.has(lRow.id)) continue;
    const target = new Decimal(Math.abs(lRow.ledger.amt));

    const avail = freeBank.filter(r => r.bank && !used.has(r.id));

    // Try pairs
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

    // Try triplets
    if (!used.has(lRow.id)) {
      const av2 = freeBank.filter(r => r.bank && !used.has(r.id));
      outer_trip:
      for (let i = 0; i < av2.length; i++) {
        for (let j = i + 1; j < av2.length; j++) {
          for (let k = j + 1; k < av2.length; k++) {
            const sum = new Decimal(Math.abs(av2[i].bank!.amt))
              .plus(Math.abs(av2[j].bank!.amt))
              .plus(Math.abs(av2[k].bank!.amt));
            if (sum.minus(target).abs().lessThanOrEqualTo(0.02)) {
              const groupRows = [av2[i], av2[j], av2[k], lRow];
              const bankTxs   = [av2[i].bank!, av2[j].bank!, av2[k].bank!];
              cases.push(makeCase(
                "MANY_TO_ONE_MATCH", groupRows, bankTxs, [lRow.ledger!],
                "medium", "proposed", target.toNumber(),
              ));
              groupRows.forEach(r => used.add(r.id));
              break outer_trip;
            }
          }
        }
      }
    }
  }

  // ── 3. Individual row classification ──────────────────────────────────────

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
        const sb = row.scoreBreakdown;
        if (sb) {
          if (sb.amount_score >= 0.85 && sb.date_score < 0.8 && row.dateDiff >= 1) {
            type = "TIMING_DIFFERENCE";
          } else if (sb.description_score < 0.5) {
            type = "DESCRIPTION_MISMATCH";
          } else if (row.amtDiff > 0.01 && row.amtDiff < 50) {
            type = "FX_OR_ROUNDING_DIFFERENCE";
          } else {
            type = "TIMING_DIFFERENCE";
          }
        } else {
          type = "TIMING_DIFFERENCE";
        }
        risk   = row.dateDiff > 5 ? "medium" : "low";
        status = "proposed";
        break;
      }

      case "manual_review": {
        const hasCrit = (row.criticalWarnings ?? []).length > 0;
        type   = row.amtDiff > 1 ? "AMOUNT_VARIANCE" : "UNKNOWN";
        risk   = hasCrit ? "high" : "medium";
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

      case "invalid_row": {
        type   = "UNKNOWN";
        risk   = "medium";
        status = "needs_review";
        break;
      }

      default:
        type   = "UNKNOWN";
        risk   = "low";
        status = "proposed";
    }

    const allTxs  = [row.bank, row.ledger].filter(Boolean) as Tx[];
    const bankTxs   = row.bank   ? [row.bank]   : [];
    const ledgerTxs = row.ledger ? [row.ledger] : [];
    const amount  = row.amtDiff > 0 ? row.amtDiff : sumAmt(allTxs);

    cases.push(makeCase(type, [row], bankTxs, ledgerTxs, risk, status, amount));
    used.add(row.id);
  }

  return cases;
}

// ── Case summary helpers ──────────────────────────────────────────────────────

export function caseSummary(cases: DiscrepancyCase[]) {
  const autoResolved    = cases.filter(c => c.type === "AUTO_MATCHED");
  const needsAttention  = cases.filter(c => c.type !== "AUTO_MATCHED" && !c.userDecision);
  const approved        = cases.filter(c => c.userDecision === "approved");
  const rejected        = cases.filter(c => c.userDecision === "rejected");
  const escalated       = cases.filter(c => c.userDecision === "escalated");
  const highRisk        = cases.filter(c => c.risk === "high" && c.type !== "AUTO_MATCHED");
  const unresolved      = cases.filter(c => c.status !== "resolved" && !c.userDecision && c.type !== "AUTO_MATCHED");

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
