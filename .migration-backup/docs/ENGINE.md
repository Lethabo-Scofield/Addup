# Reconciliation Engine

**Location:** `artifacts/addup/src/engine/`

This document is the authoritative reference for the matching algorithm. Read `KNOWN_ISSUES.md` alongside it.

---

## File map

| File | Responsibility |
|---|---|
| `types.ts` | All TypeScript interfaces — Tx, ReconRow, Candidate, etc. |
| `normalizer.ts` | Synonym table, `normalizeDesc`, `hasOcrArtifacts` |
| `similarity.ts` | `jaroWinkler`, `tokenSim`, `computeDescScore` |
| `parser.ts` | CSV/XLSX parsing, date normalisation, `csvToTx` |
| `matcher.ts` | `scorePair` — scores a single (bank, ledger) pair |
| `reconciliation.ts` | `runReconciliation` — orchestrates the full job |
| `utils.ts` | `fmt`, `fmtDate`, `STATUS_CFG`, `ACTION_LABELS` |
| `index.ts` | Re-exports everything for use by the UI |

---

## Step 1 — Parse

`parser.ts: csvToTx(rows, prefix)`

Each raw row is validated and converted to a `Tx` object:

```typescript
interface Tx {
  id: string;           // e.g. "B001", "L003"
  date: string;         // ISO-8601 "YYYY-MM-DD"
  desc: string;         // raw description (kept for display)
  amt: number;          // signed amount in ZAR
  normalizedDesc: string; // canonical form, used for comparison
  qualityStatus: "valid" | "warning" | "invalid";
  qualityIssues: string[];
}
```

**Hard invalids** (row excluded from matching):
- Missing or unparseable date
- Year outside 2025-2027
- Missing amount
- Amount is zero or NaN
- Description empty after normalisation

**Soft warnings** (row matched, warning shown):
- OCR artifacts in description
- Duplicate signature (same date + amount + normalised desc)

---

## Step 2 — Normalise descriptions

`normalizer.ts: normalizeDesc(raw)`

Pipeline:

1. Lowercase and trim
2. Strip OCR artefacts: pipes, brackets, multiple spaces, ellipses
3. Strip non-alphanumeric characters
4. Synonym lookup (exact, prefix/suffix, substring, token overlap >= 80%)
5. Strip trailing 1-2 digit counter suffixes

**Example:**

```
"SAL APR PAY"           -> "salary payment"
"INTERNET SUB APR"      -> "internet subscription"
"BANK FEE"              -> "bank charges"
"STATIONERY PURCHASE"   -> "office supplies"
```

Synonym keys are matched longest-first to avoid partial collisions.

---

## Step 3 — Score pairs

`matcher.ts: scorePair(bank, ledger) -> CandidateInternal | null`

Every valid bank transaction is scored against every valid ledger entry. Returns `null` if the pair is too dissimilar.

### Amount score (weight 0.45)

| Condition | Score | Classification |
|---|---|---|
| Exact match (diff < R 0.01) | 1.00 | - |
| Opposite sign, same absolute amount | 0.75 | CRITICAL |
| Within 2% | 0.90 | - |
| Within 5% | 0.82 | - |
| Within 10% | 0.70 | soft warning |
| Within 15% | 0.55 | soft warning |
| Within 20% | 0.35 | soft warning |
| More than 20% different | 0.00 | CRITICAL |

### Date score (weight 0.25)

| Condition | Score | Classification |
|---|---|---|
| Same day | 1.00 | - |
| 1 day apart | 0.95 | - |
| 2-3 days apart | 0.88 | - |
| 4-7 days apart | 0.72 | soft warning |
| 8-10 days apart | 0.55 | soft warning |
| 11-14 days apart | 0.38 | soft warning |
| More than 14 days apart | 0.00 | CRITICAL |

### Description score (weight 0.30)

Computed by `similarity.ts: computeDescScore(normA, normB, rawA, rawB)`.

Uses `max(jaroWinkler(normA, normB), tokenSim(normA, normB))`.

| Combined similarity | Score | Classification |
|---|---|---|
| normA === normB | 0.95 - 1.00 | - |
| >= 90% | 0.80 | - |
| >= 70% | 0.60 | soft warning |
| >= 50% | 0.35 | soft warning |
| < 50% | 0.00 | CRITICAL if < 40% |

### Final score

```
final_score = 0.45 * amount_score + 0.30 * description_score + 0.25 * date_score
```

Pairs with `final_score <= 0` are discarded.

---

## Step 4 — Assign

`reconciliation.ts: runReconciliation(bank[], ledger[])`

**Greedy best-first assignment:**

1. Score all B x L pairs.
2. Sort bank transactions by their highest-scoring available candidate.
3. Assign the best available ledger entry to each bank transaction in order.
4. Each ledger entry can only be used once.

**Complexity:** O(B x L) scoring + O(B log B) sorting.

---

## Step 5 — Classify

After assignment, each row is classified:

```
MATCHED        final >= 0.75  AND  amtPct <= 10%  AND  dateDiff <= 7d  AND  no critical warnings
POSSIBLE MATCH final >= 0.60  AND  no critical warnings
               OR final >= 0.70  AND  no critical warnings  (force-upgrade)
MANUAL REVIEW  final 0.40 - 0.60  OR  any critical warning
UNMATCHED      best candidate final < 0.40  OR  no candidates
```

**Critical warnings block auto-match and possible_match.**

---

## Step 6 — Competing candidates

If the best and second-best scores are within 0.05 of each other:
- Gap < 0.05 AND not clearly better (gap < 0.08): CRITICAL "duplicate candidate conflict"
- Just close but clearly best selected: soft warning

---

## Outputs

```typescript
interface ReconRow {
  id: string;
  status: "matched" | "possible_match" | "manual_review" | "invalid_row" | "unmatched_bank" | "unmatched_ledger";
  bank?: Tx;
  ledger?: Tx;
  confidence: number;          // 0-100 (final_score * 100)
  dateDiff: number;            // days
  amtDiff: number;             // absolute difference in ZAR
  descSim: number;             // description_score [0,1]
  reasons: string[];           // positive signals
  warnings: string[];          // all warnings
  criticalWarnings: string[];  // blocks auto-classification
  softWarnings: string[];      // informational
  scoreBreakdown: ScoreBreakdown;
  candidates: Candidate[];     // top 3 alternatives
}
```
