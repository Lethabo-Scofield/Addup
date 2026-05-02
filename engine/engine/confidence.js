function clamp(v, a = 0, b = 1) {
  return Math.max(a, Math.min(b, v));
}

function fromMatch(matchType, rawScore = 1) {
  if (matchType === "exact") return clamp(0.95 + 0.05 * rawScore);
  if (matchType === "fuzzy") return clamp(0.6 + 0.3 * rawScore);
  return clamp(rawScore * 0.5);
}

module.exports = { fromMatch, clamp };
