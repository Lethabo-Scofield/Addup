const fs = require("fs");
const path = require("path");
const engine = require("../engine/reconciliationEngine");

const JOB_ID = process.argv[2] || "rec_20260429235945_001";
const DB = path.join(__dirname, "..", "db", "jobs.json");
if (!fs.existsSync(DB)) {
  console.error("jobs.json not found");
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(DB, "utf8"));
const job = data[JOB_ID];
if (!job) {
  console.error("job not found:", JOB_ID);
  process.exit(1);
}

const result = engine.runEngine(job);
console.log(JSON.stringify(result, null, 2));
process.exit(0);
