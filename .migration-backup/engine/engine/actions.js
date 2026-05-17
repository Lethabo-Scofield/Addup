function makeAction(type, target_id, reason, priority = "medium") {
  return { type, target_id, reason, priority };
}

function actionsForIssues(items) {
  const out = [];
  for (const it of items) {
    if (it.confidence < 0.5)
      out.push(makeAction("manual_review", it.id, "Low confidence", "high"));
    else if (it.issue === "amount_mismatch") {
      const amtDiff = Math.abs(it.difference.amount || 0);
      const small = Math.abs(it.difference.amount_relative || 0) < 0.05;
      out.push(
        makeAction(
          small ? "suggest_fix" : "manual_review",
          it.id,
          `Amount differs by ${amtDiff}`,
          small ? "low" : "medium",
        ),
      );
    } else if (it.present_in) {
      out.push(
        makeAction("request_data", it.id, "Missing in other source", "medium"),
      );
    }
  }
  return out;
}

module.exports = { makeAction, actionsForIssues };
