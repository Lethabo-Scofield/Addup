import React, { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Upload, Briefcase, AlertCircle, Clock, Settings2,
  CheckCircle2, XCircle, AlertTriangle, HelpCircle,
  Download, FileText, Sparkles, RefreshCw, X, Check, Search,
  ThumbsUp, ThumbsDown, Edit3, Menu, ChevronRight, ChevronLeft,
  BarChart3, Shield, Activity, Eye, ChevronDown, CalendarDays,
} from "lucide-react";
import addupLogo from "@assets/Addup_1777332904059.png";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";

// ── Loader ────────────────────────────────────────────────────────────────────

const LOAD_MS = 2200;

function Loader({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, LOAD_MS);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.5, ease: "easeInOut" } }}
      className="fixed inset-0 z-[999] bg-white flex flex-col items-center justify-center"
    >
      {/* Logo */}
      <motion.img
        src={addupLogo} alt="Addup"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="h-9 w-auto mb-10"
      />

      {/* Progress bar track */}
      <div className="w-48 h-[2px] bg-gray-100 overflow-hidden">
        <motion.div
          className="h-full bg-gray-900"
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: LOAD_MS / 1000 - 0.3, ease: [0.4, 0, 0.2, 1] }}
        />
      </div>

      {/* Status line */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="mt-5 text-[11px] font-medium text-gray-400 tracking-wide"
      >
        Preparing your workspace
      </motion.p>
    </motion.div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type NavId = "dashboard" | "uploads" | "jobs" | "review" | "audit" | "settings";
type TxStatus = "matched" | "possible_match" | "manual_review" | "invalid_row" | "unmatched_bank" | "unmatched_ledger";
type ActionType = "approve_match" | "reject_match" | "mark_manual" | "edit_field" | "export_json" | "export_pdf";

interface RawField { raw: string; normalized: string; confidence: number; issue?: string }
interface Tx {
  id: string; date: string; desc: string; amt: number;
  rawDate?: RawField; rawAmt?: RawField; rawDesc?: RawField;
  issues?: string[];
}
interface ReconRow {
  id: string; status: TxStatus;
  bank?: Tx; ledger?: Tx;
  confidence: number; dateDiff: number; amtDiff: number; descSim: number;
  reasons: string[]; warnings: string[]; action: string;
  userStatus?: "approved" | "rejected" | "manual";
}
interface AuditEntry {
  ts: string; job_id: string; action: ActionType; target_id: string;
  prev?: string; next?: string; user: string;
}

// ── Universal file parser ─────────────────────────────────────────────────────

function detectDelimiter(firstLine: string): string {
  const tabs     = (firstLine.match(/\t/g)  || []).length;
  const semis    = (firstLine.match(/;/g)   || []).length;
  const pipes    = (firstLine.match(/\|/g)  || []).length;
  const commas   = (firstLine.match(/,/g)   || []).length;
  const max = Math.max(tabs, semis, pipes, commas);
  if (max === 0) return ",";
  if (tabs   === max) return "\t";
  if (semis  === max) return ";";
  if (pipes  === max) return "|";
  return ",";
}

function splitDelimLine(line: string, delim: string): string[] {
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

function parseDelimitedText(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const delim   = detectDelimiter(lines[0]);
  const headers = splitDelimLine(lines[0], delim);
  return lines.slice(1).map(line => {
    const vals = splitDelimLine(line, delim);
    return Object.fromEntries(headers.map((h, i) => [h.trim(), vals[i] ?? ""]));
  });
}

function parseCSVText(text: string): Record<string, string>[] {
  return parseDelimitedText(text);
}

function xlsxToRows(buffer: ArrayBuffer): Record<string, string>[] {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "", raw: false });
}

function normalizeDate(raw: string): string {
  if (!raw) return "";
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,"0")}-${dmy[1].padStart(2,"0")}`;
  const d = new Date(s);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function csvToTx(rows: Record<string, string>[], prefix: string): { txns: Tx[]; invalid: Tx[] } {
  if (!rows.length) return { txns: [], invalid: [] };
  const keys = Object.keys(rows[0]);
  const find = (...pats: RegExp[]) => keys.find(k => pats.some(p => p.test(k))) ?? "";
  const dateKey  = find(/date/i, /period/i);
  const descKey  = find(/desc/i, /narr/i, /particular/i, /detail/i, /memo/i, /reference/i);
  const amtKey   = find(/^amount$/i, /^amt$/i, /^value$/i, /transaction.amount/i);
  const debitKey = find(/debit/i);
  const creditKey= find(/credit/i);

  const txns: Tx[] = [], invalid: Tx[] = [];
  rows.forEach((row, i) => {
    const id      = `${prefix}${String(i + 1).padStart(3, "0")}`;
    const rawDate = row[dateKey] ?? "";
    const rawDesc = row[descKey] ?? row[keys[1]] ?? "";
    let amt = 0;
    if (amtKey && row[amtKey]) {
      amt = parseFloat(row[amtKey].replace(/[,\sR$£€]/g, "")) || 0;
    } else {
      const d = parseFloat((row[debitKey]  || "0").replace(/[,\sR$£€]/g, "")) || 0;
      const c = parseFloat((row[creditKey] || "0").replace(/[,\sR$£€]/g, "")) || 0;
      amt = c - d;
    }
    const date = normalizeDate(rawDate);
    const desc = rawDesc.trim();
    const issues: string[] = [];
    if (!date) issues.push("invalid_date");
    if (!desc) issues.push("missing_description");
    const tx: Tx = { id, date: date || rawDate, desc: desc || "(blank)", amt };
    if (issues.length) { tx.issues = issues; invalid.push(tx); }
    else               { txns.push(tx); }
  });
  return { txns, invalid };
}

// ── Reconciliation engine ─────────────────────────────────────────────────────

function wordSim(a: string, b: string): number {
  const wa = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
  const wb = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
  let common = 0;
  wa.forEach(w => { if (wb.has(w)) common++; });
  return common / Math.max(wa.size, wb.size, 1);
}

function derivePeriod(txns: Tx[]): string {
  const dates = txns.map(t => t.date).filter(Boolean).sort();
  if (!dates.length) return "";
  return new Date(dates[0]).toLocaleDateString("en-ZA", { month: "long", year: "numeric" });
}

function runReconciliation(bank: Tx[], ledger: Tx[]): ReconRow[] {
  const rows: ReconRow[] = [];
  const usedLedger = new Set<string>();
  let rowN = 0;
  const rid = () => `R${String(++rowN).padStart(3, "0")}`;

  for (const b of bank) {
    let bestScore = -1, bestMatch: Tx | null = null;
    let bestReasons: string[] = [], bestWarnings: string[] = [];

    for (const l of ledger) {
      if (usedLedger.has(l.id)) continue;
      const amtDiff = Math.abs(b.amt - l.amt);
      if (amtDiff > Math.max(Math.abs(b.amt) * 0.20, 1)) continue;

      const dateDiffDays = Math.abs(new Date(b.date).getTime() - new Date(l.date).getTime()) / 86400000;
      const descSim = wordSim(b.desc, l.desc);
      let score = 0;
      const reasons: string[] = [], warnings: string[] = [];

      if (amtDiff < 0.01) { score += 50; reasons.push("Exact amount match"); }
      else                 { score += 20; warnings.push(`Amount difference: ${fmt(b.amt)} vs ${fmt(l.amt)}`); }

      if (dateDiffDays === 0)    { score += 30; reasons.push("Exact date match"); }
      else if (dateDiffDays <= 3){ score += 15; warnings.push(`Date off by ${Math.round(dateDiffDays)} day(s): ${b.date} vs ${l.date}`); }
      else if (dateDiffDays <= 7){ score +=  5; warnings.push(`Date off by ${Math.round(dateDiffDays)} days`); }

      if (descSim > 0.7)      { score += 20; reasons.push("High description similarity"); }
      else if (descSim > 0.4) { score += 10; reasons.push("Partial description match"); }
      else                    { warnings.push("Description differs significantly"); }

      if (score > bestScore) { bestScore = score; bestMatch = l; bestReasons = reasons; bestWarnings = warnings; }
    }

    if (bestMatch && bestScore >= 80) {
      usedLedger.add(bestMatch.id);
      rows.push({ id: rid(), status: "matched", bank: b, ledger: bestMatch,
        confidence: Math.min(bestScore, 100), dateDiff: 0, amtDiff: Math.abs(b.amt - bestMatch.amt),
        descSim: wordSim(b.desc, bestMatch.desc), reasons: bestReasons, warnings: bestWarnings, action: "auto_approve" });
    } else if (bestMatch && bestScore >= 45) {
      usedLedger.add(bestMatch.id);
      rows.push({ id: rid(), status: "possible_match", bank: b, ledger: bestMatch,
        confidence: bestScore, dateDiff: 0, amtDiff: Math.abs(b.amt - bestMatch.amt),
        descSim: wordSim(b.desc, bestMatch.desc), reasons: bestReasons, warnings: bestWarnings, action: "review" });
    } else {
      rows.push({ id: rid(), status: "unmatched_bank", bank: b,
        confidence: 0, dateDiff: 0, amtDiff: 0, descSim: 0,
        reasons: [], warnings: ["No matching ledger entry found"], action: "create_entry" });
    }
  }

  for (const l of ledger) {
    if (!usedLedger.has(l.id)) {
      const inv = !!(l.issues && l.issues.length > 0);
      rows.push({ id: rid(), status: inv ? "invalid_row" : "unmatched_ledger", ledger: l,
        confidence: 0, dateDiff: 0, amtDiff: 0, descSim: 0,
        reasons: [], warnings: inv ? (l.issues ?? []).map(i => i.replace(/_/g," ")) : ["No matching bank transaction found"],
        action: inv ? "fix_data" : "create_entry" });
    }
  }
  return rows;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  const abs = Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${n < 0 ? "-" : "+"}R ${abs}`;
}
function fmtDate(d: string) {
  try { return new Date(d).toLocaleDateString("en-ZA", { day:"2-digit", month:"short", year:"numeric" }); }
  catch { return d; }
}
function now() { return new Date().toISOString(); }

const STATUS_CFG: Record<TxStatus, { label: string; short: string; bg: string; text: string; border: string; dot: string }> = {
  matched:          { label:"Matched",          short:"Matched",    bg:"bg-emerald-50",  text:"text-emerald-700", border:"border-emerald-200", dot:"bg-emerald-500"  },
  possible_match:   { label:"Possible Match",   short:"Possible",   bg:"bg-blue-50",     text:"text-blue-700",    border:"border-blue-200",    dot:"bg-blue-500"     },
  manual_review:    { label:"Manual Review",    short:"Manual",     bg:"bg-amber-50",    text:"text-amber-700",   border:"border-amber-200",   dot:"bg-amber-500"    },
  invalid_row:      { label:"Invalid Row",      short:"Invalid",    bg:"bg-red-50",      text:"text-red-700",     border:"border-red-200",     dot:"bg-red-500"      },
  unmatched_bank:   { label:"Unmatched Bank",   short:"No Ledger",  bg:"bg-orange-50",   text:"text-orange-700",  border:"border-orange-200",  dot:"bg-orange-500"   },
  unmatched_ledger: { label:"Unmatched Ledger", short:"No Bank",    bg:"bg-purple-50",   text:"text-purple-700",  border:"border-purple-200",  dot:"bg-purple-500"   },
};

const ACTION_LABELS: Record<ActionType, string> = {
  approve_match: "Approved match",
  reject_match:  "Rejected match",
  mark_manual:   "Marked manual review",
  edit_field:    "Edited field",
  export_json:   "Exported JSON report",
  export_pdf:    "Exported PDF report",
};

// ── useGrokExplain hook ───────────────────────────────────────────────────────

function useGrokExplain() {
  const [resp, setResp]       = useState("");
  const [streaming, setStr]   = useState(false);
  const [error, setErr]       = useState("");
  const abort = useRef<AbortController | null>(null);

  const explain = useCallback(async (question: string, ctx?: string) => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setResp(""); setErr(""); setStr(true);
    try {
      const res = await fetch("/api/explain", {
        method:"POST", signal: ctrl.signal,
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ question, context: ctx }),
      });
      if (!res.ok || !res.body) { setErr("Could not reach Grok."); setStr(false); return; }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n"); buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const p = JSON.parse(line.slice(6));
            if (p.content) setResp(r => r + p.content);
            if (p.done)    setStr(false);
            if (p.error)   { setErr(p.error); setStr(false); }
          } catch { /* skip */ }
        }
      }
    } catch (e: any) { if (e.name !== "AbortError") setErr("Something went wrong."); }
    finally { setStr(false); }
  }, []);

  const reset = useCallback(() => { abort.current?.abort(); setResp(""); setErr(""); setStr(false); }, []);
  return { resp, streaming, error, explain, reset };
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: TxStatus }) {
  const c = STATUS_CFG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold border ${c.bg} ${c.text} ${c.border}`}>
      <span className={`w-1.5 h-1.5 shrink-0 ${c.dot}`} />
      {c.label}
    </span>
  );
}

// ── Confidence bar ─────────────────────────────────────────────────────────────

function ConfBar({ pct }: { pct: number }) {
  const color = pct >= 90 ? "bg-emerald-500" : pct >= 70 ? "bg-blue-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";
  const textColor = pct >= 90 ? "text-emerald-700" : pct >= 70 ? "text-blue-700" : pct >= 40 ? "text-amber-700" : "text-red-700";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100">
        <div className={`h-full ${color} transition-all`} style={{ width:`${pct}%` }} />
      </div>
      <span className={`text-[11px] font-bold w-8 text-right shrink-0 ${textColor}`}>{pct}%</span>
    </div>
  );
}

// ── Transaction card (side-by-side review) ────────────────────────────────────

function TxCard({ tx, side, highlight }: { tx?: Tx; side: "bank" | "ledger"; highlight?: string[] }) {
  if (!tx) return (
    <div className="flex-1 border border-dashed border-gray-200 flex items-center justify-center min-h-[200px] text-gray-300">
      <div className="text-center">
        <HelpCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p className="text-xs">No {side} entry</p>
      </div>
    </div>
  );
  const isBank = side === "bank";
  const fields = [
    { label:"Transaction ID", val: tx.id },
    { label:"Date",           val: tx.date, raw: tx.rawDate },
    { label:"Description",    val: tx.desc, raw: tx.rawDesc },
    { label:"Amount",         val: fmt(tx.amt), raw: tx.rawAmt },
  ];
  return (
    <div className={`flex-1 border ${isBank ? "border-gray-200" : "border-gray-200"}`}>
      <div className={`px-4 py-2.5 border-b ${isBank ? "bg-gray-100 border-gray-200" : "bg-gray-50 border-gray-200"} flex items-center justify-between`}>
        <span className="text-gray-800 text-xs font-bold uppercase tracking-wider">{isBank ? "Bank Statement" : "General Ledger"}</span>
        <span className="text-gray-400 text-[10px] font-mono">{tx.id}</span>
      </div>
      <div className="divide-y divide-gray-100">
        {fields.map(({ label, val, raw }) => (
          <div key={label} className="px-4 py-3">
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-1">{label}</p>
            <p className={`text-sm font-medium ${highlight?.includes(label) ? "text-amber-700" : "text-gray-900"}`}>{val}</p>
            {raw && (
              <div className="mt-1 flex items-start gap-1">
                <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-600">Raw: <span className="font-mono">{raw.raw}</span> — {raw.issue}</p>
              </div>
            )}
          </div>
        ))}
        {tx.issues && tx.issues.length > 0 && (
          <div className="px-4 py-3 bg-red-50">
            {tx.issues.map(iss => (
              <p key={iss} className="text-[10px] text-red-600 font-semibold flex items-center gap-1">
                <XCircle className="h-3 w-3" />{iss.replace(/_/g, " ")}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Review panel ──────────────────────────────────────────────────────────────

function ReviewPanel({
  row, onClose, onApprove, onReject, onManual,
}: {
  row: ReconRow; onClose: () => void;
  onApprove: () => void; onReject: () => void; onManual: () => void;
}) {
  const { resp, streaming, error, explain, reset } = useGrokExplain();
  const [grokOpen, setGrokOpen] = useState(false);

  const diffHighlights: string[] = [];
  if (row.dateDiff > 0)  diffHighlights.push("Date");
  if (row.amtDiff  > 0)  diffHighlights.push("Amount");
  if (row.descSim  < 0.8) diffHighlights.push("Description");

  return (
    <motion.div
      initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
      transition={{ type:"spring", stiffness:300, damping:30 }}
      className="fixed right-0 top-0 h-full w-full max-w-[680px] bg-white border-l border-gray-200 z-40 flex flex-col shadow-2xl"
    >
      {/* Panel header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
        <div>
          <h2 className="text-sm font-bold text-gray-900">Side-by-side Review</h2>
          <p className="text-xs text-gray-400 mt-0.5">{row.id} · {STATUS_CFG[row.status].label}</p>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-gray-100 transition-colors">
          <X className="h-4 w-4 text-gray-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Match confidence */}
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Match confidence</span>
            <StatusBadge status={row.status} />
          </div>
          <ConfBar pct={row.confidence} />
          {row.confidence > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-3">
              {[
                { label:"Date diff",     val: row.dateDiff === 0 ? "Exact" : `${row.dateDiff}d apart`, ok: row.dateDiff === 0 },
                { label:"Amount diff",   val: row.amtDiff  === 0 ? "Exact" : `R ${row.amtDiff.toFixed(2)}`,  ok: row.amtDiff === 0  },
                { label:"Desc similarity", val: `${Math.round(row.descSim * 100)}%`,                    ok: row.descSim >= 0.8  },
              ].map(({ label, val, ok }) => (
                <div key={label} className="border border-gray-100 px-3 py-2">
                  <p className="text-[10px] text-gray-400 mb-0.5">{label}</p>
                  <p className={`text-xs font-bold ${ok ? "text-emerald-600" : "text-amber-600"}`}>{val}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Side-by-side cards */}
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Transactions</p>
          <div className="flex gap-3">
            <TxCard tx={row.bank}   side="bank"   highlight={diffHighlights} />
            <TxCard tx={row.ledger} side="ledger" highlight={diffHighlights} />
          </div>
        </div>

        {/* Explanation */}
        {(row.reasons.length > 0 || row.warnings.length > 0) && (
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Match explanation</p>
            {row.reasons.map(r => (
              <div key={r} className="flex items-start gap-2 mb-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-xs text-gray-700">{r}</p>
              </div>
            ))}
            {row.warnings.map(w => (
              <div key={w} className="flex items-start gap-2 mb-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">{w}</p>
              </div>
            ))}
          </div>
        )}

        {/* Ask Grok */}
        <div className="px-5 py-4 border-b border-gray-100">
          <button
            onClick={() => {
              setGrokOpen(true);
              if (!resp && !streaming) {
                explain(
                  `Explain this reconciliation item: ${row.bank?.desc ?? row.ledger?.desc ?? row.id}`,
                  `Status: ${row.status}. Confidence: ${row.confidence}%. Warnings: ${row.warnings.join("; ")}. Reasons: ${row.reasons.join("; ")}.`
                );
              }
            }}
            className="flex items-center gap-2 text-xs font-semibold text-gray-600 hover:text-gray-900 transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            {grokOpen ? "Grok explanation" : "Ask Grok to explain this"}
            <ChevronDown className={`h-3 w-3 transition-transform ${grokOpen ? "rotate-180" : ""}`} />
          </button>
          <AnimatePresence>
            {grokOpen && (
              <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:"auto" }} exit={{ opacity:0, height:0 }}>
                <div className="mt-3 border border-gray-100 bg-gray-50 p-3 min-h-[80px]">
                  {error && <p className="text-xs text-red-500">{error}</p>}
                  {!resp && !error && streaming && (
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <motion.div animate={{ rotate:360 }} transition={{ duration:1, repeat:Infinity, ease:"linear" }}>
                        <RefreshCw className="h-3.5 w-3.5" />
                      </motion.div>
                      Grok is thinking...
                    </div>
                  )}
                  {resp && <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{resp}</p>}
                </div>
                {resp && !streaming && (
                  <button onClick={() => { reset(); explain(`Explain: ${row.bank?.desc ?? row.ledger?.desc ?? row.id}`, `Status: ${row.status}.`); }}
                    className="mt-2 text-[10px] text-gray-400 hover:text-gray-600 flex items-center gap-1">
                    <RefreshCw className="h-3 w-3" /> Regenerate
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-5 py-4 border-t border-gray-200 bg-gray-50 shrink-0">
        <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-3">Actions</p>
        <div className="flex gap-2 flex-wrap">
          {row.status !== "invalid_row" && (
            <button onClick={onApprove}
              className="flex items-center gap-1.5 h-9 px-4 bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors">
              <ThumbsUp className="h-3.5 w-3.5" /> Approve match
            </button>
          )}
          <button onClick={onReject}
            className="flex items-center gap-1.5 h-9 px-4 border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors">
            <ThumbsDown className="h-3.5 w-3.5" /> Reject
          </button>
          <button onClick={onManual}
            className="flex items-center gap-1.5 h-9 px-4 border border-amber-200 text-xs font-semibold text-amber-700 hover:bg-amber-50 transition-colors">
            <Edit3 className="h-3.5 w-3.5" /> Mark manual review
          </button>
        </div>
        {row.userStatus && (
          <p className="mt-2 text-[10px] text-gray-400">
            Current decision: <span className="font-bold text-gray-600">{row.userStatus}</span>
          </p>
        )}
      </div>
    </motion.div>
  );
}

// ── Row table ─────────────────────────────────────────────────────────────────

const STATUS_ORDER: TxStatus[] = [
  "matched", "possible_match", "manual_review", "invalid_row", "unmatched_bank", "unmatched_ledger"
];

function ReconTable({
  rows, onSelect, selectedId, filter,
}: {
  rows: ReconRow[]; onSelect: (r: ReconRow) => void;
  selectedId?: string; filter: TxStatus | "all";
}) {
  const visible = filter === "all" ? rows : rows.filter(r => r.status === filter);
  const grouped = STATUS_ORDER.map(s => ({
    status: s, items: visible.filter(r => r.status === s),
  })).filter(g => g.items.length > 0);

  if (visible.length === 0) return (
    <div className="flex flex-col items-center justify-center py-24 text-gray-300">
      <FileText className="h-12 w-12 mb-3 opacity-40" />
      <p className="text-sm">No items in this filter</p>
    </div>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase tracking-wider">Status</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase tracking-wider">Source</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase tracking-wider min-w-[200px]">Description</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase tracking-wider">Date</th>
            <th className="text-right px-4 py-3 font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase tracking-wider min-w-[140px]">Confidence</th>
            <th className="px-4 py-3 w-8" />
          </tr>
        </thead>
        <tbody>
          {grouped.map(({ status, items }) => (
            <React.Fragment key={status}>
              <tr>
                <td colSpan={7} className="px-4 py-2 bg-gray-50 border-y border-gray-100">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                    {STATUS_CFG[status].label} — {items.length}
                  </span>
                </td>
              </tr>
              {items.map((row, i) => {
                const tx = row.bank ?? row.ledger;
                const isSelected = row.id === selectedId;
                return (
                  <tr
                    key={row.id}
                    onClick={() => onSelect(row)}
                    className={`border-b border-gray-100 cursor-pointer transition-colors
                      ${isSelected ? "bg-gray-900 text-white" : i % 2 === 0 ? "bg-white hover:bg-gray-50" : "bg-gray-50/50 hover:bg-gray-100/50"}`}
                  >
                    <td className="px-4 py-3">
                      {isSelected
                        ? <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${STATUS_CFG[status].text}`}>
                            <span className={`w-1.5 h-1.5 ${STATUS_CFG[status].dot}`} />{STATUS_CFG[status].short}
                          </span>
                        : <StatusBadge status={status} />
                      }
                    </td>
                    <td className="px-4 py-3">
                      <div className={`text-[10px] font-semibold uppercase tracking-wider ${isSelected ? "text-gray-300" : "text-gray-400"}`}>
                        {row.bank && row.ledger ? "Both" : row.bank ? "Bank" : "Ledger"}
                      </div>
                      <div className={`text-[10px] font-mono ${isSelected ? "text-gray-400" : "text-gray-300"}`}>
                        {row.bank?.id}{row.bank && row.ledger && " / "}{row.ledger?.id}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-medium text-[12px] ${isSelected ? "text-white" : "text-gray-800"}`}>
                        {tx?.desc.slice(0, 36)}{(tx?.desc.length ?? 0) > 36 && "…"}
                      </span>
                      {tx?.issues && tx.issues.length > 0 && (
                        <AlertTriangle className={`inline ml-1 h-3 w-3 ${isSelected ? "text-amber-300" : "text-amber-500"}`} />
                      )}
                    </td>
                    <td className={`px-4 py-3 font-mono text-[11px] ${isSelected ? "text-gray-300" : "text-gray-500"}`}>
                      {tx?.date}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono font-bold text-[12px]
                      ${isSelected ? (tx && tx.amt >= 0 ? "text-emerald-300" : "text-red-300")
                                   : (tx && tx.amt >= 0 ? "text-emerald-600" : "text-red-500")}`}>
                      {tx ? fmt(tx.amt) : "—"}
                    </td>
                    <td className="px-4 py-3 min-w-[140px]">
                      {row.confidence > 0
                        ? <ConfBar pct={row.confidence} />
                        : <span className={`text-[11px] ${isSelected ? "text-gray-400" : "text-gray-300"}`}>—</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight className={`h-3.5 w-3.5 ${isSelected ? "text-white" : "text-gray-300"}`} />
                    </td>
                  </tr>
                );
              })}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Dashboard view ────────────────────────────────────────────────────────────

function DashboardView({ rows, onNav, onBulkApprove, bankLen, ledgerLen, overallConf, jobId, period, bankInst, ledgerSoft }: {
  rows: ReconRow[];
  onNav: (v: NavId) => void;
  onBulkApprove: () => void;
  bankLen: number; ledgerLen: number; overallConf: number;
  jobId: string; period: string; bankInst: string; ledgerSoft: string;
}) {
  const matched        = rows.filter(r => r.status === "matched").length;
  const pendingApprove = rows.filter(r => r.status === "matched" && !r.userStatus).length;
  const possible       = rows.filter(r => r.status === "possible_match").length;
  const manual         = rows.filter(r => r.status === "manual_review").length;
  const invalid        = rows.filter(r => r.status === "invalid_row").length;
  const uBank          = rows.filter(r => r.status === "unmatched_bank").length;
  const uLedger        = rows.filter(r => r.status === "unmatched_ledger").length;
  const exceptions     = possible + manual + invalid + uBank + uLedger;

  const cards: { label:string; val:number; sub:string; color:string; bg:string; border:string; nav:NavId }[] = [
    { label:"Bank transactions",  val: bankLen,       sub:"Ingested by engine",              color:"text-gray-900",    bg:"bg-white",      border:"hover:border-gray-400",    nav:"jobs"   },
    { label:"Ledger entries",     val: ledgerLen,     sub:"Ingested by engine",              color:"text-gray-900",    bg:"bg-white",      border:"hover:border-gray-400",    nav:"jobs"   },
    { label:"Auto-matched",       val: matched,       sub:"Engine matched, no admin needed", color:"text-emerald-700", bg:"bg-emerald-50", border:"hover:border-emerald-400", nav:"jobs"   },
    { label:"Possible matches",   val: possible,      sub:"Engine flagged — needs sign-off", color:"text-blue-700",    bg:"bg-blue-50",    border:"hover:border-blue-400",    nav:"review" },
    { label:"Engine escalated",   val: manual,        sub:"Requires human judgement",        color:"text-amber-700",   bg:"bg-amber-50",   border:"hover:border-amber-400",   nav:"review" },
    { label:"Data quality issues",val: invalid,       sub:"Engine detected bad data",        color:"text-red-700",     bg:"bg-red-50",     border:"hover:border-red-400",     nav:"review" },
    { label:"Unmatched bank",     val: uBank,         sub:"Engine found no ledger pair",     color:"text-orange-700",  bg:"bg-orange-50",  border:"hover:border-orange-400",  nav:"review" },
    { label:"Unmatched ledger",   val: uLedger,       sub:"Engine found no bank pair",       color:"text-purple-700",  bg:"bg-purple-50",  border:"hover:border-purple-400",  nav:"review" },
  ];

  return (
    <div className="p-6 sm:p-8 max-w-5xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Automation Report</h1>
        <p className="text-sm text-gray-400 mt-1">Job <span className="font-mono">{jobId}</span> · {period}</p>
      </div>

      {/* Automation summary */}
      <div className="border border-gray-200 p-5 mb-6 bg-white">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Engine automation rate</p>
            <p className="text-3xl font-bold text-gray-900">{overallConf}%</p>
            <p className="text-xs text-gray-400 mt-1">
              <span className="font-semibold text-emerald-600">{matched} of {bankLen}</span> transactions handled automatically — no manual admin needed
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            {pendingApprove > 0 ? (
              <button
                onClick={onBulkApprove}
                className="flex items-center gap-2 h-10 px-5 bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors shrink-0">
                <ThumbsUp className="h-3.5 w-3.5" />
                Sign off on all {pendingApprove} engine matches
              </button>
            ) : (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                <CheckCircle2 className="h-3.5 w-3.5" /> All engine matches signed off
              </span>
            )}
            {exceptions > 0 && (
              <button onClick={() => onNav("review")}
                className="flex items-center gap-2 h-9 px-4 border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                {exceptions} exception{exceptions !== 1 && "s"} need sign-off
              </button>
            )}
            <p className="text-[10px] text-gray-400">{bankInst} · {ledgerSoft}</p>
          </div>
        </div>
        <div className="h-2 bg-gray-100 w-full">
          <div className="h-full bg-emerald-500 transition-all" style={{ width:`${overallConf}%` }} />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cards.map(({ label, val, sub, color, bg, border, nav }) => (
          <button key={label} onClick={() => onNav(nav)}
            className={`border border-gray-200 p-4 ${bg} ${border} text-left transition-all group cursor-pointer hover:shadow-sm`}>
            <div className="flex items-start justify-between">
              <p className={`text-2xl font-bold ${color}`}>{val}</p>
              <ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-gray-500 mt-1 transition-colors shrink-0" />
            </div>
            <p className="text-xs font-semibold text-gray-700 mt-0.5">{label}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Uploads view ──────────────────────────────────────────────────────────────

const ACCEPTED_EXTS = ".csv,.tsv,.txt,.xlsx,.xls,.ods,.numbers";
const XLSX_EXTS = new Set([".xlsx", ".xls", ".ods", ".numbers"]);

function getExt(name: string) { return name.slice(name.lastIndexOf(".")).toLowerCase(); }

function readFileAsText(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = e => res(e.target?.result as string ?? "");
    r.onerror = () => rej(new Error("Could not read file."));
    r.readAsText(file);
  });
}

function readFileAsBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = e => res(e.target?.result as ArrayBuffer);
    r.onerror = () => rej(new Error("Could not read file."));
    r.readAsArrayBuffer(file);
  });
}

async function parseAnyFile(file: File): Promise<Record<string, string>[]> {
  const ext = getExt(file.name);
  if (XLSX_EXTS.has(ext)) {
    const buf = await readFileAsBuffer(file);
    return xlsxToRows(buf);
  }
  const text = await readFileAsText(file);
  return parseDelimitedText(text);
}

function UploadsView({ onReconcile }: {
  onReconcile: (bank: Tx[], ledger: Tx[], bankName: string, ledgerName: string) => void;
}) {
  const bankRef    = useRef<HTMLInputElement>(null);
  const ledgerRef  = useRef<HTMLInputElement>(null);
  const [bankFile,   setBankFile]   = useState<File | null>(null);
  const [ledgerFile, setLedgerFile] = useState<File | null>(null);
  const [parsing,    setParsing]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  async function handleRun() {
    if (!bankFile || !ledgerFile) return;
    setParsing(true); setError(null);
    try {
      const [bankRows, ledgerRows] = await Promise.all([
        parseAnyFile(bankFile),
        parseAnyFile(ledgerFile),
      ]);
      if (!bankRows.length)   throw new Error(`Bank statement is empty or could not be parsed. Make sure the file has a header row. (${bankFile.name})`);
      if (!ledgerRows.length) throw new Error(`General ledger is empty or could not be parsed. Make sure the file has a header row. (${ledgerFile.name})`);
      const { txns: bankTxns,   invalid: bankInv   } = csvToTx(bankRows,   "B");
      const { txns: ledgerTxns, invalid: ledgerInv } = csvToTx(ledgerRows, "L");
      onReconcile([...bankTxns, ...bankInv], [...ledgerTxns, ...ledgerInv], bankFile.name, ledgerFile.name);
    } catch (e: any) {
      setError(e.message ?? "Something went wrong parsing your files.");
    } finally {
      setParsing(false);
    }
  }

  const slots = [
    { label:"Bank Statement",  sub:"Any format — CSV, XLSX, TSV, ODS…",  ref:bankRef,   file:bankFile,   set:setBankFile   },
    { label:"General Ledger",  sub:"Any format — CSV, XLSX, TSV, ODS…",  ref:ledgerRef, file:ledgerFile, set:setLedgerFile },
  ] as const;

  return (
    <div className="p-6 sm:p-8 max-w-2xl mx-auto w-full">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Upload Files</h1>
      <p className="text-sm text-gray-400 mb-6">
        Upload your bank statement and general ledger. CSV, XLSX, TSV, ODS, TXT — any tabular format works.
      </p>

      <div className="space-y-4">
        {slots.map(({ label, sub, ref, file, set }) => (
          <div key={label} className="border border-gray-200 bg-white">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-800">{label}</p>
                <p className="text-[10px] text-gray-400">{sub}</p>
              </div>
              {file && <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold"><Check className="h-3 w-3"/>Loaded</span>}
            </div>
            <div className="p-5">
              {file
                ? <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200">
                    <FileText className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span className="text-xs font-medium text-emerald-700 flex-1 truncate">{file.name}</span>
                    <span className="text-[10px] text-emerald-500 shrink-0">{(file.size / 1024).toFixed(0)} KB</span>
                    <button onClick={() => { set(null); setError(null); }} className="text-emerald-500 hover:text-emerald-700 ml-1">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                : <button onClick={() => ref.current?.click()}
                    className="w-full flex flex-col items-center justify-center py-10 border-2 border-dashed border-gray-200 hover:border-gray-400 transition-colors group">
                    <Upload className="h-7 w-7 text-gray-300 group-hover:text-gray-500 mb-2.5" />
                    <p className="text-sm text-gray-400 group-hover:text-gray-600 font-medium">Click to upload</p>
                    <p className="text-[11px] text-gray-300 mt-1">CSV · XLSX · TSV · ODS · TXT · up to 50 MB</p>
                  </button>
              }
              <input ref={ref} type="file" accept={ACCEPTED_EXTS} className="hidden"
                onChange={e => { set(e.target.files?.[0] ?? null); setError(null); e.target.value = ""; }} />
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="mt-4 p-4 border border-red-200 bg-red-50 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {bankFile && ledgerFile && !error && (
        <div className="mt-5 flex items-center justify-between p-4 border border-emerald-200 bg-emerald-50">
          <div>
            <p className="text-sm font-bold text-emerald-800">Ready to reconcile</p>
            <p className="text-xs text-emerald-600 mt-0.5">The engine will match transactions automatically.</p>
          </div>
          <button onClick={handleRun} disabled={parsing}
            className="h-9 px-5 bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2 shrink-0">
            {parsing
              ? <><motion.div animate={{rotate:360}} transition={{duration:1,repeat:Infinity,ease:"linear"}}><RefreshCw className="h-3.5 w-3.5"/></motion.div>Running...</>
              : "Run now"
            }
          </button>
        </div>
      )}

      <div className="mt-8 border border-gray-100 p-5 bg-gray-50">
        <p className="text-xs font-semibold text-gray-500 mb-3">Accepted formats and column layout</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">File formats</p>
            <div className="bg-white border border-gray-200 p-2 space-y-0.5">
              {[
                ["CSV",  "Comma-separated (.csv)"],
                ["TSV",  "Tab-separated (.tsv, .txt)"],
                ["XLSX", "Excel workbook (.xlsx, .xls)"],
                ["ODS",  "LibreOffice Calc (.ods)"],
                ["Auto", "Delimiter auto-detected (,  ;  |  tab)"],
              ].map(([fmt, desc]) => (
                <div key={fmt} className="flex items-baseline gap-2">
                  <span className="text-[9px] font-bold text-gray-400 w-8 shrink-0">{fmt}</span>
                  <span className="text-[10px] text-gray-500">{desc}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">Required columns</p>
            <code className="block text-[10px] text-gray-500 bg-white border border-gray-200 p-2 leading-relaxed whitespace-pre">{"Date, Description, Amount\n\nor:\nDate, Description, Debit, Credit"}</code>
            <p className="text-[10px] text-gray-400 mt-2 font-bold uppercase">Dates</p>
            <div className="bg-white border border-gray-200 p-2 space-y-0.5 mt-1">
              {["YYYY-MM-DD", "DD/MM/YYYY", "DD-MM-YYYY", "MM/DD/YYYY"].map(f => (
                <p key={f} className="text-[10px] text-gray-500 font-mono">{f}</p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Jobs / workspace view ─────────────────────────────────────────────────────

function JobsView({
  rows, setRows, addAudit, jobId,
}: {
  rows: ReconRow[];
  setRows: React.Dispatch<React.SetStateAction<ReconRow[]>>;
  addAudit: (a: Omit<AuditEntry, "ts" | "user">) => void;
  jobId: string;
}) {
  const [selected, setSelected] = useState<ReconRow | null>(null);
  const [filter, setFilter]     = useState<TxStatus | "all">("all");
  const [search, setSearch]     = useState("");

  const counts: Record<string, number> = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    STATUS_ORDER.forEach(s => { c[s] = rows.filter(r => r.status === s).length; });
    return c;
  }, [rows]);

  const searched = search
    ? rows.filter(r =>
        r.bank?.desc.toLowerCase().includes(search.toLowerCase()) ||
        r.ledger?.desc.toLowerCase().includes(search.toLowerCase()) ||
        r.bank?.id.toLowerCase().includes(search.toLowerCase()) ||
        r.ledger?.id.toLowerCase().includes(search.toLowerCase())
      )
    : rows;

  function handleAction(row: ReconRow, action: "approve" | "reject" | "manual") {
    const actionType: ActionType = action === "approve" ? "approve_match" : action === "reject" ? "reject_match" : "mark_manual";
    const userStatus = action === "approve" ? "approved" : action === "reject" ? "rejected" : "manual";
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, userStatus } : r));
    addAudit({ job_id: jobId, action: actionType, target_id: row.id, prev: row.userStatus, next: userStatus });
    setSelected(null);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filter tabs + search */}
      <div className="px-4 sm:px-6 py-3 border-b border-gray-200 bg-white shrink-0 flex items-center gap-2 overflow-x-auto">
        {(["all", ...STATUS_ORDER] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`shrink-0 flex items-center gap-1 h-8 px-2.5 text-[11px] font-semibold transition-colors border
              ${filter === s
                ? "bg-gray-900 text-white border-gray-900"
                : "text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-800"
              }`}
          >
            {s === "all" ? "All" : STATUS_CFG[s as TxStatus].short}
            <span className={`text-[10px] px-1 py-0.5 font-bold min-w-[18px] text-center
              ${filter === s ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>
              {counts[s] ?? 0}
            </span>
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 border border-gray-200 px-3 h-8 shrink-0">
          <Search className="h-3.5 w-3.5 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
            className="w-24 sm:w-32 text-xs outline-none bg-transparent text-gray-700 placeholder-gray-300" />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <ReconTable rows={searched} onSelect={setSelected} selectedId={selected?.id} filter={filter} />
      </div>

      {/* Review panel */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div initial={{ opacity:0 }} animate={{ opacity:0.3 }} exit={{ opacity:0 }}
              className="fixed inset-0 bg-black z-30" onClick={() => setSelected(null)} />
            <ReviewPanel
              row={selected}
              onClose={() => setSelected(null)}
              onApprove={() => handleAction(selected, "approve")}
              onReject={() => handleAction(selected, "reject")}
              onManual={() => handleAction(selected, "manual")}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Review Queue view ─────────────────────────────────────────────────────────

function ReviewQueueView({
  rows, setRows, addAudit, jobId,
}: {
  rows: ReconRow[];
  setRows: React.Dispatch<React.SetStateAction<ReconRow[]>>;
  addAudit: (a: Omit<AuditEntry, "ts" | "user">) => void;
  jobId: string;
}) {
  const [confFilter, setConfFilter] = useState(100);
  const [statusFilter, setStatusFilter] = useState<TxStatus | "all">("all");
  const [selected, setSelected] = useState<ReconRow | null>(null);

  const queue = rows.filter(r =>
    (r.status === "possible_match" || r.status === "manual_review" ||
     r.status === "invalid_row"   || r.status === "unmatched_bank" ||
     r.status === "unmatched_ledger") &&
    r.confidence <= confFilter &&
    (statusFilter === "all" || r.status === statusFilter) &&
    !r.userStatus
  );

  function handleAction(row: ReconRow, action: "approve" | "reject" | "manual") {
    const actionType: ActionType = action === "approve" ? "approve_match" : action === "reject" ? "reject_match" : "mark_manual";
    const userStatus = action === "approve" ? "approved" : action === "reject" ? "rejected" : "manual";
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, userStatus } : r));
    addAudit({ job_id: jobId, action: actionType, target_id: row.id, next: userStatus });
    setSelected(null);
  }

  return (
    <div className="p-6 sm:p-8 max-w-5xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Exceptions</h1>
          <p className="text-sm text-gray-400 mt-1">{queue.length} item{queue.length !== 1 && "s"} escalated by the engine — your sign-off required</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] text-gray-400 font-semibold hidden sm:block">CONFIDENCE MAX</span>
          <select value={confFilter} onChange={e => setConfFilter(Number(e.target.value))}
            className="border border-gray-200 text-xs px-2 h-8 text-gray-700 focus:outline-none">
            {[100, 90, 80, 70, 50].map(v => <option key={v} value={v}>{v}%</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
            className="border border-gray-200 text-xs px-2 h-8 text-gray-700 focus:outline-none">
            <option value="all">All statuses</option>
            {(["possible_match","manual_review","invalid_row","unmatched_bank","unmatched_ledger"] as TxStatus[]).map(s =>
              <option key={s} value={s}>{STATUS_CFG[s].label}</option>
            )}
          </select>
        </div>
      </div>

      {queue.length === 0 ? (
        <div className="border border-gray-200 py-24 flex flex-col items-center bg-white">
          <CheckCircle2 className="h-12 w-12 text-emerald-400 mb-3" />
          <p className="text-sm font-semibold text-gray-600">No exceptions</p>
          <p className="text-xs text-gray-400 mt-1">The engine handled everything — nothing needs your attention</p>
        </div>
      ) : (
        <div className="space-y-2">
          {queue.map(row => {
            const tx = row.bank ?? row.ledger;
            return (
              <div key={row.id} className="border border-gray-200 bg-white hover:border-gray-300 transition-colors">
                <div className="flex items-start sm:items-center gap-3 sm:gap-4 px-4 sm:px-5 py-4">
                  <div className={`w-1 self-stretch shrink-0 ${STATUS_CFG[row.status].dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <StatusBadge status={row.status} />
                      {row.warnings.length > 0 && (
                        <span className="text-[10px] text-amber-600 flex items-center gap-0.5">
                          <AlertTriangle className="h-3 w-3" />{row.warnings.length} warning{row.warnings.length > 1 && "s"}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-gray-800 truncate">{tx?.desc ?? "—"}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5 font-mono">{tx?.id} · {tx?.date}</p>
                    <div className="flex items-center gap-3 mt-2 sm:hidden">
                      <p className={`text-sm font-bold ${tx && tx.amt >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {tx ? fmt(tx.amt) : "—"}
                      </p>
                      {row.confidence > 0 && <div className="w-24"><ConfBar pct={row.confidence} /></div>}
                    </div>
                  </div>
                  <div className="text-right shrink-0 hidden sm:block">
                    <p className={`text-sm font-bold ${tx && tx.amt >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {tx ? fmt(tx.amt) : "—"}
                    </p>
                    <div className="mt-1 w-32"><ConfBar pct={row.confidence} /></div>
                  </div>
                  <button onClick={() => setSelected(row)}
                    className="h-9 px-3 sm:px-4 border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 flex items-center gap-1.5 shrink-0">
                    <Eye className="h-3.5 w-3.5" /><span className="hidden sm:inline">Sign off</span>
                  </button>
                </div>
                {row.warnings.slice(0, 2).map(w => (
                  <div key={w} className="flex items-start gap-2 px-5 py-2 bg-amber-50 border-t border-amber-100">
                    <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-amber-700">{w}</p>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {selected && (
          <>
            <motion.div initial={{ opacity:0 }} animate={{ opacity:0.3 }} exit={{ opacity:0 }}
              className="fixed inset-0 bg-black z-30" onClick={() => setSelected(null)} />
            <ReviewPanel
              row={selected}
              onClose={() => setSelected(null)}
              onApprove={() => handleAction(selected, "approve")}
              onReject={() => handleAction(selected, "reject")}
              onManual={() => handleAction(selected, "manual")}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Audit log view ────────────────────────────────────────────────────────────

function AuditLogView({ log, onExport, jobId }: { log: AuditEntry[]; onExport: () => void; jobId: string }) {
  return (
    <div className="p-6 sm:p-8 max-w-4xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Audit Log</h1>
          <p className="text-sm text-gray-400 mt-1">{log.length} entries{jobId ? ` · ${jobId}` : ""}</p>
        </div>
        <button onClick={onExport}
          className="self-start sm:self-auto flex items-center gap-2 h-9 px-4 border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50">
          <Download className="h-3.5 w-3.5" /> Export JSON
        </button>
      </div>

      {log.length === 0 ? (
        <div className="border border-gray-200 py-16 sm:py-24 flex flex-col items-center bg-white">
          <Clock className="h-10 w-10 sm:h-12 sm:w-12 text-gray-300 mb-3" />
          <p className="text-sm font-semibold text-gray-500">No actions recorded yet</p>
          <p className="text-xs text-gray-400 mt-1 text-center px-4">Actions in the Review Queue and Workspace will appear here</p>
        </div>
      ) : (
        <>
          {/* Mobile card view */}
          <div className="sm:hidden space-y-2">
            {[...log].reverse().map((entry, i) => (
              <div key={i} className={`border border-gray-200 p-4 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                <div className="flex items-center gap-1.5 font-semibold text-gray-700 text-xs mb-1">
                  {entry.action === "approve_match" && <ThumbsUp className="h-3 w-3 text-emerald-500" />}
                  {entry.action === "reject_match"  && <ThumbsDown className="h-3 w-3 text-red-500" />}
                  {entry.action === "mark_manual"   && <Edit3 className="h-3 w-3 text-amber-500" />}
                  {(entry.action === "export_json" || entry.action === "export_pdf") && <Download className="h-3 w-3 text-gray-400" />}
                  {ACTION_LABELS[entry.action]}
                </div>
                <p className="text-[10px] font-mono text-gray-400">{entry.target_id}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-[10px] text-gray-400">{new Date(entry.ts).toLocaleTimeString("en-ZA")}</p>
                  {entry.next && <span className="text-[10px] font-semibold text-gray-600">{entry.next}</span>}
                </div>
              </div>
            ))}
          </div>
          {/* Desktop table view */}
          <div className="hidden sm:block border border-gray-200 bg-white overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {["Timestamp","Action","Target ID","Previous","New value","User"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...log].reverse().map((entry, i) => (
                  <tr key={i} className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                    <td className="px-4 py-3 font-mono text-gray-500 text-[10px] whitespace-nowrap">{new Date(entry.ts).toLocaleTimeString("en-ZA")}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="flex items-center gap-1.5 font-semibold text-gray-700">
                        {entry.action === "approve_match" && <ThumbsUp className="h-3 w-3 text-emerald-500" />}
                        {entry.action === "reject_match"  && <ThumbsDown className="h-3 w-3 text-red-500" />}
                        {entry.action === "mark_manual"   && <Edit3 className="h-3 w-3 text-amber-500" />}
                        {(entry.action === "export_json" || entry.action === "export_pdf") && <Download className="h-3 w-3 text-gray-400" />}
                        {ACTION_LABELS[entry.action]}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-400 whitespace-nowrap">{entry.target_id}</td>
                    <td className="px-4 py-3 text-gray-400">{entry.prev ?? "—"}</td>
                    <td className="px-4 py-3 font-semibold text-gray-700">{entry.next ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-400">{entry.user}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── Settings view ─────────────────────────────────────────────────────────────

function SettingsView({ company, setCompany, bank, setBank, ledger, setLedger }:
  { company:string; setCompany:(v:string)=>void; bank:string; setBank:(v:string)=>void; ledger:string; setLedger:(v:string)=>void }) {
  return (
    <div className="p-6 sm:p-8 max-w-xl mx-auto w-full">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Settings</h1>
      <p className="text-sm text-gray-400 mb-6">Configure company info and matching preferences.</p>

      <div className="border border-gray-200 bg-white divide-y divide-gray-100">
        {[
          { label:"Company name",        val:company, set:setCompany, placeholder:"e.g. Acme Trading (Pty) Ltd" },
          { label:"Bank institution",    val:bank,    set:setBank,    placeholder:"e.g. FNB Business" },
          { label:"Ledger software",     val:ledger,  set:setLedger,  placeholder:"e.g. Xero" },
        ].map(({ label, val, set, placeholder }) => (
          <div key={label} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <label className="text-xs font-semibold text-gray-600 sm:w-40 shrink-0">{label}</label>
            <input value={val} onChange={e => set(e.target.value)} placeholder={placeholder}
              className="flex-1 h-9 border border-gray-200 px-3 text-sm text-gray-900 focus:outline-none focus:border-gray-400" />
          </div>
        ))}
      </div>

      <div className="mt-6 border border-gray-200 bg-white divide-y divide-gray-100">
        <div className="px-5 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-700">Date tolerance</p>
            <p className="text-[10px] text-gray-400">Max days apart for a possible match</p>
          </div>
          <select className="border border-gray-200 text-xs px-2 h-8 text-gray-700 focus:outline-none shrink-0">
            <option>1 day</option><option>2 days</option><option>3 days</option><option>7 days</option>
          </select>
        </div>
        <div className="px-5 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-700">Confidence threshold</p>
            <p className="text-[10px] text-gray-400">Minimum confidence to auto-approve</p>
          </div>
          <select className="border border-gray-200 text-xs px-2 h-8 text-gray-700 focus:outline-none shrink-0">
            <option>100%</option><option>95%</option><option>90%</option>
          </select>
        </div>
        <div className="px-5 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-700">OCR validation</p>
            <p className="text-[10px] text-gray-400">Flag rows with suspected OCR errors</p>
          </div>
          <button className="relative w-10 h-5 bg-emerald-500 flex items-center shrink-0">
            <span className="absolute right-0.5 w-4 h-4 bg-white shadow-sm" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PDF + JSON export helpers ─────────────────────────────────────────────────

async function loadImgDataUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image(); img.crossOrigin = "anonymous";
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext("2d")!.drawImage(img, 0, 0);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = reject; img.src = url;
  });
}

async function exportPDF(rows: ReconRow[], auditLog: AuditEntry[], company: string, bankInst: string, ledgerSoft: string, bank: Tx[], ledger: Tx[], jobId: string, period: string) {
  const logoData = await loadImgDataUrl(addupLogo).catch(() => null);
  const doc = new jsPDF({ unit:"mm", format:"a4" });

  const W=210, H=297, ML=18, MR=18, CW=W-ML-MR, RX=W-MR;
  const genDate = new Date().toLocaleDateString("en-ZA",{day:"2-digit",month:"long",year:"numeric"});
  const genTs   = new Date().toLocaleString("en-ZA");
  const reportRef = `RPT-${(jobId||"XXXXXXXX").slice(4,12).toUpperCase()}-001`;

  const clr  = (r:number,g:number,b:number) => doc.setTextColor(r,g,b);
  const fill = (r:number,g:number,b:number) => doc.setFillColor(r,g,b);
  const strk = (r:number,g:number,b:number) => doc.setDrawColor(r,g,b);
  const lw   = (w:number) => doc.setLineWidth(w);
  const fnt  = (s:"normal"|"bold") => doc.setFont("helvetica",s);
  const sz   = (s:number) => doc.setFontSize(s);
  const txt  = (t:string,x:number,y:number,o?:any) => doc.text(t,x,y,o);
  const hln  = (y:number,x1=ML,x2=RX,w=0.2,c:[number,number,number]=[229,231,235]) => {
    strk(...c); lw(w); doc.line(x1,y,x2,y);
  };

  const STATUS_COLOR: Record<TxStatus,[number,number,number]> = {
    matched:          [16,185,129],
    possible_match:   [37,99,235],
    manual_review:    [217,119,6],
    invalid_row:      [220,38,38],
    unmatched_bank:   [234,88,12],
    unmatched_ledger: [147,51,234],
  };

  let page = 1;

  const addFooter = (p:number) => {
    const fy = H-10;
    hln(fy-4,ML,RX,0.2,[209,213,219]);
    fnt("normal"); sz(6.5); clr(156,163,175);
    txt(`CONFIDENTIAL  |  ${company}  |  ${reportRef}  |  ${period}`, ML, fy);
    txt(`Page ${p}`, RX, fy, {align:"right"});
    if (logoData) doc.addImage(logoData,"PNG",W/2-7,fy-3,14,4.5);
    else { fnt("bold"); clr(107,114,128); txt("Addup",W/2,fy,{align:"center"}); }
  };

  const addHeader = (title:string, p:number) => {
    fill(248,250,252); doc.rect(0,0,W,13,"F");
    hln(13,0,W,0.3,[209,213,219]);
    fnt("bold"); sz(7.5); clr(55,65,81);
    txt("BANK RECONCILIATION REPORT", ML, 9);
    fnt("normal"); clr(156,163,175);
    txt(`${company}  |  ${period}  |  ${title}`, RX, 9, {align:"right"});
    addFooter(p);
  };

  const newPage = (title:string) => {
    doc.addPage(); page++;
    addHeader(title, page);
    return 22;
  };

  // ── COVER PAGE ──────────────────────────────────────────────────────────────
  // Left accent bar
  fill(16,185,129); doc.rect(0,0,6,H,"F");

  // Logo
  if (logoData) doc.addImage(logoData,"PNG",ML+2,28,38,12);
  else { fnt("bold"); sz(22); clr(17,17,17); txt("Addup",ML+2,44); }

  sz(7.5); fnt("bold"); clr(107,114,128);
  txt("BANK RECONCILIATION REPORT", ML+2, 48);
  sz(7); fnt("normal"); clr(156,163,175);
  txt("Prepared for submission to SARS / Independent Auditors", ML+2, 54);

  hln(60, ML+2, W-12, 0.5, [209,213,219]);

  let cy = 72;
  sz(7); fnt("bold"); clr(107,114,128); txt("TAXPAYER / ENTITY NAME", ML+2, cy); cy+=6;
  sz(22); fnt("bold"); clr(17,17,17); txt(company, ML+2, cy); cy+=10;
  hln(cy, ML+2, W-12, 0.2); cy+=8;

  const cdet = (label:string, val:string, x:number, y:number) => {
    sz(6.5); fnt("bold"); clr(156,163,175); txt(label,x,y);
    sz(8.5); fnt("normal"); clr(17,17,17); txt(val,x,y+5);
  };
  cdet("RECONCILIATION PERIOD",  period,            ML+2,    cy);
  cdet("BANK INSTITUTION",       bankInst,          ML+2+90, cy); cy+=13;
  cdet("ACCOUNTING SOFTWARE",    ledgerSoft,        ML+2,    cy);
  cdet("JOB REFERENCE",          jobId,             ML+2+90, cy); cy+=13;
  cdet("REPORT REFERENCE",       reportRef,         ML+2,    cy);
  cdet("DATE GENERATED",         genDate,           ML+2+90, cy); cy+=13;
  cdet("TAX REFERENCE NUMBER",   "_______________________________", ML+2,    cy);
  cdet("VAT REGISTRATION NO.",   "_______________________________", ML+2+90, cy); cy+=13;
  cdet("REGISTERED ADDRESS",     "_______________________________", ML+2,    cy);
  cdet("FINANCIAL YEAR END",     "_______________________________", ML+2+90, cy); cy+=18;

  hln(cy, ML+2, W-12, 0.3); cy+=8;

  // KPI bar
  const matched  = rows.filter(r=>r.status==="matched").length;
  const possible = rows.filter(r=>r.status==="possible_match").length;
  const manual   = rows.filter(r=>r.status==="manual_review").length;
  const invalid  = rows.filter(r=>r.status==="invalid_row").length;
  const uBank    = rows.filter(r=>r.status==="unmatched_bank").length;
  const uLedger  = rows.filter(r=>r.status==="unmatched_ledger").length;
  const conf     = bank.length > 0 ? Math.round(matched/bank.length*100) : 0;
  const exceptions = rows.filter(r=>r.status!=="matched");

  const kpis = [
    {val:`${matched}/${bank.length}`, lbl:"AUTO-MATCHED"},
    {val:`${conf}%`,                  lbl:"CONFIDENCE"},
    {val:`${possible}`,               lbl:"NEEDS REVIEW"},
    {val:`${manual+invalid+uBank+uLedger}`, lbl:"EXCEPTIONS"},
  ];
  const kw = (CW-6)/4;
  fill(248,250,252); doc.rect(ML+2,cy,CW-4,26,"F");
  strk(229,231,235); lw(0.2); doc.rect(ML+2,cy,CW-4,26,"S");
  kpis.forEach((k,i)=>{
    const kx=ML+2+i*kw;
    if(i>0){strk(229,231,235);lw(0.2);doc.line(kx,cy+3,kx,cy+23);}
    sz(17); fnt("bold"); clr(17,17,17); txt(k.val,kx+kw/2,cy+15,{align:"center"});
    sz(6); fnt("bold"); clr(156,163,175); txt(k.lbl,kx+kw/2,cy+23,{align:"center"});
  });
  cy+=34;

  // Confidentiality notice
  fill(255,251,235); doc.rect(ML+2,cy,CW-4,18,"F");
  strk(251,191,36); lw(0.2); doc.rect(ML+2,cy,CW-4,18,"S");
  sz(7.5); fnt("bold"); clr(146,64,14); txt("CONFIDENTIAL — RESTRICTED DISTRIBUTION", ML+7,cy+6);
  sz(7); fnt("normal"); clr(120,53,15);
  const cn=doc.splitTextToSize(
    "This document contains privileged and confidential financial information. It is prepared solely for "+company+", their designated auditors, and the South African Revenue Service (SARS). Unauthorised reproduction, disclosure or distribution is strictly prohibited. This report is prepared in accordance with the requirements of the Income Tax Act 58 of 1962 and the Value-Added Tax Act 89 of 1991.",
    CW-12
  );
  doc.text(cn,ML+7,cy+11);

  addFooter(page);

  // ── PAGE 2: RECONCILIATION STATEMENT ────────────────────────────────────────
  let y = newPage("RECONCILIATION STATEMENT");

  sz(11); fnt("bold"); clr(17,17,17); txt("1.  Reconciliation Opinion",ML,y); y+=7;
  hln(y); y+=5;

  sz(8.5); fnt("normal"); clr(55,65,81);
  const opinion = doc.splitTextToSize(
    conf>=80
      ? `Based on an automated reconciliation of ${bank.length} bank transactions against ${ledger.length} general ledger entries for the period ${period}, a total of ${matched} transactions (${conf}%) were matched with high confidence. The remaining ${exceptions.length} items are catalogued in the Exceptions Register (Section 4) and must be resolved by the responsible accountant before this reconciliation can be finalised and submitted.`
      : `The automated reconciliation for ${period} has identified material discrepancies that require resolution prior to submission. Of ${bank.length} bank transactions reviewed, ${matched} were matched automatically. The remaining ${exceptions.length} items in the Exceptions Register (Section 4) require corrective action.`,
    CW
  );
  doc.text(opinion,ML,y); y+=opinion.length*4.5+8;

  sz(11); fnt("bold"); clr(17,17,17); txt("2.  Summary Statistics",ML,y); y+=7;
  hln(y); y+=5;

  // Summary table header
  const sCols=[{h:"Category",x:ML,w:90},{h:"Count",x:ML+90,w:22,r:true},{h:"Total (ZAR)",x:ML+112,w:38,r:true},{h:"Status",x:ML+150,w:CW-150}];
  fill(30,41,59); doc.rect(ML,y,CW,7,"F");
  sCols.forEach(c=>{
    sz(6.5); fnt("bold"); clr(255,255,255);
    txt(c.h, c.r ? c.x+c.w : c.x+2, y+5, {align:c.r?"right":"left"});
  });
  y+=7;

  const zarSum = (status:TxStatus) => {
    const sum = rows.filter(r=>r.status===status).reduce((a,r)=>{
      return a+Math.abs(r.bank?.amt??0)+Math.abs(r.ledger?.amt??0);
    },0);
    return `R ${sum.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,",")}`;
  };

  const sumRows=[
    {cat:"Auto-matched Transactions",              cnt:matched,  zar:zarSum("matched"),          ok:true},
    {cat:"Possible Matches — Review Required",     cnt:possible, zar:zarSum("possible_match"),   ok:false},
    {cat:"Manual Review Items",                    cnt:manual,   zar:zarSum("manual_review"),    ok:false},
    {cat:"Invalid / Unprocessable Rows",           cnt:invalid,  zar:zarSum("invalid_row"),      ok:false},
    {cat:"Unmatched Bank Transactions",            cnt:uBank,    zar:zarSum("unmatched_bank"),   ok:false},
    {cat:"Unmatched Ledger Entries",               cnt:uLedger,  zar:zarSum("unmatched_ledger"), ok:false},
  ];
  sumRows.forEach((r,i)=>{
    if(i%2===0){fill(248,250,252);}else{fill(255,255,255);}
    doc.rect(ML,y,CW,7,"F");
    strk(229,231,235); lw(0.1); doc.rect(ML,y,CW,7,"S");
    sz(8); fnt("normal"); clr(55,65,81); txt(r.cat,ML+2,y+5);
    fnt("bold"); clr(17,17,17); txt(String(r.cnt),ML+90+22,y+5,{align:"right"});
    fnt("normal"); clr(55,65,81); txt(r.zar,ML+112+38,y+5,{align:"right"});
    const [cr,cg,cb]=r.ok?[16,185,129]:[217,119,6];
    fill(cr,cg,cb); doc.circle(ML+155,y+3.5,1.5,"F");
    sz(7); fnt("normal"); clr(r.ok?4:120,r.ok?120:53,r.ok?64:15);
    txt(r.ok?"Compliant":"Action Required",ML+159,y+5);
    y+=7;
  });
  y+=4;

  // Totals
  const tBank   = bank.reduce((a,b)=>a+Math.abs(b.amt),0);
  const tLedger = ledger.reduce((a,l)=>a+Math.abs(l.amt),0);
  const discAmt = Math.abs(tBank-tLedger);
  const fmtR    = (n:number)=>`R ${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,",")}`;

  fill(241,245,249); strk(209,213,219); lw(0.3);
  doc.rect(ML,y,CW,14,"FD");
  sz(7.5); fnt("bold"); clr(107,114,128);
  txt("BANK STATEMENT GROSS TOTAL (ABS)",ML+2,y+5);
  sz(9); fnt("bold"); clr(17,17,17); txt(fmtR(tBank),RX,y+5,{align:"right"});
  sz(7.5); fnt("bold"); clr(107,114,128);
  txt("GENERAL LEDGER GROSS TOTAL (ABS)",ML+2,y+12);
  sz(9); fnt("bold"); clr(17,17,17); txt(fmtR(tLedger),RX,y+12,{align:"right"});
  y+=18;

  const discOk = discAmt<0.01;
  fill(discOk?240:254, discOk?253:242, discOk?244:242);
  strk(discOk?134:252, discOk?239:165, discOk?172:165); lw(0.3);
  doc.rect(ML,y,CW,10,"FD");
  sz(8); fnt("bold");
  clr(discOk?4:153, discOk?120:27, discOk?64:27);
  txt(
    discOk
      ? `NET DISCREPANCY: R 0.00  (FULLY RECONCILED)`
      : `NET DISCREPANCY: ${fmtR(discAmt)}  (UNRECONCILED — REQUIRES RESOLUTION BEFORE SUBMISSION)`,
    ML+4, y+6.5
  );

  // ── PAGE 3: FULL TRANSACTION REGISTER ───────────────────────────────────────
  y = newPage("TRANSACTION REGISTER");

  sz(11); fnt("bold"); clr(17,17,17); txt("3.  Full Transaction Register",ML,y); y+=5;
  sz(7.5); fnt("normal"); clr(107,114,128);
  txt(`${bank.length} bank transactions and ${ledger.length} ledger entries for ${period}. All amounts in South African Rand (ZAR).`,ML,y); y+=8;

  const tCols=[
    {h:"Row",       x:ML,      w:12},
    {h:"Date",      x:ML+12,   w:22},
    {h:"Description",x:ML+34,  w:56},
    {h:"Amount (R)",x:ML+90,   w:30, r:true},
    {h:"Bank Ref",  x:ML+120,  w:16},
    {h:"Ledger Ref",x:ML+136,  w:16},
    {h:"Conf.",     x:ML+152,  w:13, r:true},
    {h:"Status",    x:ML+165,  w:CW-165},
  ];

  const drawTxHdr = () => {
    fill(30,41,59); doc.rect(ML,y,CW,7,"F");
    tCols.forEach(c=>{
      sz(6); fnt("bold"); clr(255,255,255);
      txt(c.h, c.r?c.x+c.w:c.x+1.5, y+5, {align:c.r?"right":"left"});
    });
    y+=7;
  };
  drawTxHdr();

  const sorted=[...rows].sort((a,b)=>{
    const da=a.bank?.date||a.ledger?.date||"";
    const db=b.bank?.date||b.ledger?.date||"";
    return da.localeCompare(db);
  });

  sorted.forEach((row,i)=>{
    if(y>272){
      addFooter(page); y=newPage("TRANSACTION REGISTER (CONT.)");
      drawTxHdr();
    }
    const tx=row.bank||row.ledger;
    if(i%2===0){fill(248,250,252);}else{fill(255,255,255);}
    doc.rect(ML,y,CW,7,"F");
    strk(229,231,235); lw(0.1); doc.rect(ML,y,CW,7,"S");
    const [sc1,sc2,sc3]=STATUS_COLOR[row.status];
    fill(sc1,sc2,sc3); doc.rect(ML,y,2.5,7,"F");

    sz(7.5); fnt("normal"); clr(107,114,128); txt(row.id,ML+3,y+5);
    clr(17,17,17); txt(tx?.date?fmtDate(tx.date):"—",ML+12+1,y+5);
    const desc=(tx?.desc||"—"); txt(desc.length>30?desc.slice(0,28)+"..":desc,ML+34+1,y+5);

    const amt=tx?.amt;
    if(amt!==undefined){
      fnt("bold");
      clr(amt>=0?4:185, amt>=0?120:28, amt>=0?64:28);
      txt(fmt(amt),ML+90+30,y+5,{align:"right"});
    } else {
      fnt("normal"); clr(209,213,219); txt("—",ML+90+30,y+5,{align:"right"});
    }

    fnt("normal"); clr(107,114,128);
    txt(row.bank?.id||"—",ML+120+1,y+5);
    txt(row.ledger?.id||"—",ML+136+1,y+5);

    if(row.confidence>0){
      fnt("bold");
      clr(
        row.confidence>=90?4:row.confidence>=70?37:146,
        row.confidence>=90?120:row.confidence>=70?99:64,
        row.confidence>=90?64:row.confidence>=70?235:14
      );
      txt(`${row.confidence}%`,ML+152+13,y+5,{align:"right"});
    } else {
      fnt("normal"); clr(209,213,219); txt("—",ML+152+13,y+5,{align:"right"});
    }

    sz(6.5); fnt("normal"); clr(107,114,128);
    txt(STATUS_CFG[row.status].label,ML+165+1,y+5);
    y+=7;
  });

  // ── PAGE 4+: EXCEPTIONS REGISTER ────────────────────────────────────────────
  y = newPage("EXCEPTIONS REGISTER");

  sz(11); fnt("bold"); clr(17,17,17); txt("4.  Exceptions Register",ML,y); y+=5;
  sz(7.5); fnt("normal"); clr(107,114,128);
  txt(`${exceptions.length} items require resolution before this reconciliation can be finalised and submitted to SARS.`,ML,y); y+=8;

  if(exceptions.length===0){
    fill(240,253,244); doc.rect(ML,y,CW,12,"F");
    strk(134,239,172); lw(0.2); doc.rect(ML,y,CW,12,"S");
    sz(9); fnt("bold"); clr(4,120,64); txt("No exceptions — all transactions reconciled successfully.",ML+4,y+8);
    y+=18;
  }

  exceptions.forEach((row)=>{
    const blockH=Math.max(22, 14+row.warnings.length*5+(row.reasons.length>0?5:0));
    if(y+blockH>272){y=newPage("EXCEPTIONS REGISTER (CONT.)");}

    const tx=row.bank||row.ledger;
    const [sc1,sc2,sc3]=STATUS_COLOR[row.status];

    fill(248,250,252); doc.rect(ML,y,CW,blockH,"F");
    strk(229,231,235); lw(0.2); doc.rect(ML,y,CW,blockH,"S");
    fill(sc1,sc2,sc3); doc.rect(ML,y,3,blockH,"F");

    sz(8); fnt("bold"); clr(17,17,17);
    txt(`${row.id}  —  ${STATUS_CFG[row.status].label}`,ML+6,y+5.5);
    sz(7.5); fnt("normal"); clr(107,114,128);
    const detLine=[tx?.date?fmtDate(tx.date):"—", tx?.desc||"—", tx?fmt(tx.amt):"—"].join("   |   ");
    txt(detLine,RX,y+5.5,{align:"right"});

    let ry=y+10;

    if(row.reasons.length>0){
      sz(7); fnt("normal"); clr(75,85,99);
      txt("Match signals: "+row.reasons.join("  ·  "),ML+6,ry); ry+=5;
    }

    row.warnings.forEach(w=>{
      sz(7.5); fnt("bold"); clr(153,27,27); txt("!", ML+6,ry);
      fnt("normal"); clr(55,65,81);
      const wl=doc.splitTextToSize(w,CW-14);
      doc.text(wl,ML+10,ry); ry+=wl.length*4.5;
    });

    // Required action
    sz(6.5); fnt("bold"); clr(sc1,sc2,sc3);
    txt("ACTION: "+row.action.replace(/_/g," ").toUpperCase(),ML+6,y+blockH-3);
    y+=blockH+3;
  });

  // ── PAGE: AUDIT TRAIL ────────────────────────────────────────────────────────
  y=newPage("AUDIT TRAIL");

  sz(11); fnt("bold"); clr(17,17,17); txt("5.  Audit Trail",ML,y); y+=5;
  sz(7.5); fnt("normal"); clr(107,114,128);
  txt(`Complete record of all system actions performed during reconciliation ${jobId}.`,ML,y); y+=8;

  fill(30,41,59); doc.rect(ML,y,CW,7,"F");
  [{h:"Timestamp",x:ML+2,w:0},{h:"Action Performed",x:ML+48,w:0},{h:"Target Reference",x:ML+108,w:0},{h:"User",x:RX,w:0,r:true}].forEach(c=>{
    sz(6.5); fnt("bold"); clr(255,255,255);
    txt(c.h,c.x,y+5,c.r?{align:"right"}:undefined);
  });
  y+=7;

  if(auditLog.length===0){
    fill(248,250,252); doc.rect(ML,y,CW,8,"F");
    sz(8); fnt("normal"); clr(156,163,175); txt("No actions recorded during this session.",ML+2,y+5.5);
    y+=12;
  } else {
    auditLog.forEach((e,i)=>{
      if(y>272){y=newPage("AUDIT TRAIL (CONT.)");}
      if(i%2===0){fill(248,250,252);}else{fill(255,255,255);}
      doc.rect(ML,y,CW,6.5,"F");
      strk(229,231,235); lw(0.1); doc.rect(ML,y,CW,6.5,"S");
      sz(7.5); fnt("normal"); clr(107,114,128);
      txt(new Date(e.ts).toLocaleString("en-ZA"),ML+2,y+4.5);
      clr(17,17,17); txt(ACTION_LABELS[e.action],ML+48,y+4.5);
      clr(107,114,128); txt(e.target_id,ML+108,y+4.5);
      txt(e.user,RX,y+4.5,{align:"right"});
      y+=6.5;
    });
    y+=4;
  }

  // ── DECLARATION & SIGN-OFF ───────────────────────────────────────────────────
  if(y>190){y=newPage("DECLARATION & SIGN-OFF");}

  sz(11); fnt("bold"); clr(17,17,17); txt("6.  Declaration & Sign-off",ML,y); y+=7;
  hln(y); y+=7;

  sz(8.5); fnt("normal"); clr(55,65,81);
  const decl=doc.splitTextToSize(
    `I, the undersigned, being a duly authorised representative of ${company}, hereby declare that the information contained in this Bank Reconciliation Report is true, accurate and complete to the best of my knowledge and belief. This reconciliation was performed for the period ${period} using ${bankInst} bank records and the ${ledgerSoft} general ledger. This report has been prepared for the purposes of compliance with the Income Tax Act 58 of 1962 and/or the Value-Added Tax Act 89 of 1991, and is available for inspection by the South African Revenue Service (SARS) upon request.`,
    CW
  );
  doc.text(decl,ML,y); y+=decl.length*4.5+10;

  // Signature blocks
  const sigBlock=(label:string,x:number,bw:number)=>{
    strk(107,114,128); lw(0.3); doc.line(x,y+14,x+bw,y+14);
    sz(7); fnt("normal"); clr(156,163,175); txt(label,x,y+18);
    doc.line(x,y+26,x+bw,y+26);
    txt("Date (DD / MM / YYYY)",x,y+30);
  };
  sigBlock("Full Name & Designation",ML,76);
  sigBlock("Reviewer / Authorised Signatory",ML+88,76);
  y+=38;

  // SARS office use block
  fill(248,250,252); strk(229,231,235); lw(0.2);
  doc.rect(ML,y,CW,20,"FD");
  sz(7); fnt("bold"); clr(107,114,128); txt("FOR OFFICIAL USE ONLY — SARS",ML+4,y+6);
  txt("SARS Case / Reference No.:",ML+4,y+13); strk(209,213,219); doc.line(ML+56,y+14,ML+120,y+14);
  txt("Date Received by SARS:",ML+125,y+13); doc.line(ML+168,y+14,RX,y+14);
  txt("SARS Branch / Office:",ML+4,y+19); doc.line(ML+44,y+20,ML+100,y+20);
  txt("Assessment Ref. No.:",ML+105,y+19); doc.line(ML+145,y+20,RX,y+20);
  y+=28;

  // Generated by
  hln(y); y+=5;
  sz(6.5); fnt("normal"); clr(156,163,175);
  txt(`Generated by Addup Reconciliation Engine  |  ${genTs}  |  Job: ${jobId}  |  Ref: ${reportRef}`,ML,y);

  const slug=(company||"report").toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9-]/g,"");
  doc.save(`Addup-Recon-${slug}-${(period||"report").replace(/\s+/g,"-")}.pdf`);
}

function exportJSON(rows: ReconRow[], auditLog: AuditEntry[], company: string, bank: Tx[], ledger: Tx[], jobId: string, period: string) {
  const data = {
    meta: { job_id: jobId, period, company, generated: now(), version:"1.0" },
    summary: {
      bank_transactions: bank.length, ledger_entries: ledger.length,
      matched: rows.filter(r=>r.status==="matched").length,
      possible_match: rows.filter(r=>r.status==="possible_match").length,
      manual_review: rows.filter(r=>r.status==="manual_review").length,
      invalid_rows: rows.filter(r=>r.status==="invalid_row").length,
      unmatched_bank: rows.filter(r=>r.status==="unmatched_bank").length,
      unmatched_ledger: rows.filter(r=>r.status==="unmatched_ledger").length,
      overall_confidence: bank.length > 0 ? Math.round(rows.filter(r=>r.status==="matched").length / bank.length * 100) : 0,
    },
    rows: rows.map(r=>({ id:r.id, status:r.status, confidence:r.confidence,
      bank_id: r.bank?.id, ledger_id: r.ledger?.id,
      reasons: r.reasons, warnings: r.warnings, user_decision: r.userStatus })),
    audit_log: auditLog,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:"application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `addup-${jobId || "report"}.json`; a.click();
  URL.revokeObjectURL(url);
}

// ── Header clock + calendar popup ─────────────────────────────────────────────

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_ABBRS   = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function HeaderClock() {
  const [now,      setNow]      = useState(() => new Date());
  const [open,     setOpen]     = useState(false);
  const [viewDate, setViewDate] = useState(() => new Date());
  const ref = useRef<HTMLDivElement>(null);

  // Tick every second
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Sync viewDate month to now when closed
  useEffect(() => {
    if (!open) setViewDate(new Date());
  }, [open]);

  // Click-outside to close
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Calendar grid helpers
  const today = new Date();
  const vy = viewDate.getFullYear();
  const vm = viewDate.getMonth();
  const firstDay  = new Date(vy, vm, 1).getDay();       // 0=Sun
  const daysInMon = new Date(vy, vm + 1, 0).getDate();

  function prevMonth() { setViewDate(new Date(vy, vm - 1, 1)); }
  function nextMonth() { setViewDate(new Date(vy, vm + 1, 1)); }

  const pad = (n: number) => String(n).padStart(2, "0");
  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const dateStr = `${pad(now.getDate())} ${MONTH_NAMES[now.getMonth()].slice(0,3)} ${now.getFullYear()}`;

  // Grid: leading empty cells + day numbers
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMon }, (_, i) => i + 1),
  ];
  // Pad to full rows
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 h-8 px-3 border transition-colors text-[11px] font-mono
          ${open
            ? "border-gray-400 bg-gray-50 text-gray-800"
            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-500"
          }`}
      >
        <CalendarDays className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        <span className="font-bold text-gray-700 tracking-tight hidden sm:inline">{timeStr}</span>
        <span className="text-gray-400 hidden md:inline">{dateStr}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-10 z-50 w-[272px] bg-white border border-gray-200 shadow-lg"
          >
            {/* Time display */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-2xl font-mono font-bold text-gray-900 tracking-tight">{timeStr}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {MONTH_NAMES[today.getMonth()]} {today.getDate()}, {today.getFullYear()}
                  {" · "}
                  {["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][today.getDay()]}
                </p>
              </div>
              <Clock className="h-5 w-5 text-gray-200" />
            </div>

            {/* Calendar */}
            <div className="p-4">
              {/* Month nav */}
              <div className="flex items-center justify-between mb-3">
                <button onClick={prevMonth} className="p-1 hover:bg-gray-100 transition-colors">
                  <ChevronLeft className="h-3.5 w-3.5 text-gray-500" />
                </button>
                <p className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                  {MONTH_NAMES[vm]} {vy}
                </p>
                <button onClick={nextMonth} className="p-1 hover:bg-gray-100 transition-colors">
                  <ChevronRight className="h-3.5 w-3.5 text-gray-500" />
                </button>
              </div>

              {/* Day-of-week headers */}
              <div className="grid grid-cols-7 mb-1">
                {DAY_ABBRS.map(d => (
                  <div key={d} className="text-center text-[9px] font-bold text-gray-300 uppercase py-1">{d}</div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-y-0.5">
                {cells.map((day, i) => {
                  const isToday = day !== null && vy === today.getFullYear() && vm === today.getMonth() && day === today.getDate();
                  return (
                    <div key={i} className="flex items-center justify-center">
                      {day !== null ? (
                        <span className={`w-7 h-7 flex items-center justify-center text-[11px] font-medium transition-colors
                          ${isToday
                            ? "bg-gray-900 text-white font-bold"
                            : "text-gray-600 hover:bg-gray-100 cursor-default"
                          }`}>
                          {day}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {/* Today shortcut */}
              {(vy !== today.getFullYear() || vm !== today.getMonth()) && (
                <button onClick={() => setViewDate(new Date())}
                  className="mt-3 w-full text-[10px] font-semibold text-gray-400 hover:text-gray-700 transition-colors py-1 border-t border-gray-100">
                  Back to today
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Engine ───────────────────────────────────────────────────────────────

export default function Engine() {
  const [loading,    setLoading]    = useState(true);
  const [nav,        setNav]        = useState<NavId>("uploads");
  const [sidebarOpen,setSidebarOpen]= useState(false);
  const [bankData,   setBankData]   = useState<Tx[]>([]);
  const [ledgerData, setLedgerData] = useState<Tx[]>([]);
  const [rows,       setRows]       = useState<ReconRow[]>([]);
  const [auditLog,   setAuditLog]   = useState<AuditEntry[]>([]);
  const [company,    setCompany]    = useState("");
  const [bankInst,   setBankInst]   = useState("");
  const [ledgerSoft, setLedgerSoft] = useState("");
  const [jobId,      setJobId]      = useState("");
  const [period,     setPeriod]     = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);

  const hasData = bankData.length > 0 && ledgerData.length > 0;
  const overallConf = hasData
    ? Math.round(rows.filter(r => r.status === "matched").length / bankData.length * 100)
    : 0;

  const addAudit = useCallback((a: Omit<AuditEntry, "ts" | "user">) => {
    setAuditLog(prev => [...prev, { ...a, ts: now(), user: "local_user" }]);
  }, []);

  function handleReconcile(bank: Tx[], ledger: Tx[], bankName: string, ledgerName: string) {
    const newJobId = `rec_${Date.now()}_001`;
    const newPeriod = derivePeriod(bank) || derivePeriod(ledger);
    const reconRows = runReconciliation(bank, ledger);
    setBankData(bank);
    setLedgerData(ledger);
    setRows(reconRows);
    setJobId(newJobId);
    setPeriod(newPeriod);
    if (!bankInst)   setBankInst(bankName.replace(/\.[^.]+$/, ""));
    if (!ledgerSoft) setLedgerSoft(ledgerName.replace(/\.[^.]+$/, ""));
    setAuditLog([]);
    setNav("dashboard");
  }

  const reviewCount = rows.filter(r =>
    (r.status === "possible_match" || r.status === "manual_review" ||
     r.status === "invalid_row" || r.status === "unmatched_bank" ||
     r.status === "unmatched_ledger") && !r.userStatus
  ).length;

  const NAV = [
    { id:"dashboard" as NavId, label:"Dashboard",    icon:<LayoutDashboard className="h-4 w-4"/> },
    { id:"uploads"   as NavId, label:"Uploads",      icon:<Upload className="h-4 w-4"/>          },
    { id:"jobs"      as NavId, label:"Reconciliation Jobs", icon:<Briefcase className="h-4 w-4"/> },
    { id:"review"    as NavId, label:"Exceptions",   icon:<AlertCircle className="h-4 w-4"/>, badge: reviewCount > 0 ? reviewCount : undefined },
    { id:"audit"     as NavId, label:"Audit Log",    icon:<Clock className="h-4 w-4"/>, badge: auditLog.length > 0 ? auditLog.length : undefined },
    { id:"settings"  as NavId, label:"Settings",     icon:<Settings2 className="h-4 w-4"/>       },
  ];

  function SidebarContent() {
    return (
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="px-5 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <Link href="/" onClick={() => setSidebarOpen(false)}>
            <img src={addupLogo} alt="Addup" className="h-6 w-auto" />
          </Link>
          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mt-1.5">
            Reconciliation Engine
          </p>
        </div>

        {/* Job summary */}
        <div className="px-4 py-3 border-b border-gray-100 shrink-0">
          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-2">Active Job</p>
          {hasData ? (
            <>
              <p className="text-[10px] font-mono text-gray-500 truncate">{jobId}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{period}{company ? ` · ${company}` : ""}</p>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-1 bg-gray-100">
                  <div className="h-full bg-emerald-500" style={{ width:`${overallConf}%` }} />
                </div>
                <span className="text-[10px] font-bold text-emerald-600">{overallConf}%</span>
              </div>
            </>
          ) : (
            <p className="text-[10px] text-gray-300 italic">No data loaded — upload files to begin</p>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {NAV.map(item => (
            <button key={item.id} onClick={() => { setNav(item.id); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors
                ${nav === item.id ? "bg-gray-100 text-gray-900" : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"}`}
            >
              <span className={nav === item.id ? "text-emerald-600" : "text-gray-400"}>{item.icon}</span>
              <span className="text-xs font-semibold flex-1">{item.label}</span>
              {item.badge !== undefined && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 min-w-[20px] text-center
                  ${nav === item.id ? "bg-gray-200 text-gray-700" : "bg-red-500 text-white"}`}>
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Export buttons */}
        <div className="px-4 py-4 border-t border-gray-100 space-y-2 shrink-0">
          <button
            onClick={async () => {
              setPdfLoading(true);
              addAudit({ job_id:jobId, action:"export_pdf", target_id:jobId });
              await exportPDF(rows, auditLog, company, bankInst, ledgerSoft, bankData, ledgerData, jobId, period);
              setPdfLoading(false);
            }}
            disabled={pdfLoading}
            className="w-full flex items-center justify-center gap-2 h-9 bg-gray-100 text-gray-700 text-[11px] font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            {pdfLoading
              ? <><motion.div animate={{rotate:360}} transition={{duration:1,repeat:Infinity,ease:"linear"}}><RefreshCw className="h-3.5 w-3.5"/></motion.div>Generating...</>
              : <><FileText className="h-3.5 w-3.5"/>Export PDF</>
            }
          </button>
          <button
            onClick={() => {
              addAudit({ job_id:jobId, action:"export_json", target_id:jobId });
              exportJSON(rows, auditLog, company, bankData, ledgerData, jobId, period);
            }}
            className="w-full flex items-center justify-center gap-2 h-9 border border-gray-200 text-gray-500 text-[11px] font-semibold hover:bg-gray-50 transition-colors"
          >
            <Download className="h-3.5 w-3.5"/>Export JSON
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <AnimatePresence>
        {loading && <Loader onDone={() => setLoading(false)} />}
      </AnimatePresence>

    <div className="flex h-screen bg-white overflow-hidden">

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-[240px] bg-white flex-col shrink-0 border-r border-gray-200">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar drawer */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div initial={{opacity:0}} animate={{opacity:0.4}} exit={{opacity:0}}
              className="fixed inset-0 bg-gray-900 z-40 lg:hidden" onClick={()=>setSidebarOpen(false)} />
            <motion.aside initial={{x:"-100%"}} animate={{x:0}} exit={{x:"-100%"}}
              transition={{type:"spring",stiffness:300,damping:30}}
              className="fixed left-0 top-0 h-full w-[240px] bg-white border-r border-gray-200 z-50 lg:hidden">
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar */}
        <header className="h-12 border-b border-gray-200 bg-white flex items-center px-4 gap-3 shrink-0">
          <button onClick={()=>setSidebarOpen(true)} className="lg:hidden p-1.5 hover:bg-gray-100 transition-colors">
            <Menu className="h-4 w-4 text-gray-600" />
          </button>
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Shield className="h-3.5 w-3.5 text-gray-300" />
            {hasData
              ? <span className="font-mono text-gray-500 truncate max-w-[140px]">{jobId}</span>
              : <span className="text-gray-300 italic">No job loaded</span>
            }
            <ChevronRight className="h-3 w-3" />
            <span className="font-semibold text-gray-700 capitalize">{nav.replace("_"," ")}</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {company && <span className="text-[10px] text-gray-400 hidden sm:block">{company}</span>}
            {hasData && (
              <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5">
                <BarChart3 className="h-3 w-3" />{overallConf}%
              </span>
            )}
            <HeaderClock />
          </div>
        </header>

        {/* View content */}
        <main className="flex-1 overflow-auto">
          {nav === "dashboard" && <DashboardView
              rows={rows} onNav={setNav}
              bankLen={bankData.length} ledgerLen={ledgerData.length}
              overallConf={overallConf} jobId={jobId} period={period}
              bankInst={bankInst} ledgerSoft={ledgerSoft}
              onBulkApprove={() => {
                const pending = rows.filter(r => r.status === "matched" && !r.userStatus);
                setRows(prev => prev.map(r => r.status === "matched" && !r.userStatus ? { ...r, userStatus: "approved" } : r));
                pending.forEach(r => addAudit({ job_id: jobId, action: "approve_match", target_id: r.id, next: "approved" }));
              }}
            />}
          {nav === "uploads"   && <UploadsView onReconcile={handleReconcile} />}
          {nav === "jobs"      && <JobsView rows={rows} setRows={setRows} addAudit={addAudit} jobId={jobId} />}
          {nav === "review"    && <ReviewQueueView rows={rows} setRows={setRows} addAudit={addAudit} jobId={jobId} />}
          {nav === "audit"     && <AuditLogView log={auditLog} jobId={jobId} onExport={() => {
              addAudit({ job_id:jobId, action:"export_json", target_id:jobId });
              exportJSON(rows, auditLog, company, bankData, ledgerData, jobId, period);
            }} />}
          {nav === "settings"  && <SettingsView company={company} setCompany={setCompany} bank={bankInst} setBank={setBankInst} ledger={ledgerSoft} setLedger={setLedgerSoft} />}
        </main>
      </div>
    </div>
    </>
  );
}
