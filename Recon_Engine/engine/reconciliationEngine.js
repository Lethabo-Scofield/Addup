const { fromMatch } = require("./confidence");
const explainer = require("./explainer");
const summaryGen = require("./summary");
const actions = require("./actions");
const insights = require("./insights");
const config = require("./config.json");
const pino = require("pino")();

function tokens(s) {
  return String(s || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}
function tokenScore(a, b) {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.length || !tb.length) return 0;
  const setb = new Set(tb);
  let common = 0;
  for (const t of ta) if (setb.has(t)) common++;
  return common / Math.max(ta.length, tb.length);
}
function daysDiff(a, b) {
  const da = new Date(a);
  const db = new Date(b);
  if (isNaN(da) || isNaN(db)) return 9999;
  return Math.round((da - db) / (24 * 3600 * 1000));
}

function runEngine(job) {
  const out = {
    status: "completed",
    summary: "",
    confidence: 0,
    results: { matches: [], mismatches: [], missing: [] },
    insights: [],
    actions: [],
    audit_log: [],
  };
  const bank =
    (job.result && job.result.bank && job.result.bank.transactions) || [];
  const ledger =
    (job.result && job.result.ledger && job.result.ledger.transactions) || [];

  // OCR quality checks (if ledger appears OCRed)
  pino.info({ job: job && job.state }, "Starting reconciliation engine");
  let invalidDates = 0,
    unrealistic = 0;
  for (const l of ledger) {
    if (!l.date || isNaN(new Date(l.date).getTime())) invalidDates++;
    if (Math.abs(Number(l.amount) || 0) > 1e7) unrealistic++;
  }
  const ocrIssues = [];
  if (ledger.length && invalidDates / ledger.length > 0.4)
    ocrIssues.push("many_invalid_dates");
  if (ledger.length && unrealistic > 0) ocrIssues.push("unrealistic_amounts");
  if (ocrIssues.length) {
    out.status = "failed";
    out.summary = "OCR data quality too low for reconciliation";
    out.confidence = 0.0;
    out.insights.push({
      type: "ocr",
      message: ocrIssues.join(", "),
      confidence: 0.2,
    });
    out.audit_log.push({
      timestamp: new Date().toISOString(),
      event: "reconciliation_run",
      details: {
        records_processed: bank.length + ledger.length,
        matches_found: 0,
      },
    });
    return out;
  }

  // Matching
  const ledgerAvail = new Set(ledger.map((t) => t.id));
  const matches = [];
  for (const b of bank) {
    let found = null,
      matchType = null,
      rawScore = 1;
    // exact amount & date
    for (const l of ledger)
      if (ledgerAvail.has(l.id)) {
        if (
          Number(l.amount) === Number(b.amount) &&
          daysDiff(l.date, b.date) === 0
        ) {
          found = l;
          matchType = "exact";
          rawScore = 1;
          break;
        }
      }
    // amount match within 1 day
    if (!found)
      for (const l of ledger)
        if (ledgerAvail.has(l.id)) {
          if (
            Number(l.amount) === Number(b.amount) &&
            Math.abs(daysDiff(l.date, b.date)) <= 1
          ) {
            found = l;
            matchType = "fuzzy";
            rawScore = 0.8;
            break;
          }
        }
    // amount match only
    if (!found)
      for (const l of ledger)
        if (ledgerAvail.has(l.id)) {
          if (Number(l.amount) === Number(b.amount)) {
            found = l;
            matchType = "fuzzy";
            rawScore = 0.6;
            break;
          }
        }
    if (found) {
      ledgerAvail.delete(found.id);
      const conf = fromMatch(matchType, rawScore);
      matches.push({
        id: `${b.id}::${found.id}`,
        source_a: b.id,
        source_b: found.id,
        match_type: matchType || "fuzzy",
        confidence: conf,
        bank: b,
        ledger: found,
      });
    }
  }

  // Unmatched
  const matchedBankIds = new Set(matches.map((m) => m.source_a));
  const matchedLedgerIds = new Set(matches.map((m) => m.source_b));
  const unmatchedBank = bank.filter((b) => !matchedBankIds.has(b.id));
  const unmatchedLedger = ledger.filter((l) => !matchedLedgerIds.has(l.id));

  // Mismatches for matched pairs
  const mismatches = [];
  for (const m of matches) {
    const b = m.bank,
      l = m.ledger;
    // amount mismatch
    const amountDiff = Number(b.amount) - Number(l.amount);
    const amountRel =
      Math.abs(amountDiff) / Math.max(1, Math.abs(Number(l.amount) || 1));
    if (Math.abs(amountDiff) > 0.0001) {
      mismatches.push({
        id: m.id,
        issue: "amount_mismatch",
        difference: { amount: amountDiff, amount_relative: amountRel },
        explanation: explainer.explainAmount(b, l),
        confidence: Math.max(0, m.confidence - amountRel),
      });
    }
    const dateDelta = Math.abs(daysDiff(b.date, l.date));
    if (dateDelta > 2) {
      mismatches.push({
        id: m.id,
        issue: "date_mismatch",
        difference: { days: dateDelta },
        explanation: explainer.explainDate(b, l),
        confidence: m.confidence - dateDelta / 30,
      });
    }
    const descSim = tokenScore(b.description, l.description);
    if (descSim < 0.4) {
      mismatches.push({
        id: m.id,
        issue: "description_mismatch",
        difference: { similarity: descSim },
        explanation: explainer.explainDescription(b, l),
        confidence: m.confidence * descSim,
      });
    }
  }

  // Build results
  out.results.matches = matches.map((m) => ({
    id: m.id,
    source_a: m.source_a,
    source_b: m.source_b,
    match_type: m.match_type,
    confidence: Number(m.confidence.toFixed(3)),
  }));
  out.results.mismatches = mismatches.map((mm) => ({
    id: mm.id,
    issue: mm.issue,
    difference: mm.difference,
    explanation: mm.explanation,
    confidence: Number((mm.confidence || 0).toFixed(3)),
  }));
  out.results.missing = [];
  for (const b of unmatchedBank)
    out.results.missing.push({
      id: b.id,
      present_in: "bank",
      expected_in: "ledger",
      confidence: 0.0,
      explanation: "No reliable match found",
    });
  for (const l of unmatchedLedger)
    out.results.missing.push({
      id: l.id,
      present_in: "ledger",
      expected_in: "bank",
      confidence: 0.0,
      explanation: "No reliable match found",
    });

  // Insights
  out.insights = insights.detectPatterns(
    out.results.mismatches,
    out.results.missing,
  );

  // Actions
  out.actions = actions.actionsForIssues(
    [].concat(out.results.mismatches, out.results.missing),
  );

  // Summary
  const stats = {
    totalBank: bank.length,
    totalLedger: ledger.length,
    matches: matches.length,
    missing: out.results.missing.length,
    mismatches: out.results.mismatches.length,
  };
  out.summary = summaryGen.makeSummary(stats);
  out.confidence = out.results.matches.length
    ? out.results.matches.reduce((s, m) => s + m.confidence, 0) /
      out.results.matches.length
    : 0;

  out.audit_log.push({
    timestamp: new Date().toISOString(),
    event: "reconciliation_run",
    details: {
      records_processed: bank.length + ledger.length,
      matches_found: matches.length,
    },
  });

  // status
  if (out.results.matches.length === 0 && out.results.missing.length > 0)
    out.status = "partial";
  if (out.results.missing.length === 0 && out.results.mismatches.length === 0)
    out.status = "completed";

  return out;
}

module.exports = { runEngine };
