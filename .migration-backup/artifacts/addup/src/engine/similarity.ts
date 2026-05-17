// ── String similarity algorithms ──────────────────────────────────────────────
//
// Used by computeDescScore to compare two normalized descriptions.
// Both algorithms operate on the normalized (post-synonym-lookup) forms.
//
// ENGINEERS: See docs/KNOWN_ISSUES.md §3 for known weaknesses here.

/**
 * Jaro-Winkler similarity — good for short strings with character transpositions.
 * Returns a value in [0, 1] where 1 = identical.
 */
export function jaroWinkler(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  const l1 = s1.length, l2 = s2.length;
  if (l1 === 0 || l2 === 0) return 0.0;

  const matchDist = Math.max(Math.floor(Math.max(l1, l2) / 2) - 1, 0);
  const m1 = new Array(l1).fill(false);
  const m2 = new Array(l2).fill(false);
  let matches = 0;

  for (let i = 0; i < l1; i++) {
    const lo = Math.max(0, i - matchDist);
    const hi = Math.min(i + matchDist + 1, l2);
    for (let j = lo; j < hi; j++) {
      if (m2[j] || s1[i] !== s2[j]) continue;
      m1[i] = m2[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  let trans = 0, k = 0;
  for (let i = 0; i < l1; i++) {
    if (!m1[i]) continue;
    while (!m2[k]) k++;
    if (s1[i] !== s2[k]) trans++;
    k++;
  }

  const jaro = (matches / l1 + matches / l2 + (matches - trans / 2) / matches) / 3;
  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(l1, l2)); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}

/**
 * Token (word) overlap — good for descriptions where word order differs.
 * Returns |intersection| / |union| (Jaccard-like on word sets).
 */
export function tokenSim(a: string, b: string): number {
  const wa = new Set(a.split(/\s+/).filter(Boolean));
  const wb = new Set(b.split(/\s+/).filter(Boolean));
  if (wa.size === 0 && wb.size === 0) return 1;
  if (wa.size === 0 || wb.size === 0) return 0;
  let common = 0;
  wa.forEach(w => { if (wb.has(w)) common++; });
  return common / Math.max(wa.size, wb.size);
}

/**
 * Combined description score.
 *
 * Takes the maximum of Jaro-Winkler and token overlap on the NORMALIZED
 * descriptions, then maps to a discrete score used by the matcher:
 *
 *   Normalized match (same canonical category)  → 0.95 – 1.0
 *   combined >= 0.90                            → 0.80
 *   combined >= 0.70                            → 0.60
 *   combined >= 0.50                            → 0.35  (soft warning)
 *   combined < 0.50                             → 0.00  (critical if < 0.40)
 *
 * ENGINEERS: The discrete buckets are a known limitation — see KNOWN_ISSUES.md §3.
 */
export function computeDescScore(
  normA: string,
  normB: string,
  rawA: string,
  rawB: string,
): { score: number; reason: string } {
  if (normA === normB) {
    const changed =
      normA !== rawA.toLowerCase().trim() || normB !== rawB.toLowerCase().trim();
    return {
      score: changed ? 0.95 : 1.0,
      reason: changed
        ? `Normalized description match: "${normA}"`
        : "Exact description match",
    };
  }

  const combined = Math.max(jaroWinkler(normA, normB), tokenSim(normA, normB));

  if (combined >= 0.90)
    return { score: 0.80, reason: `Strong description similarity (${Math.round(combined * 100)}%)` };
  if (combined >= 0.70)
    return { score: 0.60, reason: `Moderate description similarity (${Math.round(combined * 100)}%)` };
  if (combined >= 0.50)
    return { score: 0.35, reason: `Weak description similarity (${Math.round(combined * 100)}%)` };

  return { score: 0.0, reason: "Descriptions do not match" };
}
