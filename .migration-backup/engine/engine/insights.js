function detectPatterns(mismatches, missing) {
  const vendorCounts = {};
  for (const m of mismatches) {
    const key = (
      m.vendor ||
      (m.record && m.record.description) ||
      ""
    ).toLowerCase();
    if (!key) continue;
    vendorCounts[key] = (vendorCounts[key] || 0) + 1;
  }
  const patterns = [];
  for (const k of Object.keys(vendorCounts)) {
    if (vendorCounts[k] > 1)
      patterns.push({
        type: "pattern",
        message: `Multiple mismatches for vendor: ${k}`,
        confidence: 0.8,
      });
  }
  return patterns;
}

module.exports = { detectPatterns };
