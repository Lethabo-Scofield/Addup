// ── Reconciliation engine tests ──────────────────────────────────────────────
//
// Covers the 14 acceptance scenarios defined in the product spec:
//   1.  Valid schemas pass validation
//   2.  Missing required columns fail validation
//   3.  Opening balances are excluded (never become Missing Bank)
//   4.  Non-bank ledger rows are excluded from reconciliation
//   5.  Only bank-account ledger rows are matched
//   6.  Exact amount + date + reference → auto_matched
//   7.  Date tolerance of up to 3 days still produces proposed/auto
//   8.  Fuzzy description match works when wording differs
//   9.  Missing bank is only created from unmatched bank-account ledger rows
//  10.  Missing ledger is created from unmatched bank statement rows
//  11.  Confidence scores are not all the same value
//  12.  Clean files should not produce many high-risk cases
//  13.  Duplicate bank transactions are flagged
//  14.  Duplicate bank ledger rows are flagged

import { describe, it, expect } from "vitest";
import {
  reconcile,
  csvToTx,
  buildCases,
  computeIntegrityChecks,
  computeReconciliationHealth,
  computeSettlementAnalytics,
  computeCaseIntegrity,
  runReconciliation,
} from "../index";
import type { Tx } from "../index";

// ── Helpers ──────────────────────────────────────────────────────────────────

type Row = Record<string, string>;

const BANK_HEADER  = ["date", "description", "debit", "credit", "balance", "reference"] as const;
const LEDGER_HEADER = ["date", "account", "description", "debit", "credit", "reference"] as const;

const bankRow = (
  date: string, description: string, debit: number, credit: number, balance: number, reference: string,
): Row => ({
  date, description,
  debit:  debit  ? debit.toFixed(2)  : "",
  credit: credit ? credit.toFixed(2) : "",
  balance: balance.toFixed(2),
  reference,
});

const ledgerRow = (
  date: string, account: string, description: string, debit: number, credit: number, reference: string,
): Row => ({
  date, account, description,
  debit:  debit  ? debit.toFixed(2)  : "",
  credit: credit ? credit.toFixed(2) : "",
  reference,
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("validation", () => {
  it("test 1: valid bank statement and ledger schemas pass validation", () => {
    const bank   = [bankRow("2026-01-05", "Client payment", 0, 1000, 1000, "INV-1001")];
    const ledger = [ledgerRow("2026-01-05", "Bank", "Client payment INV-1001", 1000, 0, "INV-1001")];
    const result = reconcile(bank, ledger);
    expect(result.status).toBe("completed");
    expect(result.validation.passed).toBe(true);
    expect(result.validation.issues).toHaveLength(0);
  });

  it("test 2: missing required columns fail validation", () => {
    // Bank row missing "balance" and "reference"
    const bank   = [{ date: "2026-01-05", description: "Client payment", debit: "", credit: "1000" }];
    const ledger = [ledgerRow("2026-01-05", "Bank", "Client payment", 1000, 0, "INV-1001")];
    const result = reconcile(bank, ledger);
    expect(result.status).toBe("failed");
    expect(result.validation.passed).toBe(false);
    const missing = result.validation.issues.map(i => i.missingColumn);
    expect(missing).toContain("balance");
    expect(missing).toContain("reference");
    // No cases produced when validation fails
    expect(result.cases).toHaveLength(0);
  });
});

describe("opening balances", () => {
  it("test 3: opening balance is excluded and never becomes Missing Bank", () => {
    const bank = [
      bankRow("2026-01-01", "Opening Balance",      0,    0,    5000, ""),
      bankRow("2026-01-05", "Client payment",       0,    1000, 6000, "INV-1001"),
    ];
    const ledger = [
      ledgerRow("2026-01-01", "Bank", "Balance Brought Forward", 5000, 0,    ""),
      ledgerRow("2026-01-05", "Bank", "Client payment INV-1001", 1000, 0,    "INV-1001"),
    ];
    const result = reconcile(bank, ledger);
    const opening = result.cases.filter(c => c.case_type === "opening_balance");
    expect(opening.length).toBeGreaterThanOrEqual(1);
    // Opening rows must not produce missing_bank / missing_ledger cases
    const missing = result.cases.filter(
      c => c.case_type === "missing_bank" || c.case_type === "missing_ledger"
    );
    expect(missing).toHaveLength(0);
    // Opening cases are reconciliation_required: false
    expect(opening.every(c => c.reconciliation_required === false)).toBe(true);
  });
});

describe("bank-account ledger filtering", () => {
  it("test 4: non-bank ledger rows are excluded from reconciliation", () => {
    const bank = [
      bankRow("2026-01-05", "Office Supplies CPT", 2500, 0, 2500, "POS-9001"),
    ];
    // A typical double-entry journal: expense Dr + Bank Cr.
    // Only the Bank row should enter the matching engine.
    const ledger = [
      ledgerRow("2026-01-05", "Office Supplies Expense", "Office Supplies",  2500, 0,    "POS-9001"),
      ledgerRow("2026-01-05", "Bank",                    "Office Supplies", 0,    2500, "POS-9001"),
    ];
    const result = reconcile(bank, ledger);
    // Office Supplies Expense row must NOT appear as a missing_bank case.
    const officeSuppliesCases = result.cases.filter(
      c => c.ledger_description?.includes("Office Supplies") && c.case_type === "missing_bank"
    );
    expect(officeSuppliesCases).toHaveLength(0);
    // Bank-side ledger row matched against bank statement
    const matched = result.cases.filter(
      c => c.case_type === "auto_matched" || c.case_type === "proposed_match"
    );
    expect(matched.length).toBeGreaterThanOrEqual(1);
  });

  it("test 5: only bank ledger rows are matched (multi-account ledger)", () => {
    const bank = [
      bankRow("2026-01-10", "Salary payment APR", 50000, 0, -50000, "PAY-001"),
    ];
    const ledger = [
      ledgerRow("2026-01-10", "Salary Expense", "Salary payment APR",  50000, 0,     "PAY-001"),
      ledgerRow("2026-01-10", "PAYE Payable",   "Salary PAYE",         0,    7500,  "PAY-001"),
      ledgerRow("2026-01-10", "UIF Payable",    "Salary UIF",          0,    500,   "PAY-001"),
      ledgerRow("2026-01-10", "Bank",           "Salary payment APR",  0,    42000, "PAY-001"),
    ];
    const result = reconcile(bank, ledger);
    // None of the non-Bank ledger rows should appear as missing_bank cases
    const wrongMisses = result.cases.filter(c =>
      c.case_type === "missing_bank" &&
      (c.ledger_description?.includes("PAYE") ||
       c.ledger_description?.includes("UIF")  ||
       c.ledger_description?.includes("Salary Expense"))
    );
    expect(wrongMisses).toHaveLength(0);
  });
});

describe("matching priorities", () => {
  it("test 6: exact amount + date + reference produces auto_matched", () => {
    const bank   = [bankRow("2026-02-01", "Client INV 1001",         0, 1500, 1500, "INV-1001")];
    const ledger = [ledgerRow("2026-02-01", "Bank", "Client INV 1001", 1500, 0,    "INV-1001")];
    const result = reconcile(bank, ledger);
    expect(result.summary.auto_matched).toBe(1);
    expect(result.summary.missing_bank).toBe(0);
    expect(result.summary.missing_ledger).toBe(0);
  });

  it("test 7: date tolerance up to 3 days still produces proposed_match or auto_matched", () => {
    const bank   = [bankRow("2026-02-05", "Vendor refund",         200, 0, -200, "VR-22")];
    // Ledger posted 2 days earlier
    const ledger = [ledgerRow("2026-02-03", "Bank", "Vendor refund VR-22", 0, 200, "VR-22")];
    const result = reconcile(bank, ledger);
    const goodMatches = result.cases.filter(
      c => c.case_type === "auto_matched" || c.case_type === "proposed_match"
    );
    expect(goodMatches.length).toBeGreaterThanOrEqual(1);
    expect(result.summary.missing_bank).toBe(0);
    expect(result.summary.missing_ledger).toBe(0);
  });

  it("test 8: fuzzy description match works when wording differs", () => {
    const bank   = [bankRow("2026-03-10", "Stationery purchase",          750, 0, -750, "PO-77")];
    // No reference on ledger, completely different wording, but synonym-aware
    const ledger = [ledgerRow("2026-03-10", "Bank", "Office Supplies CPT", 0, 750, "")];
    const result = reconcile(bank, ledger);
    const goodMatches = result.cases.filter(
      c => c.case_type === "auto_matched" || c.case_type === "proposed_match" || c.case_type === "needs_review"
    );
    expect(goodMatches.length).toBeGreaterThanOrEqual(1);
    // It should NOT be classified as missing on either side
    expect(result.summary.missing_bank + result.summary.missing_ledger).toBe(0);
  });
});

describe("unmatched-row classification", () => {
  it("test 9: missing_bank is only created from unmatched bank-account ledger rows", () => {
    // Bank-account ledger row with no bank statement counterpart
    const bank   = [bankRow("2026-04-05", "Some other payment", 100, 0, -100, "X-1")];
    const ledger = [
      // Non-bank rows — must be ignored entirely
      ledgerRow("2026-04-10", "Office Supplies Expense", "Stationery", 200, 0, "Z-1"),
      // Bank row with no bank-statement match — this one becomes missing_bank
      ledgerRow("2026-04-12", "Bank", "Outstanding cheque CHK-99", 0, 1234, "CHK-99"),
    ];
    const result = reconcile(bank, ledger);
    const mb = result.cases.filter(c => c.case_type === "missing_bank");
    expect(mb).toHaveLength(1);
    expect(mb[0].ledger_description).toContain("Outstanding cheque");
  });

  it("test 10: missing_ledger is created from unmatched bank statement rows", () => {
    const bank = [
      bankRow("2026-04-05", "Mystery payment", 100, 0, -100, "X-1"),
    ];
    const ledger = [
      ledgerRow("2026-04-05", "Bank", "Some other tx", 0, 50, "Y-1"),
    ];
    const result = reconcile(bank, ledger);
    expect(result.summary.missing_ledger).toBeGreaterThanOrEqual(1);
  });
});

describe("confidence scoring", () => {
  it("test 11: confidence scores are not all the same value", () => {
    const bank = [
      bankRow("2026-05-01", "Client INV 2001",     0, 1000, 1000, "INV-2001"),  // perfect
      bankRow("2026-05-03", "Client INV 2002",     0, 2000, 3000, "INV-2002"),  // perfect
      bankRow("2026-05-10", "Stationery purchase", 750, 0,  2250, ""),          // fuzzy desc, no ref
      bankRow("2026-05-12", "Vendor refund",       0, 300,  2550, "VR-3"),      // small date drift
    ];
    const ledger = [
      ledgerRow("2026-05-01", "Bank", "Client INV 2001",        1000, 0, "INV-2001"),
      ledgerRow("2026-05-03", "Bank", "Client INV 2002",        2000, 0, "INV-2002"),
      ledgerRow("2026-05-10", "Bank", "Office Supplies CPT",    0, 750, ""),
      ledgerRow("2026-05-13", "Bank", "Refund vendor VR-3",     0, 300, "VR-3"),
    ];
    const result = reconcile(bank, ledger);
    const confidences = new Set(
      result.cases
        .filter(c => c.case_type !== "opening_balance")
        .map(c => c.confidence)
    );
    // Expect at least 2 distinct confidence values across the cases.
    expect(confidences.size).toBeGreaterThanOrEqual(2);
  });

  it("test 12: clean matching files should not produce many high-risk cases", () => {
    const bank: Row[] = [];
    const ledger: Row[] = [];
    for (let i = 1; i <= 10; i++) {
      const dd = String(i).padStart(2, "0");
      const ref = `INV-30${i.toString().padStart(2, "0")}`;
      bank.push(bankRow(`2026-06-${dd}`,   `Client ${ref}`, 0, 1000 + i, 1000 + i, ref));
      ledger.push(ledgerRow(`2026-06-${dd}`, "Bank", `Client ${ref}`,  1000 + i, 0, ref));
    }
    const result = reconcile(bank, ledger);
    expect(result.summary.auto_matched).toBeGreaterThanOrEqual(8);
    expect(result.summary.high_risk).toBeLessThanOrEqual(1);
  });
});

describe("duplicate detection", () => {
  it("test 13: duplicate bank transactions are flagged", () => {
    const bank = [
      bankRow("2026-07-05", "Internet sub APR", 499, 0, -499,  "ISP-1"),
      bankRow("2026-07-05", "Internet sub APR", 499, 0, -998,  "ISP-1"),  // duplicate
      bankRow("2026-07-10", "Client payment",   0, 5000, 4002, "INV-9001"),
    ];
    const ledger = [
      ledgerRow("2026-07-05", "Bank", "Internet sub APR", 0, 499,  "ISP-1"),
      ledgerRow("2026-07-10", "Bank", "Client payment",   5000, 0, "INV-9001"),
    ];
    const result = reconcile(bank, ledger);
    const dupes = result.cases.filter(c => c.case_type === "duplicate_bank_transaction");
    expect(dupes.length).toBeGreaterThanOrEqual(1);
    expect(dupes[0].risk).toBe("high");
    expect(result.summary.duplicates).toBeGreaterThanOrEqual(1);
  });

  it("test 14: duplicate bank-side ledger rows are flagged", () => {
    const bank = [
      bankRow("2026-08-01", "Salary payment APR", 50000, 0, -50000, "PAY-001"),
    ];
    const ledger = [
      ledgerRow("2026-08-01", "Bank", "Salary payment APR", 0, 50000, "PAY-001"),
      ledgerRow("2026-08-01", "Bank", "Salary payment APR", 0, 50000, "PAY-001"),  // duplicate
    ];
    const result = reconcile(bank, ledger);
    const dupes = result.cases.filter(c => c.case_type === "duplicate_ledger_entry");
    expect(dupes.length).toBeGreaterThanOrEqual(1);
    expect(dupes[0].risk).toBe("high");
  });
});

// ── Extra sanity checks (not part of the 14 spec tests) ──────────────────────

describe("signed amount convention", () => {
  it("bank debit produces negative signed amt; bank credit produces positive", () => {
    const rows = [
      bankRow("2026-01-01", "Money out", 100, 0, -100, "OUT"),
      bankRow("2026-01-02", "Money in",  0, 200,  100, "IN"),
    ];
    const { txns } = csvToTx(rows, "B", "bank");
    expect(txns[0].amt).toBe(-100);
    expect(txns[1].amt).toBe(200);
  });

  it("ledger Dr produces positive; ledger Cr produces negative", () => {
    const rows = [
      ledgerRow("2026-01-01", "Bank", "Dr",  500, 0,   "DR"),
      ledgerRow("2026-01-02", "Bank", "Cr",  0,   500, "CR"),
    ];
    const { txns } = csvToTx(rows, "L", "ledger");
    expect(txns[0].amt).toBe(500);
    expect(txns[1].amt).toBe(-500);
  });
});

// ── Regression: Monthly Bank Charges journal must not double-up ──────────────
//
// A standard bank-fee journal posts BOTH sides:
//   Dr  Bank Charges Expense   150
//   Cr  Bank                   150
//
// Before the word-boundary filter fix, the "Bank Charges Expense" line was
// accepted as a bank account (substring "bank" matched), so it surfaced as
// an Unmatched Ledger / Missing Bank case alongside the legitimate match.
//
// After the fix, only the Bank-side credit should reconcile.

describe("regression: monthly bank charges journal", () => {
  it("matches only the bank-side leg; expense leg never creates a case", () => {
    const bank = [
      bankRow("2026-01-31", "Monthly Bank Charges", 150, 0, -150, "BANKFEE001"),
    ];
    const ledger = [
      ledgerRow("2026-01-31", "Bank Charges Expense", "Monthly bank charges", 150, 0, "BANKFEE001"),
      ledgerRow("2026-01-31", "Bank",                 "Monthly bank charges", 0, 150, "BANKFEE001"),
    ];

    const result = reconcile(bank, ledger);

    const byType = (t: string) => result.cases.filter(c => c.case_type === t);

    expect(byType("auto_matched").length).toBe(1);
    expect(byType("missing_bank").length).toBe(0);
    expect(byType("missing_ledger").length).toBe(0);
    expect(byType("needs_review").length).toBe(0);
    expect(byType("proposed_match").length).toBe(0);
    expect(result.summary.high_risk).toBe(0);
  });
});

// ── Integrity & Health helpers ───────────────────────────────────────────────
//
// These helpers underpin the Dashboard's audit-grade framing. The
// tests guard the contract the UI relies on: every bank row must be
// accounted for in a case, matched-pair totals must balance, and the
// reconciliation-health match rate must exclude opening balances.

function buildEngineState(bank: Row[], ledger: Row[]) {
  const bankTx   = csvToTx(bank,   "B", "bank").txns;
  const ledgerTx = csvToTx(ledger, "L", "ledger").txns;
  const rows     = runReconciliation(bankTx, ledgerTx);
  const cases    = buildCases(rows, { allBank: bankTx, allLedger: ledgerTx });
  return { bankTx, ledgerTx, cases };
}

describe("integrity checks", () => {
  it("passes the coverage check when every bank row appears in a case", () => {
    const bank   = [bankRow("2026-01-05", "Client payment", 0, 1000, 1000, "INV-1001")];
    const ledger = [ledgerRow("2026-01-05", "Bank", "Client payment INV-1001", 1000, 0, "INV-1001")];
    const { bankTx, ledgerTx, cases } = buildEngineState(bank, ledger);
    const integrity = computeIntegrityChecks(cases, bankTx, ledgerTx);
    const bankCov = integrity.checks.find(c => c.id === "bank_coverage")!;
    const ledgerCov = integrity.checks.find(c => c.id === "ledger_coverage")!;
    expect(bankCov.status).toBe("pass");
    expect(ledgerCov.status).toBe("pass");
    expect(integrity.failCount).toBe(0);
  });

  it("flags duplicate bank transactions through the dedicated check", () => {
    // Mirrors the shape of test 13 (debit-side duplicate that the
    // engine's duplicate detector recognises).
    const bank = [
      bankRow("2026-07-05", "Internet sub APR", 499, 0, -499,  "ISP-1"),
      bankRow("2026-07-05", "Internet sub APR", 499, 0, -998,  "ISP-1"),
      bankRow("2026-07-10", "Client payment",   0, 5000, 4002, "INV-9001"),
    ];
    const ledger = [
      ledgerRow("2026-07-05", "Bank", "Internet sub APR", 0, 499,  "ISP-1"),
      ledgerRow("2026-07-10", "Bank", "Client payment",   5000, 0, "INV-9001"),
    ];
    const { bankTx, ledgerTx, cases } = buildEngineState(bank, ledger);
    const integrity = computeIntegrityChecks(cases, bankTx, ledgerTx);
    const dup = integrity.checks.find(c => c.id === "no_duplicate_bank")!;
    expect(dup.status).toBe("fail");
    expect(integrity.overallStatus).toBe("fail");
  });

  it("passes matched-totals balance when sides agree", () => {
    const bank   = [bankRow("2026-01-05", "Client payment", 0, 1000, 1000, "INV-1001")];
    const ledger = [ledgerRow("2026-01-05", "Bank", "Client payment INV-1001", 1000, 0, "INV-1001")];
    const { bankTx, ledgerTx, cases } = buildEngineState(bank, ledger);
    const integrity = computeIntegrityChecks(cases, bankTx, ledgerTx);
    const totals = integrity.checks.find(c => c.id === "matched_totals_balance")!;
    expect(totals.status).toBe("pass");
  });

  it("isolates opening balances as info, not fail", () => {
    const bank = [
      bankRow("2026-01-01", "Opening Balance",      0,    0,    5000, ""),
      bankRow("2026-01-05", "Client payment",       0,    1000, 6000, "INV-1001"),
    ];
    const ledger = [
      ledgerRow("2026-01-01", "Bank", "Balance Brought Forward", 5000, 0, ""),
      ledgerRow("2026-01-05", "Bank", "Client payment INV-1001", 1000, 0, "INV-1001"),
    ];
    const { bankTx, ledgerTx, cases } = buildEngineState(bank, ledger);
    const integrity = computeIntegrityChecks(cases, bankTx, ledgerTx);
    const opening = integrity.checks.find(c => c.id === "opening_balance_isolated")!;
    expect(opening.status).toBe("info");
    expect(opening.detail).toMatch(/excluded from matching/);
  });
});

describe("reconciliation health", () => {
  it("excludes opening balances from the reconcilable denominator", () => {
    const bank = [
      bankRow("2026-01-01", "Opening Balance",      0,    0,    5000, ""),
      bankRow("2026-01-05", "Client payment",       0,    1000, 6000, "INV-1001"),
    ];
    const ledger = [
      ledgerRow("2026-01-01", "Bank", "Balance Brought Forward", 5000, 0, ""),
      ledgerRow("2026-01-05", "Bank", "Client payment INV-1001", 1000, 0, "INV-1001"),
    ];
    const { bankTx, cases } = buildEngineState(bank, ledger);
    const health = computeReconciliationHealth(cases, bankTx);
    // 2 bank rows total, 1 is an opening balance → 1 reconcilable
    expect(health.reconcilableBankCount).toBe(1);
    expect(health.excludedCount).toBe(1);
    expect(health.reconciledCount).toBe(1);
    expect(health.matchRatePct).toBe(100);
    expect(health.status).toBe("complete");
  });

  it("reports has_discrepancies when there is a missing-ledger case", () => {
    const bank = [
      bankRow("2026-01-05", "Client payment",      0, 1000, 1000, "INV-1001"),
      bankRow("2026-01-06", "Mystery deposit",     0, 500,  1500, "MYST-1"),
    ];
    const ledger = [
      ledgerRow("2026-01-05", "Bank", "Client payment INV-1001", 1000, 0, "INV-1001"),
    ];
    const { bankTx, cases } = buildEngineState(bank, ledger);
    const health = computeReconciliationHealth(cases, bankTx);
    expect(health.status).toBe("has_discrepancies");
    expect(health.discrepancyCount).toBeGreaterThan(0);
  });

  it("returns 100% match rate when there is nothing reconcilable", () => {
    const health = computeReconciliationHealth([], [] as Tx[]);
    expect(health.matchRatePct).toBe(100);
    expect(health.status).toBe("complete");
  });
});

describe("settlement analytics", () => {
  it("buckets matched cases by certainty band", () => {
    const bank = [
      bankRow("2026-01-05", "Client payment ALPHA",   0, 1000, 1000, "INV-1001"),
      bankRow("2026-01-06", "Client payment BETA",    0, 2000, 3000, "INV-1002"),
    ];
    const ledger = [
      ledgerRow("2026-01-05", "Bank", "Client payment INV-1001", 1000, 0, "INV-1001"),
      ledgerRow("2026-01-06", "Bank", "Client payment INV-1002", 2000, 0, "INV-1002"),
    ];
    const { cases } = buildEngineState(bank, ledger);
    const stats = computeSettlementAnalytics(cases);
    expect(stats.exactMatches + stats.strongMatches + stats.probableMatches + stats.weakMatches)
      .toBe(cases.filter(c => c.type === "AUTO_MATCHED" || c.type === "PROPOSED_MATCH" || c.type === "NEEDS_REVIEW").length);
    expect(stats.avgPostingLagDays).toBe(0);
    expect(stats.timedPairCount).toBe(2);
  });

  it("returns zeroes when there are no matched pairs", () => {
    const stats = computeSettlementAnalytics([]);
    expect(stats).toEqual({
      timedPairCount: 0,
      avgPostingLagDays: 0,
      exactMatches: 0,
      strongMatches: 0,
      probableMatches: 0,
      weakMatches: 0,
    });
  });
});

describe("per-case integrity", () => {
  it("marks AUTO_MATCHED cases as passed", () => {
    const bank = [bankRow("2026-01-05", "Client payment", 0, 1000, 1000, "INV-1001")];
    const ledger = [ledgerRow("2026-01-05", "Bank", "Client payment INV-1001", 1000, 0, "INV-1001")];
    const { cases } = buildEngineState(bank, ledger);
    const auto = cases.find(c => c.type === "AUTO_MATCHED");
    expect(auto).toBeDefined();
    expect(computeCaseIntegrity(auto!).status).toBe("passed");
  });

  it("marks duplicate cases as warning with a duplicate reason", () => {
    const bank = [
      bankRow("2026-01-05", "Client payment", 0, 1000, 1000, "INV-1001"),
      bankRow("2026-01-05", "Client payment", 0, 1000, 2000, "INV-1001"),
    ];
    const ledger = [ledgerRow("2026-01-05", "Bank", "Client payment INV-1001", 1000, 0, "INV-1001")];
    const { cases } = buildEngineState(bank, ledger);
    const dup = cases.find(c => c.type === "DUPLICATE_BANK_TRANSACTION");
    expect(dup).toBeDefined();
    const integrity = computeCaseIntegrity(dup!);
    expect(integrity.status).toBe("warning");
    expect(integrity.reasons.some(r => /duplicate/i.test(r))).toBe(true);
  });

  it("marks missing-ledger cases as warning", () => {
    const bank = [
      bankRow("2026-01-05", "Client payment", 0, 1000, 1000, "INV-1001"),
      bankRow("2026-01-06", "Mystery deposit", 0, 500, 1500, "MYST-1"),
    ];
    const ledger = [ledgerRow("2026-01-05", "Bank", "Client payment INV-1001", 1000, 0, "INV-1001")];
    const { cases } = buildEngineState(bank, ledger);
    const missing = cases.find(c => c.type === "MISSING_LEDGER_ENTRY");
    expect(missing).toBeDefined();
    expect(computeCaseIntegrity(missing!).status).toBe("warning");
  });
});
