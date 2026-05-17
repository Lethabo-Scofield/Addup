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
  | "unmatched_ledger";

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
  amt:             number;
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
  date_score:        number;
  description_score: number;
  final_score:       number;
}

export interface Candidate {
  ledger_id:         string;
  final_score:       number;
  amount_score:      number;
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
  | "TIMING_DIFFERENCE"
  | "MISSING_LEDGER_ENTRY"
  | "MISSING_BANK_ENTRY"
  | "BANK_FEES"
  | "DUPLICATE_ENTRY"
  | "AMOUNT_VARIANCE"
  | "DESCRIPTION_MISMATCH"
  | "MANY_TO_ONE_MATCH"
  | "ONE_TO_MANY_MATCH"
  | "FX_OR_ROUNDING_DIFFERENCE"
  | "UNKNOWN";

export type RiskLevel  = "low" | "medium" | "high";
export type CaseStatus = "proposed" | "approved" | "rejected" | "resolved" | "needs_review";

export type CaseActionType =
  | "approve_match"
  | "approve_grouped_match"
  | "create_journal_entry"
  | "adjust_ledger_date"
  | "mark_as_timing_difference"
  | "flag_duplicate"
  | "request_missing_document"
  | "request_human_review";

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
