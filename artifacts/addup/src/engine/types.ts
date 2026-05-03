// ── Core domain types ─────────────────────────────────────────────────────────

export type NavId = "dashboard" | "uploads" | "jobs" | "review" | "audit" | "settings";
export type TxStatus = "matched" | "possible_match" | "manual_review" | "invalid_row" | "unmatched_bank" | "unmatched_ledger";
export type ActionType = "approve_match" | "reject_match" | "mark_manual" | "edit_field" | "export_json" | "export_pdf";
export type QualityStatus = "valid" | "warning" | "invalid";

export interface RawField {
  raw: string;
  normalized: string;
  confidence: number;
  issue?: string;
}

export interface Tx {
  id: string;
  date: string;
  desc: string;
  amt: number;
  normalizedDesc?: string;
  qualityStatus?: QualityStatus;
  qualityIssues?: string[];
  rawDate?: RawField;
  rawAmt?: RawField;
  rawDesc?: RawField;
  issues?: string[];
}

export interface ScoreBreakdown {
  amount_score: number;
  date_score: number;
  description_score: number;
  final_score: number;
}

export interface Candidate {
  ledger_id: string;
  final_score: number;
  amount_score: number;
  date_score: number;
  description_score: number;
  reasons: string[];
  warnings: string[];
  criticalWarnings: string[];
  softWarnings: string[];
}

export interface ReconRow {
  id: string;
  status: TxStatus;
  bank?: Tx;
  ledger?: Tx;
  confidence: number;
  dateDiff: number;
  amtDiff: number;
  descSim: number;
  reasons: string[];
  warnings: string[];
  criticalWarnings: string[];
  softWarnings: string[];
  action: string;
  userStatus?: "approved" | "rejected" | "manual";
  scoreBreakdown?: ScoreBreakdown;
  candidates?: Candidate[];
}

export interface AuditEntry {
  ts: string;
  job_id: string;
  action: ActionType;
  target_id: string;
  prev?: string;
  next?: string;
  user: string;
}

/** Internal candidate used only during scoring — includes full Tx reference */
export interface CandidateInternal {
  ledger: Tx;
  final_score: number;
  amount_score: number;
  date_score: number;
  description_score: number;
  reasons: string[];
  warnings: string[];
  criticalWarnings: string[];
  softWarnings: string[];
}
