import type { Tx, CandidateInternal } from "./types";
import { computeDescScore } from "./similarity";
import { normalizeDesc } from "./normalizer";
import { fmt } from "./utils";

// ── Pair scorer ───────────────────────────────────────────────────────────────
//
// Scores a single (bank, ledger) candidate pair across three dimensions:
//   - Amount similarity   (weight 0.45)
//   - Description similarity (weight 0.30)
//   - Date proximity      (weight 0.25)
//
// Each dimension produces a score in [0, 1] and may emit warnings classified
// as CRITICAL (blocks auto-match and possible_match) or SOFT (logged only).
//
// Returns null if the pair is too dissimilar to consider.
//
// ENGINEERS: See docs/ENGINE.md for the full scoring matrix and
// docs/KNOWN_ISSUES.md for known calibration issues.

export function scorePair(b: Tx, l: Tx): CandidateInternal | null {
  const normB = b.normalizedDesc ?? normalizeDesc(b.desc);
  const normL = l.normalizedDesc ?? normalizeDesc(l.desc);

  const reasons: string[] = [];
  const warnings: string[] = [];
  const critW: string[]    = [];
  const softW: string[]    = [];

  const addW = (msg: string, critical: boolean) => {
    warnings.push(msg);
    (critical ? critW : softW).push(msg);
  };

  // ── Amount score ──────────────────────────────────────────────────────────
  // Weight: 0.45 — strongest signal for reconciliation.
  //
  // Critical threshold: > 20% difference
  // Soft thresholds:    5–20%
  let amount_score: number;
  const absDiff = Math.abs(b.amt - l.amt);
  const pct     = Math.abs(b.amt) > 0.01 ? absDiff / Math.abs(b.amt) : (absDiff > 0 ? 1 : 0);

  if (absDiff < 0.01) {
    amount_score = 1.0;
    reasons.push("Exact amount match");
  } else if (Math.abs(b.amt + l.amt) < 0.01 && Math.abs(b.amt) > 0.01) {
    amount_score = 0.75;
    addW("Direction differs — same absolute amount, opposite sign", true);
  } else if (pct <= 0.02) {
    amount_score = 0.9;
    reasons.push(`Amount within 2% tolerance (diff: ${fmt(absDiff)})`);
  } else if (pct <= 0.05) {
    amount_score = 0.82;
    reasons.push(`Amount within 5% tolerance (diff: ${fmt(absDiff)})`);
  } else if (pct <= 0.10) {
    amount_score = 0.70;
    addW(`Amount differs by ${fmt(absDiff)} (${Math.round(pct * 100)}%)`, false);
  } else if (pct <= 0.15) {
    amount_score = 0.55;
    addW(`Significant amount difference: ${fmt(absDiff)} (${Math.round(pct * 100)}%)`, false);
  } else if (pct <= 0.20) {
    amount_score = 0.35;
    addW(`Large amount difference: ${fmt(absDiff)} (${Math.round(pct * 100)}%)`, false);
  } else {
    amount_score = 0.0;
    addW(`Amount too far apart: ${fmt(absDiff)} (${Math.round(pct * 100)}% difference)`, true);
  }

  // ── Date score ────────────────────────────────────────────────────────────
  // Weight: 0.25
  //
  // Critical threshold: > 14 days
  // Soft thresholds:    4–14 days
  let date_score: number;
  const bMs     = new Date(b.date).getTime();
  const lMs     = new Date(l.date).getTime();
  const daysDiff = isNaN(bMs) || isNaN(lMs) ? Infinity : Math.abs(bMs - lMs) / 86400000;

  if (daysDiff === 0) {
    date_score = 1.0;
    reasons.push("Exact date match");
  } else if (daysDiff <= 1) {
    date_score = 0.95;
    reasons.push(`Date within 1 day (${b.date} vs ${l.date})`);
  } else if (daysDiff <= 3) {
    date_score = 0.88;
    reasons.push(`Date within 3 days (${b.date} vs ${l.date})`);
  } else if (daysDiff <= 7) {
    date_score = 0.72;
    addW(`Date off by ${Math.round(daysDiff)} days: ${b.date} vs ${l.date}`, false);
  } else if (daysDiff <= 10) {
    date_score = 0.55;
    addW(`Date off by ${Math.round(daysDiff)} days`, false);
  } else if (daysDiff <= 14) {
    date_score = 0.38;
    addW(`Date off by ${Math.round(daysDiff)} days`, false);
  } else {
    date_score = 0.0;
    addW(`Dates too far apart: ${Math.round(daysDiff)} days`, true);
  }

  // ── Description score ─────────────────────────────────────────────────────
  // Weight: 0.30
  //
  // Critical threshold: combined similarity < 0.40 (after synonym normalisation)
  // Soft threshold:     combined similarity 0.40–0.60
  const { score: description_score, reason: descReason } = computeDescScore(normB, normL, b.desc, l.desc);

  if (description_score >= 0.6) {
    reasons.push(descReason);
  } else if (description_score >= 0.4) {
    addW(descReason, false);
  } else {
    addW(descReason, true);
  }

  // OCR artifact note — always soft
  if (
    b.qualityIssues?.some(q => q.toLowerCase().includes("ocr")) ||
    l.qualityIssues?.some(q => q.toLowerCase().includes("ocr"))
  ) {
    addW("OCR artifacts detected — normalized description used for matching", false);
  }

  // Reject pair if amount is completely off and other signals cannot compensate
  if (amount_score === 0.0 && !(description_score >= 0.95 && date_score >= 0.85)) return null;

  const final_score = 0.45 * amount_score + 0.30 * description_score + 0.25 * date_score;
  if (final_score <= 0) return null;

  return {
    ledger: l,
    final_score,
    amount_score,
    date_score,
    description_score,
    reasons,
    warnings,
    criticalWarnings: critW,
    softWarnings: softW,
  };
}
