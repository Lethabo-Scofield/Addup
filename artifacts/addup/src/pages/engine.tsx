import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, AlertCircle, Check, FileText, Upload,
  Download, X, ArrowRight, ArrowLeft, Camera, Sparkles,
  BarChart2, ListChecks, Workflow, FolderInput,
  ChevronDown, RefreshCw,
} from "lucide-react";
import addupLogo from "@assets/Addup_1777332904059.png";
import jsPDF from "jspdf";

// ── Loader ────────────────────────────────────────────────────────────────────

const LOADER_LINES = [
  { ms: 0,    text: "Connecting to reconciliation engine..." },
  { ms: 550,  text: "Loading bank.csv — 19 transactions"    },
  { ms: 1050, text: "Loading ledger.csv — 11 entries"       },
  { ms: 1500, text: "Normalizing date formats..."           },
  { ms: 1950, text: "Ready."                                },
];
const LOADER_MS = 2600;

function EngineLoader({ onDone }: { onDone: () => void }) {
  const [visible, setVisible] = useState<number[]>([]);
  useEffect(() => {
    const ts: ReturnType<typeof setTimeout>[] = [];
    LOADER_LINES.forEach((l, i) => ts.push(setTimeout(() => setVisible(p => [...p, i]), l.ms)));
    ts.push(setTimeout(onDone, LOADER_MS));
    return () => ts.forEach(clearTimeout);
  }, [onDone]);

  return (
    <motion.div
      initial={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: "easeInOut" }}
      className="fixed inset-0 z-[999] bg-white flex flex-col items-center justify-center px-6"
    >
      <motion.img src={addupLogo} alt="Addup"
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }} className="h-8 w-auto mb-14"
      />
      <div className="w-full max-w-xs space-y-3">
        {LOADER_LINES.map((l, i) => (
          <AnimatePresence key={i}>
            {visible.includes(i) && (
              <motion.div initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25 }} className="flex items-center gap-3"
              >
                {i === LOADER_LINES.length - 1
                  ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  : <span className="h-3.5 w-3.5 flex items-center justify-center shrink-0">
                      <span className="h-1.5 w-1.5 bg-gray-300 rounded-full" />
                    </span>
                }
                <span className={`font-mono text-xs ${i === LOADER_LINES.length - 1 ? "text-gray-900 font-semibold" : "text-gray-400"}`}>
                  {l.text}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        ))}
      </div>
      <div className="mt-14 w-full max-w-xs h-[1px] bg-gray-100 overflow-hidden">
        <motion.div className="h-full bg-gray-900"
          initial={{ width: "0%" }} animate={{ width: "100%" }}
          transition={{ duration: LOADER_MS / 1000 - 0.2, ease: "linear" }}
        />
      </div>
    </motion.div>
  );
}

// ── Data ──────────────────────────────────────────────────────────────────────

type View = "workflow" | "results" | "resolves" | "explain";
type StepId = "upload" | "read" | "match" | "review" | "report";

const STEPS: { id: StepId; label: string; desc: string }[] = [
  { id: "upload", label: "Upload",  desc: "Add your files"       },
  { id: "read",   label: "Read",    desc: "Parse & normalize"     },
  { id: "match",  label: "Match",   desc: "Compare transactions"  },
  { id: "review", label: "Review",  desc: "Resolve flagged items" },
  { id: "report", label: "Report",  desc: "Export reconciliation" },
];

const DATE_FORMATS = [
  { raw: "2026-04-01",    norm: "2026-04-01", note: "Standard — no change"  },
  { raw: "01/04/2026",    norm: "2026-04-01", note: "Day/Month/Year"         },
  { raw: "07-04-2026",    norm: "2026-04-07", note: "Dash-separated"         },
  { raw: '"09 Apr 2026"', norm: "2026-04-09", note: "Written month"          },
  { raw: "4/5/2026",      norm: "2026-04-05", note: "Short US format"        },
];

const MATCHES = [
  { bank: { id: "B-001", date: "1 Apr",  desc: "Salary Payment",            amt:  3500.00 },
    ledger:{ id: "L-001", date: "1 Apr",  desc: "Salary",                    amt:  3500.00 },
    quality: "perfect" as const, conf: 100, flags: [] },
  { bank: { id: "B-002", date: "2 Apr",  desc: "Online Transfer to Savings", amt:  -500.00 },
    ledger:{ id: "L-002", date: "3 Apr",  desc: "Savings Transfer",           amt:  -500.00 },
    quality: "close"   as const, conf: 84,  flags: ["Different descriptions"] },
  { bank: { id: "B-004", date: "6 Apr",  desc: "Direct Debit Electricity",   amt:   -95.67 },
    ledger:{ id: "L-003", date: "28 Mar", desc: "Electricity DD",             amt:   -95.67 },
    quality: "amount"  as const, conf: 78,  flags: ["Dates 9 days apart"]     },
  { bank: { id: "B-005", date: "7 Apr",  desc: "Online Payment - Amazon",    amt:   -87.99 },
    ledger:{ id: "L-004", date: "7 Apr",  desc: "Online Purchase",            amt:   -87.99 },
    quality: "perfect" as const, conf: 100, flags: ["Different descriptions"] },
  { bank: { id: "B-006", date: "10 Apr", desc: "Check Deposit",              amt:   500.00 },
    ledger:{ id: "L-005", date: "10 Apr", desc: "Check Deposit",              amt:   500.00 },
    quality: "perfect" as const, conf: 100, flags: [] },
  { bank: { id: "B-007", date: "12 Apr", desc: "Interest Credit",            amt:     2.35 },
    ledger:{ id: "L-006", date: "15 Apr", desc: "Interest",                   amt:     2.35 },
    quality: "amount"  as const, conf: 78,  flags: ["Dates 3 days apart"]     },
  { bank: { id: "B-009", date: "19 Apr", desc: "Payroll Tax",                amt:  -450.00 },
    ledger:{ id: "L-007", date: "19 Apr", desc: "Payroll Tax",                amt:  -450.00 },
    quality: "perfect" as const, conf: 100, flags: [] },
];

const MISSING = [
  { id: "B-003", desc: "Coffee Shop, Downtown",  amt:    -4.50, why: "No ledger entry found for this amount on this date."        },
  { id: "B-008", desc: "Wire Transfer Incoming", amt: 10000.00, why: "Large credit in the bank — nothing recorded in the ledger." },
];

const ISSUES = [
  { id: "B-002::L-002", kind: "desc" as const,
    title: "Bank and ledger use different names",
    bank: "Online Transfer to Savings", ledger: "Savings Transfer", amt: -500.00,
    plain: "The bank says 'Online Transfer to Savings', your ledger says 'Savings Transfer'. These are likely the same transaction — the wording is just different.",
    action: "Accept as match" },
  { id: "B-004::L-003", kind: "date" as const,
    title: "Dates are 9 days apart",
    bank: "Bank: 6 Apr 2026", ledger: "Ledger: 28 Mar 2026", amt: -95.67,
    plain: "The electricity direct debit appears on 6 April in the bank but 28 March in the ledger. The amounts match exactly — this may be a posting delay or a recording error.",
    action: "Confirm and accept" },
  { id: "B-005::L-004", kind: "desc" as const,
    title: "Amazon payment recorded generically",
    bank: "Online Payment - Amazon", ledger: "Online Purchase", amt: -87.99,
    plain: "The bank identifies this as an Amazon payment. The ledger just says 'Online Purchase'. Consider updating the ledger description for clarity.",
    action: "Accept as match" },
  { id: "B-007::L-006", kind: "date" as const,
    title: "Interest credit dates are 3 days apart",
    bank: "Bank: 12 Apr 2026", ledger: "Ledger: 15 Apr 2026", amt: 2.35,
    plain: "Small interest credit — the bank shows it on the 12th, the ledger on the 15th. Timing differences like this are common for interest postings.",
    action: "Apply fix" },
  { id: "B-003", kind: "missing" as const,
    title: "Coffee shop charge not in ledger",
    bank: "Coffee Shop, Downtown", ledger: "—", amt: -4.50,
    plain: "A R4.50 charge appears in your bank statement but nothing matches in your ledger. This could be an unrecorded petty cash expense.",
    action: "Add to ledger" },
  { id: "B-008", kind: "missing" as const,
    title: "R10,000 wire transfer not recorded",
    bank: "Wire Transfer Incoming", ledger: "—", amt: 10000.00,
    plain: "A R10,000 incoming wire appears in your bank with no matching ledger entry. This is a significant amount — confirm the source and record it.",
    action: "Request data" },
];

const AVG_CONF = Math.round(MATCHES.reduce((s, m) => s + m.conf, 0) / MATCHES.length);

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtAmt(n: number) {
  const abs = Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${n < 0 ? "\u2212" : "+"}R\u00a0${abs}`;
}

function qualityChip(q: "perfect" | "close" | "amount") {
  if (q === "perfect") return { label: "Perfect match", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (q === "close")   return { label: "Off by 1 day",  cls: "bg-blue-50 text-blue-700 border-blue-200"         };
  return                      { label: "Amount match",  cls: "bg-amber-50 text-amber-700 border-amber-200"      };
}

// ── Grok explain hook ─────────────────────────────────────────────────────────

function useGrokExplain() {
  const [response, setResponse]     = useState("");
  const [streaming, setStreaming]   = useState(false);
  const [error, setError]           = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const explain = useCallback(async (question: string, context?: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setResponse("");
    setError("");
    setStreaming(true);

    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, context }),
        signal: ctrl.signal,
      });

      if (!res.ok) { setError("Could not reach the explain service."); setStreaming(false); return; }
      if (!res.body) { setError("No response received."); setStreaming(false); return; }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.content) setResponse(p => p + parsed.content);
            if (parsed.done)    setStreaming(false);
            if (parsed.error)   { setError(parsed.error); setStreaming(false); }
          } catch { /* skip malformed */ }
        }
      }
    } catch (e: any) {
      if (e.name !== "AbortError") setError("Something went wrong. Please try again.");
    } finally {
      setStreaming(false);
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setResponse(""); setError(""); setStreaming(false);
  }, []);

  return { response, streaming, error, explain, reset };
}

// ── Sidebar step node ─────────────────────────────────────────────────────────

function StepNode({ n, status }: { n: number; status: "done" | "active" | "pending" }) {
  if (status === "done")   return <span className="w-6 h-6 flex items-center justify-center bg-emerald-500 shrink-0"><Check className="h-3 w-3 text-white" strokeWidth={2.5} /></span>;
  if (status === "active") return <span className="w-6 h-6 flex items-center justify-center bg-gray-900 shrink-0"><span className="text-white text-[11px] font-bold">{n}</span></span>;
  return                          <span className="w-6 h-6 flex items-center justify-center border border-gray-200 shrink-0"><span className="text-gray-300 text-[11px] font-medium">{n}</span></span>;
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Engine() {
  const [loading,     setLoading]     = useState(true);
  const [view,        setView]        = useState<View>("workflow");
  const [step,        setStep]        = useState(0);
  const [filter,      setFilter]      = useState<"all" | "clean" | "flagged">("all");
  const [resolved,    setResolved]    = useState<Set<string>>(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bankFile,    setBankFile]    = useState<string | null>(null);
  const [ledgerFile,  setLedgerFile]  = useState<string | null>(null);
  const [explainTarget, setExplainTarget] = useState<{ id: string; title: string; context: string } | null>(null);

  const { response: grokResponse, streaming: grokStreaming, error: grokError, explain: grokExplain, reset: grokReset } = useGrokExplain();

  const handleLoaderDone = useCallback(() => setLoading(false), []);
  const resolve = (id: string) => setResolved(p => new Set([...p, id]));

  const stepId   = STEPS[step].id;
  const isLast   = step === STEPS.length - 1;
  const isMobile = typeof window !== "undefined" && /Mobi|Android/i.test(navigator.userAgent);

  const visibleMatches =
    filter === "clean"   ? MATCHES.filter(m => m.flags.length === 0) :
    filter === "flagged" ? MATCHES.filter(m => m.flags.length  >  0) : MATCHES;

  function openExplain(id: string, title: string, context: string) {
    setExplainTarget({ id, title, context });
    setView("explain");
    grokReset();
    setSidebarOpen(false);
  }

  useEffect(() => {
    if (view === "explain" && explainTarget && !grokResponse && !grokStreaming) {
      grokExplain(
        `Explain this reconciliation item to me in plain English: "${explainTarget.title}"`,
        explainTarget.context
      );
    }
  }, [view, explainTarget]);

  // ── Shared sidebar nav ────────────────────────────────────────────────────

  const NAV_ITEMS: { id: View; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: "workflow", label: "Workflow",  icon: <Workflow   className="h-4 w-4" /> },
    { id: "results",  label: "Results",   icon: <BarChart2  className="h-4 w-4" /> },
    { id: "resolves", label: "Resolves",  icon: <ListChecks className="h-4 w-4" />,
      badge: resolved.size < ISSUES.length ? `${ISSUES.length - resolved.size}` : undefined },
    { id: "explain",  label: "Ask Grok",  icon: <Sparkles  className="h-4 w-4" /> },
  ];

  function SidebarInner() {
    const bankRef   = useRef<HTMLInputElement>(null);
    const ledgerRef = useRef<HTMLInputElement>(null);
    const scanRef   = useRef<HTMLInputElement>(null);

    return (
      <div className="flex flex-col h-full overflow-y-auto">

        {/* Logo */}
        <div className="px-5 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <Link href="/" onClick={() => setSidebarOpen(false)}>
            <img src={addupLogo} alt="Addup" className="h-6 w-auto" />
          </Link>
          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mt-1.5">
            Reconciliation Engine
          </p>
        </div>

        {/* Sources */}
        <div className="px-4 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-1.5 mb-3">
            <FolderInput className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Sources</span>
          </div>

          {/* Bank statement */}
          <div className="mb-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold text-gray-600">Bank statement</span>
              {bankFile && <span className="text-[9px] text-emerald-600 font-bold flex items-center gap-0.5"><Check className="h-2.5 w-2.5" /> Loaded</span>}
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => bankRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-1 h-8 border border-dashed border-gray-200 text-[11px] text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
              >
                <Upload className="h-3 w-3" />
                {bankFile ? bankFile : "Upload CSV"}
              </button>
            </div>
            <input ref={bankRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
              onChange={e => setBankFile(e.target.files?.[0]?.name ?? null)} />
          </div>

          {/* Ledger */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold text-gray-600">General ledger</span>
              {ledgerFile && <span className="text-[9px] text-emerald-600 font-bold flex items-center gap-0.5"><Check className="h-2.5 w-2.5" /> Loaded</span>}
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => ledgerRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-1 h-8 border border-dashed border-gray-200 text-[11px] text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
              >
                <Upload className="h-3 w-3" />
                {ledgerFile ? ledgerFile : "Upload CSV"}
              </button>
              {isMobile && (
                <button
                  onClick={() => scanRef.current?.click()}
                  title="Scan with camera"
                  className="w-8 h-8 flex items-center justify-center border border-dashed border-gray-200 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
                >
                  <Camera className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <input ref={ledgerRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
              onChange={e => setLedgerFile(e.target.files?.[0]?.name ?? null)} />
            <input ref={scanRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={e => setLedgerFile(e.target.files?.[0]?.name ?? "Scanned ledger")} />
            {!isMobile && (
              <p className="text-[10px] text-gray-400 mt-1">On mobile, you can also scan a printed ledger.</p>
            )}
          </div>
        </div>

        {/* Period */}
        <div className="px-4 py-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-400 font-medium">Period</span>
            <span className="text-[11px] font-bold text-gray-900 bg-gray-100 px-2 py-0.5">April 2026</span>
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px] text-gray-400 font-medium">Status</span>
            <span className={`text-[9px] font-bold px-2 py-0.5 border ${
              isLast && view === "workflow"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-amber-50 text-amber-700 border-amber-200"
            }`}>
              {isLast && view === "workflow" ? "Complete" : "In progress"}
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="px-3 py-3 space-y-0.5 shrink-0">
          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 px-2 mb-2">Navigate</p>
          {NAV_ITEMS.map(item => (
            <button key={item.id}
              onClick={() => { setView(item.id); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-left transition-colors
                ${view === item.id
                  ? "bg-gray-900 text-white"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                }`}
            >
              <span className={view === item.id ? "text-white" : "text-gray-400"}>{item.icon}</span>
              <span className="text-xs font-semibold flex-1">{item.label}</span>
              {item.badge && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 min-w-[20px] text-center
                  ${view === item.id ? "bg-white/20 text-white" : "bg-red-100 text-red-600"}`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Workflow steps (visible when on workflow view) */}
        {view === "workflow" && (
          <div className="px-3 pb-3 shrink-0">
            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 px-2 mb-2">Steps</p>
            <div className="space-y-0.5">
              {STEPS.map((s, i) => {
                const status = i < step ? "done" : i === step ? "active" : "pending";
                const canClick = i <= step;
                return (
                  <button key={s.id}
                    onClick={() => { if (canClick) setStep(i); }}
                    disabled={!canClick}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-left transition-colors
                      ${status === "active" ? "bg-gray-50 border-l-2 border-gray-900"
                        : canClick ? "hover:bg-gray-50 border-l-2 border-transparent"
                        : "border-l-2 border-transparent opacity-40 cursor-default"}`}
                  >
                    <StepNode n={i + 1} status={status} />
                    <div className="min-w-0">
                      <div className={`text-[11px] font-semibold leading-tight ${
                        status === "active" ? "text-gray-900" : status === "done" ? "text-gray-500" : "text-gray-300"
                      }`}>{s.label}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Live summary */}
        {step >= 2 && (
          <div className="px-4 py-3 mx-3 mb-3 bg-gray-50 shrink-0">
            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-2">Run summary</p>
            {[
              { lbl: "Matched",   val: "7 / 9",         cls: "text-emerald-600" },
              { lbl: "Unmatched", val: "2",              cls: "text-amber-600"   },
              { lbl: "Issues",    val: `${ISSUES.length - resolved.size} left`,
                cls: resolved.size === ISSUES.length ? "text-emerald-600" : "text-red-500" },
              { lbl: "Avg conf.", val: `${AVG_CONF}%`,   cls: "text-gray-900"   },
            ].map(({ lbl, val, cls }) => (
              <div key={lbl} className="flex items-center justify-between">
                <span className="text-[10px] text-gray-400">{lbl}</span>
                <span className={`text-[10px] font-bold font-mono ${cls}`}>{val}</span>
              </div>
            ))}
          </div>
        )}

        {/* Spacer + exit */}
        <div className="flex-1" />
        <div className="px-5 py-4 border-t border-gray-100 shrink-0">
          <Link href="/" className="flex items-center gap-2 text-[11px] text-gray-400 hover:text-gray-700 transition-colors">
            <X className="h-3.5 w-3.5" />
            Exit reconciliation
          </Link>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      <AnimatePresence>
        {loading && <EngineLoader onDone={handleLoaderDone} />}
      </AnimatePresence>

      <div className="flex h-[100svh] bg-white overflow-hidden">

        {/* Desktop sidebar */}
        <aside className="hidden lg:flex flex-col w-60 shrink-0 border-r border-gray-100 h-full">
          <SidebarInner />
        </aside>

        {/* Mobile overlay sidebar */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-black/20 lg:hidden"
                onClick={() => setSidebarOpen(false)}
              />
              <motion.aside
                initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="fixed left-0 top-0 bottom-0 z-50 w-60 bg-white border-r border-gray-100 lg:hidden"
              >
                <SidebarInner />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

          {/* Mobile topbar */}
          <div className="lg:hidden flex items-center justify-between px-4 h-13 border-b border-gray-100 shrink-0">
            <button onClick={() => setSidebarOpen(true)} className="flex items-center gap-2">
              <img src={addupLogo} alt="Addup" className="h-5 w-auto" />
            </button>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-gray-400 font-medium capitalize">{view}</span>
              <Link href="/"><X className="h-4 w-4 text-gray-400" /></Link>
            </div>
          </div>

          {/* Progress strip */}
          <div className="h-[2px] bg-gray-100 shrink-0">
            <motion.div className="h-full bg-gray-900"
              animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>

          {/* Content */}
          <main className="flex-1 overflow-y-auto">
            <AnimatePresence mode="wait">
              <motion.div key={`${view}-${step}`}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="min-h-full"
              >
                <div className="max-w-2xl mx-auto px-5 py-10 sm:py-12">

                  {/* ══ WORKFLOW VIEW ══ */}
                  {view === "workflow" && (
                    <>
                      {/* STEP 1 */}
                      {stepId === "upload" && <>
                        <StepMeta n={1} title="Upload your two files"
                          sub="Addup needs your bank statement and your accounting ledger — then it compares them automatically."
                        />
                        <div className="grid sm:grid-cols-2 gap-4 mb-8">
                          {[
                            { label:"Bank Statement", file:"bank.csv",   rows:19, size:"4.2 KB", note:"FNB Business · April 2026",  tip:"Export from your online banking portal." },
                            { label:"General Ledger", file:"ledger.csv", rows:11, size:"2.8 KB", note:"Xero export · April 2026",    tip:"Export from Xero, QuickBooks, or Sage."  },
                          ].map(f=>(
                            <div key={f.file} className="border border-gray-100 p-5 hover:border-gray-200 transition-colors">
                              <div className="flex items-center gap-3 mb-3">
                                <div className="w-8 h-8 bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
                                  <FileText className="h-4 w-4 text-gray-400" />
                                </div>
                                <div>
                                  <div className="font-semibold text-sm text-gray-900">{f.label}</div>
                                  <div className="text-xs text-gray-400">{f.note}</div>
                                </div>
                              </div>
                              <p className="text-xs text-gray-400 mb-3">{f.tip}</p>
                              <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 px-3 py-2 mb-3">
                                <Check className="h-3 w-3 text-emerald-500 shrink-0" />
                                <span className="font-mono text-xs text-gray-700 flex-1 truncate">{f.file}</span>
                                <span className="text-xs text-gray-400 shrink-0">{f.rows}r · {f.size}</span>
                              </div>
                              <button className="w-full h-8 flex items-center justify-center gap-1.5 border border-gray-200 text-xs text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-colors">
                                <Upload className="h-3 w-3" /> Replace file
                              </button>
                            </div>
                          ))}
                        </div>
                        <Note>Sample April 2026 data is pre-loaded so you can walk through the full workflow right now.</Note>
                      </>}

                      {/* STEP 2 */}
                      {stepId === "read" && <>
                        <StepMeta n={2} title="Files read successfully"
                          sub="19 bank transactions and 11 ledger entries found. All dates were standardized to one format."
                        />
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
                          {[["19","Bank transactions"],["11","Ledger entries"],["5","Date formats"],["0","Invalid rows"]].map(([v,l])=>(
                            <StatCard key={l} val={v} label={l} />
                          ))}
                        </div>
                        <SectionLabel>Date formats recognized automatically</SectionLabel>
                        <div className="border border-gray-100 mb-8">
                          <div className="grid grid-cols-3 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                            {["In your file","Format","Converted to"].map(h=>(<span key={h} className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{h}</span>))}
                          </div>
                          {DATE_FORMATS.map((r,i)=>(
                            <div key={i} className="grid grid-cols-3 px-4 py-3 border-b border-gray-50 last:border-0 items-center">
                              <span className="font-mono text-[11px] text-gray-500">{r.raw}</span>
                              <span className="text-xs text-gray-400">{r.note}</span>
                              <span className="font-mono text-xs text-gray-900 font-medium flex items-center gap-1.5"><Check className="h-3 w-3 text-emerald-500 shrink-0" />{r.norm}</span>
                            </div>
                          ))}
                        </div>
                        <Note>Your files don't need consistent formatting. Addup handles mixed date styles, extra columns, and different delimiters automatically.</Note>
                      </>}

                      {/* STEP 3 */}
                      {stepId === "match" && <>
                        <StepMeta n={3} title="Comparing bank vs. ledger"
                          sub="Every bank entry is compared using three passes — exact match, fuzzy match, then amount-only."
                        />
                        <div className="grid grid-cols-3 gap-px bg-gray-100 border border-gray-100 mb-6">
                          {[{val:"7",lbl:"Matched",cls:"text-emerald-600"},{val:`${AVG_CONF}%`,lbl:"Avg confidence",cls:"text-gray-900"},{val:"2",lbl:"No match",cls:"text-amber-600"}].map(({val,lbl,cls})=>(
                            <div key={lbl} className="bg-white px-4 py-4 text-center">
                              <div className={`text-xl font-bold font-mono ${cls}`}>{val}</div>
                              <div className="text-[11px] text-gray-400 mt-0.5">{lbl}</div>
                            </div>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-2 mb-5">
                          {[{cls:"bg-emerald-50 text-emerald-700 border-emerald-200",lbl:"Perfect — same amount + date"},{cls:"bg-blue-50 text-blue-700 border-blue-200",lbl:"Off by 1 day"},{cls:"bg-amber-50 text-amber-700 border-amber-200",lbl:"Amount match only"}].map(({cls,lbl})=>(
                            <span key={lbl} className={`text-[10px] font-semibold px-2 py-1 border ${cls}`}>{lbl}</span>
                          ))}
                        </div>
                        <div className="flex border border-gray-100 mb-5">
                          {(["all","clean","flagged"] as const).map(f=>(
                            <button key={f} onClick={()=>setFilter(f)}
                              className={`flex-1 h-9 text-xs font-medium transition-colors border-r border-gray-100 last:border-0 ${filter===f?"bg-gray-900 text-white":"text-gray-400 hover:bg-gray-50"}`}
                            >
                              {f==="all"?`All (${MATCHES.length})`:f==="clean"?`Clean (${MATCHES.filter(m=>m.flags.length===0).length})`:`Flagged (${MATCHES.filter(m=>m.flags.length>0).length})`}
                            </button>
                          ))}
                        </div>
                        <MatchList matches={visibleMatches} missing={filter!=="clean"?MISSING:[]} onExplain={openExplain} />
                      </>}

                      {/* STEP 4 */}
                      {stepId === "review" && <>
                        <div className="flex items-end justify-between gap-4 mb-6">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Step 4 of 5</p>
                            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">{ISSUES.length} items need attention</h1>
                            <p className="text-gray-500 text-sm mt-2 leading-relaxed">Everything else matched cleanly. Read each one and decide what to do.</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="text-2xl font-bold font-mono text-gray-900">{resolved.size}<span className="text-gray-300">/{ISSUES.length}</span></div>
                            <div className="text-[10px] text-gray-400 font-medium">resolved</div>
                          </div>
                        </div>
                        <div className="h-1.5 bg-gray-100 mb-8">
                          <motion.div className="h-full bg-emerald-500"
                            animate={{ width: `${(resolved.size/ISSUES.length)*100}%` }}
                            transition={{ duration: 0.4 }}
                          />
                        </div>
                        <IssueList issues={ISSUES} resolved={resolved} onResolve={resolve} onExplain={openExplain} />
                      </>}

                      {/* STEP 5 */}
                      {stepId === "report" && <>
                        <motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}} transition={{duration:0.35}} className="flex flex-col items-center text-center mb-12">
                          <div className="w-14 h-14 bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-5">
                            <CheckCircle2 className="h-7 w-7 text-emerald-500" />
                          </div>
                          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">April 2026 is reconciled</h1>
                          <p className="text-gray-500 text-sm max-w-sm">7 of 9 transactions matched. 2 flagged for follow-up. Your books are ready to close.</p>
                        </motion.div>
                        <div className="grid grid-cols-3 gap-px bg-gray-100 border border-gray-100 mb-6">
                          {[{val:"7 / 9",lbl:"Matched",sub:"2 need follow-up"},{val:`${AVG_CONF}%`,lbl:"Avg confidence",sub:"Across all matches"},{val:"4",lbl:"Issues reviewed",sub:"All actioned"}].map(({val,lbl,sub})=>(
                            <div key={lbl} className="bg-white px-3 py-4 text-center">
                              <div className="text-lg font-bold font-mono text-gray-900">{val}</div>
                              <div className="text-xs font-semibold text-gray-600 mt-0.5">{lbl}</div>
                              <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>
                            </div>
                          ))}
                        </div>
                        <div className="border border-gray-100 mb-6">
                          <div className="px-4 py-3 border-b border-gray-50 bg-gray-50">
                            <span className="text-xs font-bold uppercase tracking-widest text-gray-500">How matches were found</span>
                          </div>
                          {[
                            {lbl:"Perfect — same amount and date",       val:MATCHES.filter(m=>m.quality==="perfect").length, cls:"text-emerald-600"},
                            {lbl:"Close — same amount, date off by 1",   val:MATCHES.filter(m=>m.quality==="close").length,   cls:"text-blue-600"},
                            {lbl:"Amount match — date differed",         val:MATCHES.filter(m=>m.quality==="amount").length,  cls:"text-amber-600"},
                            {lbl:"No match found",                       val:MISSING.length,                                  cls:"text-red-500"},
                          ].map(({lbl,val,cls})=>(
                            <div key={lbl} className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0">
                              <span className="text-sm text-gray-500">{lbl}</span>
                              <span className={`font-mono text-sm font-bold shrink-0 ${cls}`}>{val}</span>
                            </div>
                          ))}
                        </div>
                        <Note>In production, your bank feed and ledger connect directly. Addup runs this automatically every period.</Note>
                        <div className="flex flex-col sm:flex-row gap-3 mt-8">
                          <button onClick={()=>generatePDF(resolved)}
                            className="inline-flex items-center justify-center gap-2 bg-gray-900 text-white px-6 h-11 text-sm font-bold hover:bg-gray-700 transition-colors"
                          >
                            <Download className="h-4 w-4" />Download PDF report
                          </button>
                          <button onClick={()=>openExplain("full","Explain this reconciliation",
                            "April 2026 reconciliation: 9 bank transactions, 7 matched, 2 unmatched. 6 issues flagged (4 description mismatches/date gaps, 2 missing ledger entries). Average confidence 91%. Unmatched: Coffee Shop R4.50 (no ledger entry), Wire Transfer R10,000 (large unrecorded credit)."
                          )} className="inline-flex items-center justify-center gap-2 h-11 px-6 border border-gray-200 text-sm font-medium text-gray-600 hover:border-gray-300 hover:text-gray-900 transition-colors">
                            <Sparkles className="h-4 w-4" />Ask Grok to explain
                          </button>
                        </div>
                      </>}

                      {/* Navigation */}
                      {!isLast && (
                        <div className="flex items-center justify-between mt-12 pt-8 border-t border-gray-100">
                          <button onClick={()=>setStep(s=>Math.max(s-1,0))} disabled={step===0}
                            className="inline-flex items-center gap-2 h-10 px-5 text-sm font-medium text-gray-400 border border-gray-200 hover:text-gray-700 hover:border-gray-300 transition-colors disabled:opacity-30 disabled:pointer-events-none">
                            <ArrowLeft className="h-4 w-4" /> Back
                          </button>
                          <button onClick={()=>setStep(s=>Math.min(s+1,STEPS.length-1))}
                            className="inline-flex items-center gap-2 h-10 px-6 bg-gray-900 text-white text-sm font-bold hover:bg-gray-700 transition-colors">
                            {step===3?"Generate report":"Continue"} <ArrowRight className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </>
                  )}

                  {/* ══ RESULTS VIEW ══ */}
                  {view === "results" && (
                    <>
                      <div className="mb-8">
                        <h1 className="text-2xl font-bold text-gray-900 mb-1">Match results</h1>
                        <p className="text-sm text-gray-500">All 9 bank entries compared against 11 ledger records.</p>
                      </div>
                      <div className="grid grid-cols-3 gap-px bg-gray-100 border border-gray-100 mb-6">
                        {[{val:"7",lbl:"Matched",cls:"text-emerald-600"},{val:`${AVG_CONF}%`,lbl:"Avg confidence",cls:"text-gray-900"},{val:"2",lbl:"Unmatched",cls:"text-amber-600"}].map(({val,lbl,cls})=>(
                          <div key={lbl} className="bg-white px-4 py-4 text-center">
                            <div className={`text-xl font-bold font-mono ${cls}`}>{val}</div>
                            <div className="text-[11px] text-gray-400 mt-0.5">{lbl}</div>
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2 mb-5">
                        {[{cls:"bg-emerald-50 text-emerald-700 border-emerald-200",lbl:"Perfect match"},{cls:"bg-blue-50 text-blue-700 border-blue-200",lbl:"Off by 1 day"},{cls:"bg-amber-50 text-amber-700 border-amber-200",lbl:"Amount match"},{cls:"bg-red-50 text-red-600 border-red-200",lbl:"No match"}].map(({cls,lbl})=>(
                          <span key={lbl} className={`text-[10px] font-semibold px-2 py-1 border ${cls}`}>{lbl}</span>
                        ))}
                      </div>
                      <MatchList matches={MATCHES} missing={MISSING} onExplain={openExplain} />
                    </>
                  )}

                  {/* ══ RESOLVES VIEW ══ */}
                  {view === "resolves" && (
                    <>
                      <div className="flex items-end justify-between gap-4 mb-6">
                        <div>
                          <h1 className="text-2xl font-bold text-gray-900 mb-1">Resolve flagged items</h1>
                          <p className="text-sm text-gray-500">{ISSUES.length} items need a decision before you can close the books.</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-2xl font-bold font-mono text-gray-900">{resolved.size}<span className="text-gray-300">/{ISSUES.length}</span></div>
                          <div className="text-[10px] text-gray-400 font-medium">resolved</div>
                        </div>
                      </div>
                      <div className="h-1.5 bg-gray-100 mb-8">
                        <motion.div className="h-full bg-emerald-500"
                          animate={{ width: `${(resolved.size/ISSUES.length)*100}%` }}
                          transition={{ duration: 0.4 }}
                        />
                      </div>
                      {resolved.size === ISSUES.length && (
                        <motion.div initial={{opacity:0,y:6}} animate={{opacity:1,y:0}}
                          className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 px-4 py-3 mb-6"
                        >
                          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                          <div>
                            <p className="text-sm font-bold text-emerald-700">All issues resolved</p>
                            <p className="text-xs text-emerald-600">Your April 2026 books are ready to close.</p>
                          </div>
                        </motion.div>
                      )}
                      <IssueList issues={ISSUES} resolved={resolved} onResolve={resolve} onExplain={openExplain} />
                    </>
                  )}

                  {/* ══ EXPLAIN VIEW (Grok) ══ */}
                  {view === "explain" && (
                    <>
                      <div className="flex items-start gap-3 mb-8">
                        <div className="w-8 h-8 bg-gray-900 flex items-center justify-center shrink-0 mt-0.5">
                          <Sparkles className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <h1 className="text-2xl font-bold text-gray-900 mb-1">Ask Grok</h1>
                          <p className="text-sm text-gray-500">Grok explains your reconciliation results in plain English.</p>
                        </div>
                      </div>

                      {/* Quick-explain cards */}
                      {!explainTarget && !grokResponse && (
                        <>
                          <SectionLabel>Explain a specific item</SectionLabel>
                          <div className="space-y-2 mb-8">
                            {ISSUES.map(iss=>(
                              <button key={iss.id} onClick={()=>openExplain(iss.id, iss.title,
                                `Issue: ${iss.title}\nBank: ${iss.bank}\nLedger: ${iss.ledger}\nAmount: ${fmtAmt(iss.amt)}\nDescription: ${iss.plain}`
                              )}
                                className="w-full flex items-center justify-between gap-3 px-4 py-3 border border-gray-100 hover:border-gray-300 hover:bg-gray-50 transition-colors text-left group"
                              >
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-gray-900 leading-snug">{iss.title}</div>
                                  <div className="font-mono text-[10px] text-gray-400 mt-0.5">{fmtAmt(iss.amt)}</div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0 text-gray-300 group-hover:text-gray-600 transition-colors">
                                  <Sparkles className="h-3.5 w-3.5" />
                                  <ChevronDown className="h-3.5 w-3.5 -rotate-90" />
                                </div>
                              </button>
                            ))}
                          </div>
                          <button onClick={()=>openExplain("full","Full reconciliation summary",
                            "April 2026 reconciliation: 9 bank transactions, 7 matched, 2 unmatched. 6 issues flagged (4 description mismatches/date gaps, 2 missing ledger entries). Average confidence 91%. Unmatched: Coffee Shop R4.50 (no ledger entry), Wire Transfer R10,000 (large unrecorded credit)."
                          )} className="w-full flex items-center justify-between gap-3 px-4 py-4 bg-gray-900 text-white hover:bg-gray-700 transition-colors">
                            <div>
                              <div className="text-sm font-bold">Summarize the full reconciliation</div>
                              <div className="text-xs text-gray-400 mt-0.5">What went well, what needs attention, what to do next</div>
                            </div>
                            <Sparkles className="h-4 w-4 text-gray-400 shrink-0" />
                          </button>
                        </>
                      )}

                      {/* Active explanation */}
                      {explainTarget && (
                        <div>
                          <div className="flex items-start justify-between gap-3 mb-5">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Explaining</p>
                              <p className="text-base font-bold text-gray-900">{explainTarget.title}</p>
                            </div>
                            <button onClick={()=>{setExplainTarget(null);grokReset();}}
                              className="shrink-0 text-xs text-gray-400 hover:text-gray-700 flex items-center gap-1 mt-1">
                              <X className="h-3 w-3" /> Clear
                            </button>
                          </div>

                          <div className="border border-gray-100 p-5 min-h-[180px] mb-4">
                            {grokError && (
                              <div className="flex items-center gap-2 text-red-500">
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                <span className="text-sm">{grokError}</span>
                              </div>
                            )}
                            {!grokError && !grokResponse && grokStreaming && (
                              <div className="flex items-center gap-2 text-gray-400">
                                <motion.div animate={{opacity:[0.4,1,0.4]}} transition={{duration:1.2,repeat:Infinity}}>
                                  <Sparkles className="h-4 w-4" />
                                </motion.div>
                                <span className="text-sm">Grok is thinking...</span>
                              </div>
                            )}
                            {grokResponse && (
                              <div className="prose prose-sm max-w-none">
                                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{grokResponse}</p>
                                {grokStreaming && <motion.span animate={{opacity:[0,1]}} transition={{duration:0.5,repeat:Infinity}} className="inline-block w-1 h-4 bg-gray-400 ml-0.5 align-middle" />}
                              </div>
                            )}
                          </div>

                          <div className="flex gap-2">
                            <button onClick={()=>grokExplain(
                              `Explain this reconciliation item to me in plain English: "${explainTarget.title}"`,
                              explainTarget.context
                            )} disabled={grokStreaming}
                              className="inline-flex items-center gap-2 h-9 px-4 border border-gray-200 text-xs font-medium text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors disabled:opacity-40">
                              <RefreshCw className="h-3.5 w-3.5" /> Regenerate
                            </button>
                            <button onClick={()=>grokExplain(
                              "What should I do next about this?",
                              explainTarget.context
                            )} disabled={grokStreaming}
                              className="inline-flex items-center gap-2 h-9 px-4 border border-gray-200 text-xs font-medium text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors disabled:opacity-40">
                              <ArrowRight className="h-3.5 w-3.5" /> What should I do?
                            </button>
                          </div>

                          <div className="mt-6 pt-6 border-t border-gray-100">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Explain another item</p>
                            <div className="space-y-1.5">
                              {ISSUES.filter(i=>i.id!==explainTarget.id).map(iss=>(
                                <button key={iss.id} onClick={()=>openExplain(iss.id, iss.title,
                                  `Issue: ${iss.title}\nBank: ${iss.bank}\nLedger: ${iss.ledger}\nAmount: ${fmtAmt(iss.amt)}\nDescription: ${iss.plain}`
                                )} className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
                                  <span className="text-xs text-gray-500 font-medium">{iss.title}</span>
                                  <Sparkles className="h-3 w-3 text-gray-300 shrink-0" />
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                </div>
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function MatchList({ matches, missing, onExplain }: {
  matches: typeof MATCHES; missing: typeof MISSING;
  onExplain: (id: string, title: string, ctx: string) => void;
}) {
  return (
    <div className="border border-gray-100 divide-y divide-gray-50">
      {matches.map((m) => {
        const qc = qualityChip(m.quality);
        return (
          <div key={m.bank.id} className="p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 border ${qc.cls}`}>{qc.label}</span>
                  {m.flags.map(f=><span key={f} className="text-[10px] font-medium px-1.5 py-0.5 border bg-gray-50 text-gray-500 border-gray-200">{f}</span>)}
                </div>
                <div className="text-sm font-semibold text-gray-900">{m.bank.desc}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-mono font-bold text-gray-900">{fmtAmt(m.bank.amt)}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{m.conf}% confidence</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {[{label:"Bank",date:m.bank.date,desc:m.bank.desc},{label:"Ledger",date:m.ledger.date,desc:m.ledger.desc}].map(({label,date,desc})=>(
                <div key={label} className="bg-gray-50 px-3 py-2">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">{label}</div>
                  <div className="text-xs font-semibold text-gray-700">{date}</div>
                  <div className="text-xs text-gray-400 truncate">{desc}</div>
                </div>
              ))}
            </div>
            {m.flags.length > 0 && (
              <button onClick={()=>onExplain(m.bank.id,m.bank.desc,
                `Match: ${m.bank.desc}\nBank ID: ${m.bank.id}, Ledger ID: ${m.ledger.id}\nBank date: ${m.bank.date}, Ledger date: ${m.ledger.date}\nAmount: ${fmtAmt(m.bank.amt)}\nConfidence: ${m.conf}%\nFlags: ${m.flags.join(", ")}`
              )} className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-gray-700 transition-colors mt-1">
                <Sparkles className="h-3 w-3" /> Ask Grok to explain
              </button>
            )}
          </div>
        );
      })}
      {missing.map(m=>(
        <div key={m.id} className="p-4 bg-amber-50/30">
          <div className="flex items-start justify-between gap-3 mb-1">
            <div className="min-w-0">
              <span className="text-[10px] font-bold px-1.5 py-0.5 border bg-amber-50 text-amber-700 border-amber-200 inline-block mb-1.5">Not in ledger</span>
              <div className="text-sm font-semibold text-gray-900">{m.desc}</div>
            </div>
            <span className="font-mono text-sm font-bold text-gray-900 shrink-0">{fmtAmt(m.amt)}</span>
          </div>
          <p className="text-xs text-gray-400 mb-2">{m.why}</p>
          <button onClick={()=>onExplain(m.id,m.desc,
            `Unmatched bank entry: ${m.desc}\nID: ${m.id}\nAmount: ${fmtAmt(m.amt)}\nReason: ${m.why}`
          )} className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-gray-700 transition-colors">
            <Sparkles className="h-3 w-3" /> Ask Grok to explain
          </button>
        </div>
      ))}
    </div>
  );
}

function IssueList({ issues, resolved, onResolve, onExplain }: {
  issues: typeof ISSUES; resolved: Set<string>;
  onResolve: (id: string) => void;
  onExplain: (id: string, title: string, ctx: string) => void;
}) {
  return (
    <div className="space-y-3">
      {issues.map((iss)=>{
        const done = resolved.has(iss.id);
        return (
          <motion.div key={iss.id} layout
            className={`border transition-all ${done?"border-gray-100 opacity-40":"border-gray-100"}`}
          >
            <div className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  {done ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                        : <AlertCircle  className="h-4 w-4 text-amber-400 shrink-0 mt-0.5"   />}
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-gray-900 leading-snug">{iss.title}</div>
                    <div className="font-mono text-[10px] text-gray-400 mt-0.5">{iss.id}</div>
                  </div>
                </div>
                <span className="font-mono text-sm font-bold text-gray-900 shrink-0">{fmtAmt(iss.amt)}</span>
              </div>
              {iss.kind!=="missing" && (
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {[{l:"Bank says",v:iss.bank},{l:"Ledger says",v:iss.ledger}].map(({l,v})=>(
                    <div key={l} className="bg-gray-50 px-3 py-2">
                      <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">{l}</div>
                      <div className="text-xs font-semibold text-gray-700 leading-snug">{v}</div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-sm text-gray-500 leading-relaxed mb-4">{iss.plain}</p>
              {done ? (
                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> Done</span>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button onClick={()=>onResolve(iss.id)}
                    className="px-4 h-9 bg-gray-900 text-white text-xs font-bold hover:bg-gray-700 transition-colors flex items-center gap-1.5">
                    <Check className="h-3 w-3" />{iss.action}
                  </button>
                  <button onClick={()=>onResolve(iss.id)}
                    className="px-4 h-9 border border-gray-200 text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors">
                    Mark for follow-up
                  </button>
                  <button onClick={()=>onExplain(iss.id,iss.title,
                    `Issue: ${iss.title}\nBank: ${iss.bank}\nLedger: ${iss.ledger}\nAmount: ${fmtAmt(iss.amt)}\n${iss.plain}`
                  )} className="px-3 h-9 border border-gray-200 text-xs font-medium text-gray-400 hover:text-gray-700 hover:border-gray-300 transition-colors flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3" /> Ask Grok
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function StepMeta({ n, title, sub }: { n: number; title: string; sub: string }) {
  return (
    <div className="mb-8">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Step {n} of 5</p>
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight mb-2">{title}</h1>
      <p className="text-gray-500 text-sm leading-relaxed">{sub}</p>
    </div>
  );
}

function StatCard({ val, label }: { val: string; label: string }) {
  return (
    <div className="border border-gray-100 p-4">
      <div className="text-2xl font-bold font-mono text-gray-900">{val}</div>
      <div className="text-xs text-gray-400 mt-1 leading-snug">{label}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">{children}</p>;
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-500 leading-relaxed">
      <span className="font-bold text-gray-600">Note: </span>{children}
    </div>
  );
}

// ── PDF generation ────────────────────────────────────────────────────────────

function generatePDF(resolved: Set<string>) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, margin = 18, col = margin;
  let y = 0;
  const right = (t: string, yy: number, sz = 9) => { doc.setFontSize(sz); doc.text(t, W - margin, yy, { align: "right" }); };
  const hline = (yy: number) => { doc.setDrawColor(220,220,220); doc.line(margin, yy, W-margin, yy); };
  const secLabel = (t: string, yy: number) => {
    doc.setFontSize(7.5); doc.setTextColor(150,150,150); doc.setFont("helvetica","bold");
    doc.text(t.toUpperCase(), col, yy); doc.setFont("helvetica","normal"); doc.setTextColor(30,30,30);
    return yy + 5;
  };
  doc.setFillColor(17,17,17); doc.rect(0,0,W,22,"F");
  doc.setTextColor(255,255,255); doc.setFontSize(13); doc.setFont("helvetica","bold"); doc.text("Addup", col, 14);
  doc.setFontSize(8.5); doc.setFont("helvetica","normal"); doc.text("Reconciliation Report — April 2026", col+22, 14);
  right(new Date().toLocaleDateString("en-ZA",{day:"2-digit",month:"long",year:"numeric"}), 14, 8);
  y = 32;
  doc.setTextColor(30,30,30); doc.setFontSize(18); doc.setFont("helvetica","bold"); doc.text("April 2026 is reconciled", col, y); y+=7;
  doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.setTextColor(100,100,100);
  doc.text("7 out of 9 bank transactions matched your ledger. 2 entries are flagged for follow-up.", col, y); y+=12;
  hline(y); y+=8;
  y = secLabel("Summary", y);
  ([["Transactions matched","7 / 9"],["Average confidence",`${AVG_CONF}%`],["Issues reviewed","4"],["Unmatched entries","2"]] as [string,string][]).forEach(([l,v])=>{
    doc.setFontSize(9); doc.setTextColor(90,90,90); doc.text(l,col,y);
    doc.setTextColor(17,17,17); doc.setFont("helvetica","bold"); right(v,y,9); doc.setFont("helvetica","normal"); y+=6;
  });
  y+=4; hline(y); y+=8;
  y = secLabel("Transaction matches", y);
  MATCHES.forEach(m=>{
    if(y>270){doc.addPage();y=20;}
    doc.setFontSize(8.5); doc.setTextColor(17,17,17);
    doc.text(`${m.bank.id} — ${m.bank.desc.slice(0,40)}`,col,y);
    right(`${m.conf}% · ${m.quality}`,y,8.5); y+=5;
  });
  y+=4; hline(y); y+=8;
  y = secLabel("Issues flagged", y);
  ISSUES.forEach(iss=>{
    if(y>260){doc.addPage();y=20;}
    doc.setFontSize(8.5); doc.setTextColor(17,17,17); doc.setFont("helvetica","bold"); doc.text(iss.title,col,y); y+=5;
    doc.setFont("helvetica","normal"); doc.setTextColor(90,90,90);
    const w=doc.splitTextToSize(iss.plain,W-margin*2);
    doc.text(w,col,y); y+=w.length*4.5+4;
  });
  y+=2; hline(y); y+=8;
  doc.setFontSize(7.5); doc.setTextColor(160,160,160);
  doc.text(`Generated by Addup · ${new Date().toISOString()}`,col,y); right("addup.co",y,7.5);
  doc.save("addup-reconciliation-april-2026.pdf");
}
