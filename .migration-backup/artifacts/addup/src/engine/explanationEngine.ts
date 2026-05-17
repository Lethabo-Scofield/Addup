import type { ReconRow, CaseType, RiskLevel } from "./types";
import { fmt } from "./utils";

export interface Explanation {
  hypothesis: string;
  evidence: string[];
  confidence: number;
  audit_narrative: string;
}

export function buildExplanation(
  type: CaseType,
  rows: ReconRow[],
  risk: RiskLevel,
): Explanation {
  const row = rows[0];
  const bank = row?.bank;
  const ledger = row?.ledger;
  const dateDiff = row?.dateDiff ?? 0;
  const amtDiff = row?.amtDiff ?? 0;
  const descSim = row?.descSim ?? 0;
  const conf = row?.confidence ?? 0;

  switch (type) {
    case "AUTO_MATCHED": {
      const evidence = [
        "Amount matches within threshold",
        "Date within reconciliation window",
        "Description similarity passed",
        ...(row?.reasons ?? []),
      ];
      return {
        hypothesis:
          "All three matching dimensions (amount, date, description) align within acceptable thresholds. This transaction pair is auto-approved with no manual intervention needed.",
        evidence,
        confidence: conf,
        audit_narrative: `Transaction auto-matched with ${conf}% confidence. Amount, date, and description all passed validation. No human action required.`,
      };
    }

    case "TIMING_DIFFERENCE": {
      const evidence: string[] = [];
      if (bank && ledger) {
        evidence.push(`Bank date: ${bank.date}`);
        evidence.push(`Ledger date: ${ledger.date}`);
        evidence.push(`Date gap: ${dateDiff} day${dateDiff !== 1 ? "s" : ""}`);
        if (amtDiff < 0.01) evidence.push("Amount matches exactly");
        else evidence.push(`Amount difference: ${fmt(amtDiff)}`);
        if (descSim >= 0.5) evidence.push(`Description similarity: ${Math.round(descSim * 100)}%`);
      }
      const dayWord = dateDiff === 1 ? "1 day" : `${dateDiff} days`;
      return {
        hypothesis: `The transaction appears to have been recorded on a different date in the bank vs. the ledger. The ${dayWord} gap is consistent with normal banking timing — especially end-of-day batch processing, weekends, or next-business-day settlements.`,
        evidence,
        confidence: Math.max(conf, 55),
        audit_narrative: `Timing difference of ${dayWord} detected between bank statement (${bank?.date ?? "N/A"}) and ledger entry (${ledger?.date ?? "N/A"}). Amount and description match. Recommend approving as a timing difference.`,
      };
    }

    case "BANK_FEES": {
      const feeAmt = bank ? Math.abs(bank.amt) : 0;
      const evidence: string[] = [
        `Bank description contains fee-related keywords: "${bank?.desc ?? ""}"`,
        `Amount: ${fmt(feeAmt)}`,
        "No corresponding ledger entry found within the reconciliation window",
      ];
      return {
        hypothesis:
          "This bank debit appears to be a bank fee or service charge not captured in the general ledger. Common examples include monthly account fees, transaction fees, and administration charges.",
        evidence,
        confidence: 72,
        audit_narrative: `Unmatched bank debit of ${fmt(feeAmt)} identified as probable bank fee (description: "${bank?.desc ?? "N/A"}"). No ledger entry found. Recommend creating a journal entry to Bank Charges expense.`,
      };
    }

    case "MISSING_LEDGER_ENTRY": {
      const evidence: string[] = [
        `Bank transaction: "${bank?.desc ?? "N/A"}"`,
        `Date: ${bank?.date ?? "N/A"}`,
        `Amount: ${bank ? fmt(Math.abs(bank.amt)) : "N/A"}`,
        "No matching ledger entry found within the search window",
        ...(row?.warnings ?? []),
      ];
      return {
        hypothesis:
          "A bank transaction exists with no corresponding ledger entry. This could indicate an unrecorded payment, a missing journal entry, or a transaction posted to the wrong account.",
        evidence,
        confidence: 60,
        audit_narrative: `Bank transaction "${bank?.desc ?? "N/A"}" on ${bank?.date ?? "N/A"} for ${bank ? fmt(Math.abs(bank.amt)) : "N/A"} has no ledger counterpart. Request documentation to determine the correct posting.`,
      };
    }

    case "MISSING_BANK_ENTRY": {
      const evidence: string[] = [
        `Ledger entry: "${ledger?.desc ?? "N/A"}"`,
        `Date: ${ledger?.date ?? "N/A"}`,
        `Amount: ${ledger ? fmt(Math.abs(ledger.amt)) : "N/A"}`,
        "No matching bank transaction found within the search window",
        ...(row?.warnings ?? []),
      ];
      return {
        hypothesis:
          "A ledger entry exists with no corresponding bank transaction. This could indicate a payment not yet cleared, a future-dated entry, a ledger error, or a transaction outside the statement period.",
        evidence,
        confidence: 55,
        audit_narrative: `Ledger entry "${ledger?.desc ?? "N/A"}" on ${ledger?.date ?? "N/A"} for ${ledger ? fmt(Math.abs(ledger.amt)) : "N/A"} has no bank counterpart. Verify whether payment cleared in a different period.`,
      };
    }

    case "DUPLICATE_ENTRY": {
      const evidence: string[] = [
        `${rows.length} rows share the same date and amount`,
        `Affected IDs: ${rows.map(r => r.ledger?.id ?? r.id).join(", ")}`,
        `Amount: ${ledger ? fmt(Math.abs(ledger.amt)) : "N/A"}`,
        "Multiple ledger entries found with identical date and amount — high risk",
      ];
      return {
        hypothesis:
          "Two or more ledger entries share the same date and amount, suggesting a possible duplicate posting. This is a high-risk finding that requires human verification before any corrective action.",
        evidence,
        confidence: 78,
        audit_narrative: `Potential duplicate detected: ${rows.length} entries share date and amount (${ledger ? fmt(Math.abs(ledger.amt)) : "N/A"}). Do not auto-approve. Escalate to finance team for verification and any required reversal.`,
      };
    }

    case "AMOUNT_VARIANCE": {
      const evidence: string[] = [
        `Bank amount: ${bank ? fmt(bank.amt) : "N/A"}`,
        `Ledger amount: ${ledger ? fmt(ledger.amt) : "N/A"}`,
        `Variance: ${fmt(amtDiff)}`,
        ...(row?.criticalWarnings ?? []),
        ...(row?.softWarnings ?? []),
      ];
      const pct = bank && Math.abs(bank.amt) > 0.01
        ? Math.round((amtDiff / Math.abs(bank.amt)) * 100)
        : 0;
      return {
        hypothesis: `The amounts differ by ${fmt(amtDiff)} (${pct}%). This could be due to a partial payment, FX conversion, bank charges applied to the transaction, or an error in one of the systems.`,
        evidence,
        confidence: Math.max(conf, 40),
        audit_narrative: `Amount variance of ${fmt(amtDiff)} between bank (${bank ? fmt(bank.amt) : "N/A"}) and ledger (${ledger ? fmt(ledger.amt) : "N/A"}). Requires investigation: possible fee, FX, or posting error.`,
      };
    }

    case "DESCRIPTION_MISMATCH": {
      const evidence: string[] = [
        `Bank: "${bank?.desc ?? "N/A"}"`,
        `Ledger: "${ledger?.desc ?? "N/A"}"`,
        `Description similarity: ${Math.round(descSim * 100)}%`,
        `Amount match: ${amtDiff < 0.01 ? "Exact" : fmt(amtDiff) + " difference"}`,
        `Date gap: ${dateDiff} day${dateDiff !== 1 ? "s" : ""}`,
      ];
      return {
        hypothesis:
          "The bank and ledger descriptions differ significantly, though amounts and dates are close. This often occurs when internal references differ from bank statement narrations.",
        evidence,
        confidence: Math.max(conf, 45),
        audit_narrative: `Description mismatch: bank ("${bank?.desc ?? "N/A"}") vs ledger ("${ledger?.desc ?? "N/A"}"). Similarity: ${Math.round(descSim * 100)}%. Amounts align. Verify these represent the same underlying transaction.`,
      };
    }

    case "MANY_TO_ONE_MATCH": {
      const bankRows = rows.filter(r => r.bank && !r.ledger);
      const ledgerRow = rows.find(r => r.ledger && !r.bank);
      const bankTotal = bankRows.reduce((s, r) => s + Math.abs(r.bank?.amt ?? 0), 0);
      const evidence: string[] = [
        `${bankRows.length} bank transactions totalling ${fmt(bankTotal)}`,
        `1 ledger entry for ${ledgerRow?.ledger ? fmt(Math.abs(ledgerRow.ledger.amt)) : "N/A"}`,
        "Totals match within R 0.02 tolerance",
        ...bankRows.map(r => `Bank: "${r.bank?.desc ?? "N/A"}" — ${r.bank ? fmt(r.bank.amt) : ""}`),
      ];
      return {
        hypothesis: `${bankRows.length} bank transactions totalling ${fmt(bankTotal)} appear to have been consolidated into a single ledger settlement entry. This is a many-to-one match — a common pattern in payment batch processing and card settlements.`,
        evidence,
        confidence: 82,
        audit_narrative: `Group match: ${bankRows.length} bank transactions (total: ${fmt(bankTotal)}) match one ledger entry (${ledgerRow?.ledger ? fmt(Math.abs(ledgerRow.ledger.amt)) : "N/A"}). Recommend approving as grouped match.`,
      };
    }

    case "ONE_TO_MANY_MATCH": {
      const ledgerRows = rows.filter(r => r.ledger && !r.bank);
      const bankRow = rows.find(r => r.bank && !r.ledger);
      const ledgerTotal = ledgerRows.reduce((s, r) => s + Math.abs(r.ledger?.amt ?? 0), 0);
      const evidence: string[] = [
        `1 bank transaction for ${bankRow?.bank ? fmt(Math.abs(bankRow.bank.amt)) : "N/A"}`,
        `${ledgerRows.length} ledger entries totalling ${fmt(ledgerTotal)}`,
        "Totals match within R 0.02 tolerance",
      ];
      return {
        hypothesis: `One bank transaction of ${bankRow?.bank ? fmt(Math.abs(bankRow.bank.amt)) : "N/A"} appears to have been split across ${ledgerRows.length} ledger sub-entries. This is a one-to-many split — common for invoices or cost allocations.`,
        evidence,
        confidence: 80,
        audit_narrative: `Split match: bank transaction (${bankRow?.bank ? fmt(Math.abs(bankRow.bank.amt)) : "N/A"}) matches ${ledgerRows.length} ledger sub-entries (total: ${fmt(ledgerTotal)}). Recommend approving as a split allocation.`,
      };
    }

    case "FX_OR_ROUNDING_DIFFERENCE": {
      const evidence: string[] = [
        `Bank: ${bank ? fmt(bank.amt) : "N/A"}`,
        `Ledger: ${ledger ? fmt(ledger.amt) : "N/A"}`,
        `Difference: ${fmt(amtDiff)} (minor)`,
        "Amounts are otherwise consistent in date and description",
      ];
      return {
        hypothesis:
          "A very small amount difference exists between the bank and ledger entries. This is typically caused by FX conversion rounding, payment gateway fees, or minor system rounding differences.",
        evidence,
        confidence: 74,
        audit_narrative: `Minor variance of ${fmt(amtDiff)} between bank and ledger. Likely a rounding or FX difference. If within company tolerance policy, approve as a known variance.`,
      };
    }

    default: {
      const evidence = [
        ...(row?.reasons ?? []),
        ...(row?.warnings ?? []),
      ];
      return {
        hypothesis:
          "The system could not confidently classify this discrepancy. A finance team member must review and determine the correct resolution.",
        evidence: evidence.length > 0 ? evidence : ["Insufficient matching signals for automated classification"],
        confidence: 30,
        audit_narrative: `Unclassified discrepancy for ${bank?.desc ?? ledger?.desc ?? row?.id ?? "unknown"}. Manual review required. Do not auto-approve.`,
      };
    }
  }
}
