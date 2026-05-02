import React, { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Upload, Briefcase, AlertCircle, Clock, Settings2,
  CheckCircle2, XCircle, AlertTriangle, HelpCircle,
  Download, FileText, Sparkles, RefreshCw, X, Check, Search,
  ThumbsUp, ThumbsDown, Edit3, Menu, ChevronRight,
  BarChart3, Shield, Activity, Eye, ChevronDown,
} from "lucide-react";
import addupLogo from "@assets/Addup_1777332904059.png";
import jsPDF from "jspdf";

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

// ── Data ──────────────────────────────────────────────────────────────────────

const JOB_ID = "rec_20260502151654_001";
const PERIOD = "April 2026";
const COMPANY = "Acme Trading (Pty) Ltd";
const BANK_INST = "FNB Business";
const LEDGER_SOFT = "Xero";

const BANK: Tx[] = [
  { id:"B001", date:"2026-04-01", desc:"CHECKERS HYPER POS #4412",   amt:-2850.00 },
  { id:"B002", date:"2026-04-03", desc:"PICK N PAY STORES #221",      amt:-1240.50 },
  { id:"B003", date:"2026-04-05", desc:"ESKOM PAYMENT ONLINE",        amt:-5600.00 },
  { id:"B004", date:"2026-04-25", desc:"SALARY CREDIT OLYXEE",        amt: 45000.00 },
  { id:"B005", date:"2026-04-07", desc:"MTN MOBILE MONTHLY",          amt: -799.00 },
  { id:"B006", date:"2026-04-10", desc:"UBER EATS ORDER",             amt: -340.00 },
  { id:"B007", date:"2026-04-15", desc:"NEDBANK EFT TRANSFER",        amt:-15000.00 },
  { id:"B008", date:"2026-04-20", desc:"COFFEE SHOP DOWNTOWN",        amt:    -4.50 },
  { id:"B009", date:"2026-04-28", desc:"WIRE TRANSFER INCOMING",      amt: 10000.00 },
];

const LEDGER: Tx[] = [
  { id:"L001", date:"2026-04-01", desc:"Checkers Hyper",              amt:-2850.00 },
  { id:"L002", date:"2026-04-04", desc:"Pik n Pay",                   amt:-1240.50,
    rawDesc:{ raw:"Pik n Pay", normalized:"Pick n Pay", confidence:0.72, issue:"Spelling variation" } },
  { id:"L003", date:"2026-04-05", desc:"Esk0m - electricity",         amt: -560.00,
    rawAmt:{ raw:"-560.00", normalized:"-5600.00", confidence:0.40, issue:"Possible OCR decimal shift" },
    rawDesc:{ raw:"Esk0m", normalized:"Eskom", confidence:0.65, issue:"OCR: letter O substituted for digit 0" },
    issues:["ocr_symbol","amount_mismatch"] },
  { id:"L004", date:"2026-04-25", desc:"Salary Payment",              amt: 45000.00 },
  { id:"L005", date:"2026-04-07", desc:"MTN Mobile",                  amt:  -799.00 },
  { id:"L006", date:"2026-04-11", desc:"Ubereats",                    amt:  -340.00 },
  { id:"L007", date:"2026-04-16", desc:"Bank Transfer EFT",           amt:-15000.00 },
  { id:"L008", date:"2O26-O4-O8", desc:"Office supplies",             amt:  -650.00,
    rawDate:{ raw:"2O26-O4-O8", normalized:"2026-04-08", confidence:0.0, issue:"OCR: letter O for digit 0 — unparseable" },
    issues:["invalid_date","ocr_symbol"] },
  { id:"L009", date:"2026-04-12", desc:"Refund received",             amt:-99999.00,
    rawAmt:{ raw:"-99,999.00", normalized:"unknown", confidence:0.0, issue:"Amount exceeds plausible threshold" },
    issues:["impossible_amount"] },
  { id:"L010", date:"2026-04-01", desc:"Checkers Hyper (duplicate)",  amt:-2850.00, issues:["duplicate"] },
  { id:"L011", date:"2026-04-22", desc:"Vodacom contract",            amt:  -599.00 },
];

const ROWS: ReconRow[] = [
  { id:"R001", status:"matched",         bank:BANK[0], ledger:LEDGER[0],  confidence:100, dateDiff:0, amtDiff:0,    descSim:0.92,
    reasons:["Exact amount match","Exact date match","High description similarity"], warnings:[], action:"auto_approve" },
  { id:"R002", status:"matched",         bank:BANK[3], ledger:LEDGER[3],  confidence:100, dateDiff:0, amtDiff:0,    descSim:0.85,
    reasons:["Exact amount match","Exact date match"], warnings:[], action:"auto_approve" },
  { id:"R003", status:"matched",         bank:BANK[4], ledger:LEDGER[4],  confidence:100, dateDiff:0, amtDiff:0,    descSim:0.95,
    reasons:["Exact amount match","Exact date match","Exact vendor match"], warnings:[], action:"auto_approve" },
  { id:"R004", status:"possible_match",  bank:BANK[1], ledger:LEDGER[1],  confidence:85,  dateDiff:1, amtDiff:0,    descSim:0.72,
    reasons:["Exact amount match","Date off by 1 day","Similar description"],
    warnings:["Spelling differs: 'PICK N PAY' vs 'Pik n Pay' — possible OCR error","Date discrepancy: bank 2026-04-03, ledger 2026-04-04"], action:"review" },
  { id:"R005", status:"possible_match",  bank:BANK[5], ledger:LEDGER[5],  confidence:88,  dateDiff:1, amtDiff:0,    descSim:0.78,
    reasons:["Exact amount match","Date off by 1 day"],
    warnings:["Date discrepancy: bank 2026-04-10, ledger 2026-04-11"], action:"review" },
  { id:"R006", status:"possible_match",  bank:BANK[6], ledger:LEDGER[6],  confidence:82,  dateDiff:1, amtDiff:0,    descSim:0.68,
    reasons:["Exact amount match","Date off by 1 day"],
    warnings:["Description differs: 'NEDBANK EFT TRANSFER' vs 'Bank Transfer EFT'","Date discrepancy: bank 2026-04-15, ledger 2026-04-16"], action:"review" },
  { id:"R007", status:"manual_review",   bank:BANK[2], ledger:LEDGER[2],  confidence:45,  dateDiff:0, amtDiff:5040, descSim:0.55,
    reasons:["Date match","Vendor name partially similar"],
    warnings:["Amount mismatch: bank R5,600 vs ledger R560 — 10x difference","OCR issue: '0' in 'Esk0m' may be letter O","Possible OCR decimal parsing error in ledger amount"], action:"manual_review" },
  { id:"R008", status:"manual_review",   bank:undefined, ledger:LEDGER[9], confidence:20, dateDiff:0, amtDiff:0,    descSim:0,
    reasons:[], warnings:["Duplicate detected: same amount and date as L001 — likely double-entry"], action:"manual_review" },
  { id:"R009", status:"invalid_row",     bank:undefined, ledger:LEDGER[7], confidence:0,  dateDiff:0, amtDiff:0,    descSim:0,
    reasons:[], warnings:["Invalid date format '2O26-O4-O8' — OCR substituted letter O for digit 0","Row cannot be processed until date is corrected"], action:"fix_data" },
  { id:"R010", status:"invalid_row",     bank:undefined, ledger:LEDGER[8], confidence:0,  dateDiff:0, amtDiff:0,    descSim:0,
    reasons:[], warnings:["Impossible amount: R99,999 credit flagged as likely OCR error","Exceeds typical transaction threshold — manual verification required"], action:"fix_data" },
  { id:"R011", status:"unmatched_bank",  bank:BANK[7],  ledger:undefined, confidence:0,  dateDiff:0, amtDiff:0,    descSim:0,
    reasons:[], warnings:["No ledger entry found for this bank transaction","Small amount (R4.50) — may be unrecorded petty cash"], action:"create_entry" },
  { id:"R012", status:"unmatched_bank",  bank:BANK[8],  ledger:undefined, confidence:0,  dateDiff:0, amtDiff:0,    descSim:0,
    reasons:[], warnings:["Large unrecorded credit: R10,000","Incoming wire — verify source and record in ledger"], action:"create_entry" },
  { id:"R013", status:"unmatched_ledger",bank:undefined, ledger:LEDGER[10],confidence:0, dateDiff:0, amtDiff:0,    descSim:0,
    reasons:[], warnings:["No bank transaction found for this ledger entry","May be an outstanding payment or direct debit not yet cleared"], action:"create_entry" },
];

const OVERALL_CONF = Math.round(
  ROWS.filter(r => r.status === "matched").length / BANK.length * 100
);

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
            <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase tracking-wider w-8">#</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase tracking-wider">Status</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase tracking-wider">Source</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase tracking-wider min-w-[200px]">Description</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase tracking-wider">Date</th>
            <th className="text-right px-4 py-3 font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase tracking-wider min-w-[140px]">Confidence</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase tracking-wider">Action</th>
            <th className="px-4 py-3 w-8" />
          </tr>
        </thead>
        <tbody>
          {grouped.map(({ status, items }) => (
            <React.Fragment key={status}>
              <tr>
                <td colSpan={9} className="px-4 py-2 bg-gray-50 border-y border-gray-100">
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
                    <td className="px-4 py-3 font-mono text-gray-400 text-[10px]">{i + 1}</td>
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
                    <td className={`px-4 py-3 text-[10px] font-semibold uppercase tracking-wider
                      ${isSelected ? "text-gray-300" : "text-gray-400"}`}>
                      {row.action.replace(/_/g, " ")}
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

function DashboardView({ rows, onNav }: { rows: ReconRow[]; onNav: (v: NavId) => void }) {
  const matched  = rows.filter(r => r.status === "matched").length;
  const possible = rows.filter(r => r.status === "possible_match").length;
  const manual   = rows.filter(r => r.status === "manual_review").length;
  const invalid  = rows.filter(r => r.status === "invalid_row").length;
  const uBank    = rows.filter(r => r.status === "unmatched_bank").length;
  const uLedger  = rows.filter(r => r.status === "unmatched_ledger").length;

  const cards = [
    { label:"Bank transactions",   val: BANK.length,   sub:"Loaded",                  color:"text-gray-900",     bg:"bg-white" },
    { label:"Ledger entries",      val: LEDGER.length, sub:"Loaded",                  color:"text-gray-900",     bg:"bg-white" },
    { label:"Matched",             val: matched,       sub:"Auto-approved",            color:"text-emerald-700",  bg:"bg-emerald-50" },
    { label:"Possible matches",    val: possible,      sub:"Needs review",             color:"text-blue-700",     bg:"bg-blue-50" },
    { label:"Manual review",       val: manual,        sub:"Flagged items",            color:"text-amber-700",    bg:"bg-amber-50" },
    { label:"Invalid rows",        val: invalid,       sub:"Data quality issues",      color:"text-red-700",      bg:"bg-red-50" },
    { label:"Unmatched bank",      val: uBank,         sub:"No ledger entry",          color:"text-orange-700",   bg:"bg-orange-50" },
    { label:"Unmatched ledger",    val: uLedger,       sub:"No bank transaction",      color:"text-purple-700",   bg:"bg-purple-50" },
  ];

  return (
    <div className="p-6 sm:p-8 max-w-5xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-400 mt-1">Job <span className="font-mono">{JOB_ID}</span> · {PERIOD} · {COMPANY}</p>
      </div>

      {/* Overall confidence */}
      <div className="border border-gray-200 p-5 mb-6 bg-white">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Overall reconciliation confidence</p>
            <p className="text-3xl font-bold text-gray-900">{OVERALL_CONF}%</p>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
              <span className="w-1.5 h-1.5 bg-emerald-500" />
              {matched} of {BANK.length} auto-matched
            </span>
            <p className="text-[10px] text-gray-400 mt-1.5">{BANK_INST} · {LEDGER_SOFT}</p>
          </div>
        </div>
        <div className="h-3 bg-gray-100 w-full">
          <div className="h-full bg-emerald-500 transition-all" style={{ width:`${OVERALL_CONF}%` }} />
        </div>
        <div className="flex gap-4 mt-3">
          {[
            { label:"Matched",  pct: Math.round(matched / BANK.length * 100),  color:"bg-emerald-500" },
            { label:"Review",   pct: Math.round(possible / BANK.length * 100), color:"bg-blue-500"    },
            { label:"Issues",   pct: Math.round((manual + invalid) / BANK.length * 100), color:"bg-amber-500" },
            { label:"No match", pct: Math.round((uBank + uLedger) / BANK.length * 100), color:"bg-red-400" },
          ].map(({ label, pct, color }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 ${color}`} />
              <span className="text-[11px] text-gray-500">{label} <b className="text-gray-900">{pct}%</b></span>
            </div>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {cards.map(({ label, val, sub, color, bg }) => (
          <div key={label} className={`border border-gray-200 p-4 ${bg}`}>
            <p className={`text-2xl font-bold ${color}`}>{val}</p>
            <p className="text-xs font-semibold text-gray-700 mt-0.5">{label}</p>
            <p className="text-[10px] text-gray-400">{sub}</p>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label:"Open reconciliation workspace", icon:<Briefcase className="h-4 w-4"/>, nav:"jobs"   as NavId, desc:"View and review all transactions" },
          { label:"Go to review queue",            icon:<AlertCircle className="h-4 w-4"/>, nav:"review" as NavId, desc:`${possible + manual + invalid} items need attention` },
          { label:"View audit log",                icon:<Clock className="h-4 w-4"/>,      nav:"audit"  as NavId, desc:"Track all actions on this job" },
        ].map(({ label, icon, nav, desc }) => (
          <button key={nav} onClick={() => onNav(nav)}
            className="flex items-start gap-3 border border-gray-200 p-4 text-left hover:bg-gray-50 hover:border-gray-300 transition-colors bg-white">
            <span className="mt-0.5 text-gray-400">{icon}</span>
            <div>
              <p className="text-xs font-semibold text-gray-800">{label}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{desc}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-300 ml-auto mt-0.5 shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Uploads view ──────────────────────────────────────────────────────────────

function UploadsView() {
  const bankRef   = useRef<HTMLInputElement>(null);
  const ledgerRef = useRef<HTMLInputElement>(null);
  const [bank, setBank]     = useState<string | null>(null);
  const [ledger, setLedger] = useState<string | null>(null);

  return (
    <div className="p-6 sm:p-8 max-w-2xl mx-auto w-full">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Upload Files</h1>
      <p className="text-sm text-gray-400 mb-6">Upload your bank statement and general ledger export to start reconciliation.</p>

      <div className="space-y-4">
        {[
          { label:"Bank Statement", sub:"Export from your bank — CSV or XLSX", ref:bankRef, file:bank, set:setBank, accept:".csv,.xlsx,.xls" },
          { label:"General Ledger", sub:"Accounting software export — CSV or XLSX", ref:ledgerRef, file:ledger, set:setLedger, accept:".csv,.xlsx,.xls" },
        ].map(({ label, sub, ref, file, set, accept }) => (
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
                    <FileText className="h-4 w-4 text-emerald-600" />
                    <span className="text-xs font-medium text-emerald-700 flex-1">{file}</span>
                    <button onClick={() => set(null)} className="text-emerald-500 hover:text-emerald-700"><X className="h-3.5 w-3.5" /></button>
                  </div>
                : <button onClick={() => ref.current?.click()}
                    className="w-full flex flex-col items-center justify-center py-10 border-2 border-dashed border-gray-200 hover:border-gray-400 transition-colors group">
                    <Upload className="h-7 w-7 text-gray-300 group-hover:text-gray-500 mb-2.5" />
                    <p className="text-sm text-gray-400 group-hover:text-gray-600 font-medium">Click to upload</p>
                    <p className="text-[11px] text-gray-300 mt-1">CSV or XLSX · up to 10 MB</p>
                  </button>
              }
              <input ref={ref} type="file" accept={accept} className="hidden" onChange={e => set(e.target.files?.[0]?.name ?? null)} />
            </div>
          </div>
        ))}
      </div>

      {bank && ledger && (
        <div className="mt-5 flex items-center justify-between p-4 border border-emerald-200 bg-emerald-50">
          <div>
            <p className="text-sm font-bold text-emerald-800">Ready to reconcile</p>
            <p className="text-xs text-emerald-600">Both files loaded — click to run the reconciliation engine.</p>
          </div>
          <button className="h-9 px-5 bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors">
            Run now
          </button>
        </div>
      )}

      <div className="mt-6 border border-gray-100 p-4 bg-gray-50">
        <p className="text-[11px] text-gray-400 leading-relaxed">
          Addup accepts standard bank statement exports and accounting software ledger exports.
          Supported formats: CSV, XLSX. Column headers are detected automatically.
        </p>
      </div>
    </div>
  );
}

// ── Jobs / workspace view ─────────────────────────────────────────────────────

function JobsView({
  rows, setRows, addAudit,
}: {
  rows: ReconRow[];
  setRows: React.Dispatch<React.SetStateAction<ReconRow[]>>;
  addAudit: (a: Omit<AuditEntry, "ts" | "user">) => void;
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
    addAudit({ job_id: JOB_ID, action: actionType, target_id: row.id, prev: row.userStatus, next: userStatus });
    setSelected(null);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Job header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-gray-900">Reconciliation Workspace</h1>
            <p className="text-xs text-gray-400 mt-0.5 font-mono">{JOB_ID} · {PERIOD} · {COMPANY}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-400">{BANK_INST} + {LEDGER_SOFT}</span>
            <span className="h-4 w-px bg-gray-200" />
            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5">
              <Activity className="h-3 w-3" />{OVERALL_CONF}% confidence
            </span>
          </div>
        </div>
      </div>

      {/* Filter tabs + search */}
      <div className="px-6 py-3 border-b border-gray-200 bg-white shrink-0 flex items-center gap-3 overflow-x-auto">
        {(["all", ...STATUS_ORDER] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`shrink-0 flex items-center gap-1.5 h-8 px-3 text-[11px] font-semibold transition-colors border
              ${filter === s
                ? "bg-gray-900 text-white border-gray-900"
                : "text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-800"
              }`}
          >
            {s === "all" ? "All" : STATUS_CFG[s as TxStatus].short}
            <span className={`text-[10px] px-1.5 py-0.5 font-bold min-w-[20px] text-center
              ${filter === s ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>
              {counts[s] ?? 0}
            </span>
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 border border-gray-200 px-3 h-8 shrink-0">
          <Search className="h-3.5 w-3.5 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
            className="w-32 text-xs outline-none bg-transparent text-gray-700 placeholder-gray-300" />
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
  rows, setRows, addAudit,
}: {
  rows: ReconRow[];
  setRows: React.Dispatch<React.SetStateAction<ReconRow[]>>;
  addAudit: (a: Omit<AuditEntry, "ts" | "user">) => void;
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
    addAudit({ job_id: JOB_ID, action: actionType, target_id: row.id, next: userStatus });
    setSelected(null);
  }

  return (
    <div className="p-6 sm:p-8 max-w-5xl mx-auto w-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Review Queue</h1>
          <p className="text-sm text-gray-400 mt-1">{queue.length} items requiring your attention</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 font-semibold">CONFIDENCE MAX</span>
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
          <p className="text-sm font-semibold text-gray-600">All items reviewed</p>
          <p className="text-xs text-gray-400 mt-1">No items match your current filters</p>
        </div>
      ) : (
        <div className="space-y-2">
          {queue.map(row => {
            const tx = row.bank ?? row.ledger;
            return (
              <div key={row.id} className="border border-gray-200 bg-white hover:border-gray-300 transition-colors">
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className={`w-1 self-stretch ${STATUS_CFG[row.status].dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <StatusBadge status={row.status} />
                      {row.warnings.length > 0 && (
                        <span className="text-[10px] text-amber-600 flex items-center gap-0.5">
                          <AlertTriangle className="h-3 w-3" />{row.warnings.length} warning{row.warnings.length > 1 && "s"}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-gray-800 truncate">{tx?.desc ?? "—"}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5 font-mono">{tx?.id} · {tx?.date}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold ${tx && tx.amt >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {tx ? fmt(tx.amt) : "—"}
                    </p>
                    <div className="mt-1 w-32"><ConfBar pct={row.confidence} /></div>
                  </div>
                  <button onClick={() => setSelected(row)}
                    className="h-9 px-4 border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 flex items-center gap-1.5 shrink-0">
                    <Eye className="h-3.5 w-3.5" /> Review
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

function AuditLogView({ log, onExport }: { log: AuditEntry[]; onExport: () => void }) {
  return (
    <div className="p-6 sm:p-8 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Audit Log</h1>
          <p className="text-sm text-gray-400 mt-1">{log.length} entries · {JOB_ID}</p>
        </div>
        <button onClick={onExport}
          className="flex items-center gap-2 h-9 px-4 border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50">
          <Download className="h-3.5 w-3.5" /> Export JSON
        </button>
      </div>

      {log.length === 0 ? (
        <div className="border border-gray-200 py-24 flex flex-col items-center bg-white">
          <Clock className="h-12 w-12 text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">No actions recorded yet</p>
          <p className="text-xs text-gray-400 mt-1">Actions in the Review Queue and Workspace will appear here</p>
        </div>
      ) : (
        <div className="border border-gray-200 bg-white overflow-hidden">
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
                  <td className="px-4 py-3 font-mono text-gray-500 text-[10px]">{new Date(entry.ts).toLocaleTimeString("en-ZA")}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 font-semibold text-gray-700">
                      {entry.action === "approve_match" && <ThumbsUp className="h-3 w-3 text-emerald-500" />}
                      {entry.action === "reject_match"  && <ThumbsDown className="h-3 w-3 text-red-500" />}
                      {entry.action === "mark_manual"   && <Edit3 className="h-3 w-3 text-amber-500" />}
                      {(entry.action === "export_json" || entry.action === "export_pdf") && <Download className="h-3 w-3 text-gray-400" />}
                      {ACTION_LABELS[entry.action]}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-400">{entry.target_id}</td>
                  <td className="px-4 py-3 text-gray-400">{entry.prev ?? "—"}</td>
                  <td className="px-4 py-3 font-semibold text-gray-700">{entry.next ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-400">{entry.user}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
          <div key={label} className="px-5 py-4 flex items-center gap-4">
            <label className="text-xs font-semibold text-gray-600 w-40 shrink-0">{label}</label>
            <input value={val} onChange={e => set(e.target.value)} placeholder={placeholder}
              className="flex-1 h-8 border border-gray-200 px-3 text-sm text-gray-900 focus:outline-none focus:border-gray-400" />
          </div>
        ))}
      </div>

      <div className="mt-6 border border-gray-200 bg-white divide-y divide-gray-100">
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-700">Date tolerance</p>
            <p className="text-[10px] text-gray-400">Max days apart for a possible match</p>
          </div>
          <select className="border border-gray-200 text-xs px-2 h-8 text-gray-700 focus:outline-none">
            <option>1 day</option><option>2 days</option><option>3 days</option><option>7 days</option>
          </select>
        </div>
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-700">Confidence threshold</p>
            <p className="text-[10px] text-gray-400">Minimum confidence to auto-approve</p>
          </div>
          <select className="border border-gray-200 text-xs px-2 h-8 text-gray-700 focus:outline-none">
            <option>100%</option><option>95%</option><option>90%</option>
          </select>
        </div>
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-700">OCR validation</p>
            <p className="text-[10px] text-gray-400">Flag rows with suspected OCR errors</p>
          </div>
          <button className="relative w-10 h-5 bg-emerald-500 flex items-center">
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

async function exportPDF(rows: ReconRow[], auditLog: AuditEntry[], company: string, bankInst: string, ledgerSoft: string) {
  const logoData = await loadImgDataUrl(addupLogo).catch(() => null);
  const doc = new jsPDF({ unit:"mm", format:"a4" });

  const W=210, H=297, ML=18, MR=18, CW=W-ML-MR, RX=W-MR;
  const genDate = new Date().toLocaleDateString("en-ZA",{day:"2-digit",month:"long",year:"numeric"});
  const genTs   = new Date().toLocaleString("en-ZA");
  const reportRef = `RPT-${JOB_ID.slice(4,12).toUpperCase()}-001`;

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
    txt(`CONFIDENTIAL  |  ${company}  |  ${reportRef}  |  ${PERIOD}`, ML, fy);
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
    txt(`${company}  |  ${PERIOD}  |  ${title}`, RX, 9, {align:"right"});
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
  cdet("RECONCILIATION PERIOD",  PERIOD,           ML+2,    cy);
  cdet("BANK INSTITUTION",       bankInst,          ML+2+90, cy); cy+=13;
  cdet("ACCOUNTING SOFTWARE",    ledgerSoft,        ML+2,    cy);
  cdet("JOB REFERENCE",          JOB_ID,            ML+2+90, cy); cy+=13;
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
  const conf     = Math.round(matched/BANK.length*100);
  const exceptions = rows.filter(r=>r.status!=="matched");

  const kpis = [
    {val:`${matched}/${BANK.length}`, lbl:"AUTO-MATCHED"},
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
      ? `Based on an automated reconciliation of ${BANK.length} bank transactions against ${LEDGER.length} general ledger entries for the period ${PERIOD}, a total of ${matched} transactions (${conf}%) were matched with high confidence. The remaining ${exceptions.length} items are catalogued in the Exceptions Register (Section 4) and must be resolved by the responsible accountant before this reconciliation can be finalised and submitted.`
      : `The automated reconciliation for ${PERIOD} has identified material discrepancies that require resolution prior to submission. Of ${BANK.length} bank transactions reviewed, ${matched} were matched automatically. The remaining ${exceptions.length} items in the Exceptions Register (Section 4) require corrective action.`,
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
  const tBank   = BANK.reduce((a,b)=>a+Math.abs(b.amt),0);
  const tLedger = LEDGER.reduce((a,l)=>a+Math.abs(l.amt),0);
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
  txt(`${BANK.length} bank transactions and ${LEDGER.length} ledger entries for ${PERIOD}. All amounts in South African Rand (ZAR).`,ML,y); y+=8;

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
  txt(`Complete record of all system actions performed during reconciliation ${JOB_ID}.`,ML,y); y+=8;

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
    `I, the undersigned, being a duly authorised representative of ${company}, hereby declare that the information contained in this Bank Reconciliation Report is true, accurate and complete to the best of my knowledge and belief. This reconciliation was performed for the period ${PERIOD} using ${bankInst} bank records and the ${ledgerSoft} general ledger. This report has been prepared for the purposes of compliance with the Income Tax Act 58 of 1962 and/or the Value-Added Tax Act 89 of 1991, and is available for inspection by the South African Revenue Service (SARS) upon request.`,
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
  txt(`Generated by Addup Reconciliation Engine  |  ${genTs}  |  Job: ${JOB_ID}  |  Ref: ${reportRef}`,ML,y);

  const slug=(company||"report").toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9-]/g,"");
  doc.save(`Addup-Recon-${slug}-${PERIOD.replace(/\s+/g,"-")}.pdf`);
}

function exportJSON(rows: ReconRow[], auditLog: AuditEntry[], company: string) {
  const data = {
    meta: { job_id: JOB_ID, period: PERIOD, company, generated: now(), version:"1.0" },
    summary: {
      bank_transactions: BANK.length, ledger_entries: LEDGER.length,
      matched: rows.filter(r=>r.status==="matched").length,
      possible_match: rows.filter(r=>r.status==="possible_match").length,
      manual_review: rows.filter(r=>r.status==="manual_review").length,
      invalid_rows: rows.filter(r=>r.status==="invalid_row").length,
      unmatched_bank: rows.filter(r=>r.status==="unmatched_bank").length,
      unmatched_ledger: rows.filter(r=>r.status==="unmatched_ledger").length,
      overall_confidence: Math.round(rows.filter(r=>r.status==="matched").length / BANK.length * 100),
    },
    rows: rows.map(r=>({ id:r.id, status:r.status, confidence:r.confidence,
      bank_id: r.bank?.id, ledger_id: r.ledger?.id,
      reasons: r.reasons, warnings: r.warnings, user_decision: r.userStatus })),
    audit_log: auditLog,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:"application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `addup-${JOB_ID}.json`; a.click();
  URL.revokeObjectURL(url);
}

// ── Main Engine ───────────────────────────────────────────────────────────────

export default function Engine() {
  const [loading,    setLoading]    = useState(true);
  const [nav,        setNav]        = useState<NavId>("dashboard");
  const [sidebarOpen,setSidebarOpen]= useState(false);
  const [rows,       setRows]       = useState<ReconRow[]>(ROWS);
  const [auditLog,   setAuditLog]   = useState<AuditEntry[]>([]);
  const [company,    setCompany]    = useState(COMPANY);
  const [bankInst,   setBankInst]   = useState(BANK_INST);
  const [ledgerSoft, setLedgerSoft] = useState(LEDGER_SOFT);
  const [pdfLoading, setPdfLoading] = useState(false);

  const addAudit = useCallback((a: Omit<AuditEntry, "ts" | "user">) => {
    setAuditLog(prev => [...prev, { ...a, ts: now(), user: "local_user" }]);
  }, []);

  const reviewCount = rows.filter(r =>
    (r.status === "possible_match" || r.status === "manual_review" ||
     r.status === "invalid_row" || r.status === "unmatched_bank" ||
     r.status === "unmatched_ledger") && !r.userStatus
  ).length;

  const NAV = [
    { id:"dashboard" as NavId, label:"Dashboard",    icon:<LayoutDashboard className="h-4 w-4"/> },
    { id:"uploads"   as NavId, label:"Uploads",      icon:<Upload className="h-4 w-4"/>          },
    { id:"jobs"      as NavId, label:"Reconciliation Jobs", icon:<Briefcase className="h-4 w-4"/> },
    { id:"review"    as NavId, label:"Review Queue", icon:<AlertCircle className="h-4 w-4"/>, badge: reviewCount > 0 ? reviewCount : undefined },
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
          <p className="text-[10px] font-mono text-gray-500 truncate">{JOB_ID}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{PERIOD} · {company}</p>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1 bg-gray-100">
              <div className="h-full bg-emerald-500" style={{ width:`${OVERALL_CONF}%` }} />
            </div>
            <span className="text-[10px] font-bold text-emerald-600">{OVERALL_CONF}%</span>
          </div>
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
              addAudit({ job_id:JOB_ID, action:"export_pdf", target_id:JOB_ID });
              await exportPDF(rows, auditLog, company, bankInst, ledgerSoft);
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
              addAudit({ job_id:JOB_ID, action:"export_json", target_id:JOB_ID });
              exportJSON(rows, auditLog, company);
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
            <span className="font-mono text-gray-500">{JOB_ID}</span>
            <ChevronRight className="h-3 w-3" />
            <span className="font-semibold text-gray-700 capitalize">{nav.replace("_"," ")}</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-[10px] text-gray-400 hidden sm:block">{company}</span>
            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5">
              <BarChart3 className="h-3 w-3" />{OVERALL_CONF}%
            </span>
          </div>
        </header>

        {/* View content */}
        <main className="flex-1 overflow-auto">
          {nav === "dashboard" && <DashboardView rows={rows} onNav={setNav} />}
          {nav === "uploads"   && <UploadsView />}
          {nav === "jobs"      && <JobsView rows={rows} setRows={setRows} addAudit={addAudit} />}
          {nav === "review"    && <ReviewQueueView rows={rows} setRows={setRows} addAudit={addAudit} />}
          {nav === "audit"     && <AuditLogView log={auditLog} onExport={() => { addAudit({job_id:JOB_ID,action:"export_json",target_id:JOB_ID}); exportJSON(rows, auditLog, company); }} />}
          {nav === "settings"  && <SettingsView company={company} setCompany={setCompany} bank={bankInst} setBank={setBankInst} ledger={ledgerSoft} setLedger={setLedgerSoft} />}
        </main>
      </div>
    </div>
    </>
  );
}
