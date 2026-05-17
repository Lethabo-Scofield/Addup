import * as XLSX from "xlsx";
import type { Tx, QualityStatus, ValidationIssue } from "./types";
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
  // Disambiguate DMY vs MDY: if first group > 12 it must be a day (DMY).
  // If second group > 12 it must be a day (MDY). Otherwise prefer DMY
  // (typical for ZA/EU bank statements).
  const m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (m) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    const y = m[3];
    if (b > 12 && a <= 12) return `${y}-${String(a).padStart(2, "0")}-${String(b).padStart(2, "0")}`; // MDY
    return `${y}-${String(b).padStart(2, "0")}-${String(a).padStart(2, "0")}`;                        // DMY (default)
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

// ── Schema validation ─────────────────────────────────────────────────────────
//
// Required columns per the product spec:
//   Bank statement: date | description | debit | credit | balance | reference
//   Ledger       : date | account | description | debit | credit | reference

export type FileKind = "bank" | "ledger";

interface ColumnSpec {
  /** Logical column name surfaced in validation messages. */
  name:    string;
  /** Regex patterns used to detect the column in the file's headers. */
  match:   RegExp[];
  /** Whether the column is required for the kind. */
  required: boolean;
}

const BANK_COLUMNS: ColumnSpec[] = [
  { name: "date",        match: [/^date$/i, /^transaction.?date$/i, /^posting.?date$/i, /^value.?date$/i], required: true },
  { name: "description", match: [/desc/i, /narr/i, /particular/i, /detail/i, /memo/i, /transaction$/i],    required: true },
  { name: "debit",       match: [/^debit$/i, /debit.?amount/i, /withdrawal/i, /money.?out/i, /paid.?out/i], required: true },
  { name: "credit",      match: [/^credit$/i, /credit.?amount/i, /deposit/i, /money.?in/i, /paid.?in/i],   required: true },
  { name: "balance",     match: [/^balance$/i, /running.?balance/i, /closing.?balance/i],                  required: true },
  { name: "reference",   match: [/^reference$/i, /^ref$/i, /ref.?no/i, /reference.?no/i, /cheque/i],       required: true },
];

const LEDGER_COLUMNS: ColumnSpec[] = [
  { name: "date",        match: [/^date$/i, /^transaction.?date$/i, /^posting.?date$/i],                   required: true },
  { name: "account",     match: [/^account$/i, /account.?name/i, /ledger.?account/i, /gl.?account/i],      required: true },
  { name: "description", match: [/desc/i, /narr/i, /particular/i, /detail/i, /memo/i],                     required: true },
  { name: "debit",       match: [/^debit$/i, /debit.?amount/i, /^dr$/i],                                   required: true },
  { name: "credit",      match: [/^credit$/i, /credit.?amount/i, /^cr$/i],                                 required: true },
  { name: "reference",   match: [/^reference$/i, /^ref$/i, /ref.?no/i, /reference.?no/i, /journal.?no/i],  required: true },
];

interface ResolvedColumns {
  date?:        string;
  account?:     string;
  description?: string;
  debit?:       string;
  credit?:      string;
  balance?:     string;
  reference?:   string;
}

function resolveColumns(headers: string[], spec: ColumnSpec[]): { cols: ResolvedColumns; missing: string[] } {
  const cols: ResolvedColumns = {};
  const missing: string[] = [];
  for (const col of spec) {
    const found = headers.find(h => col.match.some(re => re.test(h)));
    if (found) (cols as Record<string, string>)[col.name] = found;
    else if (col.required) missing.push(col.name);
  }
  return { cols, missing };
}

export function validateSchema(
  rows: Record<string, string>[],
  kind: FileKind,
): { passed: boolean; issues: ValidationIssue[]; cols: ResolvedColumns } {
  const issues: ValidationIssue[] = [];
  if (!rows.length) {
    issues.push({ file: kind, severity: "error", message: `${kind} file is empty or could not be parsed` });
    return { passed: false, issues, cols: {} };
  }
  const headers = Object.keys(rows[0]);
  const spec = kind === "bank" ? BANK_COLUMNS : LEDGER_COLUMNS;
  const { cols, missing } = resolveColumns(headers, spec);
  for (const m of missing) {
    issues.push({
      file: kind,
      severity: "error",
      missingColumn: m,
      message: `${kind} file is missing required column "${m}"`,
    });
  }
  return { passed: issues.length === 0, issues, cols };
}

// ── Bank account detection & opening balance detection ───────────────────────

const DEFAULT_BANK_ACCOUNT_NAMES = [
  "bank",
  "cash at bank",
  "business bank account",
  "current account",
  "cheque account",
  "checking account",
  "bank account",
  "main bank",
];

const OPENING_BALANCE_PATTERNS = [
  /opening\s*balance/i,
  /balance\s*b(?:rought)?\s*[\/\-]?\s*f(?:orward)?/i,
  /b\s*\/\s*f\b/i,
  /brought\s*forward/i,
  /\bbf\b/i,
];

function isOpeningBalanceText(...parts: (string | undefined)[]): boolean {
  const joined = parts.filter(Boolean).join(" ").toLowerCase();
  if (!joined.trim()) return false;
  return OPENING_BALANCE_PATTERNS.some(re => re.test(joined));
}

function isBankAccount(account: string | undefined, bankAccountNames: string[]): boolean {
  if (!account) return false;
  const norm = account.trim().toLowerCase();
  if (!norm) return false;
  const aliases = bankAccountNames.map(n => n.trim().toLowerCase()).filter(Boolean);
  return aliases.some(a => norm === a || norm.includes(a));
}

// ── Amount parsing ────────────────────────────────────────────────────────────

function parseMoney(raw: string | undefined): number {
  if (raw === undefined || raw === null) return 0;
  const s = String(raw).trim();
  if (!s) return 0;
  // Treat "(123.45)" or "-123.45" as negative
  const negative = /^\(.*\)$/.test(s) || /^-/.test(s);
  const cleaned = s.replace(/[(),\sR$£€]/g, "").replace(/^-/, "");
  const n = parseFloat(cleaned);
  if (isNaN(n)) return 0;
  return negative ? -n : n;
}

// ── CSV/XLSX → Tx[] ───────────────────────────────────────────────────────────
//
// Converts raw row objects into typed Tx records, applying:
//   1. Schema validation (when kind provided)
//   2. Signed-amount convention:
//        bank   : debit (money out)  → NEGATIVE,  credit (money in) → POSITIVE
//        ledger : debit (Dr)         → POSITIVE,  credit (Cr)        → NEGATIVE
//      With this convention a bank tx and its bank-side ledger counterpart
//      share the SAME sign.
//   3. Opening-balance detection (flagged on Tx.isOpeningBalance).
//   4. Quality status (valid / warning / invalid).
//
// Backward-compat: when `kind` is omitted, columns are detected heuristically
// and amounts are computed as (credit - debit) — preserves old behavior for
// any legacy callers passing only (rows, prefix).

export function csvToTx(
  rows: Record<string, string>[],
  prefix: string,
  kind?: FileKind,
  opts?: { bankAccountNames?: string[] },
): { txns: Tx[]; invalid: Tx[]; validation: { passed: boolean; issues: ValidationIssue[] } } {
  const bankAccountNames = opts?.bankAccountNames?.length
    ? opts.bankAccountNames
    : DEFAULT_BANK_ACCOUNT_NAMES;

  if (!rows.length) {
    return {
      txns: [],
      invalid: [],
      validation: kind
        ? { passed: false, issues: [{ file: kind, severity: "error", message: `${kind} file is empty` }] }
        : { passed: true, issues: [] },
    };
  }

  // ── Resolve columns ──────────────────────────────────────────────────────
  let cols: ResolvedColumns;
  let validation: { passed: boolean; issues: ValidationIssue[] };

  if (kind) {
    const v = validateSchema(rows, kind);
    cols = v.cols;
    validation = { passed: v.passed, issues: v.issues };
  } else {
    // Legacy heuristic mode
    const keys = Object.keys(rows[0]);
    const find = (...pats: RegExp[]) => keys.find(k => pats.some(p => p.test(k)));
    cols = {
      date:        find(/date/i, /period/i),
      description: find(/desc/i, /narr/i, /particular/i, /detail/i, /memo/i, /reference/i),
      debit:       find(/debit/i),
      credit:      find(/credit/i),
      reference:   find(/^reference$/i, /^ref$/i, /ref.?no/i),
      account:     find(/^account$/i, /account.?name/i),
      balance:     find(/^balance$/i),
    };
    validation = { passed: true, issues: [] };
  }

  // If required columns are missing, return validation failure without parsing
  if (kind && !validation.passed) {
    return { txns: [], invalid: [], validation };
  }

  const txns: Tx[]    = [];
  const invalid: Tx[] = [];
  const seenSignatures = new Map<string, number>();

  rows.forEach((row, i) => {
    const id      = `${prefix}${String(i + 1).padStart(3, "0")}`;
    const rawDate = (row[cols.date ?? ""] ?? "").trim();
    const rawDesc = (row[cols.description ?? ""] ?? "").trim();
    const rawAcct = cols.account   ? (row[cols.account]   ?? "").trim()   : undefined;
    const rawRef  = cols.reference ? (row[cols.reference] ?? "").trim()   : undefined;
    const rawBal  = cols.balance   ? row[cols.balance]                    : undefined;

    const debit  = cols.debit  ? parseMoney(row[cols.debit])  : 0;
    const credit = cols.credit ? parseMoney(row[cols.credit]) : 0;

    // Signed-amount convention
    let amt: number;
    if (kind === "bank") {
      // bank debit  = money out  = negative
      // bank credit = money in   = positive
      amt = credit - debit;
    } else if (kind === "ledger") {
      // ledger debit  (Dr) = positive
      // ledger credit (Cr) = negative
      amt = debit - credit;
    } else {
      // legacy heuristic
      amt = credit - debit;
    }

    const date     = normalizeDate(rawDate);
    const normDesc = normalizeDesc(rawDesc);
    const qualityIssues: string[] = [];
    let   qualityStatus: QualityStatus = "valid";

    // Opening balance detection (description OR account text)
    const isOpening = isOpeningBalanceText(rawDesc, rawAcct);

    // Bank-account row detection (ledger only; bank statements are all bank)
    const isBankAccountRow =
      kind === "bank" ? true :
      kind === "ledger" ? isBankAccount(rawAcct, bankAccountNames) :
      isBankAccount(rawAcct, bankAccountNames);

    // ── Hard invalids ────────────────────────────────────────────────────
    if (!rawDate || !date) {
      qualityIssues.push("Missing or unparseable date");
    } else {
      const year = parseInt(date.slice(0, 4), 10);
      if (year < 2000)      qualityIssues.push(`Invalid year detected: ${year}`);
      else if (year > 2100) qualityIssues.push(`Future year detected: ${year}`);
    }

    // Opening balances are allowed to have zero "movement" amounts — exempt
    // them from the zero-amount invalid check.
    if (!isOpening) {
      if (amt === 0)        qualityIssues.push("Amount is zero");
      else if (isNaN(amt))  qualityIssues.push("Amount is not a number");
    }
    if (!normDesc || normDesc.length === 0) qualityIssues.push("Description is empty after normalization");

    // ── Soft warnings ────────────────────────────────────────────────────
    const warnings: string[] = [];
    if (hasOcrArtifacts(rawDesc)) warnings.push("Description contains OCR artifacts");

    // Duplicate signature includes reference + account so genuine repeats
    // (e.g. two distinct payments with same desc) aren't false-flagged.
    const sig  = `${date}|${amt.toFixed(2)}|${normDesc}|${rawRef ?? ""}|${rawAcct ?? ""}`;
    const prev = seenSignatures.get(sig);
    if (prev !== undefined) {
      warnings.push(`Possible duplicate of row ${prefix}${String(prev + 1).padStart(3, "0")}`);
    } else {
      seenSignatures.set(sig, i);
    }

    if (qualityIssues.length > 0) qualityStatus = "invalid";
    else if (warnings.length > 0) qualityStatus = "warning";

    const balance = rawBal !== undefined && String(rawBal).trim() !== ""
      ? parseMoney(String(rawBal))
      : undefined;

    const tx: Tx = {
      id,
      date: date || rawDate,
      desc: rawDesc || "(blank)",
      amt,
      account:           rawAcct || undefined,
      reference:         rawRef  || undefined,
      balance,
      isOpeningBalance:  isOpening || undefined,
      isBankAccountRow:  isBankAccountRow || undefined,
      normalizedDesc:    normDesc,
      qualityStatus,
      qualityIssues:     [...qualityIssues, ...warnings],
      issues:            qualityIssues.length > 0 ? qualityIssues : undefined,
    };

    if (qualityStatus === "invalid") invalid.push(tx);
    else                             txns.push(tx);
  });

  return { txns, invalid, validation };
}
