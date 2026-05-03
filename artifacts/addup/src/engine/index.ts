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
} from "./parser";

// ── Matching engine ───────────────────────────────────────────────────────────

export { scorePair }                    from "./matcher";
export { derivePeriod, runReconciliation } from "./reconciliation";

// ── Case engine ───────────────────────────────────────────────────────────────

export { buildCases, caseSummary }      from "./caseEngine";
export { buildExplanation }             from "./explanationEngine";
export { proposeAction }                from "./actionEngine";
export { caseAuditTrail }               from "./auditTrail";

// ── Demo data ─────────────────────────────────────────────────────────────────

export { loadDemoData, DEMO_BANK_NAME, DEMO_LEDGER_NAME, DEMO_COMPANY } from "./demoData";
