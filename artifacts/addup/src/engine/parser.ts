import * as XLSX from "xlsx";
import type { Tx, QualityStatus } from "./types";
import { hasOcrArtifacts, normalizeDesc } from "./normalizer";

// ── Delimiter detection ───────────────────────────────────────────────────────

export function detectDelimiter(firstLine: string): string {
  const tabs   = (firstLine.match(/\t/g)  || []).length;
  const semis  = (firstLine.match(/;/g)   || []).length;
  const pipes  = (firstLine.match(/\|/g)  || []).length;
  const commas = (firstLine.match(/,/g)   || []).length;
  const max = Math.max(tabs, semis, pipes, commas);
  if (max === 0) return ",";
  if (tabs   === max) return "\t";
  if (semis  === max) return ";";
  if (pipes  === max) return "|";
  return ",";
}

export function splitDelimLine(line: string, delim: string): string[] {
  if (delim !== ",") return line.split(delim).map(v => v.trim().replace(/^"|"$/g, ""));
  const result: string[] = [];
  let cur = "", inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; }
    else if (ch === "," && !inQ) { result.push(cur); cur = ""; }
    else { cur += ch; }
  }
  result.push(cur);
  return result.map(v => v.trim().replace(/^"|"$/g, ""));
}

export function parseDelimitedText(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const delim   = detectDelimiter(lines[0]);
  const headers = splitDelimLine(lines[0], delim);
  return lines.slice(1).map(line => {
    const vals = splitDelimLine(line, delim);
    return Object.fromEntries(headers.map((h, i) => [h.trim(), vals[i] ?? ""]));
  });
}

export function parseCSVText(text: string): Record<string, string>[] {
  return parseDelimitedText(text);
}

export function xlsxToRows(buffer: ArrayBuffer): Record<string, string>[] {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "", raw: false });
}

// ── Date normalizer ───────────────────────────────────────────────────────────

export function normalizeDate(raw: string): string {
  if (!raw) return "";
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  const mdy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
  const d = new Date(s);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

// ── CSV/XLSX → Tx[] ───────────────────────────────────────────────────────────
//
// Converts raw row objects (from CSV or XLSX) into typed Tx records.
// Applies quality checks and marks rows as valid / warning / invalid.
//
// ENGINEERS: Column detection uses regex heuristics — see docs/KNOWN_ISSUES.md §1
// for limitations when customer files use non-standard column headers.

export function csvToTx(
  rows: Record<string, string>[],
  prefix: string,
): { txns: Tx[]; invalid: Tx[] } {
  if (!rows.length) return { txns: [], invalid: [] };

  const keys    = Object.keys(rows[0]);
  const find    = (...pats: RegExp[]) => keys.find(k => pats.some(p => p.test(k))) ?? "";
  const dateKey  = find(/date/i, /period/i);
  const descKey  = find(/desc/i, /narr/i, /particular/i, /detail/i, /memo/i, /reference/i);
  const amtKey   = find(/^amount$/i, /^amt$/i, /^value$/i, /transaction.amount/i);
  const debitKey = find(/debit/i);
  const creditKey= find(/credit/i);

  const txns: Tx[]    = [];
  const invalid: Tx[] = [];
  const seenSignatures = new Map<string, number>();

  rows.forEach((row, i) => {
    const id      = `${prefix}${String(i + 1).padStart(3, "0")}`;
    const rawDate = (row[dateKey] ?? "").trim();
    const rawDesc = (row[descKey] ?? row[keys[1]] ?? "").trim();

    let amt = 0, amtRaw = "";
    if (amtKey && row[amtKey]) {
      amtRaw = row[amtKey];
      amt = parseFloat(amtRaw.replace(/[,\sR$£€]/g, "")) || 0;
    } else {
      const d = parseFloat((row[debitKey]  || "0").replace(/[,\sR$£€]/g, "")) || 0;
      const c = parseFloat((row[creditKey] || "0").replace(/[,\sR$£€]/g, "")) || 0;
      amt    = c - d;
      amtRaw = amtKey ? (row[amtKey] ?? "") : `${c} / ${d}`;
    }

    const date     = normalizeDate(rawDate);
    const normDesc = normalizeDesc(rawDesc);
    const qualityIssues: string[] = [];
    let   qualityStatus: QualityStatus = "valid";

    // Hard invalids
    if (!rawDate || !date) {
      qualityIssues.push("Missing or unparseable date");
    } else {
      const year = parseInt(date.slice(0, 4), 10);
      if (year < 2025)      qualityIssues.push(`Invalid year detected: ${year}`);
      else if (year > 2027) qualityIssues.push(`Future year detected: ${year}`);
    }
    if (amtRaw === "" && !debitKey && !creditKey) qualityIssues.push("Missing amount");
    else if (amt === 0)  qualityIssues.push("Amount is zero");
    else if (isNaN(amt)) qualityIssues.push("Amount is not a number");
    if (!normDesc || normDesc.length === 0) qualityIssues.push("Description is empty after normalization");

    // Soft warnings
    const warnings: string[] = [];
    if (hasOcrArtifacts(rawDesc)) warnings.push("Description contains OCR artifacts");
    const sig  = `${date}|${amt}|${normDesc}`;
    const prev = seenSignatures.get(sig);
    if (prev !== undefined) warnings.push(`Possible duplicate of row ${prefix}${String(prev + 1).padStart(3, "0")}`);
    else seenSignatures.set(sig, i);

    if (qualityIssues.length > 0) qualityStatus = "invalid";
    else if (warnings.length > 0) qualityStatus = "warning";

    const tx: Tx = {
      id,
      date: date || rawDate,
      desc: rawDesc || "(blank)",
      amt,
      normalizedDesc: normDesc,
      qualityStatus,
      qualityIssues: [...qualityIssues, ...warnings],
      issues: qualityIssues.length > 0 ? qualityIssues : undefined,
    };

    if (qualityStatus === "invalid") invalid.push(tx);
    else                             txns.push(tx);
  });

  return { txns, invalid };
}
