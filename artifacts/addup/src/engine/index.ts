// ── Public API of the reconciliation engine ───────────────────────────────────
//
// Import from this file when using the engine in UI or test code.
// Internal modules (matcher.ts, similarity.ts, etc.) should not be imported
// directly from outside the engine/ folder.

// ── Core types ────────────────────────────────────────────────────────────────

export type {
  NavId,
  TxStatus,
  ActionType,
  QualityStatus,
  RawField,
  Tx,
  ScoreBreakdown,
  Candidate,
  CandidateInternal,
  ReconRow,
  AuditEntry,
  // Case types
  CaseType,
  RiskLevel,
  CaseStatus,
  CaseActionType,
  SuggestedAction,
  DiscrepancyCase,
  CaseAuditEntry,
  // Structured result schema
  ValidationIssue,
  ValidationResult,
  StructuredCase,
  SnakeCaseType,
  ReconciliationSummary,
  ReconciliationResult,
  ReconcileOptions,
} from "./types";

// ── Utilities ─────────────────────────────────────────────────────────────────

export { fmt, fmtDate, now, STATUS_CFG, ACTION_LABELS } from "./utils";
export { SYNONYMS, SYNONYM_KEYS, hasOcrArtifacts, normalizeDesc } from "./normalizer";
export { jaroWinkler, tokenSim, computeDescScore } from "./similarity";

// ── Parser ────────────────────────────────────────────────────────────────────

export {
  detectDelimiter,
  splitDelimLine,
  parseDelimitedText,
  parseCSVText,
  xlsxToRows,
  normalizeDate,
  csvToTx,
  validateSchema,
} from "./parser";

// ── Structured top-level API ─────────────────────────────────────────────────

export { reconcile } from "./reconcile";

// ── Matching engine ───────────────────────────────────────────────────────────

export { scorePair }                    from "./matcher";
export { derivePeriod, runReconciliation } from "./reconciliation";

// ── Case engine ───────────────────────────────────────────────────────────────

export { buildCases, caseSummary }      from "./caseEngine";
export { buildExplanation }             from "./explanationEngine";
export { proposeAction }                from "./actionEngine";
export { caseAuditTrail }               from "./auditTrail";

