function makeSummary(stats) {
  const {
    totalBank = 0,
    totalLedger = 0,
    matches = 0,
    missing = 0,
    mismatches = 0,
  } = stats;
  return `${matches}/${totalBank} bank transactions matched. ${missing} missing. ${mismatches} mismatches.`;
}

module.exports = { makeSummary };
