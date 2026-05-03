// ── Public API of the reconciliation engine ───────────────────────────────────
//
// Import from this file when using the engine in UI or test code.
// Internal modules (matcher.ts, similarity.ts, etc.) should not be imported
// directly from outside the engine/ folder.

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
} from "./types";

export { fmt, fmtDate, now, STATUS_CFG, ACTION_LABELS } from "./utils";
export { SYNONYMS, SYNONYM_KEYS, hasOcrArtifacts, normalizeDesc } from "./normalizer";
export { jaroWinkler, tokenSim, computeDescScore } from "./similarity";
export {
  detectDelimiter,
  splitDelimLine,
  parseDelimitedText,
  parseCSVText,
  xlsxToRows,
  normalizeDate,
  csvToTx,
} from "./parser";
export { scorePair } from "./matcher";
export { derivePeriod, runReconciliation } from "./reconciliation";
