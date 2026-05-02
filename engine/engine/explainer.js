function explainAmount(b, a) {
  const diff = Number(a.amount) - Number(b.amount);
  return `Amounts differ by ${diff}`;
}

function explainDate(b, a) {
  const d1 = new Date(b.date);
  const d2 = new Date(a.date);
  const days = Math.round((d1 - d2) / (24 * 3600 * 1000));
  return `Dates differ by ${Math.abs(days)} day(s)`;
}

function explainDescription(b, a) {
  return `Descriptions differ (bank: "${b.description}", ledger: "${a.description}")`;
}

function ocrQualitySummary(issues) {
  if (!issues || !issues.length) return "OCR looks acceptable";
  return `OCR issues: ${issues.join("; ")}`;
}

module.exports = {
  explainAmount,
  explainDate,
  explainDescription,
  ocrQualitySummary,
};
