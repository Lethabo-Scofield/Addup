const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const Tesseract = require("tesseract.js");

function normalizeDate(s) {
  if (!s) return "";
  s = String(s).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const m2 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m2) {
    const dd = String(m2[1]).padStart(2, "0");
    const mm = String(m2[2]).padStart(2, "0");
    const yyyy = m2[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return "";
}

const JOB_ID = process.argv[2] || "rec_20260429235945_001";
const IMG = path.join(__dirname, "..", "ledger.png");
const DB = path.join(__dirname, "..", "db", "jobs.json");

if (!fs.existsSync(IMG)) {
  console.error("ledger.png not found at", IMG);
  process.exit(1);
}
if (!fs.existsSync(DB)) {
  console.error("db/jobs.json not found at", DB);
  process.exit(1);
}

console.log("Starting OCR on", IMG);
Tesseract.recognize(IMG, "eng", {
  logger: (m) => {
    /* silent or show progress */
  },
})
  .then(({ data: { text } }) => {
    console.log("OCR complete — parsing text...");
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const txns = [];
    // Heuristic: each line that contains a date and an amount is a txn
    const dateRe =
      /(\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{1,2}\s+[A-Za-z]{3}\s+\d{4})/;
    const amtRe = /(-?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2}))/;
    let idCounter = 1;
    for (const line of lines) {
      const dmatch = line.match(dateRe);
      const amatch = line.match(amtRe);
      if (dmatch && amatch) {
        const date = normalizeDate(dmatch[0]);
        // amount: remove thousand separators
        let amt = amatch[0].replace(/,/g, "");
        amt = parseFloat(amt);
        // description: remove date and amount from line
        let desc = line.replace(dmatch[0], "").replace(amatch[0], "").trim();
        if (!desc) desc = "OCR transaction";
        const txn = {
          id: `ocr_${String(idCounter++).padStart(4, "0")}`,
          source: "ledger_ocr",
          date,
          description: desc,
          amount: Number.isNaN(amt) ? 0 : amt,
          reference: "",
          raw_row: { text: line },
        };
        txns.push(txn);
      }
    }

    if (!txns.length) {
      console.error(
        "No transactions parsed from OCR output. Raw text:\n",
        text.slice(0, 1000),
      );
      process.exit(1);
    }

    // Load DB and update job ledger
    const db = JSON.parse(fs.readFileSync(DB, "utf8"));
    if (!db[JOB_ID]) {
      console.error("job not found:", JOB_ID);
      process.exit(1);
    }
    db[JOB_ID].result = db[JOB_ID].result || {};
    db[JOB_ID].result.ledger = db[JOB_ID].result.ledger || {};
    db[JOB_ID].result.ledger.transactions = txns;
    db[JOB_ID].result.ledger.schema = [
      "date",
      "description",
      "amount",
      "reference",
    ];
    db[JOB_ID].result.ledger.issues = [];

    fs.writeFileSync(DB, JSON.stringify(db, null, 2), "utf8");
    console.log(
      `Wrote ${txns.length} OCR transactions into job ${JOB_ID} in db/jobs.json`,
    );

    // run reconcile
    console.log("\nRunning reconciliation report...\n");
    exec(
      `node "${path.join(__dirname, "reconcile.js")}" ${JOB_ID}`,
      (err, stdout, stderr) => {
        if (err) console.error("reconcile error:", err);
        if (stderr) process.stderr.write(stderr);
        process.stdout.write(stdout);
      },
    );
  })
  .catch((err) => {
    console.error("OCR failed:", err);
    process.exit(1);
  });
