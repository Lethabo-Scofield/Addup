// ── Top-level reconcile() — structured spec output ───────────────────────────
//
// Orchestrates the full reconciliation pipeline against raw row objects
// (already extracted from CSV / XLSX into Record<string,string>[]) and returns
// the structured `ReconciliationResult` mandated by the product spec:
//
//   {
//     status: "completed" | "failed",
//     validation: { passed, issues },
//     summary:    { total_cases, auto_matched, ... },
//     cases:      [{ case_id, case_type, status, ... }]
//   }
//
// Use this for API-facing / downstream-consumer use. The legacy
// `runReconciliation` + `buildCases` pair remains available for the existing
// UI which builds its own richer view models.

import { csvToTx } from "./parser";
import { runReconciliation } from "./reconciliation";
import { buildCases } from "./caseEngine";
import type {
  CaseType, DiscrepancyCase, ReconcileOptions, ReconciliationResult,
  ReconciliationSummary, SnakeCaseType, StructuredCase, ValidationIssue,
} from "./types";

const CASE_TYPE_TO_SNAKE: Partial<Record<CaseType, SnakeCaseType>> = {
  AUTO_MATCHED:               "auto_matched",
  PROPOSED_MATCH:             "proposed_match",
  NEEDS_REVIEW:               "needs_review",
  MISSING_LEDGER_ENTRY:       "missing_ledger",
  MISSING_BANK_ENTRY:         "missing_bank",
  BANK_FEES:                  "bank_fees",
  DUPLICATE_ENTRY:            "duplicate_ledger_entry",
  DUPLICATE_BANK_TRANSACTION: "duplicate_bank_transaction",
  DUPLICATE_LEDGER_ENTRY:     "duplicate_ledger_entry",
  OPENING_BALANCE:            "opening_balance",
  UNKNOWN_DISCREPANCY:        "unknown_discrepancy",
  TIMING_DIFFERENCE:          "timing_difference",
  AMOUNT_VARIANCE:            "amount_variance",
  DESCRIPTION_MISMATCH:       "description_mismatch",
  MANY_TO_ONE_MATCH:          "many_to_one_match",
  ONE_TO_MANY_MATCH:          "one_to_many_match",
  FX_OR_ROUNDING_DIFFERENCE:  "fx_or_rounding_difference",
};

function toSnake(t: CaseType): SnakeCaseType {
  return CASE_TYPE_TO_SNAKE[t] ?? "unknown_discrepancy";
}

function toStructured(c: DiscrepancyCase): StructuredCase {
  const bank   = c.bank_txs[0];
  const ledger = c.ledger_txs[0];
  const snake  = toSnake(c.type);
  const reconciliationRequired = !(
    snake === "auto_matched" ||
    snake === "opening_balance"
  );

  return {
    case_id:                 c.case_id,
    case_type:               snake,
    status:                  c.status,
    reconciliation_required: reconciliationRequired,
    risk:                    c.risk,
    confidence:              c.confidence,
    amount:                  Number(c.amount.toFixed(2)),
    bank_reference:          bank?.reference,
    ledger_reference:        ledger?.reference,
    bank_description:        bank?.desc,
    ledger_description:      ledger?.desc,
    bank_date:               bank?.date,
    ledger_date:             ledger?.date,
    explanation:             c.hypothesis,
    recommended_action:      c.suggested_action.description,
  };
}

function summarise(cases: StructuredCase[]): ReconciliationSummary {
  const by = (t: SnakeCaseType) => cases.filter(c => c.case_type === t).length;
  const duplicates =
    by("duplicate_bank_transaction") + by("duplicate_ledger_entry");
  return {
    total_cases:                cases.length,
    auto_matched:               by("auto_matched"),
    proposed:                   by("proposed_match"),
    needs_review:               by("needs_review"),
    missing_bank:               by("missing_bank"),
    missing_ledger:             by("missing_ledger"),
    duplicates,
    opening_balances_excluded:  by("opening_balance"),
    high_risk:                  cases.filter(c => c.risk === "high").length,
  };
}

export function reconcile(
  bankRows:   Record<string, string>[],
  ledgerRows: Record<string, string>[],
  opts:       ReconcileOptions = {},
): ReconciliationResult {
  const bank   = csvToTx(bankRows,   "B", "bank",   { bankAccountNames: opts.bankAccountNames });
  const ledger = csvToTx(ledgerRows, "L", "ledger", { bankAccountNames: opts.bankAccountNames });

  const issues: ValidationIssue[] = [...bank.validation.issues, ...ledger.validation.issues];
  const validation = { passed: bank.validation.passed && ledger.validation.passed, issues };

  if (!validation.passed) {
    return {
      status: "failed",
      validation,
      summary: {
        total_cases: 0, auto_matched: 0, proposed: 0, needs_review: 0,
        missing_bank: 0, missing_ledger: 0, duplicates: 0,
        opening_balances_excluded: 0, high_risk: 0,
      },
      cases: [],
    };
  }

  // Re-introduce invalid rows so they surface as needs_review / unknown
  const bankTxs   = [...bank.txns,   ...bank.invalid];
  const ledgerTxs = [...ledger.txns, ...ledger.invalid];

  const rows = runReconciliation(bankTxs, ledgerTxs, opts);
  const cases = buildCases(rows, { allBank: bankTxs, allLedger: ledgerTxs }).map(toStructured);

  return {
    status: "completed",
    validation,
    summary: summarise(cases),
    cases,
  };
}
