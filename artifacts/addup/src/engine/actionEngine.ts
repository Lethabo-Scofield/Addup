import type { CaseType, SuggestedAction } from "./types";
import { fmt } from "./utils";

const HIGH_VALUE_THRESHOLD = 50_000;

export function proposeAction(type: CaseType, amount: number): SuggestedAction {
  const isHighValue = amount > HIGH_VALUE_THRESHOLD;

  switch (type) {
    case "AUTO_MATCHED":
      return {
        action_type: "approve_match",
        description: "Auto-approve this matched pair. All thresholds met — no manual action needed.",
        requires_approval: false,
        reason: "All scoring dimensions passed",
      };

    case "TIMING_DIFFERENCE":
      return {
        action_type: "mark_as_timing_difference",
        description:
          "Approve as a timing difference. The transaction is valid — it was simply recorded on different dates in each system.",
        requires_approval: false,
        reason: "Amounts match; date gap is within normal banking settlement window",
      };

    case "BANK_FEES":
      return {
        action_type: "create_journal_entry",
        description: `Create a journal entry debiting Bank Charges expense for ${fmt(amount)}.`,
        requires_approval: isHighValue,
        affected_accounts: ["Bank Charges Expense", "Bank Account"],
        amount,
        reason: "Bank fee not recorded in the general ledger",
      };

    case "MISSING_LEDGER_ENTRY":
      return {
        action_type: isHighValue ? "request_human_review" : "request_missing_document",
        description: isHighValue
          ? `High-value unmatched transaction (${fmt(amount)}). Escalate to finance manager before posting any entry.`
          : "Obtain supporting documentation (invoice, receipt, or remittance advice) and create the corresponding ledger entry.",
        requires_approval: true,
        amount,
        reason: "No ledger entry found for this bank transaction",
      };

    case "MISSING_BANK_ENTRY":
      return {
        action_type: "request_missing_document",
        description:
          "Verify whether the payment cleared the bank in a later period. If still outstanding, follow up with the bank or counterparty.",
        requires_approval: true,
        amount,
        reason: "Ledger entry exists but no corresponding bank transaction found",
      };

    case "DUPLICATE_ENTRY":
      return {
        action_type: "flag_duplicate",
        description:
          "Do not auto-approve. Flag for human review and verify which ledger entry is correct before any reversal or correction.",
        requires_approval: true,
        amount,
        reason: "Multiple ledger entries share the same date and amount — potential duplicate posting",
      };

    case "AMOUNT_VARIANCE":
      return {
        action_type: "request_human_review",
        description: `Investigate the ${fmt(amount)} variance. Determine if it relates to bank fees, partial payment, FX, or a posting error before resolving.`,
        requires_approval: true,
        amount,
        reason: "Significant amount difference between bank and ledger",
      };

    case "DESCRIPTION_MISMATCH":
      return {
        action_type: "approve_match",
        description:
          "Manually verify that both entries represent the same underlying transaction (amounts and dates align), then approve.",
        requires_approval: true,
        reason: "Descriptions differ significantly but amounts and dates align",
      };

    case "MANY_TO_ONE_MATCH":
      return {
        action_type: "approve_grouped_match",
        description:
          "Approve this group: multiple bank transactions are consolidated into a single ledger settlement. Verify totals match before approving.",
        requires_approval: false,
        amount,
        reason: "Bank transaction totals equal the ledger settlement amount",
      };

    case "ONE_TO_MANY_MATCH":
      return {
        action_type: "approve_grouped_match",
        description:
          "Approve this split: one bank transaction corresponds to multiple ledger sub-entries. Verify the allocation is correct.",
        requires_approval: false,
        amount,
        reason: "Single bank transaction split across multiple ledger entries",
      };

    case "FX_OR_ROUNDING_DIFFERENCE":
      return {
        action_type: "mark_as_timing_difference",
        description: `Approve as a known rounding or FX variance of ${fmt(amount)}. Confirm this is within your company tolerance policy before approving.`,
        requires_approval: false,
        amount,
        reason: "Minor variance consistent with FX conversion or system rounding",
      };

    default:
      return {
        action_type: "request_human_review",
        description:
          "This case could not be automatically classified. A finance team member must review and determine the correct resolution.",
        requires_approval: true,
        amount,
        reason: "Case type unknown — insufficient data for automated recommendation",
      };
  }
}
