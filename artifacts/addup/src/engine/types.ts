// ── Core domain types ─────────────────────────────────────────────────────────

export type NavId =
  | "dashboard"
  | "cases"
  | "uploads"
  | "jobs"
  | "review"
  | "audit"
  | "settings";

export type TxStatus =
  | "matched"
  | "possible_match"
  | "manual_review"
  | "invalid_row"
  | "unmatched_bank"
  | "unmatched_ledger"
  | "excluded_from_matching";

export type ActionType =
  | "approve_match"
  | "reject_match"
  | "mark_manual"
  | "edit_field"
  | "export_json"
  | "export_pdf";

export type QualityStatus = "valid" | "warning" | "invalid";

// ── Transaction types ─────────────────────────────────────────────────────────

export interface RawField {
  raw:       string;
  normalized: string;
  confidence: number;
  issue?:    string;
}

export interface Tx {
  id:              string;
  date:            string;
  desc:            string;
  /**
   * Signed amount.
   *   Bank statement: debit (money out) = negative, credit (money in) = positive.
   *   Ledger row    : debit (Dr) = positive, credit (Cr) = negative.
   * With this convention, a correctly reconciled bank tx and its bank-side
   * ledger counterpart share the SAME sign.
   */
  amt:             number;
  /** Optional ledger account name (e.g. "Bank", "Office Supplies"). */
  account?:        string;
  /** Optional transaction reference / cheque / payment id. */
  reference?:      string;
  /** Optional running balance from the bank statement. */
  balance?:        number;
  /** True if the row is an opening balance / brought-forward marker. */
  isOpeningBalance?: boolean;
  /** True if the row's account resolves to a configured bank account. */
  isBankAccountRow?: boolean;
  normalizedDesc?: string;
  qualityStatus?:  QualityStatus;
  qualityIssues?:  string[];
  rawDate?:        RawField;
  rawAmt?:         RawField;
  rawDesc?:        RawField;
  issues?:         string[];
}

export interface ScoreBreakdown {
  amount_score:      number;
  reference_score:   number;
  date_score:        number;
  description_score: number;
  final_score:       number;
}

export interface Candidate {
  ledger_id:         string;
  final_score:       number;
  amount_score:      number;
  reference_score:   number;
  date_score:        number;
  description_score: number;
  reasons:           string[];
  warnings:          string[];
  criticalWarnings:  string[];
  softWarnings:      string[];
}

export interface ReconRow {
  id:              string;
  status:          TxStatus;
  bank?:           Tx;
  ledger?:         Tx;
  confidence:      number;
  dateDiff:        number;
  amtDiff:         number;
  descSim:         number;
  reasons:         string[];
  warnings:        string[];
  criticalWarnings: string[];
  softWarnings:    string[];
  action:          string;
  userStatus?:     "approved" | "rejected" | "manual";
  scoreBreakdown?: ScoreBreakdown;
  candidates?:     Candidate[];
}

export interface AuditEntry {
  ts:        string;
  job_id:    string;
  action:    ActionType;
  target_id: string;
  prev?:     string;
  next?:     string;
  user:      string;
}

/** Internal candidate used only during scoring */
export interface CandidateInternal {
  ledger:            Tx;
  final_score:       number;
  amount_score:      number;
  reference_score:   number;
  date_score:        number;
  description_score: number;
  reasons:           string[];
  warnings:          string[];
  criticalWarnings:  string[];
  softWarnings:      string[];
}

// ── Case-level reconciliation types ──────────────────────────────────────────

export type CaseType =
  | "AUTO_MATCHED"
  | "PROPOSED_MATCH"
  | "NEEDS_REVIEW"
  | "TIMING_DIFFERENCE"
  | "MISSING_LEDGER_ENTRY"
  | "MISSING_BANK_ENTRY"
  | "BANK_FEES"
  | "DUPLICATE_ENTRY"
  | "DUPLICATE_BANK_TRANSACTION"
  | "DUPLICATE_LEDGER_ENTRY"
  | "OPENING_BALANCE"
  | "UNKNOWN_DISCREPANCY"
  | "AMOUNT_VARIANCE"
  | "DESCRIPTION_MISMATCH"
  | "MANY_TO_ONE_MATCH"
  | "ONE_TO_MANY_MATCH"
  | "FX_OR_ROUNDING_DIFFERENCE"
  | "UNKNOWN";

export type RiskLevel  = "low" | "medium" | "high";
export type CaseStatus =
  | "proposed"
  | "approved"
  | "rejected"
  | "resolved"
  | "needs_review"
  | "excluded_from_matching";

export type CaseActionType =
  | "approve_match"
  | "approve_grouped_match"
  | "create_journal_entry"
  | "adjust_ledger_date"
  | "mark_as_timing_difference"
  | "flag_duplicate"
  | "request_missing_document"
  | "request_human_review"
  | "no_action_required";

export interface SuggestedAction {
  action_type:       CaseActionType;
  description:       string;
  requires_approval: boolean;
  affected_accounts?: string[];
  amount?:           number;
  reason?:           string;
}

export interface DiscrepancyCase {
  case_id:         string;
  type:            CaseType;
  title:           string;
  row_ids:         string[];
  bank_txs:        Tx[];
  ledger_txs:      Tx[];
  hypothesis:      string;
  evidence:        string[];
  confidence:      number;
  risk:            RiskLevel;
  suggested_action: SuggestedAction;
  audit_narrative: string;
  status:          CaseStatus;
  amount:          number;
  created_at:      string;
  userDecision?:   "approved" | "rejected" | "escalated";
  userNote?:       string;
}

export interface CaseAuditEntry {
  ts:             string;
  case_id:        string;
  actor:          "system" | "user";
  action:         string;
  before_status?: CaseStatus;
  after_status?:  CaseStatus;
  reason?:        string;
  evidence?:      string[];
}

// ── Structured reconciliation result (public API) ─────────────────────────────
//
// Stable, snake_case schema exposed to API clients / downstream consumers.
// Mirrors the spec in the product requirements; keep keys backward-compatible.

export type SnakeCaseType =
  | "auto_matched"
  | "proposed_match"
  | "needs_review"
  | "missing_bank"
  | "missing_ledger"
  | "duplicate_bank_transaction"
  | "duplicate_ledger_entry"
  | "opening_balance"
  | "unknown_discrepancy"
  | "timing_difference"
  | "bank_fees"
  | "amount_variance"
  | "description_mismatch"
  | "many_to_one_match"
  | "one_to_many_match"
  | "fx_or_rounding_difference";

export interface ValidationIssue {
  file:           "bank" | "ledger";
  severity:       "error" | "warning";
  message:        string;
  missingColumn?: string;
}

export interface ValidationResult {
  passed: boolean;
  issues: ValidationIssue[];
}

export interface StructuredCase {
  case_id:                  string;
  case_type:                SnakeCaseType;
  status:                   string;
  reconciliation_required:  boolean;
  risk:                     RiskLevel;
  confidence:               number;
  amount:                   number;
  bank_reference?:          string;
  ledger_reference?:        string;
  bank_description?:        string;
  ledger_description?:      string;
  bank_date?:               string;
  ledger_date?:             string;
  explanation:              string;
  recommended_action:       string;
}

export interface ReconciliationSummary {
  total_cases:                number;
  auto_matched:               number;
  proposed:                   number;
  needs_review:               number;
  missing_bank:               number;
  missing_ledger:             number;
  duplicates:                 number;
  opening_balances_excluded:  number;
  high_risk:                  number;
}

export interface ReconciliationResult {
  status:     "completed" | "failed";
  validation: ValidationResult;
  summary:    ReconciliationSummary;
  cases:      StructuredCase[];
}

export interface ReconcileOptions {
  /**
   * Ledger account names (case-insensitive, trimmed) that should be treated as
   * the bank account. Defaults to common variants. Provide custom names from
   * settings to support multiple bank accounts.
   */
  bankAccountNames?: string[];
  /** Date tolerance (in days) for non-exact matching tiers. */
  dateToleranceDays?: number;
}
