import type { Tx, CandidateInternal } from "./types";
import { computeDescScore } from "./similarity";
import { normalizeDesc } from "./normalizer";
import { fmt } from "./utils";

// ── Pair scorer ───────────────────────────────────────────────────────────────
//
// Scores a single (bank, ledger) candidate pair across four dimensions using
// the weights mandated by the product spec:
//
//   Amount       — 45 %   strongest signal
//   Reference    — 25 %   business identifier (cheque no, journal no, etc.)
//   Date         — 15 %
//   Description  — 15 %   fuzzy similarity
//
// Sign convention (see types.ts):
//   Bank   debit (money out)  → negative amt
//   Bank   credit (money in)  → positive amt
//   Ledger Dr (Bank acct)      → positive amt
//   Ledger Cr (Bank acct)      → negative amt
//
// → A correctly reconciled pair has SAME-SIGN amounts. Opposite-sign pairs are
//   penalised as a direction mismatch (critical warning).
//
// Returns null only when the pair is structurally incompatible (e.g. amount
// signs differ and absolute magnitude is also wrong).

const WEIGHT_AMOUNT      = 0.45;
const WEIGHT_REFERENCE   = 0.25;
const WEIGHT_DATE        = 0.15;
const WEIGHT_DESCRIPTION = 0.15;

function normalizeRef(r: string | undefined): string {
  return (r ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function scoreReference(b: Tx, l: Tx, addReason: (m: string) => void, addSoft: (m: string) => void): number {
  const a = normalizeRef(b.reference);
  const c = normalizeRef(l.reference);
  if (!a && !c) {
    // Both missing — neutral; don't reward, don't punish.
    return 0.5;
  }
  if (!a || !c) {
    addSoft("Reference missing on one side");
    return 0.3;
  }
  if (a === c) {
    addReason(`Reference match: "${b.reference}"`);
    return 1.0;
  }
  if (a.includes(c) || c.includes(a)) {
    addReason(`Reference substring match: "${b.reference}" ⇆ "${l.reference}"`);
    return 0.75;
  }
  // Compare common-tail digits (cheque/journal numbers)
  const tailA = a.match(/\d+$/)?.[0] ?? "";
  const tailC = c.match(/\d+$/)?.[0] ?? "";
  if (tailA && tailA === tailC) {
    addReason(`Reference number match (${tailA})`);
    return 0.6;
  }
  addSoft(`References differ: "${b.reference}" vs "${l.reference}"`);
  return 0.0;
}

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
  // With the signed convention, a correct match has same-sign amounts.
  let amount_score: number;
  const absDiff      = Math.abs(b.amt - l.amt);
  const absMagDiff   = Math.abs(Math.abs(b.amt) - Math.abs(l.amt));
  const sameMagnitude = Math.abs(b.amt) > 0.01 && absMagDiff < 0.01;
  const oppositeSign  = sameMagnitude && Math.sign(b.amt) !== Math.sign(l.amt);
  const pct           = Math.abs(b.amt) > 0.01 ? absDiff / Math.abs(b.amt) : (absDiff > 0 ? 1 : 0);

  if (absDiff < 0.01) {
    amount_score = 1.0;
    reasons.push("Exact amount match");
  } else if (oppositeSign) {
    // Direction mismatch — magnitude matches but sign differs. This is a
    // sign-convention error in the data, not a real reconciliation.
    amount_score = 0.30;
    addW("Direction mismatch — same magnitude, opposite sign (check Dr/Cr)", true);
  } else if (pct <= 0.02) {
    amount_score = 0.92;
    reasons.push(`Amount within 2% tolerance (diff: ${fmt(absDiff)})`);
  } else if (pct <= 0.05) {
    amount_score = 0.78;
    reasons.push(`Amount within 5% tolerance (diff: ${fmt(absDiff)})`);
  } else if (pct <= 0.10) {
    amount_score = 0.55;
    addW(`Amount differs by ${fmt(absDiff)} (${Math.round(pct * 100)}%)`, false);
  } else if (pct <= 0.20) {
    amount_score = 0.20;
    addW(`Significant amount difference: ${fmt(absDiff)} (${Math.round(pct * 100)}%)`, false);
  } else {
    amount_score = 0.0;
    addW(`Amount too far apart: ${fmt(absDiff)} (${Math.round(pct * 100)}% difference)`, true);
  }

  // ── Reference score (25 %) ────────────────────────────────────────────────
  const reference_score = scoreReference(b, l, m => reasons.push(m), m => softW.push(m));

  // ── Date score (15 %) ─────────────────────────────────────────────────────
  // Spec tolerance: 0–3 days = strong, ≤7 days = acceptable, >14 days = critical.
  let date_score: number;
  const bMs      = new Date(b.date).getTime();
  const lMs      = new Date(l.date).getTime();
  const daysDiff = isNaN(bMs) || isNaN(lMs) ? Infinity : Math.abs(bMs - lMs) / 86400000;

  if (daysDiff === 0) {
    date_score = 1.0;
    reasons.push("Exact date match");
  } else if (daysDiff <= 1) {
    date_score = 0.92;
    reasons.push(`Date within 1 day (${b.date} vs ${l.date})`);
  } else if (daysDiff <= 3) {
    date_score = 0.80;
    reasons.push(`Date within 3 days (${b.date} vs ${l.date})`);
  } else if (daysDiff <= 7) {
    date_score = 0.55;
    addW(`Date off by ${Math.round(daysDiff)} days: ${b.date} vs ${l.date}`, false);
  } else if (daysDiff <= 14) {
    date_score = 0.30;
    addW(`Date off by ${Math.round(daysDiff)} days`, false);
  } else {
    date_score = 0.0;
    addW(`Dates too far apart: ${Math.round(daysDiff)} days`, true);
  }

  // ── Description score (15 %) ──────────────────────────────────────────────
  const { score: description_score, reason: descReason } =
    computeDescScore(normB, normL, b.desc, l.desc);

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

  // Reject the pair only if amount is completely off AND no other strong signal.
  if (amount_score === 0.0 && reference_score < 0.6 && description_score < 0.95) return null;

  const final_score =
    WEIGHT_AMOUNT      * amount_score +
    WEIGHT_REFERENCE   * reference_score +
    WEIGHT_DATE        * date_score +
    WEIGHT_DESCRIPTION * description_score;

  if (final_score <= 0) return null;

  return {
    ledger: l,
    final_score,
    amount_score,
    reference_score,
    date_score,
    description_score,
    reasons,
    warnings,
    criticalWarnings: critW,
    softWarnings: softW,
  };
}
