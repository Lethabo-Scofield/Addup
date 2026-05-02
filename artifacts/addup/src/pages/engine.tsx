import React, { useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, ArrowLeft, CheckCircle2, AlertCircle,
  X, Check, FileText, Upload, Hash,
} from "lucide-react";
import addupLogo from "@assets/Addup_1777332904059.png";

/* ─────────────────────────────────────────────
   STEPS
───────────────────────────────────────────── */
type StepId = "upload" | "parse" | "match" | "issues" | "report";

const STEPS: { id: StepId; label: string }[] = [
  { id: "upload",  label: "Upload"  },
  { id: "parse",   label: "Parse"   },
  { id: "match",   label: "Match"   },
  { id: "issues",  label: "Issues"  },
  { id: "report",  label: "Report"  },
];

/* ─────────────────────────────────────────────
   DEMO DATA — derived from real Recon_Engine/bank.csv + engine logic
───────────────────────────────────────────── */
const DATE_FORMATS = [
  { raw: "2026-04-01",    norm: "2026-04-01", fmt: "ISO 8601"    },
  { raw: "01/04/2026",    norm: "2026-04-01", fmt: "DD/MM/YYYY"  },
  { raw: "07-04-2026",    norm: "2026-04-07", fmt: "DD-MM-YYYY"  },
  { raw: '"09 Apr 2026"', norm: "2026-04-09", fmt: "Natural text"},
  { raw: "4/5/2026",      norm: "2026-04-05", fmt: "M/D/YYYY"    },
];

const MATCHES = [
  { bank: { id: "B-001", date: "2026-04-01", desc: "Salary Payment",            amt:  3500.00 },
    ledger:{ id: "L-001", date: "2026-04-01", desc: "Salary",                    amt:  3500.00 },
    matchType: "exact"  as const, conf: 1.00, issues: [] },
  { bank: { id: "B-002", date: "2026-04-02", desc: "Online Transfer to Savings", amt: -500.00 },
    ledger:{ id: "L-002", date: "2026-04-03", desc: "Savings Transfer",           amt: -500.00 },
    matchType: "fuzzy"  as const, conf: 0.84, issues: ["description_mismatch"] },
  { bank: { id: "B-004", date: "2026-04-06", desc: "Direct Debit Electricity",  amt:  -95.67 },
    ledger:{ id: "L-003", date: "2026-03-28", desc: "Electricity DD",            amt:  -95.67 },
    matchType: "amount" as const, conf: 0.78, issues: ["date_mismatch"] },
  { bank: { id: "B-005", date: "2026-04-07", desc: "Online Payment - Amazon",   amt:  -87.99 },
    ledger:{ id: "L-004", date: "2026-04-07", desc: "Online Purchase",           amt:  -87.99 },
    matchType: "exact"  as const, conf: 1.00, issues: ["description_mismatch"] },
  { bank: { id: "B-006", date: "2026-04-10", desc: "Check Deposit",             amt:  500.00 },
    ledger:{ id: "L-005", date: "2026-04-10", desc: "Check Deposit",             amt:  500.00 },
    matchType: "exact"  as const, conf: 1.00, issues: [] },
  { bank: { id: "B-007", date: "2026-04-12", desc: "Interest Credit",           amt:    2.35 },
    ledger:{ id: "L-006", date: "2026-04-15", desc: "Interest",                  amt:    2.35 },
    matchType: "amount" as const, conf: 0.78, issues: ["date_mismatch"] },
  { bank: { id: "B-009", date: "2026-04-19", desc: "Payroll Tax",               amt: -450.00 },
    ledger:{ id: "L-007", date: "2026-04-19", desc: "Payroll Tax",               amt: -450.00 },
    matchType: "exact"  as const, conf: 1.00, issues: [] },
];

const MISSING = [
  { id: "B-003", desc: "Coffee Shop, Downtown",  amt:    -4.50 },
  { id: "B-008", desc: "Wire Transfer Incoming",  amt: 10000.00 },
];

const ISSUES_LIST = [
  { id: "B-002::L-002", type: "description_mismatch" as const, bankDesc: "Online Transfer to Savings",
    ledgerDesc: "Savings Transfer",  amt: -500.00, conf: 0.84, action: "manual_review",
    explanation: "Token similarity 33%. Bank uses full description; ledger uses shorthand." },
  { id: "B-004::L-003", type: "date_mismatch" as const, bankDesc: "2026-04-06",
    ledgerDesc: "2026-03-28", amt: -95.67, conf: 0.78, action: "manual_review",
    explanation: "Date differs by 9 days. Amounts match exactly. Possible posting delay or backdated entry." },
  { id: "B-005::L-004", type: "description_mismatch" as const, bankDesc: "Online Payment - Amazon",
    ledgerDesc: "Online Purchase", amt: -87.99, conf: 1.00, action: "manual_review",
    explanation: "Token similarity 0%. Bank identifies the vendor; ledger uses a generic category." },
  { id: "B-007::L-006", type: "date_mismatch" as const, bankDesc: "2026-04-12",
    ledgerDesc: "2026-04-15", amt: 2.35, conf: 0.78, action: "suggest_fix",
    explanation: "Date differs by 3 days. Small interest credit, likely a timing difference." },
  { id: "B-003", type: "missing" as const, bankDesc: "Coffee Shop, Downtown",
    ledgerDesc: "—", amt: -4.50, conf: 0, action: "request_data",
    explanation: "No reliable match found in ledger." },
  { id: "B-008", type: "missing" as const, bankDesc: "Wire Transfer Incoming",
    ledgerDesc: "—", amt: 10000.00, conf: 0, action: "request_data",
    explanation: "High-value entry with no ledger match. Verify source and recording." },
];

const SUMMARY = "7/9 bank transactions matched. 2 missing. 4 mismatches.";
const AVG_CONF = MATCHES.reduce((s, m) => s + m.conf, 0) / MATCHES.length;

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
function fmtAmt(n: number) {
  const abs = Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${n < 0 ? "−" : ""}R ${abs}`;
}
function confBadge(c: number) {
  if (c >= 0.95) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (c >= 0.80) return "bg-blue-50 text-blue-700 border-blue-200";
  if (c >= 0.60) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-red-50 text-red-700 border-red-200";
}
function matchLabel(t: "exact" | "fuzzy" | "amount") {
  if (t === "exact")  return { label: "Exact",        cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (t === "fuzzy")  return { label: "Fuzzy ±1 day", cls: "bg-blue-50 text-blue-700 border-blue-200"         };
  return               { label: "Amount-only",         cls: "bg-amber-50 text-amber-700 border-amber-200"      };
}
function issueLabel(t: "date_mismatch" | "description_mismatch" | "missing") {
  if (t === "date_mismatch")        return { label: "Date mismatch",        cls: "bg-amber-50 text-amber-700 border-amber-200" };
  if (t === "description_mismatch") return { label: "Desc mismatch",        cls: "bg-blue-50 text-blue-700 border-blue-200"   };
  return                             { label: "Missing",                    cls: "bg-red-50 text-red-700 border-red-200"       };
}

/* ─────────────────────────────────────────────
   MAIN
───────────────────────────────────────────── */
export default function Engine() {
  const [step,     setStep]     = useState(0);
  const [filter,   setFilter]   = useState<"all" | "clean" | "issues">("all");
  const [resolved, setResolved] = useState<Set<string>>(new Set());

  const stepId = STEPS[step].id;
  const isLast = step === STEPS.length - 1;
  const resolve = (id: string) => setResolved(p => new Set([...p, id]));

  const visibleMatches =
    filter === "clean"  ? MATCHES.filter(m => m.issues.length === 0) :
    filter === "issues" ? MATCHES.filter(m => m.issues.length  >  0) : MATCHES;

  return (
    <div className="min-h-[100svh] bg-white flex flex-col">

      {/* ── Header ── */}
      <header className="fixed inset-x-0 top-0 z-50 h-16 bg-white border-b border-gray-100">
        <div className="h-full max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-4">

          {/* Logo */}
          <Link href="/" className="shrink-0">
            <img src={addupLogo} alt="Addup" className="h-7 w-auto" />
          </Link>

          {/* Step breadcrumb — desktop */}
          <ol className="hidden sm:flex items-center gap-0">
            {STEPS.map((s, i) => (
              <React.Fragment key={s.id}>
                <li>
                  <button
                    onClick={() => i <= step && setStep(i)}
                    disabled={i > step}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors
                      ${i === step   ? "text-gray-900"
                      : i < step     ? "text-gray-400 hover:text-gray-600 cursor-pointer"
                                     : "text-gray-300 cursor-default"}`}
                  >
                    {i < step && <span className="text-emerald-500 mr-1">✓</span>}
                    {s.label}
                  </button>
                </li>
                {i < STEPS.length - 1 && (
                  <li className="text-gray-200 text-xs select-none">›</li>
                )}
              </React.Fragment>
            ))}
          </ol>

          {/* Mobile counter */}
          <span className="sm:hidden text-xs text-gray-400 font-medium">
            {step + 1} / {STEPS.length}
          </span>

          <Link href="/"
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors shrink-0"
          >
            <X className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Exit</span>
          </Link>
        </div>
      </header>

      {/* ── Progress bar ── */}
      <div className="fixed top-16 inset-x-0 z-40 h-[2px] bg-gray-100">
        <div
          className="h-full bg-gray-900 transition-all duration-500 ease-out"
          style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
        />
      </div>

      {/* ── Content ── */}
      <main className="flex-1 pt-16 pb-28">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >

            {/* ─── Upload ─── */}
            {stepId === "upload" && (
              <section className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-4">Step 1 of 5</p>
                <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2">Upload your files</h1>
                <p className="text-gray-500 text-sm sm:text-base mb-10">
                  The engine accepts CSV or Excel exports from your bank and accounting system. Sample files are pre-loaded.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                  {[
                    { label: "Bank Statement",  file: "bank.csv",   rows: 19, size: "4.2 KB", note: "FNB Business · April 2026" },
                    { label: "General Ledger",  file: "ledger.csv", rows: 11, size: "2.8 KB", note: "Xero export · April 2026"  },
                  ].map((f) => (
                    <div key={f.file} className="border border-dashed border-gray-200 p-5 hover:border-gray-300 transition-colors">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-9 h-9 bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
                          <FileText className="h-4 w-4 text-gray-400" />
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-gray-900">{f.label}</div>
                          <div className="text-xs text-gray-400">{f.note}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 p-2.5 bg-gray-50 border border-gray-100 mb-3">
                        <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        <span className="text-xs font-mono font-medium text-gray-700 flex-1 truncate">{f.file}</span>
                        <span className="text-xs text-gray-400 shrink-0">{f.rows} rows · {f.size}</span>
                      </div>
                      <button className="w-full flex items-center justify-center gap-2 h-9 border border-gray-200 text-xs text-gray-400 hover:text-gray-700 hover:border-gray-300 transition-colors">
                        <Upload className="h-3 w-3" />
                        Replace file
                      </button>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-gray-400 leading-relaxed">
                  <span className="font-medium text-gray-600">Supported:</span> CSV (any delimiter), Excel (.xlsx, .xls).
                  Dates, currency symbols, and column headers are auto-detected.
                </p>
              </section>
            )}

            {/* ─── Parse ─── */}
            {stepId === "parse" && (
              <section className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-4">Step 2 of 5</p>
                <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2">Parsed and normalized</h1>
                <p className="text-gray-500 text-sm sm:text-base mb-10">
                  Both files parsed. 5 date formats detected and normalized to ISO 8601. Row hashes generated for deduplication.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
                  {[
                    { val: "19", lbl: "Bank rows"    },
                    { val: "11", lbl: "Ledger rows"  },
                    { val: "5",  lbl: "Date formats" },
                    { val: "0",  lbl: "Invalid rows" },
                  ].map(({ val, lbl }) => (
                    <div key={lbl} className="border border-gray-100 p-4">
                      <div className="text-2xl font-semibold font-mono text-gray-900">{val}</div>
                      <div className="text-xs text-gray-400 mt-1">{lbl}</div>
                    </div>
                  ))}
                </div>

                {/* Date format table */}
                <div className="mb-8">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Date format detection — bank.csv</p>
                  <div className="border border-gray-100 overflow-hidden">
                    <div className="grid grid-cols-3 gap-4 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                      {["Raw value", "Format", "Normalized"].map(h => (
                        <span key={h} className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{h}</span>
                      ))}
                    </div>
                    {DATE_FORMATS.map((row, i) => (
                      <div key={i} className="grid grid-cols-3 gap-4 px-4 py-3 border-b border-gray-50 last:border-0 items-center">
                        <span className="font-mono text-[11px] text-gray-500">{row.raw}</span>
                        <span className="text-xs text-blue-600 font-medium">{row.fmt}</span>
                        <span className="font-mono text-xs text-gray-900 font-medium flex items-center gap-1.5">
                          <Check className="h-3 w-3 text-emerald-500 shrink-0" />{row.norm}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Checksums */}
                <div className="border border-gray-100 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Hash className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">SHA-256 checksums</span>
                  </div>
                  {[
                    { f: "bank.csv",   h: "a3f8b2c1d4e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5" },
                    { f: "ledger.csv", h: "7c2e5f8a1b4d7e0c3f6a9b2e5c8f1a4d7b0e3c6f9a2d5e8b1c4f7a0d3e6c9b2" },
                  ].map(r => (
                    <div key={r.f} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 py-2 border-b border-gray-50 last:border-0">
                      <span className="text-xs font-semibold text-gray-700 w-20 shrink-0">{r.f}</span>
                      <span className="font-mono text-[10px] text-gray-400 break-all">{r.h}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ─── Match ─── */}
            {stepId === "match" && (
              <section className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-4">Step 3 of 5</p>
                <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2">Match results</h1>
                <p className="text-gray-500 text-sm sm:text-base mb-8">
                  Three-pass matching: exact (amount + date), fuzzy (amount + date ±1 day), then amount-only.
                </p>

                <div className="grid grid-cols-3 gap-px bg-gray-100 border border-gray-100 mb-8">
                  {[
                    { val: String(MATCHES.length), lbl: "Matched",       cls: "text-emerald-600" },
                    { val: `${(AVG_CONF*100).toFixed(1)}%`, lbl: "Avg conf", cls: "text-gray-900" },
                    { val: String(MISSING.length),  lbl: "Unmatched",    cls: "text-amber-600"   },
                  ].map(({ val, lbl, cls }) => (
                    <div key={lbl} className="bg-white p-4 sm:p-5 text-center">
                      <div className={`text-xl sm:text-2xl font-semibold font-mono ${cls}`}>{val}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{lbl}</div>
                    </div>
                  ))}
                </div>

                {/* Filter */}
                <div className="flex border border-gray-100 mb-5">
                  {(["all", "clean", "issues"] as const).map((f) => (
                    <button key={f} onClick={() => setFilter(f)}
                      className={`flex-1 h-9 text-xs font-medium capitalize transition-colors border-r border-gray-100 last:border-r-0
                        ${filter === f ? "bg-gray-900 text-white" : "text-gray-400 hover:text-gray-700 hover:bg-gray-50"}`}
                    >
                      {f === "all" ? `All (${MATCHES.length})`
                        : f === "clean" ? `Clean (${MATCHES.filter(m=>m.issues.length===0).length})`
                        : `Issues (${MATCHES.filter(m=>m.issues.length>0).length})`}
                    </button>
                  ))}
                </div>

                <div className="border border-gray-100 divide-y divide-gray-50">
                  {visibleMatches.map((m) => {
                    const ml = matchLabel(m.matchType);
                    return (
                      <div key={m.bank.id} className="p-4">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap gap-1.5 mb-1.5">
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 border ${ml.cls}`}>{ml.label}</span>
                              {m.issues.map(iss => {
                                const il = issueLabel(iss as any);
                                return <span key={iss} className={`text-[10px] font-semibold px-1.5 py-0.5 border ${il.cls}`}>{il.label}</span>;
                              })}
                            </div>
                            <div className="text-sm font-medium text-gray-900">{m.bank.desc}</div>
                            <div className="text-xs text-gray-400 font-mono">{m.bank.id} → {m.ledger.id}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-sm font-mono font-semibold text-gray-900">{fmtAmt(m.bank.amt)}</div>
                            <div className={`text-[10px] font-bold border px-1 py-0.5 mt-1 ${confBadge(m.conf)}`}>
                              {(m.conf * 100).toFixed(0)}%
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {[{ label: "Bank", d: m.bank }, { label: "Ledger", d: m.ledger }].map(({ label, d }) => (
                            <div key={label} className="bg-gray-50 px-3 py-2">
                              <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">{label}</div>
                              <div className="font-mono text-gray-600">{d.date}</div>
                              <div className="text-gray-500 truncate">{d.desc}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {MISSING.map((m) => (
                    <div key={m.id} className="p-4 bg-red-50/50">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 border bg-red-50 text-red-700 border-red-200 inline-block mb-1.5">Missing</span>
                          <div className="text-sm font-medium text-gray-900">{m.desc}</div>
                          <div className="text-xs text-gray-400 font-mono">{m.id} · bank only</div>
                        </div>
                        <div className="text-sm font-mono font-semibold text-gray-900 shrink-0">{fmtAmt(m.amt)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ─── Issues ─── */}
            {stepId === "issues" && (
              <section className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
                <div className="flex items-end justify-between gap-4 mb-2">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-4">Step 4 of 5</p>
                    <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">Review issues</h1>
                  </div>
                  <span className="text-xs font-medium text-gray-500 shrink-0 mb-0.5 pb-0.5">
                    {resolved.size} / {ISSUES_LIST.length} resolved
                  </span>
                </div>
                <p className="text-gray-500 text-sm sm:text-base mb-10">
                  {ISSUES_LIST.length} issues flagged across date mismatches, description mismatches, and missing entries.
                </p>

                <div className="space-y-3">
                  {ISSUES_LIST.map((iss) => {
                    const done = resolved.has(iss.id);
                    const il = issueLabel(iss.type);
                    return (
                      <div key={iss.id}
                        className={`border p-4 sm:p-5 transition-all duration-200 ${
                          done ? "border-gray-100 opacity-50" : "border-gray-100 bg-white hover:border-gray-200"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            {done
                              ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                              : <AlertCircle  className="h-4 w-4 text-amber-400 shrink-0" />}
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 border ${il.cls}`}>{il.label}</span>
                            <span className="font-mono text-[10px] text-gray-400">{iss.id}</span>
                          </div>
                          <span className="font-mono text-sm font-semibold text-gray-900 shrink-0">{fmtAmt(iss.amt)}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mb-3">
                          {[{ label: "Bank", val: iss.bankDesc }, { label: "Ledger", val: iss.ledgerDesc }].map(({ label, val }) => (
                            <div key={label} className="bg-gray-50 px-3 py-2">
                              <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">{label}</div>
                              <div className="text-xs font-medium text-gray-700 truncate">{val}</div>
                            </div>
                          ))}
                        </div>

                        <p className="text-xs text-gray-400 mb-4">{iss.explanation}</p>

                        {done ? (
                          <span className="text-xs text-emerald-600 font-semibold">Resolved</span>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => resolve(iss.id)}
                              className="px-4 py-2 bg-gray-900 text-white text-xs font-semibold hover:bg-gray-700 transition-colors">
                              {iss.action === "suggest_fix" ? "Apply fix" : iss.action === "request_data" ? "Request data" : "Accept"}
                            </button>
                            <button onClick={() => resolve(iss.id)}
                              className="px-4 py-2 border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                              Override
                            </button>
                            <button
                              className="px-4 py-2 border border-gray-200 text-xs font-medium text-gray-400 hover:bg-gray-50 transition-colors">
                              Escalate
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ─── Report ─── */}
            {stepId === "report" && (
              <section className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="text-center mb-12"
                >
                  <div className="mx-auto w-14 h-14 flex items-center justify-center border border-emerald-100 bg-emerald-50 mb-6">
                    <CheckCircle2 className="h-7 w-7 text-emerald-500" />
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-4">Reconciliation complete</h1>
                  <code className="text-xs text-gray-500 bg-gray-50 border border-gray-100 px-4 py-2 inline-block font-mono">
                    {SUMMARY}
                  </code>
                </motion.div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-px bg-gray-100 border border-gray-100 mb-6">
                  {[
                    { val: "7 / 9",                           lbl: "Matched"       },
                    { val: `${(AVG_CONF*100).toFixed(1)}%`,   lbl: "Avg confidence"},
                    { val: "4",                                lbl: "Issues flagged"},
                  ].map(({ val, lbl }) => (
                    <div key={lbl} className="bg-white p-4 sm:p-5 text-center">
                      <div className="text-lg sm:text-xl font-semibold font-mono text-gray-900">{val}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{lbl}</div>
                    </div>
                  ))}
                </div>

                {/* Breakdown */}
                <div className="border border-gray-100 mb-6">
                  <div className="px-4 py-2.5 border-b border-gray-50">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Match breakdown</span>
                  </div>
                  {[
                    { label: "Exact (amount + date)",        count: MATCHES.filter(m=>m.matchType==="exact").length,  conf: "1.00" },
                    { label: "Fuzzy (amount + date ±1 day)", count: MATCHES.filter(m=>m.matchType==="fuzzy").length,  conf: "0.84" },
                    { label: "Amount-only",                  count: MATCHES.filter(m=>m.matchType==="amount").length, conf: "0.78" },
                    { label: "Unmatched (missing)",          count: MISSING.length,                                   conf: "0.00" },
                  ].map(({ label, count, conf }) => (
                    <div key={label} className="flex items-center justify-between gap-4 px-4 py-3 border-b border-gray-50 last:border-0 text-sm">
                      <div className="text-gray-500">{label}</div>
                      <div className="flex items-center gap-4 shrink-0">
                        <span className="font-mono text-xs text-gray-400">conf {conf}</span>
                        <span className="font-semibold text-gray-900 w-4 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Audit log */}
                <div className="bg-gray-50 border border-gray-100 p-4 mb-10 font-mono text-[11px] text-gray-400 space-y-0.5">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-2">audit_log</div>
                  <div>{"{"}</div>
                  <div className="pl-4">"event": "reconciliation_run",</div>
                  <div className="pl-4">"timestamp": "{new Date().toISOString()}",</div>
                  <div className="pl-4">"records_processed": 30,</div>
                  <div className="pl-4">"matches_found": 7,</div>
                  <div className="pl-4">"status": "completed"</div>
                  <div>{"}"}</div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <button className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gray-900 text-white px-7 h-11 text-sm font-semibold hover:bg-gray-700 transition-colors">
                    Export report
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <Link href="/" className="w-full sm:w-auto">
                    <button className="w-full inline-flex items-center justify-center h-11 px-7 text-sm font-medium text-gray-400 hover:text-gray-700 border border-gray-200 hover:border-gray-300 transition-colors">
                      Back to home
                    </button>
                  </Link>
                </div>
              </section>
            )}

          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── Bottom nav ── */}
      {!isLast && (
        <div className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-gray-100">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
            <button
              onClick={() => setStep(s => Math.max(s - 1, 0))}
              disabled={step === 0}
              className="inline-flex items-center gap-2 px-5 h-11 text-sm font-medium text-gray-400 border border-gray-200 hover:text-gray-700 hover:border-gray-300 transition-colors disabled:opacity-30 disabled:pointer-events-none"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <button
              onClick={() => setStep(s => Math.min(s + 1, STEPS.length - 1))}
              className="inline-flex items-center gap-2 bg-gray-900 text-white px-7 h-11 text-sm font-semibold hover:bg-gray-700 transition-colors"
            >
              {step === 3 ? "Generate report" : "Continue"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
