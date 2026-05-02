const fs = require("fs");
const path = require("path");
const Tesseract = require("tesseract.js");
const service = require("../dist/services/reconciliation.service");
const stateStorePath = path.join(__dirname, "..", "db", "jobs.json");
const engine = require("../engine/reconciliationEngine");

async function ocrToCsvText(imgPath) {
  const {
    data: { text },
  } = await Tesseract.recognize(imgPath, "eng");
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  // Heuristic: if lines contain commas assume CSV-like; else try split by two or more spaces
  const csvLines = [];
  for (const l of lines) {
    if (l.includes(",")) csvLines.push(l);
    else {
      const parts = l
        .split(/\s{2,}/)
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length >= 3) csvLines.push(parts.join(","));
    }
  }
  // fallback: join lines as single column
  if (!csvLines.length)
    csvLines.push(
      ...lines.map(
        (l) => `description
${l}`,
      ),
    );
  return csvLines.join("\n");
}

async function main() {
  const bankPath = path.join(__dirname, "..", "bank.csv");
  const ledgerCsvPath = path.join(__dirname, "..", "ledger.csv");
  const ledgerPngPath = path.join(__dirname, "..", "ledger.png");
  if (!fs.existsSync(bankPath)) {
    console.error("bank.csv not found");
    process.exit(1);
  }

  let ledgerBuffer;
  if (fs.existsSync(ledgerCsvPath)) {
    ledgerBuffer = fs.readFileSync(ledgerCsvPath);
  } else if (fs.existsSync(ledgerPngPath)) {
    console.log("No ledger.csv found — running OCR on ledger.png");
    const csvText = await ocrToCsvText(ledgerPngPath);
    ledgerBuffer = Buffer.from(csvText);
    // also write to ledger.csv for inspection
    try {
      fs.writeFileSync(ledgerCsvPath, csvText);
    } catch (e) {}
  } else {
    console.error("No ledger source found (ledger.csv or ledger.png)");
    process.exit(1);
  }

  const bankBuffer = fs.readFileSync(bankPath);
  const bankFile = {
    buffer: bankBuffer,
    originalname: "bank.csv",
    mimetype: "text/csv",
  };
  const ledgerFile = {
    buffer: ledgerBuffer,
    originalname: "ledger.csv",
    mimetype: "text/csv",
  };

  console.log("Calling processUpload service...");
  const res = await service.processUpload(bankFile, ledgerFile);
  if (res && res.job_id) {
    // reload job from jobs.json
    const jobs = JSON.parse(fs.readFileSync(stateStorePath, "utf8"));
    const job = jobs[res.job_id];
    if (!job) {
      console.error("Job not found after upload");
      process.exit(1);
    }
    const engineRes = engine.runEngine(job);
    console.log(JSON.stringify(engineRes, null, 2));
    process.exit(0);
  } else {
    console.error("Upload failed:", res);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
