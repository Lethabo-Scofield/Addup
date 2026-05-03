import React, { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Upload, AlertCircle, Clock, Settings2,
  CheckCircle2, XCircle, AlertTriangle, HelpCircle, Info,
  Download, FileText, Sparkles, RefreshCw, X, Check, Search,
  ThumbsUp, ThumbsDown, Edit3, Menu, ChevronRight,
  Eye, ChevronDown, ArrowLeftRight, ScrollText, BarChart3,
  Layers, Shield, ShieldAlert, ShieldCheck, GitMerge, Zap,
  ListChecks,
} from "lucide-react";
import addupLogo from "@assets/logo.png";
import logoAbsa        from "@assets/banks/absa.png";
import logoCapitec     from "@assets/banks/capitec.png";
import logoDiscovery   from "@assets/banks/discovery.png";
import logoEcobank     from "@assets/banks/ecobank.png";
import logoEquity      from "@assets/banks/equity.png";
import logoFlutterwave from "@assets/banks/flutterwave.png";
import logoFnb         from "@assets/banks/fnb.png";
import logoGtbank      from "@assets/banks/gtbank.png";
import logoInvestec    from "@assets/banks/investec.png";
import logoKcb         from "@assets/banks/kcb.png";
import logoKuda        from "@assets/banks/kuda.png";
import logoNedbank     from "@assets/banks/nedbank.png";
import logoPaystack    from "@assets/banks/paystack.png";
import logoStandardbank from "@assets/banks/standardbank.png";
import logoTymebank    from "@assets/banks/tymebank.png";
import logoZenith      from "@assets/banks/zenith.png";

const BANK_LOGOS: [string[], string][] = [
  [["absa"],                          logoAbsa],
  [["capitec"],                       logoCapitec],
  [["discovery"],                     logoDiscovery],
  [["ecobank"],                       logoEcobank],
  [["equity"],                        logoEquity],
  [["flutterwave"],                   logoFlutterwave],
  [["fnb", "first national"],         logoFnb],
  [["gtbank", "guaranty"],            logoGtbank],
  [["investec"],                      logoInvestec],
  [["kcb", "kenya commercial"],       logoKcb],
  [["kuda"],                          logoKuda],
  [["nedbank"],                       logoNedbank],
  [["paystack"],                      logoPaystack],
  [["standard bank", "standardbank"], logoStandardbank],
  [["tymebank", "tyme"],              logoTymebank],
  [["zenith"],                        logoZenith],
];

function getBankLogo(name: string): string | null {
  if (!name) return null;
  const lower = name.toLowerCase();
  for (const [keys, src] of BANK_LOGOS) {
    if (keys.some(k => lower.includes(k))) return src;
  }
  return null;
}
import jsPDF from "jspdf";
import {
  type NavId, type TxStatus, type ActionType, type QualityStatus,
  type Tx, type ScoreBreakdown, type Candidate, type ReconRow, type AuditEntry,
  type DiscrepancyCase, type CaseType, type RiskLevel, type CaseStatus,
  fmt, fmtDate, now, STATUS_CFG, ACTION_LABELS,
  parseCSVText, xlsxToRows, parseDelimitedText, csvToTx,
  normalizeDesc, hasOcrArtifacts,
  runReconciliation, derivePeriod,
  buildCases,
} from "../engine";

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
        className="h-20 w-auto mb-10"
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
  const color = pct >= 90 ? "bg-blue-500" : pct >= 70 ? "bg-blue-400" : pct >= 40 ? "bg-amber-500" : "bg-red-500";
  const textColor = pct >= 90 ? "text-blue-700" : pct >= 70 ? "text-blue-600" : pct >= 40 ? "text-amber-700" : "text-red-700";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100">
        <div className={`h-full ${color} transition-all`} style={{ width:`${pct}%` }} />
      </div>
      <span className={`text-[11px] font-bold w-8 text-right shrink-0 ${textColor}`}>{pct}%</span>
    </div>
  );
}

// ── Case type + risk badges ────────────────────────────────────────────────────

const CASE_TYPE_CFG: Record<CaseType, { label: string; bg: string; text: string; border: string; icon: React.ReactNode }> = {
  AUTO_MATCHED:               { label:"Auto-matched",    bg:"bg-emerald-50",  text:"text-emerald-700", border:"border-emerald-200", icon:<ShieldCheck className="h-3 w-3"/>    },
  TIMING_DIFFERENCE:          { label:"Timing",          bg:"bg-blue-50",     text:"text-blue-700",    border:"border-blue-200",    icon:<Clock className="h-3 w-3"/>          },
  BANK_FEES:                  { label:"Bank Fee",        bg:"bg-orange-50",   text:"text-orange-700",  border:"border-orange-200",  icon:<Zap className="h-3 w-3"/>            },
  MISSING_LEDGER_ENTRY:       { label:"Missing Ledger",  bg:"bg-red-50",      text:"text-red-700",     border:"border-red-200",     icon:<AlertTriangle className="h-3 w-3"/>  },
  MISSING_BANK_ENTRY:         { label:"Missing Bank",    bg:"bg-purple-50",   text:"text-purple-700",  border:"border-purple-200",  icon:<AlertTriangle className="h-3 w-3"/>  },
  DUPLICATE_ENTRY:            { label:"Duplicate",       bg:"bg-red-50",      text:"text-red-700",     border:"border-red-200",     icon:<XCircle className="h-3 w-3"/>        },
  AMOUNT_VARIANCE:            { label:"Variance",        bg:"bg-amber-50",    text:"text-amber-700",   border:"border-amber-200",   icon:<AlertCircle className="h-3 w-3"/>    },
  DESCRIPTION_MISMATCH:       { label:"Desc Mismatch",   bg:"bg-indigo-50",   text:"text-indigo-700",  border:"border-indigo-200",  icon:<Info className="h-3 w-3"/>           },
  MANY_TO_ONE_MATCH:          { label:"Group Match",     bg:"bg-teal-50",     text:"text-teal-700",    border:"border-teal-200",    icon:<GitMerge className="h-3 w-3"/>       },
  ONE_TO_MANY_MATCH:          { label:"Split Match",     bg:"bg-teal-50",     text:"text-teal-700",    border:"border-teal-200",    icon:<GitMerge className="h-3 w-3"/>       },
  FX_OR_ROUNDING_DIFFERENCE:  { label:"Rounding",        bg:"bg-cyan-50",     text:"text-cyan-700",    border:"border-cyan-200",    icon:<ArrowLeftRight className="h-3 w-3"/> },
  UNKNOWN:                    { label:"Unknown",         bg:"bg-gray-100",    text:"text-gray-600",    border:"border-gray-200",    icon:<HelpCircle className="h-3 w-3"/>     },
};

function CaseTypeBadge({ type }: { type: CaseType }) {
  const cfg = CASE_TYPE_CFG[type];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

const RISK_CFG: Record<RiskLevel, { label: string; bg: string; text: string; border: string }> = {
  low:    { label:"Low Risk",  bg:"bg-emerald-50", text:"text-emerald-700", border:"border-emerald-200" },
  medium: { label:"Med Risk",  bg:"bg-amber-50",   text:"text-amber-700",   border:"border-amber-200"   },
  high:   { label:"High Risk", bg:"bg-red-50",     text:"text-red-700",     border:"border-red-200"     },
};

function RiskBadge({ risk }: { risk: RiskLevel }) {
  const cfg = RISK_CFG[risk];
  const icon = risk === "high" ? <ShieldAlert className="h-3 w-3"/>
    : risk === "medium" ? <Shield className="h-3 w-3"/> : <ShieldCheck className="h-3 w-3"/>;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {icon}{cfg.label}
    </span>
  );
}

// ── Skeleton primitives ───────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-sm bg-gray-200 ${className ?? ""}`} />
  );
}

function SkeletonCaseCard() {
  return (
    <div className="border border-gray-100 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="flex gap-1.5">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-16" />
          </div>
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-2/3" />
        </div>
        <div className="shrink-0 space-y-2 text-right">
          <Skeleton className="h-4 w-16 ml-auto" />
          <Skeleton className="h-3 w-10 ml-auto" />
          <Skeleton className="h-3 w-4 ml-auto" />
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2">
        <Skeleton className="h-3 w-3" />
        <Skeleton className="h-3 flex-1" />
        <Skeleton className="h-5 w-24" />
      </div>
    </div>
  );
}

function SkeletonStatCard() {
  return (
    <div className="border border-gray-100 px-4 py-3 space-y-1.5">
      <Skeleton className="h-7 w-8" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="border-b border-gray-100 px-4 py-3 flex items-center gap-3">
      <Skeleton className="h-4 w-4 shrink-0" />
      <Skeleton className="h-4 flex-1" />
      <Skeleton className="h-4 w-24 shrink-0" />
      <Skeleton className="h-4 w-20 shrink-0" />
      <Skeleton className="h-5 w-16 shrink-0" />
    </div>
  );
}

// ── Transaction card (side-by-side review) ────────────────────────────────────

function TxCard({ tx, side, highlight, bankLogo }: { tx?: Tx; side: "bank" | "ledger"; highlight?: string[]; bankLogo?: string | null }) {
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
    <div className={`flex-1 border border-gray-200`}>
      <div className={`px-4 py-2.5 border-b ${isBank ? "bg-gray-100 border-gray-200" : "bg-gray-50 border-gray-200"} flex items-center justify-between gap-2`}>
        <div className="flex items-center gap-2 min-w-0">
          {isBank && bankLogo && (
            <img src={bankLogo} alt="bank" className="h-5 w-auto max-w-[64px] object-contain shrink-0" />
          )}
          <span className="text-gray-800 text-xs font-bold uppercase tracking-wider truncate">
            {isBank ? "Bank Statement" : "General Ledger"}
          </span>
        </div>
        <span className="text-gray-400 text-[10px] font-mono shrink-0">{tx.id}</span>
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
  row, onClose, onApprove, onReject, onManual, bankInst,
}: {
  row: ReconRow; onClose: () => void;
  onApprove: () => void; onReject: () => void; onManual: () => void;
  bankInst?: string;
}) {
  const { resp, streaming, error, explain, reset } = useGrokExplain();
  const [grokOpen, setGrokOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const diffHighlights: string[] = [];
  if (row.dateDiff > 0)  diffHighlights.push("Date");
  if (row.amtDiff  > 0)  diffHighlights.push("Amount");
  if (row.descSim  < 0.8) diffHighlights.push("Description");

  return (
    <motion.div
      initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
      transition={{ type:"spring", stiffness:300, damping:30 }}
      className="fixed right-0 top-0 h-full w-full max-w-[680px] bg-white border-l border-gray-200 z-50 flex flex-col shadow-2xl"
    >
      {/* Panel header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
        <div>
          <h2 className="text-sm font-bold text-gray-900">Side-by-side Review</h2>
          <p className="text-xs text-gray-400 mt-0.5">{row.id} · {STATUS_CFG[row.status].label}</p>
        </div>
        <button onClick={onClose} aria-label="Close panel" className="p-1.5 hover:bg-gray-100 transition-colors">
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
          {row.scoreBreakdown && (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {[
                { label:"Amount",      val: `${Math.round(row.scoreBreakdown.amount_score * 100)}%`,      ok: row.scoreBreakdown.amount_score >= 0.65 },
                { label:"Date",        val: `${Math.round(row.scoreBreakdown.date_score   * 100)}%`,      ok: row.scoreBreakdown.date_score   >= 0.65 },
                { label:"Description", val: `${Math.round(row.scoreBreakdown.description_score * 100)}%`, ok: row.scoreBreakdown.description_score >= 0.6 },
                { label:"Final",       val: `${Math.round(row.scoreBreakdown.final_score  * 100)}%`,      ok: row.scoreBreakdown.final_score  >= 0.82 },
              ].map(({ label, val, ok }) => (
                <div key={label} className="border border-gray-100 px-2 py-2">
                  <p className="text-[9px] font-bold text-gray-400 uppercase">{label}</p>
                  <p className={`text-xs font-bold mt-0.5 ${ok ? "text-blue-600" : "text-amber-600"}`}>{val}</p>
                </div>
              ))}
            </div>
          )}
          {!row.scoreBreakdown && row.confidence > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-3">
              {[
                { label:"Date diff",     val: row.dateDiff === 0 ? "Exact" : `${row.dateDiff}d apart`, ok: row.dateDiff === 0 },
                { label:"Amount diff",   val: row.amtDiff  === 0 ? "Exact" : `R ${row.amtDiff.toFixed(2)}`,  ok: row.amtDiff === 0  },
                { label:"Desc similarity", val: `${Math.round(row.descSim * 100)}%`,                    ok: row.descSim >= 0.8  },
              ].map(({ label, val, ok }) => (
                <div key={label} className="border border-gray-100 px-3 py-2">
                  <p className="text-[10px] text-gray-400 mb-0.5">{label}</p>
                  <p className={`text-xs font-bold ${ok ? "text-blue-600" : "text-amber-600"}`}>{val}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Side-by-side cards */}
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Transactions</p>
          <div className="flex gap-3">
            <TxCard tx={row.bank}   side="bank"   highlight={diffHighlights} bankLogo={getBankLogo(bankInst ?? "")} />
            <TxCard tx={row.ledger} side="ledger" highlight={diffHighlights} />
          </div>
        </div>

        {/* Explanation */}
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Match explanation</p>
          {row.reasons.length === 0 && (row.criticalWarnings ?? []).length === 0 && (row.softWarnings ?? []).length === 0 && (
            <div className="flex items-start gap-2 mb-2">
              <Info className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />
              <p className="text-xs text-gray-500">
                {row.status === "matched"
                  ? "All scoring dimensions aligned within thresholds. Automatic match."
                  : row.status === "possible_match"
                  ? "Partial match detected. Verify transaction details before approving."
                  : row.status === "manual_review"
                  ? "Low confidence match. Manual verification required before posting."
                  : row.status === "unmatched_bank"
                  ? "No suitable ledger entry found for this bank transaction."
                  : row.status === "unmatched_ledger"
                  ? "No bank transaction found for this ledger entry."
                  : "Row excluded from matching due to data quality issues."}
              </p>
            </div>
          )}
          {row.reasons.map(r => (
            <div key={r} className="flex items-start gap-2 mb-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
              <p className="text-xs text-gray-700">{r}</p>
            </div>
          ))}
          {(row.criticalWarnings ?? []).length > 0 && (
            <>
              <p className="text-[9px] font-bold text-red-400 uppercase tracking-wider mt-3 mb-1.5">Critical</p>
              {(row.criticalWarnings ?? []).map(w => (
                <div key={w} className="flex items-start gap-2 mb-2">
                  <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">{w}</p>
                </div>
              ))}
            </>
          )}
          {(row.softWarnings ?? []).length > 0 && (
            <>
              <p className="text-[9px] font-bold text-amber-500 uppercase tracking-wider mt-3 mb-1.5">Notes</p>
              {(row.softWarnings ?? []).map(w => (
                <div key={w} className="flex items-start gap-2 mb-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">{w}</p>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Normalized descriptions */}
        {(row.bank?.normalizedDesc || row.ledger?.normalizedDesc) && (
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Normalized descriptions</p>
            <div className="space-y-2">
              {row.bank?.normalizedDesc && (
                <div className="flex gap-3">
                  <span className="text-[9px] font-bold text-gray-400 uppercase w-10 shrink-0 pt-0.5">Bank</span>
                  <div>
                    <p className="text-xs text-gray-700 font-medium">{row.bank.normalizedDesc}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5 font-mono">{row.bank.desc}</p>
                  </div>
                </div>
              )}
              {row.ledger?.normalizedDesc && (
                <div className="flex gap-3">
                  <span className="text-[9px] font-bold text-gray-400 uppercase w-10 shrink-0 pt-0.5">Ledger</span>
                  <div>
                    <p className="text-xs text-gray-700 font-medium">{row.ledger.normalizedDesc}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5 font-mono">{row.ledger.desc}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Top candidates */}
        {row.candidates && row.candidates.length > 0 && (
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Top {row.candidates.length} candidate{row.candidates.length !== 1 && "s"}
            </p>
            <div className="space-y-2">
              {row.candidates.map((c, i) => (
                <div key={c.ledger_id} className={`border px-3 py-2 ${i === 0 ? "border-blue-200 bg-blue-50" : "border-gray-100 bg-white"}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-gray-500 font-mono">{c.ledger_id}</span>
                    <span className={`text-[11px] font-bold ${i === 0 ? "text-blue-700" : "text-gray-500"}`}>
                      {Math.round(c.final_score * 100)}%
                    </span>
                  </div>
                  <div className="flex gap-3 text-[10px] text-gray-500">
                    <span>Amt <span className="font-semibold">{Math.round(c.amount_score * 100)}%</span></span>
                    <span>Date <span className="font-semibold">{Math.round(c.date_score * 100)}%</span></span>
                    <span>Desc <span className="font-semibold">{Math.round(c.description_score * 100)}%</span></span>
                  </div>
                  {c.warnings.length > 0 && (
                    <p className="text-[10px] text-amber-600 mt-1 truncate">
                      {c.warnings[0]}
                    </p>
                  )}
                </div>
              ))}
            </div>
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
                  `Status: ${row.status}. Confidence: ${row.confidence}%. Score breakdown: Amount ${Math.round((row.scoreBreakdown?.amount_score ?? 0)*100)}%, Date ${Math.round((row.scoreBreakdown?.date_score ?? 0)*100)}%, Desc ${Math.round((row.scoreBreakdown?.description_score ?? 0)*100)}%. Warnings: ${row.warnings.join("; ")}. Reasons: ${row.reasons.join("; ")}.`
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
              className="flex items-center gap-1.5 h-9 px-4 bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors">
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
            <th className="text-center px-3 py-3 font-semibold text-gray-500 uppercase tracking-wider w-14">Flags</th>
            <th className="px-4 py-3 w-8" />
          </tr>
        </thead>
        <tbody>
          {grouped.map(({ status, items }) => (
            <React.Fragment key={status}>
              <tr>
                <td colSpan={8} className="px-4 py-2 bg-gray-50 border-y border-gray-100">
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
                        {(tx?.normalizedDesc ?? tx?.desc ?? "").slice(0, 36)}
                        {((tx?.normalizedDesc ?? tx?.desc ?? "").length > 36) && "…"}
                      </span>
                      {tx?.normalizedDesc && tx.normalizedDesc !== tx.desc.toLowerCase().trim() && (
                        <span className={`block text-[10px] font-mono truncate max-w-[200px] ${isSelected ? "text-gray-400" : "text-gray-300"}`}>
                          {tx.desc.slice(0, 32)}{tx.desc.length > 32 && "…"}
                        </span>
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
                    <td className="px-3 py-3 text-center">
                      {(() => {
                        const crit = (row.criticalWarnings ?? []).length;
                        const soft = (row.softWarnings ?? []).length;
                        if (crit === 0 && soft === 0) return (
                          <span className={`text-[10px] ${isSelected ? "text-gray-500" : "text-gray-300"}`}>—</span>
                        );
                        return (
                          <span className="inline-flex items-center gap-1">
                            {crit > 0 && (
                              <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1 py-0.5 ${isSelected ? "bg-red-900/40 text-red-300" : "bg-red-50 text-red-600"}`}>
                                <XCircle className="h-2.5 w-2.5" />{crit}
                              </span>
                            )}
                            {soft > 0 && (
                              <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1 py-0.5 ${isSelected ? "bg-amber-900/40 text-amber-300" : "bg-amber-50 text-amber-600"}`}>
                                <AlertTriangle className="h-2.5 w-2.5" />{soft}
                              </span>
                            )}
                          </span>
                        );
                      })()}
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

function DashboardView({ rows, onNav, onBulkApprove, bankLen, ledgerLen, overallConf, jobId, period, bankInst, ledgerSoft, loading }: {
  rows: ReconRow[];
  onNav: (v: NavId) => void;
  onBulkApprove: () => void;
  bankLen: number; ledgerLen: number; overallConf: number;
  jobId: string; period: string; bankInst: string; ledgerSoft: string;
  loading?: boolean;
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
    { label:"Auto-matched",      val: matched,  sub:"No human action needed",        color:"text-emerald-700", bg:"bg-emerald-50", border:"hover:border-emerald-400", nav:"jobs"   },
    { label:"Likely matches",    val: possible, sub:"Verify before approving",        color:"text-blue-700",    bg:"bg-blue-50",    border:"hover:border-blue-400",    nav:"review" },
    { label:"Needs attention",   val: manual,   sub:"Low confidence — review needed", color:"text-amber-700",   bg:"bg-amber-50",   border:"hover:border-amber-400",   nav:"review" },
    { label:"Data issues",       val: invalid,  sub:"Bad or unreadable data",         color:"text-red-700",     bg:"bg-red-50",     border:"hover:border-red-400",     nav:"review" },
    { label:"Unmatched bank",    val: uBank,    sub:"No ledger entry found",          color:"text-orange-700",  bg:"bg-orange-50",  border:"hover:border-orange-400",  nav:"review" },
    { label:"Unmatched ledger",  val: uLedger,  sub:"No bank transaction found",      color:"text-purple-700",  bg:"bg-purple-50",  border:"hover:border-purple-400",  nav:"review" },
  ];

  if (loading) {
    return (
      <div className="p-6 sm:p-8 max-w-5xl mx-auto w-full">
        <div className="mb-6 space-y-2">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonStatCard key={i} />)}
        </div>
        <div className="border border-gray-100 bg-white divide-y divide-gray-100">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 max-w-5xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Reconciliation Summary</h1>
        <p className="text-sm text-gray-400 mt-1">{period}{bankInst ? ` · ${bankInst}` : ""}{ledgerSoft ? ` · ${ledgerSoft}` : ""}</p>
      </div>

      {/* Automation summary */}
      <div className="border border-gray-200 p-5 mb-6 bg-white">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Engine automation rate</p>
            <p className="text-3xl font-bold text-gray-900">{overallConf}%</p>
            <p className="text-xs text-gray-400 mt-1">
              <span className="font-semibold text-blue-600">{matched} of {bankLen}</span> transactions handled automatically — no manual admin needed
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            {pendingApprove > 0 ? (
              <button
                onClick={onBulkApprove}
                className="flex items-center gap-2 h-10 px-5 bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors shrink-0">
                <ThumbsUp className="h-3.5 w-3.5" />
                Sign off on all {pendingApprove} engine matches
              </button>
            ) : (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold">
                <CheckCircle2 className="h-3.5 w-3.5" /> All engine matches signed off
              </span>
            )}
            {exceptions > 0 && (
              <button onClick={() => onNav("review")}
                className="flex items-center gap-2 h-9 px-4 border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                <AlertCircle className="h-3.5 w-3.5 text-blue-500" />
                {exceptions} exception{exceptions !== 1 && "s"} need sign-off
              </button>
            )}
            <p className="text-[10px] text-gray-400">{bankInst} · {ledgerSoft}</p>
          </div>
        </div>
        <div className="h-2 bg-gray-100 w-full">
          <div className="h-full bg-blue-500 transition-all" style={{ width:`${overallConf}%` }} />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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

// ── Case card ─────────────────────────────────────────────────────────────────

function CaseCard({ c, onClick }: { c: DiscrepancyCase; onClick: () => void }) {
  const isDecided  = !!c.userDecision;
  const isApproved = c.userDecision === "approved";
  const isRejected = c.userDecision === "rejected";
  const isHigh     = c.risk === "high" && !isDecided;

  const borderCls = isApproved ? "border-emerald-200 bg-emerald-50/30"
    : isRejected ? "border-red-200 bg-red-50/20"
    : isHigh ? "border-red-200"
    : "border-gray-200";

  return (
    <button
      onClick={onClick}
      className={`w-full text-left border bg-white p-4 hover:shadow-sm transition-all group ${borderCls}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            <CaseTypeBadge type={c.type} />
            {c.type !== "AUTO_MATCHED" && <RiskBadge risk={c.risk} />}
            {c.userDecision && (
              <span className={`text-[10px] font-bold px-2 py-0.5 border
                ${isApproved ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : isRejected ? "bg-red-50 text-red-700 border-red-200"
                : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                {c.userDecision === "approved" ? "✓ Approved"
                  : c.userDecision === "rejected" ? "✗ Rejected"
                  : "⚑ Escalated"}
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-gray-800 truncate">{c.title}</p>
          <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">{c.hypothesis.slice(0, 90)}{c.hypothesis.length > 90 ? "…" : ""}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-gray-900">{fmt(c.amount)}</p>
          <p className="text-[10px] text-gray-400">{c.confidence}% conf.</p>
          <ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-gray-500 ml-auto mt-1 transition-colors" />
        </div>
      </div>
      {c.type !== "AUTO_MATCHED" && !isDecided && (
        <div className="mt-2.5 pt-2.5 border-t border-gray-100 flex items-start gap-1.5">
          <Sparkles className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[11px] text-gray-500 flex-1">
            <span className="font-semibold text-gray-700">AI: </span>
            {c.suggested_action.description.slice(0, 90)}{c.suggested_action.description.length > 90 ? "…" : ""}
          </p>
          {c.suggested_action.requires_approval && (
            <span className="shrink-0 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5">
              Approval needed
            </span>
          )}
        </div>
      )}
    </button>
  );
}

// ── Case dashboard view ────────────────────────────────────────────────────────

type CaseFilter = "all" | "needs_review" | "proposed" | "resolved" | "auto";

function CaseDashboardView({ cases, loading, onSelectCase, onNav }: {
  cases: DiscrepancyCase[];
  loading?: boolean;
  onSelectCase: (c: DiscrepancyCase) => void;
  onNav: (n: NavId) => void;
}) {
  const [filter, setFilter] = useState<CaseFilter>("all");

  const auto       = cases.filter(c => c.type === "AUTO_MATCHED");
  const actionable = cases.filter(c => c.type !== "AUTO_MATCHED");
  const pending    = actionable.filter(c => !c.userDecision);
  const highRisk   = actionable.filter(c => c.risk === "high" && !c.userDecision);
  const decided    = actionable.filter(c => !!c.userDecision);

  const filtered = filter === "auto"
    ? auto
    : filter === "needs_review"
    ? actionable.filter(c => c.status === "needs_review" && !c.userDecision)
    : filter === "proposed"
    ? actionable.filter(c => c.status === "proposed" && !c.userDecision)
    : filter === "resolved"
    ? decided
    : actionable;

  const tabs: { key: CaseFilter; label: string; count: number }[] = [
    { key:"all",          label:"All Cases",     count: actionable.length },
    { key:"needs_review", label:"Needs Review",  count: actionable.filter(c => c.status === "needs_review" && !c.userDecision).length },
    { key:"proposed",     label:"Proposed",      count: actionable.filter(c => c.status === "proposed" && !c.userDecision).length },
    { key:"resolved",     label:"Resolved",      count: decided.length },
    { key:"auto",         label:"Auto-matched",  count: auto.length },
  ];

  if (loading) {
    return (
      <div className="p-6 sm:p-8 max-w-4xl mx-auto w-full">
        <div className="mb-5 space-y-2">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)}
        </div>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-24" />)}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCaseCard key={i} />)}
        </div>
      </div>
    );
  }

  if (cases.length === 0) {
    return (
      <div className="p-8 max-w-4xl mx-auto w-full">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Case Review</h1>
        <p className="text-sm text-gray-400 mb-8">Upload your bank statement and general ledger to begin.</p>
        <div className="border border-dashed border-gray-200 py-24 flex flex-col items-center bg-white">
          <Layers className="h-12 w-12 text-gray-200 mb-3" />
          <p className="text-sm font-semibold text-gray-400">No data loaded yet</p>
          <p className="text-xs text-gray-300 mt-1">Go to Upload Files to get started</p>
          <button onClick={() => onNav("uploads")}
            className="mt-4 flex items-center gap-2 h-9 px-5 bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors">
            <Upload className="h-3.5 w-3.5" /> Upload Files
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 max-w-4xl mx-auto w-full">

      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Case Review</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {cases.length} cases · {auto.length} auto-resolved · {pending.length} need attention
          {highRisk.length > 0 && <span className="text-red-500 font-semibold"> · {highRisk.length} high risk</span>}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label:"Auto-resolved",  val:auto.length,     color:"text-emerald-700", bg:"bg-emerald-50",  border:"border-emerald-100" },
          { label:"Needs attention",val:pending.length,  color:"text-amber-700",   bg:"bg-amber-50",    border:"border-amber-100"   },
          { label:"High risk",      val:highRisk.length, color:"text-red-700",     bg:"bg-red-50",      border:"border-red-100"     },
          { label:"Resolved",       val:decided.length,  color:"text-blue-700",    bg:"bg-blue-50",     border:"border-blue-100"    },
        ].map(({ label, val, color, bg, border }) => (
          <div key={label} className={`border ${border} ${bg} px-4 py-3`}>
            <p className={`text-2xl font-bold ${color}`}>{val}</p>
            <p className="text-[11px] font-semibold text-gray-600 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setFilter(tab.key)}
            className={`flex items-center gap-1.5 h-8 px-3 text-[11px] font-semibold border transition-colors
              ${filter === tab.key
                ? "bg-gray-900 text-white border-gray-900"
                : "text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-800"}`}
          >
            {tab.label}
            <span className={`text-[10px] font-bold px-1 py-0.5 min-w-[18px] text-center
              ${filter === tab.key ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Case list */}
      {filtered.length === 0 ? (
        <div className="border border-gray-200 py-16 flex flex-col items-center bg-white">
          <CheckCircle2 className="h-10 w-10 text-emerald-300 mb-3" />
          <p className="text-sm font-semibold text-gray-500">No cases in this filter</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <CaseCard key={c.case_id} c={c} onClick={() => onSelectCase(c)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Case detail panel (slide-in) ──────────────────────────────────────────────

function CaseDetailPanel({ c, onClose, onApprove, onReject, onEscalate, bankInst }: {
  c:          DiscrepancyCase;
  onClose:    () => void;
  onApprove:  (note?: string) => void;
  onReject:   (note?: string) => void;
  onEscalate: () => void;
  bankInst?:  string;
}) {
  const { resp, streaming, error, explain } = useGrokExplain();
  const [grokOpen, setGrokOpen]   = useState(false);
  const [note, setNote]           = useState("");

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const isAuto     = c.type === "AUTO_MATCHED";
  const isDecided  = !!c.userDecision;
  const needsApproval = c.suggested_action.requires_approval;

  const bankLogo = getBankLogo(bankInst ?? "");

  function handleGrok() {
    setGrokOpen(v => !v);
    if (!resp && !streaming) {
      explain(
        `Analyze reconciliation case ${c.case_id}: ${c.title}`,
        `Type: ${c.type}. Risk: ${c.risk}. Hypothesis: ${c.hypothesis}. Evidence: ${c.evidence.join("; ")}. Suggested action: ${c.suggested_action.description}.`,
      );
    }
  }

  return (
    <motion.div
      initial={{ x:"100%" }} animate={{ x:0 }} exit={{ x:"100%" }}
      transition={{ type:"spring", stiffness:300, damping:30 }}
      className="fixed right-0 top-0 h-full w-full max-w-[680px] bg-white border-l border-gray-200 z-50 flex flex-col shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200 shrink-0 bg-gray-50">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            <CaseTypeBadge type={c.type} />
            <RiskBadge risk={c.risk} />
            <span className="text-[10px] text-gray-400 font-mono">{c.case_id}</span>
          </div>
          <h2 className="text-sm font-bold text-gray-900 pr-4 truncate">{c.title}</h2>
          <div className="flex items-center gap-2 mt-1">
            <ConfBar pct={c.confidence} />
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-gray-200 transition-colors shrink-0 ml-2">
          <X className="h-4 w-4 text-gray-500" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-gray-100">

        {/* Hypothesis */}
        <div className="px-5 py-4">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Hypothesis</p>
          <p className="text-sm text-gray-700 leading-relaxed">{c.hypothesis}</p>
        </div>

        {/* Evidence */}
        <div className="px-5 py-4">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Evidence ({c.evidence.length})</p>
          <ul className="space-y-1.5">
            {c.evidence.map((e, i) => (
              <li key={i} className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-xs text-gray-700">{e}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Suggested action */}
        <div className={`px-5 py-4 ${needsApproval ? "bg-amber-50/40" : "bg-blue-50/20"}`}>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Suggested Action</p>
          <div className="flex items-start gap-2.5">
            <Sparkles className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                {c.suggested_action.action_type.replace(/_/g, " ")}
              </p>
              <p className="text-sm text-gray-800">{c.suggested_action.description}</p>
              {needsApproval && (
                <p className="text-xs text-amber-700 font-semibold mt-1.5 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Requires manual approval before action
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Related transactions */}
        {(c.bank_txs.length > 0 || c.ledger_txs.length > 0) && (
          <div className="px-5 py-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Related Transactions</p>
            <div className="flex gap-3">
              {c.bank_txs.length > 0 && (
                <div className="flex-1 border border-gray-200 overflow-hidden">
                  <div className="px-3 py-2 bg-gray-100 border-b border-gray-200 flex items-center justify-between">
                    <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">
                      Bank {c.bank_txs.length > 1 && `(${c.bank_txs.length})`}
                    </p>
                    {bankLogo && <img src={bankLogo} alt="" className="h-4 w-auto" />}
                  </div>
                  {c.bank_txs.map(tx => (
                    <div key={tx.id} className="px-3 py-2.5 border-b border-gray-100 last:border-0">
                      <p className="text-xs font-medium text-gray-800">{tx.desc}</p>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-[10px] text-gray-400">{tx.date}</p>
                        <p className={`text-xs font-bold ${tx.amt >= 0 ? "text-emerald-600" : "text-red-500"}`}>{fmt(tx.amt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {c.ledger_txs.length > 0 && (
                <div className="flex-1 border border-gray-200 overflow-hidden">
                  <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                    <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">
                      Ledger {c.ledger_txs.length > 1 && `(${c.ledger_txs.length})`}
                    </p>
                  </div>
                  {c.ledger_txs.map(tx => (
                    <div key={tx.id} className="px-3 py-2.5 border-b border-gray-100 last:border-0">
                      <p className="text-xs font-medium text-gray-800">{tx.desc}</p>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-[10px] text-gray-400">{tx.date}</p>
                        <p className={`text-xs font-bold ${tx.amt >= 0 ? "text-emerald-600" : "text-red-500"}`}>{fmt(tx.amt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Audit narrative */}
        <div className="px-5 py-4">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Audit Narrative</p>
          <div className="bg-gray-50 border border-gray-100 p-3">
            <p className="text-xs text-gray-700 leading-relaxed font-mono">{c.audit_narrative}</p>
          </div>
        </div>

        {/* AI analysis */}
        {!isAuto && (
          <div className="px-5 py-4">
            <button onClick={handleGrok}
              className="flex items-center gap-2 text-xs font-semibold text-gray-600 hover:text-gray-900 transition-colors">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              {grokOpen ? "AI Analysis" : "Get AI analysis"}
              <ChevronDown className={`h-3 w-3 transition-transform ${grokOpen ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence>
              {grokOpen && (
                <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:"auto" }} exit={{ opacity:0, height:0 }}>
                  <div className="mt-3 border border-gray-100 bg-gray-50 p-3 min-h-[72px]">
                    {error && <p className="text-xs text-red-500">{error}</p>}
                    {!resp && !error && (
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <motion.div animate={{ rotate:360 }} transition={{ duration:1, repeat:Infinity, ease:"linear" }}>
                          <RefreshCw className="h-3.5 w-3.5" />
                        </motion.div>
                        Analysing case…
                      </div>
                    )}
                    {resp && <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{resp}</p>}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Action footer */}
      <div className="px-5 py-4 border-t border-gray-200 bg-gray-50 shrink-0">
        {isDecided ? (
          <div className="flex items-center gap-3">
            <span className={`text-xs font-bold px-3 py-1.5 border
              ${c.userDecision === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : c.userDecision === "rejected"  ? "bg-red-50 text-red-700 border-red-200"
              : "bg-amber-50 text-amber-700 border-amber-200"}`}>
              {c.userDecision === "approved" ? "✓ Approved"
                : c.userDecision === "rejected" ? "✗ Rejected" : "⚑ Escalated"}
            </span>
            {c.userNote && <p className="text-xs text-gray-500 italic truncate">{c.userNote}</p>}
            <button onClick={onClose} className="ml-auto text-xs text-gray-400 hover:text-gray-700">Close</button>
          </div>
        ) : isAuto ? (
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">This case was auto-resolved by the engine.</span>
            <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-700">Close</button>
          </div>
        ) : (
          <>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Your Decision</p>
            <textarea
              value={note} onChange={e => setNote(e.target.value)}
              placeholder="Optional note (reason for decision)…"
              className="w-full mb-3 h-14 border border-gray-200 px-3 py-2 text-xs resize-none focus:outline-none focus:border-gray-400"
            />
            <div className="flex flex-wrap gap-2">
              <button onClick={() => onApprove(note || undefined)}
                className={`flex items-center gap-1.5 h-9 px-4 text-white text-xs font-bold transition-colors
                  ${c.risk === "high" ? "bg-amber-600 hover:bg-amber-700" : "bg-blue-600 hover:bg-blue-700"}`}>
                <ThumbsUp className="h-3.5 w-3.5" />
                {c.suggested_action.action_type === "create_journal_entry" ? "Create Journal Entry"
                  : c.suggested_action.action_type.includes("grouped") ? "Approve Group"
                  : "Approve"}
              </button>
              <button onClick={() => onReject(note || undefined)}
                className="flex items-center gap-1.5 h-9 px-4 border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors">
                <ThumbsDown className="h-3.5 w-3.5" /> Reject
              </button>
              <button onClick={onEscalate}
                className="flex items-center gap-1.5 h-9 px-4 border border-amber-200 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors">
                <AlertTriangle className="h-3.5 w-3.5" /> Escalate
              </button>
              <button onClick={onClose} className="ml-auto text-xs text-gray-400 hover:text-gray-700 px-2">
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </motion.div>
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
              {file && <span className="flex items-center gap-1 text-[10px] text-blue-600 font-bold"><Check className="h-3 w-3"/>Loaded</span>}
            </div>
            <div className="p-5">
              {file
                ? parsing
                  ? <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-100">
                      <Skeleton className="h-4 w-4 shrink-0" />
                      <Skeleton className="h-3 flex-1" />
                      <Skeleton className="h-3 w-14 shrink-0" />
                    </div>
                  : <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200">
                      <FileText className="h-4 w-4 text-blue-600 shrink-0" />
                      <span className="text-xs font-medium text-blue-700 flex-1 truncate">{file.name}</span>
                      <span className="text-[10px] text-blue-500 shrink-0">{(file.size / 1024).toFixed(0)} KB</span>
                      <button onClick={() => { set(null); setError(null); }} className="text-blue-500 hover:text-blue-700 ml-1">
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
        <div className="mt-5 flex items-center justify-between p-4 border border-blue-200 bg-blue-50">
          <div>
            <p className="text-sm font-bold text-blue-800">Ready to reconcile</p>
            <p className="text-xs text-blue-600 mt-0.5">The engine will match transactions automatically.</p>
          </div>
          <button onClick={handleRun} disabled={parsing}
            className="h-9 px-5 bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2 shrink-0">
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
  rows, setRows, addAudit, jobId, bankInst,
}: {
  rows: ReconRow[];
  setRows: React.Dispatch<React.SetStateAction<ReconRow[]>>;
  addAudit: (a: Omit<AuditEntry, "ts" | "user">) => void;
  jobId: string;
  bankInst?: string;
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
              bankInst={bankInst}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Review Queue view ─────────────────────────────────────────────────────────

function ReviewQueueView({
  rows, setRows, addAudit, jobId, bankInst, loading,
}: {
  rows: ReconRow[];
  setRows: React.Dispatch<React.SetStateAction<ReconRow[]>>;
  addAudit: (a: Omit<AuditEntry, "ts" | "user">) => void;
  jobId: string;
  bankInst?: string;
  loading?: boolean;
}) {
  const [statusFilter, setStatusFilter] = useState<TxStatus | "all">("all");
  const [selected, setSelected] = useState<ReconRow | null>(null);

  const REVIEW_STATUSES = ["possible_match","manual_review","invalid_row","unmatched_bank","unmatched_ledger"] as TxStatus[];

  const allPending = rows.filter(r => REVIEW_STATUSES.includes(r.status) && !r.userStatus);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: allPending.length };
    REVIEW_STATUSES.forEach(s => { c[s] = allPending.filter(r => r.status === s).length; });
    return c;
  }, [allPending]);

  const queue = statusFilter === "all" ? allPending : allPending.filter(r => r.status === statusFilter);

  function handleAction(row: ReconRow, action: "approve" | "reject" | "manual") {
    const actionType: ActionType = action === "approve" ? "approve_match" : action === "reject" ? "reject_match" : "mark_manual";
    const userStatus = action === "approve" ? "approved" : action === "reject" ? "rejected" : "manual";
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, userStatus } : r));
    addAudit({ job_id: jobId, action: actionType, target_id: row.id, next: userStatus });
    setSelected(null);
  }

  if (loading) {
    return (
      <div className="p-6 sm:p-8 max-w-4xl mx-auto w-full">
        <div className="mb-4 space-y-2">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex gap-1.5 mb-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-20" />)}
        </div>
        <div className="border border-gray-100 bg-white">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 max-w-4xl mx-auto w-full">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Needs Review</h1>
        <p className="text-sm text-gray-400">{counts.all} item{counts.all !== 1 && "s"} need your sign-off</p>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        <button
          onClick={() => setStatusFilter("all")}
          className={`flex items-center gap-1.5 h-8 px-3 text-[11px] font-semibold border transition-colors
            ${statusFilter === "all"
              ? "bg-gray-900 text-white border-gray-900"
              : "text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-800"}`}
        >
          All
          <span className={`text-[10px] font-bold px-1 py-0.5 min-w-[18px] text-center
            ${statusFilter === "all" ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>
            {counts.all}
          </span>
        </button>
        {REVIEW_STATUSES.filter(s => counts[s] > 0).map(s => (
          <button key={s}
            onClick={() => setStatusFilter(s)}
            className={`flex items-center gap-1.5 h-8 px-3 text-[11px] font-semibold border transition-colors
              ${statusFilter === s
                ? "bg-gray-900 text-white border-gray-900"
                : "text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-800"}`}
          >
            <span className={`w-1.5 h-1.5 shrink-0 ${STATUS_CFG[s].dot}`} />
            {STATUS_CFG[s].short}
            <span className={`text-[10px] font-bold px-1 py-0.5 min-w-[18px] text-center
              ${statusFilter === s ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>
              {counts[s]}
            </span>
          </button>
        ))}
      </div>

      {queue.length === 0 ? (
        <div className="border border-gray-200 py-24 flex flex-col items-center bg-white">
          <CheckCircle2 className="h-12 w-12 text-emerald-400 mb-3" />
          <p className="text-sm font-semibold text-gray-600">Nothing to review</p>
          <p className="text-xs text-gray-400 mt-1">The engine handled everything automatically</p>
        </div>
      ) : (
        <div className="border border-gray-200 bg-white divide-y divide-gray-100">
          {queue.map(row => {
            const tx = row.bank ?? row.ledger;
            return (
              <div key={row.id}
                className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => setSelected(row)}
              >
                <div className={`w-1.5 h-1.5 shrink-0 ${STATUS_CFG[row.status].dot}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{tx?.desc ?? "—"}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    <span className={STATUS_CFG[row.status].text}>{STATUS_CFG[row.status].short}</span>
                    {tx?.date ? ` · ${tx.date}` : ""}
                  </p>
                </div>
                <span className={`text-sm font-bold shrink-0 ${tx && tx.amt >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {tx ? fmt(tx.amt) : "—"}
                </span>
                <ChevronRight className="h-4 w-4 text-gray-300 shrink-0" />
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
              bankInst={bankInst}
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
  const reportRef = `RPT-${(jobId||"XXXXXXXX").slice(4,12).toUpperCase()}`;

  // ── Palette — white paper, black ink ──────────────────────
  type RGB = [number,number,number];
  const INK    : RGB = [10,  10,  10 ];   // near-black body text
  const DARK   : RGB = [50,  50,  50 ];   // secondary text
  const MID    : RGB = [100, 100, 100];   // captions, sub-labels
  const LIGHT  : RGB = [155, 155, 155];   // row numbers, footnotes
  const RULE   : RGB = [200, 200, 200];   // hairlines
  const ROW_ALT: RGB = [246, 246, 246];   // alternate row tint
  const HDR_BG : RGB = [22,  22,  22 ];   // table header background
  const WHITE  : RGB = [255, 255, 255];

  // ── Helpers ───────────────────────────────────────────────
  const clr  = (c:RGB)  => doc.setTextColor(...c);
  const fill = (c:RGB)  => doc.setFillColor(...c);
  const strk = (c:RGB)  => doc.setDrawColor(...c);
  const lw   = (w:number) => doc.setLineWidth(w);
  const fnt  = (s:"normal"|"bold") => doc.setFont("helvetica", s);
  const sz   = (s:number) => doc.setFontSize(s);
  const txt  = (t:string, x:number, y:number, o?:any) => doc.text(t, x, y, o);
  const hln  = (y:number, x1=ML, x2=RX, w=0.2, c:RGB=RULE) => {
    strk(c); lw(w); doc.line(x1, y, x2, y);
  };
  const fmtAmt = (n:number) => {
    const s = Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,",");
    return n < 0 ? `(${s})` : s;
  };
  const fmtR = (n:number) => `R\u00A0${Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,",")}`;

  // ── Aggregates ────────────────────────────────────────────
  const matched  = rows.filter(r=>r.status==="matched").length;
  const possible = rows.filter(r=>r.status==="possible_match").length;
  const manual   = rows.filter(r=>r.status==="manual_review").length;
  const invalid  = rows.filter(r=>r.status==="invalid_row").length;
  const uBank    = rows.filter(r=>r.status==="unmatched_bank").length;
  const uLedger  = rows.filter(r=>r.status==="unmatched_ledger").length;
  const conf     = bank.length > 0 ? Math.round(matched/bank.length*100) : 0;
  const exceptions = rows.filter(r=>r.status!=="matched");
  const tBank   = bank.reduce((a,b)=>a+Math.abs(b.amt),0);
  const tLedger = ledger.reduce((a,l)=>a+Math.abs(l.amt),0);
  const discAmt = Math.abs(tBank-tLedger);
  const balanced = discAmt < 0.01;

  let page = 1;

  // ── Continuation-page header ──────────────────────────────
  const addContHeader = (section:string) => {
    strk(INK); lw(0.8); doc.line(ML, 13, RX, 13);
    hln(15, ML, RX, 0.15, RULE);
    fnt("bold"); sz(6.5); clr(INK);
    txt((company||"Entity").toUpperCase(), ML, 10.5);
    fnt("normal"); sz(6.5); clr(MID);
    txt(section, ML, 18.5);
    txt(period,  RX, 18.5, {align:"right"});
  };

  // ── Footer ────────────────────────────────────────────────
  const addFooter = (p:number) => {
    hln(H-13, ML, RX, 0.15, RULE);
    fnt("normal"); sz(5.5); clr(LIGHT);
    txt(`${company||"Entity"}  ·  Bank Reconciliation Statement  ·  ${reportRef}  ·  CONFIDENTIAL`, ML, H-9);
    txt(`Page ${p}`, RX, H-9, {align:"right"});
  };

  const newPage = (section:string) => {
    doc.addPage(); page++;
    addContHeader(section);
    addFooter(page);
    return 28;
  };

  // ════════════════════════════════════════════════════════════
  // COVER PAGE — white, clean, typographic
  // ════════════════════════════════════════════════════════════

  // Top rule (double)
  strk(INK); lw(1.0); doc.line(ML, 13, RX, 13);
  hln(15.5, ML, RX, 0.2, RULE);

  // Logo (top-left) + meta (top-right)
  if (logoData) doc.addImage(logoData,"PNG", ML, 4, 22, 7.5);
  else { fnt("bold"); sz(10); clr(INK); txt("Addup", ML, 11); }
  fnt("normal"); sz(6.5); clr(MID);
  txt(genDate,    RX, 8,    {align:"right"});
  txt(reportRef,  RX, 13.5, {align:"right"});

  // Title block
  let cy = 30;
  sz(7.5); fnt("normal"); clr(MID);
  txt("BANK RECONCILIATION STATEMENT", ML, cy); cy += 8;

  sz(24); fnt("bold"); clr(INK);
  const coLines = doc.splitTextToSize(company||"Entity", CW);
  doc.text(coLines, ML, cy); cy += coLines.length * 11 + 3;

  hln(cy, ML, RX, 0.3, INK); cy += 8;

  // Detail grid — 2 columns
  const det2 = (label:string, val:string, x:number, yy:number) => {
    sz(6); fnt("normal"); clr(MID); txt(label.toUpperCase(), x, yy);
    sz(8.5); fnt("normal"); clr(INK);
    const vl = doc.splitTextToSize(val||"—", 84);
    doc.text(vl, x, yy+5);
  };
  const c1=ML, c2=ML+CW/2+4;
  det2("Reconciliation Period", period,     c1, cy);
  det2("Bank Institution",      bankInst,   c2, cy); cy += 13;
  det2("Accounting System",     ledgerSoft, c1, cy);
  det2("Report Reference",      reportRef,  c2, cy); cy += 13;
  det2("Date Prepared",         genDate,    c1, cy);
  det2("Prepared by",           "Addup Financial Reconciliation", c2, cy); cy += 16;

  hln(cy, ML, RX, 0.2, RULE); cy += 7;

  // Status line
  sz(8.5); fnt("bold"); clr(INK);
  txt("RECONCILIATION STATUS", ML, cy);
  fnt("normal"); clr(DARK);
  txt(balanced
    ? "Fully Reconciled — No discrepancy detected"
    : `Unreconciled — Net difference: ${fmtR(discAmt)}`,
    ML+62, cy); cy += 10;

  // Summary table (clean — no color fills)
  const sumItems = [
    ["Bank transactions",      String(bank.length),           fmtR(tBank)  ],
    ["Ledger entries",         String(ledger.length),         fmtR(tLedger)],
    ["Net discrepancy",        "",                            balanced ? "R\u00A00.00" : fmtR(discAmt)],
    ["Matched automatically",  `${matched} of ${bank.length} (${conf}%)`,   ""],
    ["Requiring review",       String(possible + manual),     ""],
    ["Exceptions / Unmatched", String(invalid + uBank + uLedger), ""],
  ];

  // Table header
  fill(HDR_BG); strk(HDR_BG); lw(0);
  doc.rect(ML, cy, CW, 7.5, "F");
  sz(6.5); fnt("bold"); clr(WHITE);
  txt("ITEM",   ML+2,   cy+5);
  txt("DETAIL", ML+95,  cy+5, {align:"right"});
  txt("AMOUNT", RX-2,   cy+5, {align:"right"});
  cy += 7.5;

  sumItems.forEach((r, i) => {
    fill(i%2===0 ? WHITE : ROW_ALT);
    strk(RULE); lw(0.1);
    doc.rect(ML, cy, CW, 7.5, "F");
    doc.line(ML, cy+7.5, RX, cy+7.5);
    sz(8); fnt("normal"); clr(DARK); txt(r[0], ML+2, cy+5);
    clr(INK); fnt("bold"); if(r[1]) txt(r[1], ML+95, cy+5, {align:"right"});
    fnt("normal"); clr(DARK); if(r[2]) txt(r[2], RX-2, cy+5, {align:"right"});
    cy += 7.5;
  });
  strk(RULE); lw(0.2);
  doc.line(ML, cy, RX, cy);
  cy += 9;

  // Confidentiality notice
  hln(cy, ML, RX, 0.15, RULE); cy += 5;
  sz(6); fnt("normal"); clr(LIGHT);
  const cnLines = doc.splitTextToSize(
    `CONFIDENTIAL — This statement is prepared exclusively for ${company} and their designated auditors or directors. Unauthorised disclosure, distribution or reproduction is strictly prohibited. Prepared by Addup Financial Reconciliation Platform.`,
    CW
  );
  doc.text(cnLines, ML, cy);

  addFooter(1);

  // ════════════════════════════════════════════════════════════
  // PAGE 2 — RECONCILIATION SUMMARY & TRANSACTION BREAKDOWN
  // ════════════════════════════════════════════════════════════
  let y = newPage("Reconciliation Summary");

  sz(11); fnt("bold"); clr(INK); txt("1.  Reconciliation Summary", ML, y); y += 4;
  hln(y, ML, RX, 0.4, INK); y += 7;

  // Auditor-style opinion paragraph
  sz(8.5); fnt("normal"); clr(DARK);
  const opinionText = balanced
    ? `An automated reconciliation of ${bank.length} bank transactions against ${ledger.length} ledger entries for the period ${period} yielded ${matched} matched transactions representing a ${conf}% match rate. ${exceptions.length} item${exceptions.length!==1?"s":""} remain${exceptions.length===1?"s":""} open and require${exceptions.length===1?"s":""} resolution before this statement is considered finalised.`
    : `The automated reconciliation for the period ${period} identified a discrepancy of ${fmtR(discAmt)} between the bank statement and the general ledger. Of ${bank.length} bank transactions, ${matched} were matched automatically (${conf}%). The ${exceptions.length} unresolved item${exceptions.length!==1?"s":""} detailed in Section 3 must be cleared before this statement can be authorised.`;
  const opLines = doc.splitTextToSize(opinionText, CW);
  doc.text(opLines, ML, y); y += opLines.length*4.8 + 10;

  // Transaction Breakdown
  sz(11); fnt("bold"); clr(INK); txt("2.  Transaction Breakdown", ML, y); y += 4;
  hln(y, ML, RX, 0.4, INK); y += 6;

  const zarSum = (status:TxStatus) => {
    const s = rows.filter(r=>r.status===status).reduce((a,r)=>a+Math.abs(r.bank?.amt??0)+Math.abs(r.ledger?.amt??0),0);
    return fmtR(s);
  };
  const bdRows = [
    {cat:"Matched — Cleared",        cnt:matched,  amt:zarSum("matched"),          note:"Cleared"         },
    {cat:"Possible Match",           cnt:possible, amt:zarSum("possible_match"),   note:"For Review"      },
    {cat:"Manual Review Required",   cnt:manual,   amt:zarSum("manual_review"),    note:"For Review"      },
    {cat:"Invalid / Unprocessable",  cnt:invalid,  amt:zarSum("invalid_row"),      note:"Action Required" },
    {cat:"Unmatched — Bank Only",    cnt:uBank,    amt:zarSum("unmatched_bank"),   note:"Action Required" },
    {cat:"Unmatched — Ledger Only",  cnt:uLedger,  amt:zarSum("unmatched_ledger"), note:"Action Required" },
  ];

  // Header row
  fill(HDR_BG); strk(HDR_BG); lw(0);
  doc.rect(ML, y, CW, 7.5, "F");
  sz(6.5); fnt("bold"); clr(WHITE);
  txt("CATEGORY",   ML+2,    y+5);
  txt("COUNT",       ML+108,  y+5, {align:"right"});
  txt("AMOUNT (R)", ML+148,  y+5, {align:"right"});
  txt("STATUS",     RX-2,    y+5, {align:"right"});
  y += 7.5;

  bdRows.forEach((r,i) => {
    fill(i%2===0 ? WHITE : ROW_ALT);
    strk(RULE); lw(0.1);
    doc.rect(ML, y, CW, 7.5, "F");
    doc.line(ML, y+7.5, RX, y+7.5);
    sz(8); fnt("normal"); clr(DARK); txt(r.cat,        ML+2,   y+5);
    fnt("bold");          clr(INK);  txt(String(r.cnt), ML+108, y+5, {align:"right"});
    fnt("normal");        clr(DARK); txt(r.amt,         ML+148, y+5, {align:"right"});
    sz(7);                clr(MID);  txt(r.note,        RX-2,   y+5, {align:"right"});
    y += 7.5;
  });

  // Outer border around breakdown table
  strk(RULE); lw(0.25);
  doc.line(ML, y, RX, y);
  y += 5;

  // Totals
  fill(ROW_ALT); strk(RULE); lw(0.2);
  doc.rect(ML, y, CW, 8, "FD");
  sz(7.5); fnt("normal"); clr(MID);
  txt("Bank Statement Total", ML+4, y+5.5);
  sz(8.5); fnt("bold"); clr(INK);
  txt(fmtR(tBank), RX-2, y+5.5, {align:"right"});
  y += 8;

  fill(ROW_ALT); strk(RULE); lw(0.2);
  doc.rect(ML, y, CW, 8, "FD");
  sz(7.5); fnt("normal"); clr(MID);
  txt("General Ledger Total", ML+4, y+5.5);
  sz(8.5); fnt("bold"); clr(INK);
  txt(fmtR(tLedger), RX-2, y+5.5, {align:"right"});
  y += 12;

  // Discrepancy line — outlined box
  strk(INK); lw(0.4);
  doc.rect(ML, y, CW, 10, "S");
  sz(8.5); fnt("bold"); clr(INK);
  txt("NET DISCREPANCY", ML+4, y+6.5);
  txt(
    balanced ? "R\u00A00.00  —  Balanced" : `${fmtR(discAmt)}  —  Action Required`,
    RX-2, y+6.5, {align:"right"}
  );
  y += 14;

  // ════════════════════════════════════════════════════════════
  // PAGE 3+ — UNRECONCILED ITEMS & EXCEPTIONS
  // ════════════════════════════════════════════════════════════
  y = newPage("Unreconciled Items & Exceptions");

  sz(11); fnt("bold"); clr(INK); txt("3.  Unreconciled Items & Exceptions", ML, y); y += 4;
  hln(y, ML, RX, 0.4, INK); y += 6;
  sz(8); fnt("normal"); clr(MID);
  txt(`${exceptions.length} item${exceptions.length!==1?"s":""} require${exceptions.length===1?"s":""} resolution before sign-off.`, ML, y); y += 8;

  if (exceptions.length === 0) {
    strk(RULE); lw(0.25); doc.rect(ML, y, CW, 12, "S");
    sz(9); fnt("bold"); clr(DARK);
    txt("No exceptions — all transactions reconciled.", ML+5, y+8);
    y += 16;
  }

  exceptions.forEach(row => {
    const warnLines = row.warnings.flatMap(w => doc.splitTextToSize(w, CW-14) as string[]);
    const blockH = 13 + (row.reasons.length>0?5:0) + warnLines.length*4.5 + 6;
    if (y+blockH > 272) { y = newPage("Unreconciled Items (cont.)"); }

    const tx = row.bank || row.ledger;
    strk(RULE); lw(0.2);
    doc.rect(ML, y, CW, blockH, "S");
    // Thin left rule marks exception
    strk(INK); lw(0.6);
    doc.line(ML, y, ML, y+blockH);

    sz(7.5); fnt("bold"); clr(INK);
    txt(STATUS_CFG[row.status].label, ML+5, y+5.5);

    sz(7); fnt("normal"); clr(MID);
    const meta = [tx?.date?fmtDate(tx.date):"—", tx?.desc||"—", tx?fmtAmt(tx.amt):"—"].join("   ·   ");
    const metaShort = meta.length>70 ? meta.slice(0,68)+"\u2026" : meta;
    txt(metaShort, RX-2, y+5.5, {align:"right"});

    let ry = y+11;
    if (row.reasons.length>0) {
      sz(6.5); fnt("normal"); clr(LIGHT);
      txt("Signals: "+row.reasons.join(" · "), ML+5, ry); ry += 5;
    }
    warnLines.forEach(wl => {
      sz(7); fnt("normal"); clr(DARK); txt(wl, ML+5, ry); ry += 4.5;
    });
    sz(6.5); fnt("bold"); clr(MID);
    txt("RECOMMENDED ACTION: "+row.action.replace(/_/g," ").toUpperCase(), ML+5, y+blockH-2.5);
    y += blockH+3;
  });

  // ════════════════════════════════════════════════════════════
  // PAGE 4+ — TRANSACTION REGISTER
  // ════════════════════════════════════════════════════════════
  y = newPage("Transaction Register");

  sz(11); fnt("bold"); clr(INK); txt("4.  Transaction Register", ML, y); y += 4;
  hln(y, ML, RX, 0.4, INK); y += 5;
  sz(7.5); fnt("normal"); clr(MID);
  txt(`${rows.length} transactions  ·  ${bank.length} bank entries  ·  ${ledger.length} ledger entries  ·  ${period}`, ML, y); y += 7;

  // Columns: # | Date | Description | Amount | Conf | Status
  const C = { num:ML, date:ML+9, desc:ML+33, amt:ML+111, conf:ML+131, status:ML+148, end:RX };

  const drawTxHdr = () => {
    fill(HDR_BG); strk(HDR_BG); lw(0);
    doc.rect(ML, y, CW, 7.5, "F");
    sz(6.5); fnt("bold"); clr(WHITE);
    txt("#",           C.num+1,   y+5);
    txt("Date",        C.date+1,  y+5);
    txt("Description", C.desc+1,  y+5);
    txt("Amount",      C.amt+20,  y+5, {align:"right"});
    txt("Conf",        C.conf+20, y+5, {align:"right"});
    txt("Status",      C.status+2,y+5);
    y += 7.5;
  };
  drawTxHdr();

  const sorted = [...rows].sort((a,b)=>(a.bank?.date||a.ledger?.date||"").localeCompare(b.bank?.date||b.ledger?.date||""));

  sorted.forEach((row,i) => {
    if (y > 272) { y = newPage("Transaction Register (cont.)"); drawTxHdr(); }
    const tx = row.bank || row.ledger;
    fill(i%2===0 ? WHITE : ROW_ALT);
    strk(RULE); lw(0.1);
    doc.rect(ML, y, CW, 7, "F");
    doc.line(ML, y+7, RX, y+7);

    sz(7); fnt("normal");
    clr(LIGHT); txt(String(i+1),                       C.num+1,   y+4.8);
    clr(DARK);  txt(tx?.date?fmtDate(tx.date):"—",     C.date+1,  y+4.8);
    const desc = (tx?.desc||"—");
    const shortDesc = desc.length>38 ? desc.slice(0,36)+"\u2026" : desc;
    clr(INK);   txt(shortDesc,                          C.desc+1,  y+4.8);

    const amt = tx?.amt;
    if (amt !== undefined) {
      fnt("bold"); clr(INK);
      txt(fmtAmt(amt), C.amt+20, y+4.8, {align:"right"});
    } else {
      fnt("normal"); clr(LIGHT); txt("—", C.amt+20, y+4.8, {align:"right"});
    }

    fnt("normal");
    if (row.confidence > 0) {
      clr(DARK); txt(`${row.confidence}%`, C.conf+20, y+4.8, {align:"right"});
    } else {
      clr(LIGHT); txt("—", C.conf+20, y+4.8, {align:"right"});
    }

    sz(6.5); clr(MID);
    txt(STATUS_CFG[row.status].short, C.status+2, y+4.8);
    y += 7;
  });

  // ════════════════════════════════════════════════════════════
  // PAGE 5 — AUDIT TRAIL
  // ════════════════════════════════════════════════════════════
  y = newPage("Audit Trail");

  sz(11); fnt("bold"); clr(INK); txt("5.  Audit Trail", ML, y); y += 4;
  hln(y, ML, RX, 0.4, INK); y += 6;
  sz(7.5); fnt("normal"); clr(MID);
  txt(`All actions recorded for reconciliation job ${jobId}.`, ML, y); y += 7;

  fill(HDR_BG); strk(HDR_BG); lw(0);
  doc.rect(ML, y, CW, 7.5, "F");
  sz(6.5); fnt("bold"); clr(WHITE);
  txt("Timestamp", ML+2,   y+5);
  txt("Action",    ML+46,  y+5);
  txt("Reference", ML+106, y+5);
  txt("User",      RX-2,   y+5, {align:"right"});
  y += 7.5;

  if (auditLog.length === 0) {
    fill(ROW_ALT); strk(RULE); lw(0.1); doc.rect(ML, y, CW, 8, "FD");
    sz(8); fnt("normal"); clr(MID); txt("No actions recorded in this session.", ML+3, y+5.5);
    y += 10;
  } else {
    auditLog.forEach((e,i) => {
      if (y > 272) { y = newPage("Audit Trail (cont.)"); }
      fill(i%2===0 ? WHITE : ROW_ALT);
      strk(RULE); lw(0.1);
      doc.rect(ML, y, CW, 7, "F");
      doc.line(ML, y+7, RX, y+7);
      sz(7); fnt("normal");
      clr(MID);  txt(new Date(e.ts).toLocaleString("en-ZA"), ML+2,   y+4.8);
      clr(INK);  txt(ACTION_LABELS[e.action],                ML+46,  y+4.8);
      clr(MID);  txt(e.target_id,                            ML+106, y+4.8);
                 txt(e.user,                                 RX-2,   y+4.8, {align:"right"});
      y += 7;
    });
    y += 4;
  }

  // ════════════════════════════════════════════════════════════
  // DECLARATION & SIGN-OFF
  // ════════════════════════════════════════════════════════════
  if (y > 210) { y = newPage("Declaration & Sign-off"); }

  sz(11); fnt("bold"); clr(INK); txt("6.  Declaration & Sign-off", ML, y); y += 4;
  hln(y, ML, RX, 0.4, INK); y += 8;

  sz(8); fnt("normal"); clr(DARK);
  const declLines = doc.splitTextToSize(
    `I, the undersigned, being a duly authorised representative of ${company}, declare that this Bank Reconciliation Statement for the period ${period} is true, accurate and complete to the best of my knowledge. It was prepared using ${bankInst||"bank"} records and ${ledgerSoft||"ledger"} data and is available for inspection upon request by the board, auditors or any competent authority.`,
    CW
  );
  doc.text(declLines, ML, y); y += declLines.length*4.8 + 14;

  // Signature blocks
  const sig = (label:string, x:number, w:number) => {
    strk(INK); lw(0.25);
    doc.line(x, y+14, x+w, y+14);
    sz(6.5); fnt("normal"); clr(MID); txt(label, x, y+18);
    doc.line(x, y+26, x+w, y+26);
    txt("Date", x, y+30);
  };
  sig("Preparer — Full Name & Designation",  ML,            (CW/2)-6);
  sig("Reviewer / Authorised Signatory",     ML+(CW/2)+6,   (CW/2)-6);
  y += 36;

  hln(y+4, ML, RX, 0.15, RULE); y += 8;
  sz(5.5); fnt("normal"); clr(LIGHT);
  txt(`Prepared by Addup Financial Reconciliation Platform  ·  ${genTs}  ·  ${reportRef}`, ML, y);

  const slug = (company||"report").toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9-]/g,"");
  doc.save(`Recon-Statement-${slug}-${(period||"report").replace(/\s+/g,"-")}.pdf`);
}

function exportJSON(rows: ReconRow[], auditLog: AuditEntry[], company: string, bank: Tx[], ledger: Tx[], jobId: string, period: string) {
  const matched       = rows.filter(r => r.status === "matched");
  const possible      = rows.filter(r => r.status === "possible_match");
  const manual        = rows.filter(r => r.status === "manual_review");
  const invalid       = rows.filter(r => r.status === "invalid_row");
  const unmatchedBank = rows.filter(r => r.status === "unmatched_bank");
  const unmatchedLedger = rows.filter(r => r.status === "unmatched_ledger");
  const avgConf       = matched.length > 0
    ? Math.round(matched.reduce((a, r) => a + r.confidence, 0) / matched.length)
    : 0;

  const serializeRow = (r: ReconRow) => ({
    id: r.id,
    status: r.status,
    confidence: r.confidence,
    bank: r.bank ? {
      id: r.bank.id, date: r.bank.date,
      description: r.bank.desc,
      normalized_description: r.bank.normalizedDesc,
      amount: r.bank.amt,
      quality_status: r.bank.qualityStatus,
      quality_issues: r.bank.qualityIssues,
    } : null,
    ledger: r.ledger ? {
      id: r.ledger.id, date: r.ledger.date,
      description: r.ledger.desc,
      normalized_description: r.ledger.normalizedDesc,
      amount: r.ledger.amt,
      quality_status: r.ledger.qualityStatus,
      quality_issues: r.ledger.qualityIssues,
    } : null,
    score_breakdown: r.scoreBreakdown ?? null,
    top_candidates: r.candidates ?? [],
    reasons: r.reasons,
    warnings: r.warnings,
    user_decision: r.userStatus ?? null,
    suggested_action: r.action,
  });

  const data = {
    job_id: jobId,
    meta: { period, company, generated: now(), version: "2.0" },
    summary: {
      bank_transactions: bank.length,
      ledger_entries: ledger.length,
      matched: matched.length,
      possible_matches: possible.length,
      manual_review: manual.length,
      invalid_rows: invalid.length,
      unmatched_bank: unmatchedBank.length,
      unmatched_ledger: unmatchedLedger.length,
      overall_confidence: bank.length > 0
        ? Math.round(matched.length / bank.filter(b => b.qualityStatus !== "invalid").length * 100)
        : 0,
      average_match_confidence: avgConf,
    },
    results: rows.map(serializeRow),
    matched_items: matched.map(serializeRow),
    possible_matches: possible.map(serializeRow),
    manual_reviews: manual.map(serializeRow),
    invalid_rows: invalid.map(serializeRow),
    unmatched_bank: unmatchedBank.map(serializeRow),
    unmatched_ledger: unmatchedLedger.map(serializeRow),
    audit_log: auditLog,
    generated_at: now(),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `addup-${jobId || "report"}.json`; a.click();
  URL.revokeObjectURL(url);
}


// ── Main Engine ───────────────────────────────────────────────────────────────

export default function Engine() {
  const [loading,     setLoading]     = useState(true);
  const [nav,         setNav]         = useState<NavId>("uploads");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bankData,    setBankData]    = useState<Tx[]>([]);
  const [ledgerData,  setLedgerData]  = useState<Tx[]>([]);
  const [rows,        setRows]        = useState<ReconRow[]>([]);
  const [cases,       setCases]       = useState<DiscrepancyCase[]>([]);
  const [selectedCase,setSelectedCase]= useState<DiscrepancyCase | null>(null);
  const [auditLog,    setAuditLog]    = useState<AuditEntry[]>([]);
  const [company,     setCompany]     = useState("");
  const [bankInst,    setBankInst]    = useState("");
  const [ledgerSoft,  setLedgerSoft]  = useState("");
  const [jobId,       setJobId]       = useState("");
  const [period,      setPeriod]      = useState("");
  const [pdfLoading,  setPdfLoading]  = useState(false);
  const [reconciling, setReconciling] = useState(false);

  const hasData = bankData.length > 0 && ledgerData.length > 0;
  const overallConf = hasData
    ? Math.round(rows.filter(r => r.status === "matched").length / bankData.length * 100)
    : 0;

  const addAudit = useCallback((a: Omit<AuditEntry, "ts" | "user">) => {
    setAuditLog(prev => [...prev, { ...a, ts: now(), user: "local_user" }]);
  }, []);

  async function handleReconcile(bank: Tx[], ledger: Tx[], bankName: string, ledgerName: string) {
    // Navigate first so skeleton renders immediately, then run heavy work
    setReconciling(true);
    setSelectedCase(null);
    setNav("cases");
    await new Promise(r => setTimeout(r, 40));

    const newJobId  = `rec_${Date.now()}_001`;
    const newPeriod = derivePeriod(bank) || derivePeriod(ledger);
    const reconRows  = runReconciliation(bank, ledger);
    const reconCases = buildCases(reconRows);
    setBankData(bank);
    setLedgerData(ledger);
    setRows(reconRows);
    setCases(reconCases);
    setJobId(newJobId);
    setPeriod(newPeriod);
    if (!bankInst)   setBankInst(bankName.replace(/\.[^.]+$/, ""));
    if (!ledgerSoft) setLedgerSoft(ledgerName.replace(/\.[^.]+$/, ""));
    setAuditLog([]);
    setReconciling(false);
  }

  const reviewCount = rows.filter(r =>
    (r.status === "possible_match" || r.status === "manual_review" ||
     r.status === "invalid_row" || r.status === "unmatched_bank" ||
     r.status === "unmatched_ledger") && !r.userStatus
  ).length;

  const pendingCases = hasData
    ? cases.filter(c => c.type !== "AUTO_MATCHED" && !c.userDecision).length
    : 0;

  const NAV = [
    { id:"uploads"   as NavId, label:"Upload Files", icon:<Upload className="h-4 w-4"/>    },
    { id:"cases"     as NavId, label:"Cases",         icon:<Layers className="h-4 w-4"/>,
      badge: hasData && pendingCases > 0 ? pendingCases : undefined },
    { id:"dashboard" as NavId, label:"Overview",      icon:<BarChart3 className="h-4 w-4"/> },
    { id:"review"    as NavId, label:"Needs Review",  icon:<AlertCircle className="h-4 w-4"/>,
      badge: reviewCount > 0 ? reviewCount : undefined },
    { id:"audit"     as NavId, label:"Audit Trail",   icon:<ScrollText className="h-4 w-4"/> },
  ];

  const matchedCount  = rows.filter(r => r.status === "matched").length;
  const unmatchedCount = rows.filter(r =>
    r.status === "unmatched_bank" || r.status === "unmatched_ledger"
  ).length;

  function SidebarContent() {
    return (
      <div className="flex flex-col h-full bg-gray-100">

        {/* Logo + product */}
        <div className="px-4 pt-5 pb-4 border-b border-gray-200 shrink-0">
          <Link href="/" onClick={() => setSidebarOpen(false)}>
            <img src={addupLogo} alt="Addup" className="h-6 w-auto" />
          </Link>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="w-1.5 h-1.5 bg-blue-500 shrink-0" />
            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">
              Reconciliation Engine
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV.map(item => (
            <button key={item.id} onClick={() => { setNav(item.id); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors group
                ${nav === item.id
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:bg-gray-200 hover:text-gray-800"}`}
            >
              <span className={nav === item.id ? "text-blue-600" : "text-gray-400 group-hover:text-gray-600"}>
                {item.icon}
              </span>
              <span className="text-xs font-semibold flex-1">{item.label}</span>
              {item.badge !== undefined && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 min-w-[20px] text-center bg-red-500 text-white">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Export + Settings */}
        <div className="px-3 pb-4 border-t border-gray-200 pt-3 space-y-1.5 shrink-0">
          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 px-1 mb-2">Export Report</p>
          <button
            onClick={async () => {
              setPdfLoading(true);
              addAudit({ job_id:jobId, action:"export_pdf", target_id:jobId });
              await exportPDF(rows, auditLog, company, bankInst, ledgerSoft, bankData, ledgerData, jobId, period);
              setPdfLoading(false);
            }}
            disabled={pdfLoading || !hasData}
            className="w-full flex items-center justify-center gap-2 h-9 bg-blue-600 text-white text-[11px] font-semibold hover:bg-blue-500 transition-colors disabled:opacity-40"
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
            disabled={!hasData}
            className="w-full flex items-center justify-center gap-2 h-9 border border-gray-300 text-gray-500 text-[11px] font-semibold hover:bg-gray-200 transition-colors disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5"/>Export JSON
          </button>
          <button
            onClick={() => { setNav("settings"); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2 mt-1 transition-colors group
              ${nav === "settings" ? "bg-white text-gray-900" : "text-gray-500 hover:bg-gray-200 hover:text-gray-700"}`}
          >
            <Settings2 className={`h-4 w-4 ${nav === "settings" ? "text-blue-600" : "text-gray-400 group-hover:text-gray-600"}`} />
            <span className="text-xs font-semibold">Settings</span>
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
          <span className="text-sm font-semibold text-gray-800">
            {NAV.find(n => n.id === nav)?.label ?? nav}
          </span>
          <div className="ml-auto flex items-center gap-3">
            {company && <span className="text-xs text-gray-400 hidden sm:block">{company}</span>}
            {hasData && (
              <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5">
                {overallConf}% matched
              </span>
            )}
          </div>
        </header>

        {/* View content */}
        <main className="flex-1 overflow-auto relative">
          {nav === "cases"     && <CaseDashboardView
              cases={cases}
              loading={reconciling}
              onSelectCase={c => setSelectedCase(c)}
              onNav={setNav}
            />}
          {nav === "dashboard" && <DashboardView
              rows={rows} onNav={setNav}
              loading={reconciling}
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
          {nav === "jobs"      && <JobsView rows={rows} setRows={setRows} addAudit={addAudit} jobId={jobId} bankInst={bankInst} />}
          {nav === "review"    && <ReviewQueueView rows={rows} setRows={setRows} addAudit={addAudit} jobId={jobId} bankInst={bankInst} loading={reconciling} />}
          {nav === "audit"     && <AuditLogView log={auditLog} jobId={jobId} onExport={() => {
              addAudit({ job_id:jobId, action:"export_json", target_id:jobId });
              exportJSON(rows, auditLog, company, bankData, ledgerData, jobId, period);
            }} />}
          {nav === "settings"  && <SettingsView company={company} setCompany={setCompany} bank={bankInst} setBank={setBankInst} ledger={ledgerSoft} setLedger={setLedgerSoft} />}

          {/* Case detail panel slide-in overlay */}
          <AnimatePresence>
            {selectedCase && (
              <>
                <motion.div
                  initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                  className="fixed inset-0 bg-gray-900/40 z-30"
                  onClick={() => setSelectedCase(null)}
                />
                <CaseDetailPanel
                  c={selectedCase}
                  onClose={() => setSelectedCase(null)}
                  onApprove={(note) => {
                    setCases(prev => prev.map(c => c.case_id === selectedCase.case_id
                      ? { ...c, userDecision: "approved", userNote: note, status: "approved" as CaseStatus } : c));
                    setSelectedCase(null);
                  }}
                  onReject={(note) => {
                    setCases(prev => prev.map(c => c.case_id === selectedCase.case_id
                      ? { ...c, userDecision: "rejected", userNote: note, status: "rejected" as CaseStatus } : c));
                    setSelectedCase(null);
                  }}
                  onEscalate={() => {
                    setCases(prev => prev.map(c => c.case_id === selectedCase.case_id
                      ? { ...c, userDecision: "escalated", status: "needs_review" as CaseStatus } : c));
                    setSelectedCase(null);
                  }}
                  bankInst={bankInst}
                />
              </>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
    </>
  );
}
