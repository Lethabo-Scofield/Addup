# Known Issues and Engineering Debt

**Status:** Active / unresolved as of May 2026
**Audience:** Engineers picking up this codebase

This document explains why the reconciliation engine still over-classifies transactions into **Manual Review** and what needs to change. Read `docs/ENGINE.md` first for the algorithm context.

---

## Summary

The engine works but is conservative: it consistently produces more Manual Review results than it should. The root causes are listed below in priority order. Fixing issues 1 and 2 would resolve the majority of user-facing complaints.

---

## Issue 1 — Synonym table is too small (HIGHEST PRIORITY)

**File:** `src/engine/normalizer.ts`

**Problem:**

The synonym map has ~20 entries covering only the demo dataset. Any bank description not in the table falls through to character-level similarity, which fails badly on banking abbreviations.

Real bank statements use hundreds of shorthand patterns. Examples that currently break:
- `"SAL PMT"` does not match `"salary payment"` (not in table)
- `"TRF OUT"` does not match `"transfer savings"` (not in table)
- `"MONTHLY CHRG"` does not match `"bank charges"` (not in table)
- `"INET SVC"` does not match `"internet subscription"` (not in table)

When normalisation fails, `computeDescScore` receives two completely different strings and returns `score = 0.0`, which is classified as CRITICAL. This blocks matching even when amount and date are exact.

**Fix options (in order of effort):**

A. Expand the synonym table manually as new bank formats are encountered. Low effort, does not scale.

B. Replace the table with a learned embedding similarity. Embed all descriptions using a small model (e.g., `all-MiniLM-L6-v2` via a local worker or an API call), cache embeddings, and use cosine similarity instead of string matching. Threshold around 0.75 cosine similarity as a "match". This solves the abbreviation problem permanently.

C. Short-term fix: lower the CRITICAL threshold for description from `score < 0.40` to `score < 0.20`. This means descriptions that score 0.35 (weak similarity) would become a soft warning instead of a critical one. By itself this would unlock many pairs that currently land in Manual Review. See Issue 3 below for why the threshold exists at 0.40.

---

## Issue 2 — Critical warning from description blocks everything (HIGH PRIORITY)

**File:** `src/engine/matcher.ts`, lines around `description_score >= 0.4`

**Problem:**

When `computeDescScore` returns `score < 0.40`, it is classified as CRITICAL. A critical warning on ANY dimension blocks both `matched` and `possible_match`:

```typescript
const isMatched         = ... && !hasCritical;
const forceUpgradeToPossible = ... && !hasCritical;
const isPossible        = ... && !hasCritical;
```

This means a pair with an exact amount and same-day date, where only the description differs (e.g., bank abbreviation vs full ledger text), is forced into Manual Review regardless of how good the other signals are.

**Fix:**

Make critical description warnings downgrade from `matched` to `possible_match` but not all the way to `manual_review`. The description signal should be able to be outweighed by strong amount + date agreement.

Concrete change:

```typescript
// Instead of a single hasCritical boolean, track per-dimension:
const hasCriticalAmount = criticalWarnings.some(w => w.includes("amount") || w.includes("sign"));
const hasCriticalDate   = criticalWarnings.some(w => w.includes("days") || w.includes("date"));
const hasCriticalDesc   = criticalWarnings.some(w => w.includes("description") || w.includes("match"));

// Only block matched if amount or date is critical
const isMatched = score >= 0.75 && amtPct <= 0.10 && dateDiff <= 7 && !hasCriticalAmount && !hasCriticalDate;

// Description critical degrades to possible_match, not manual_review
const isPossible = (score >= 0.60 && !hasCriticalAmount && !hasCriticalDate)
                || (score >= 0.55 && hasCriticalDesc && !hasCriticalAmount && !hasCriticalDate);
```

---

## Issue 3 — Description score ladder is too coarse

**File:** `src/engine/similarity.ts`, `computeDescScore`

**Problem:**

`computeDescScore` returns one of only 5 discrete values: 1.0, 0.95, 0.80, 0.60, 0.35, 0.0. There is no gradient. This makes the classification very sensitive to which bucket a pair falls into.

For example, two strings with 68% character similarity get score 0.60 (possible_match territory) while two strings with 69% similarity get the same 0.60. But strings at 69% that look alike to a human eye may still be forced to manual_review due to other factors.

More importantly: the gap between 0.35 and 0.60 has no intermediate bucket. A pair at 55% similarity jumps from 0.35 (soft warning, might still match) but the combination with other scores may be enough. The problem is that 0.35 triggers the CRITICAL path when `description_score < 0.40`.

**Fix:**

Add a score value at 0.50 for the 50-70% combined similarity range and move the critical threshold to 0.25:

```typescript
if (combined >= 0.90) return { score: 0.80, reason: "Strong similarity" };
if (combined >= 0.70) return { score: 0.60, reason: "Moderate similarity" };
if (combined >= 0.50) return { score: 0.50, reason: "Partial similarity" };
if (combined >= 0.30) return { score: 0.25, reason: "Weak similarity" };
return { score: 0.0, reason: "Descriptions do not match" };
```

And in `matcher.ts` change the critical threshold:
```typescript
} else if (description_score >= 0.25) {
  addW(descReason, false); // soft, not critical
} else {
  addW(descReason, true);  // critical only when < 0.25
}
```

---

## Issue 4 — Greedy assignment is suboptimal for dense datasets

**File:** `src/engine/reconciliation.ts`

**Problem:**

The engine uses a greedy first-pick strategy: bank transactions are sorted by their best score and assigned in order. Once a ledger entry is taken, it cannot be re-assigned.

This produces locally optimal but globally suboptimal assignments. If bank transaction A scores 0.80 against ledger entry X, and bank transaction B scores 0.79 against X and 0.75 against Y, greedy assigns A to X and B to Y. But if B would be a better overall fit for X and A could match Y at 0.78, the global optimum is different.

For typical month-end reconciliation (50-200 transactions) the difference is small. For high-volume clients (1000+ transactions) this degrades match rates noticeably.

**Fix:**

Implement the Hungarian algorithm (also known as the Kuhn-Munkres algorithm) for optimal bipartite assignment. A good JavaScript implementation exists in the `munkres-js` package. Replace the greedy sort + assign loop with a cost matrix and the optimal assignment.

Note: Hungarian runs in O(n^3). For large datasets, chunk into time windows (e.g., match by month-week) before running the algorithm.

---

## Issue 5 — Column header detection is fragile

**File:** `src/engine/parser.ts`, `csvToTx`

**Problem:**

Column headers are detected by regex:
```typescript
const dateKey  = find(/date/i, /period/i);
const descKey  = find(/desc/i, /narr/i, /particular/i, /detail/i, /memo/i, /reference/i);
const amtKey   = find(/^amount$/i, /^amt$/i, /^value$/i, /transaction.amount/i);
```

Many real-world bank exports use non-standard headers:
- Standard Bank: `"Transaction Date"` (matches), `"Tran Desc"` (matches), `"Transaction Amount"` (fails)
- ABSA: `"Posting Date"` (fails), `"Statement Description"` (matches), `"Transaction Amount"` (fails)
- Nedbank: `"Date"` (matches), `"Description"` (matches), `"Debit Amount"` + `"Credit Amount"` (matches debit/credit split)
- FNB: `"Date"` (matches), `"Description"` (matches), `"Amount"` (matches)

The `amtKey` regex `^amount$` (exact match, case-insensitive) correctly catches `"Amount"` but misses `"Transaction Amount"`. The pattern `transaction.amount` uses `.` which in regex matches any character — this is a bug and should be `transaction[.\s]amount` or similar.

**Fix:**

Widen the amount column regex and add more South African bank header patterns:
```typescript
const amtKey = find(/^amount$/i, /^amt$/i, /^value$/i, /transaction[\s.]amount/i, /rand[\s.]amount/i, /amount[\s.]r/i);
```

Add integration tests with real sample exports from Standard Bank, ABSA, Nedbank, and FNB.

---

## Issue 6 — No unit tests on the engine

**Problem:**

The entire engine module has zero automated tests. Threshold changes, synonym additions, and scoring modifications are tested only by loading the app and uploading sample files by hand.

This makes regressions invisible and threshold tuning unreliable.

**Fix:**

Add a Vitest test suite at `artifacts/addup/src/engine/__tests__/`. Priority test cases:

1. `normalizeDesc` — synonym coverage, OCR stripping, digit suffix removal
2. `scorePair` — exact matches, direction mismatch, large date gaps
3. `runReconciliation` — known-good CSV pairs, duplicate conflicts, unmatched rows
4. `csvToTx` — invalid rows, debit/credit split, missing columns

A minimal test harness:
```bash
pnpm --filter @workspace/addup run test
```

---

## Issue 7 — force-upgrade rule is a patch, not a principled fix

**File:** `src/engine/reconciliation.ts`

**Problem:**

```typescript
const forceUpgradeToPossible = best.final_score >= 0.70 && !hasCritical;
```

This rule exists because `isPossible` (score >= 0.60, no critical) and `isMatched` (score >= 0.75) left a gap at 0.60-0.75 where pairs with no critical warnings but moderate scores landed in Manual Review. The force-upgrade closes that gap but is logically redundant: if `forceUpgradeToPossible` is true then `isPossible` is also true (0.70 >= 0.60). The rule is dead code.

The original intent was to upgrade pairs at 0.70-0.75 from manual to possible. But since `isPossible` already covers >= 0.60, `forceUpgradeToPossible` never adds anything.

**Fix:**

Remove `forceUpgradeToPossible` and its condition from `runReconciliation`. If a gap in the 0.60-0.75 range needs separate handling, introduce a distinct `LIKELY_MATCH` status between `possible_match` and `matched`.

---

## Issue 8 — No persistence for reconciliation jobs

**Problem:**

All job data lives in React state. Closing the browser tab loses all work. There is no save-and-resume.

**Fix:**

Add a `jobs` table to the database schema. Save the `ReconRow[]` output as JSON on job creation. Load it back on the jobs page.

This requires:
- A `POST /api/jobs` endpoint to save a job
- A `GET /api/jobs` and `GET /api/jobs/:id` endpoint to retrieve
- A `jobs` Drizzle schema table
- The frontend to call the API after `runReconciliation` completes

---

## Quick reference — what to fix first

| Priority | Issue | Effort | Impact |
|---|---|---|---|
| 1 | Expand synonym table | Low | High |
| 2 | Per-dimension critical handling | Medium | High |
| 3 | Lower description critical threshold | Low | Medium |
| 4 | Add unit tests | Medium | High (risk reduction) |
| 5 | Hungarian assignment | High | Low for small datasets |
| 6 | Column header detection | Low | Medium |
| 7 | Remove dead force-upgrade rule | Low | Low (cleanup) |
| 8 | Job persistence | High | High (user-facing) |
