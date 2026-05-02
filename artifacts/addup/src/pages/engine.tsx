import React, { useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, ArrowLeft, CheckCircle2, AlertCircle,
  X, Check, FileText, Upload, Hash,
} from "lucide-react";
import addupLogo from "@assets/Addup_1777332904059.png";

/* ─────────────────────────────────────────────
   TYPES
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
   DEMO DATA — derived from real bank.csv + engine logic
   Match types: exact (conf≈1.0) | fuzzy/date±1 (conf≈0.84) | amount-only (conf≈0.78)
   Mismatches: date_mismatch | description_mismatch | missing
───────────────────────────────────────────── */
const DATE_FORMATS = [
  { raw: "2026-04-01",    norm: "2026-04-01", fmt: "ISO 8601"       },
  { raw: "01/04/2026",    norm: "2026-04-01", fmt: "DD/MM/YYYY"     },
  { raw: "07-04-2026",    norm: "2026-04-07", fmt: "DD-MM-YYYY"     },
  { raw: '"09 Apr 2026"', norm: "2026-04-09", fmt: "Natural text"   },
  { raw: "4/5/2026",      norm: "2026-04-05", fmt: "M/D/YYYY"       },
];

const MATCHES = [
  {
    bank:  { id: "B-001", date: "2026-04-01", desc: "Salary Payment",            amt:  3500.00 },
    ledger:{ id: "L-001", date: "2026-04-01", desc: "Salary",                    amt:  3500.00 },
    matchType: "exact" as const, conf: 1.00, issues: [],
  },
  {
    bank:  { id: "B-002", date: "2026-04-02", desc: "Online Transfer to Savings", amt: -500.00 },
    ledger:{ id: "L-002", date: "2026-04-03", desc: "Savings Transfer",           amt: -500.00 },
    matchType: "fuzzy" as const, conf: 0.84,
    issues: ["description_mismatch"],
  },
  {
    bank:  { id: "B-004", date: "2026-04-06", desc: "Direct Debit Electricity",  amt:  -95.67 },
    ledger:{ id: "L-003", date: "2026-03-28", desc: "Electricity DD",            amt:  -95.67 },
    matchType: "amount" as const, conf: 0.78,
    issues: ["date_mismatch"],
  },
  {
    bank:  { id: "B-005", date: "2026-04-07", desc: "Online Payment - Amazon",   amt:  -87.99 },
    ledger:{ id: "L-004", date: "2026-04-07", desc: "Online Purchase",           amt:  -87.99 },
    matchType: "exact" as const, conf: 1.00,
    issues: ["description_mismatch"],
  },
  {
    bank:  { id: "B-006", date: "2026-04-10", desc: "Check Deposit",             amt:  500.00 },
    ledger:{ id: "L-005", date: "2026-04-10", desc: "Check Deposit",             amt:  500.00 },
    matchType: "exact" as const, conf: 1.00, issues: [],
  },
  {
    bank:  { id: "B-007", date: "2026-04-12", desc: "Interest Credit",           amt:    2.35 },
    ledger:{ id: "L-006", date: "2026-04-15", desc: "Interest",                  amt:    2.35 },
    matchType: "amount" as const, conf: 0.78,
    issues: ["date_mismatch"],
  },
  {
    bank:  { id: "B-009", date: "2026-04-19", desc: "Payroll Tax",               amt: -450.00 },
    ledger:{ id: "L-007", date: "2026-04-19", desc: "Payroll Tax",               amt: -450.00 },
    matchType: "exact" as const, conf: 1.00, issues: [],
  },
];

const MISSING = [
  { id: "B-003", source: "bank",   desc: "Coffee Shop, Downtown",  amt:    -4.50, action: "request_data" },
  { id: "B-008", source: "bank",   desc: "Wire Transfer Incoming",  amt: 10000.00, action: "request_data" },
];

const ISSUES_LIST = [
  {
    id: "B-002::L-002", type: "description_mismatch" as const,
    bankDesc: "Online Transfer to Savings", ledgerDesc: "Savings Transfer",
    amt: -500.00, conf: 0.84,
    explanation: "Token similarity 33% — different wording for the same transaction. Bank uses full description; ledger uses shorthand.",
    action: "manual_review",
  },
  {
    id: "B-004::L-003", type: "date_mismatch" as const,
    bankDesc: "2026-04-06", ledgerDesc: "2026-03-28",
    amt: -95.67, conf: 0.78,
    explanation: "Date differs by 9 days. Amounts match exactly. May be a posting delay or a backdated ledger entry.",
    action: "manual_review",
  },
  {
    id: "B-005::L-004", type: "description_mismatch" as const,
    bankDesc: "Online Payment - Amazon", ledgerDesc: "Online Purchase",
    amt: -87.99, conf: 1.00,
    explanation: "Token similarity 0% — bank identifies the vendor; ledger uses a generic category.",
    action: "manual_review",
  },
  {
    id: "B-007::L-006", type: "date_mismatch" as const,
    bankDesc: "2026-04-12", ledgerDesc: "2026-04-15",
    amt: 2.35, conf: 0.78,
    explanation: "Date differs by 3 days. Small interest credit, likely a posting timing difference.",
    action: "suggest_fix",
  },
  {
    id: "B-003", type: "missing" as const,
    bankDesc: "Coffee Shop, Downtown", ledgerDesc: "—",
    amt: -4.50, conf: 0,
    explanation: "No reliable match found in ledger. Transaction may be missing or below threshold.",
    action: "request_data",
  },
  {
    id: "B-008", type: "missing" as const,
    bankDesc: "Wire Transfer Incoming", ledgerDesc: "—",
    amt: 10000.00, conf: 0,
    explanation: "No reliable match found in ledger. High-value entry — verify source and ledger recording.",
    action: "request_data",
  },
];

// Real engine summary format
const SUMMARY = "7/9 bank transactions matched. 2 missing. 4 mismatches.";
const AVG_CONF = (MATCHES.reduce((s, m) => s + m.conf, 0) / MATCHES.length);

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
function fmtAmt(n: number) {
  const abs = Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${n < 0 ? "−" : ""}R ${abs}`;
}

function confColor(c: number) {
  if (c >= 0.95) return "text-emerald-600";
  if (c >= 0.80) return "text-blue-600";
  if (c >= 0.60) return "text-amber-600";
  return "text-destructive";
}

function matchLabel(t: "exact" | "fuzzy" | "amount") {
  if (t === "exact")  return { label: "Exact",       cls: "bg-emerald-500/10 text-emerald-700" };
  if (t === "fuzzy")  return { label: "Fuzzy ±1 day",cls: "bg-blue-500/10 text-blue-700"      };
  return               { label: "Amount-only",        cls: "bg-amber-500/10 text-amber-700"    };
}

function issueLabel(t: "date_mismatch" | "description_mismatch" | "missing") {
  if (t === "date_mismatch")        return { label: "Date mismatch",        cls: "text-amber-600 bg-amber-500/10"  };
  if (t === "description_mismatch") return { label: "Description mismatch", cls: "text-blue-600 bg-blue-500/10"   };
  return                             { label: "Missing",                    cls: "text-red-600 bg-red-500/10"      };
}

/* ─────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */
export default function Engine() {
  const [step,     setStep]     = useState(0);
  const [filter,   setFilter]   = useState<"all" | "matched" | "issues">("all");
  const [resolved, setResolved] = useState<Set<string>>(new Set());

  const stepId = STEPS[step].id;
  const isLast = step === STEPS.length - 1;
  const resolve = (id: string) => setResolved(prev => new Set([...prev, id]));

  const visibleMatches =
    filter === "matched" ? MATCHES.filter(m => m.issues.length === 0) :
    filter === "issues"  ? MATCHES.filter(m => m.issues.length > 0)   : MATCHES;

  return (
    <div className="min-h-[100svh] bg-background flex flex-col">

      {/* ── Header ── */}
      <header className="fixed inset-x-0 top-0 z-50 h-14 bg-black border-b border-white/10">
        <div className="h-full max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/">
              <img src={addupLogo} alt="Addup" className="h-6 w-auto"
                style={{ filter: "brightness(0) invert(1)" }} />
            </Link>
            <span className="text-white/20 hidden sm:block">|</span>
            <span className="text-white/55 text-xs font-semibold uppercase tracking-widest hidden sm:block">
              Reconciliation Engine
            </span>
          </div>

          {/* Breadcrumb — desktop */}
          <ol className="hidden sm:flex items-center gap-0.5">
            {STEPS.map((s, i) => (
              <React.Fragment key={s.id}>
                <li>
                  <button
                    onClick={() => i <= step && setStep(i)}
                    disabled={i > step}
                    className={`px-2.5 py-1 text-xs font-medium transition-colors
                      ${i === step   ? "text-white"
                      : i < step     ? "text-white/40 hover:text-white/60 cursor-pointer"
                                     : "text-white/20 cursor-default"}`}
                  >
                    {i < step && <span className="text-emerald-400 mr-0.5">✓</span>}
                    {i >= step && <span className="text-white/30 mr-0.5">{i + 1}.</span>}
                    {s.label}
                  </button>
                </li>
                {i < STEPS.length - 1 && <li className="text-white/15 text-xs select-none">›</li>}
              </React.Fragment>
            ))}
          </ol>

          {/* Mobile counter */}
          <span className="sm:hidden text-xs text-white/50 font-medium">
            {step + 1} / {STEPS.length} — {STEPS[step].label}
          </span>

          <Link href="/" className="flex items-center gap-1 text-white/35 hover:text-white/70 transition-colors shrink-0">
            <X className="h-4 w-4" />
            <span className="hidden sm:inline text-xs ml-0.5">Exit</span>
          </Link>
        </div>
      </header>

      {/* ── Progress bar ── */}
      <div className="fixed top-14 inset-x-0 z-40 h-[2px] bg-white/10">
        <div className="h-full bg-blue-500 transition-all duration-500 ease-out"
          style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>

      {/* ── Content ── */}
      <main className="flex-1 pt-14 pb-28">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >

            {/* ───── STEP 1: Upload ───── */}
            {stepId === "upload" && (
              <section className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Step 1 of 5</p>
                <h1 className="text-2xl sm:text-3xl font-semibold mb-2">Upload your files</h1>
                <p className="text-muted-foreground text-sm sm:text-base mb-8">
                  The engine accepts CSV or Excel files for your bank statement and general ledger.
                  Sample files are pre-loaded below.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                  {[
                    { label: "Bank Statement", file: "bank.csv", rows: 19, size: "4.2 KB",
                      note: "FNB Business Current · April 2026" },
                    { label: "General Ledger", file: "ledger.csv", rows: 11, size: "2.8 KB",
                      note: "Xero export · April 2026" },
                  ].map((f) => (
                    <div key={f.file} className="border-2 border-dashed border-border p-5">
                      <div className="flex items-start gap-3 mb-4">
                        <div className="w-10 h-10 bg-muted flex items-center justify-center shrink-0">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="font-semibold text-sm">{f.label}</div>
                          <div className="text-xs text-muted-foreground">{f.note}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 p-2.5 bg-muted/40 border border-border">
                        <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        <span className="text-xs font-mono font-medium flex-1 truncate">{f.file}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{f.rows} rows · {f.size}</span>
                      </div>
                      <button className="mt-3 w-full flex items-center justify-center gap-2 h-9 border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                        <Upload className="h-3.5 w-3.5" />
                        Replace file
                      </button>
                    </div>
                  ))}
                </div>

                <div className="border border-border bg-muted/20 p-4 text-xs text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-foreground">Supported formats:</span> CSV (any delimiter), Excel (.xlsx, .xls).
                  The engine auto-detects date formats, currency symbols, and column headers. Max file size: 50 MB.
                </div>
              </section>
            )}

            {/* ───── STEP 2: Parse ───── */}
            {stepId === "parse" && (
              <section className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Step 2 of 5</p>
                <h1 className="text-2xl sm:text-3xl font-semibold mb-2">Parsed and normalized</h1>
                <p className="text-muted-foreground text-sm sm:text-base mb-8">
                  Both files parsed. Dates normalized to ISO 8601. Deterministic row hashes generated for deduplication.
                </p>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
                  {[
                    { val: "19",   lbl: "Bank rows"     },
                    { val: "11",   lbl: "Ledger rows"   },
                    { val: "5",    lbl: "Date formats"  },
                    { val: "0",    lbl: "Invalid rows"  },
                  ].map(({ val, lbl }) => (
                    <div key={lbl} className="border border-border bg-card p-4">
                      <div className="text-2xl font-semibold font-mono">{val}</div>
                      <div className="text-xs text-muted-foreground mt-1">{lbl}</div>
                    </div>
                  ))}
                </div>

                {/* Date normalization */}
                <div className="mb-8">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                    Date format detection — bank statement
                  </div>
                  <div className="border border-border overflow-hidden">
                    <div className="bg-muted/50 px-4 py-2.5 border-b border-border grid grid-cols-3 gap-4">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Raw</span>
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Format detected</span>
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Normalized</span>
                    </div>
                    {DATE_FORMATS.map((row, i) => (
                      <div key={i} className="grid grid-cols-3 gap-4 px-4 py-3 border-b border-border/50 last:border-0 items-center">
                        <span className="font-mono text-[11px] text-muted-foreground">{row.raw}</span>
                        <span className="text-xs text-blue-600 font-medium">{row.fmt}</span>
                        <span className="text-xs font-mono font-semibold flex items-center gap-1.5">
                          <Check className="h-3 w-3 text-emerald-500 shrink-0" />{row.norm}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Checksums */}
                <div className="border border-border bg-muted/20 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Hash className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">File checksums (SHA-256)</span>
                  </div>
                  {[
                    { label: "bank.csv",   hash: "a3f8b2c1d4e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5" },
                    { label: "ledger.csv", hash: "7c2e5f8a1b4d7e0c3f6a9b2e5c8f1a4d7b0e3c6f9a2d5e8b1c4f7a0d3e6c9b2" },
                  ].map((r) => (
                    <div key={r.label} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 py-2 border-b border-border/40 last:border-0">
                      <span className="text-xs font-semibold w-20 shrink-0">{r.label}</span>
                      <span className="font-mono text-[10px] text-muted-foreground break-all">{r.hash}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ───── STEP 3: Match ───── */}
            {stepId === "match" && (
              <section className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Step 3 of 5</p>
                <h1 className="text-2xl sm:text-3xl font-semibold mb-2">Match results</h1>
                <p className="text-muted-foreground text-sm sm:text-base mb-6">
                  Engine ran three passes: exact (amount + date), fuzzy (amount + date ±1 day), then amount-only.
                </p>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-px bg-border border border-border mb-2">
                  {[
                    { val: String(MATCHES.length), lbl: "Matched",         cls: "text-emerald-600" },
                    { val: `${(AVG_CONF * 100).toFixed(1)}%`, lbl: "Avg confidence", cls: "text-blue-600" },
                    { val: String(MISSING.length),  lbl: "Unmatched",      cls: "text-amber-600"  },
                  ].map(({ val, lbl, cls }) => (
                    <div key={lbl} className="bg-card p-4 sm:p-5 text-center">
                      <div className={`text-xl sm:text-2xl font-semibold font-mono ${cls}`}>{val}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{lbl}</div>
                    </div>
                  ))}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap items-center gap-3 mb-4 py-2 px-1 text-xs text-muted-foreground">
                  {[
                    { cls: "bg-emerald-500/10 text-emerald-700", lbl: "Exact  conf≈1.00"      },
                    { cls: "bg-blue-500/10 text-blue-700",       lbl: "Fuzzy  conf≈0.84"      },
                    { cls: "bg-amber-500/10 text-amber-700",     lbl: "Amount-only  conf≈0.78" },
                  ].map(({ cls, lbl }) => (
                    <span key={lbl} className={`px-2 py-0.5 text-[10px] font-semibold ${cls}`}>{lbl}</span>
                  ))}
                </div>

                {/* Filter */}
                <div className="flex border border-border mb-4">
                  {(["all", "matched", "issues"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`flex-1 h-9 text-xs font-medium capitalize transition-colors border-r border-border last:border-r-0
                        ${filter === f ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted/50"}`}
                    >
                      {f === "all" ? `All (${MATCHES.length})` : f === "matched" ? `Clean (${MATCHES.filter(m => m.issues.length === 0).length})` : `Has issues (${MATCHES.filter(m => m.issues.length > 0).length})`}
                    </button>
                  ))}
                </div>

                {/* Match rows */}
                <div className="border border-border divide-y divide-border">
                  {visibleMatches.map((m) => {
                    const ml = matchLabel(m.matchType);
                    return (
                      <div key={m.bank.id} className="p-4">
                        <div className="flex items-start justify-between gap-3 mb-2.5">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 ${ml.cls}`}>{ml.label}</span>
                              {m.issues.map(iss => {
                                const il = issueLabel(iss as any);
                                return <span key={iss} className={`text-[10px] font-semibold px-1.5 py-0.5 ${il.cls}`}>{il.label}</span>;
                              })}
                            </div>
                            <div className="text-sm font-medium">{m.bank.desc}</div>
                            <div className="text-xs text-muted-foreground">{m.bank.id} → {m.ledger.id}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-sm font-mono font-semibold">{fmtAmt(m.bank.amt)}</div>
                            <div className={`text-[10px] font-bold ${confColor(m.conf)}`}>
                              {(m.conf * 100).toFixed(0)}% conf.
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="bg-muted/30 px-3 py-2">
                            <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-0.5">Bank</div>
                            <div className="font-mono">{m.bank.date}</div>
                            <div className="text-muted-foreground truncate">{m.bank.desc}</div>
                          </div>
                          <div className="bg-muted/30 px-3 py-2">
                            <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-0.5">Ledger</div>
                            <div className="font-mono">{m.ledger.date}</div>
                            <div className="text-muted-foreground truncate">{m.ledger.desc}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {MISSING.map((m) => (
                    <div key={m.id} className="p-4 bg-red-500/3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="mb-1">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-500/10 text-red-600">Missing</span>
                          </div>
                          <div className="text-sm font-medium">{m.desc}</div>
                          <div className="text-xs text-muted-foreground">{m.id} · present in bank only</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-mono font-semibold">{fmtAmt(m.amt)}</div>
                          <div className="text-[10px] font-bold text-destructive">No match</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ───── STEP 4: Issues ───── */}
            {stepId === "issues" && (
              <section className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
                <div className="flex items-end justify-between gap-4 mb-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Step 4 of 5</p>
                    <h1 className="text-2xl sm:text-3xl font-semibold">Review issues</h1>
                  </div>
                  <span className="text-sm font-medium bg-amber-500/10 text-amber-600 px-3 py-1 shrink-0 mb-0.5">
                    {resolved.size} / {ISSUES_LIST.length} resolved
                  </span>
                </div>
                <p className="text-muted-foreground text-sm sm:text-base mb-8">
                  {ISSUES_LIST.length} issues flagged: date mismatches, description mismatches, and missing entries.
                  Resolve each before closing.
                </p>

                <div className="space-y-3">
                  {ISSUES_LIST.map((iss) => {
                    const done = resolved.has(iss.id);
                    const il = issueLabel(iss.type);
                    return (
                      <div key={iss.id}
                        className={`border p-4 sm:p-5 transition-all duration-200 ${
                          done ? "border-emerald-500/30 bg-emerald-500/5 opacity-60" : "border-border bg-card"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            {done
                              ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                              : <AlertCircle  className="h-4 w-4 text-amber-500 shrink-0" />}
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 ${il.cls}`}>{il.label}</span>
                            <span className="font-mono text-xs text-muted-foreground">{iss.id}</span>
                          </div>
                          <span className="font-mono text-sm font-semibold shrink-0">{fmtAmt(iss.amt)}</span>
                        </div>

                        {/* Diff row */}
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div className="bg-muted/40 px-3 py-2 text-xs">
                            <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-0.5">Bank</div>
                            <div className="font-medium truncate">{iss.bankDesc}</div>
                          </div>
                          <div className="bg-muted/40 px-3 py-2 text-xs">
                            <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-0.5">Ledger</div>
                            <div className="font-medium truncate">{iss.ledgerDesc}</div>
                          </div>
                        </div>

                        <p className="text-xs text-muted-foreground mb-4">{iss.explanation}</p>

                        {done ? (
                          <span className="text-xs text-emerald-600 font-semibold">Resolved</span>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => resolve(iss.id)}
                              className="px-4 py-2 bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-colors"
                            >
                              {iss.action === "suggest_fix" ? "Apply fix" : iss.action === "request_data" ? "Request data" : "Accept"}
                            </button>
                            <button
                              onClick={() => resolve(iss.id)}
                              className="px-4 py-2 border border-border text-xs font-medium hover:bg-muted transition-colors"
                            >
                              Override
                            </button>
                            <button
                              className="px-4 py-2 border border-border text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
                            >
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

            {/* ───── STEP 5: Report ───── */}
            {stepId === "report" && (
              <section className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
                <motion.div
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1,    opacity: 1 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="text-center mb-10"
                >
                  <div className="mx-auto w-16 h-16 flex items-center justify-center bg-emerald-500/10 mb-6">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-semibold mb-3">Reconciliation complete</h1>
                  {/* Real engine summary string */}
                  <p className="font-mono text-sm text-muted-foreground bg-muted/40 border border-border inline-block px-4 py-2">
                    {SUMMARY}
                  </p>
                </motion.div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-px bg-border border border-border mb-6">
                  {[
                    { val: "7 / 9",                          lbl: "Transactions matched" },
                    { val: `${(AVG_CONF * 100).toFixed(1)}%`, lbl: "Avg confidence"       },
                    { val: "4",                               lbl: "Issues flagged"       },
                  ].map(({ val, lbl }) => (
                    <div key={lbl} className="bg-card p-4 sm:p-5 text-center">
                      <div className="text-lg sm:text-xl font-semibold font-mono">{val}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{lbl}</div>
                    </div>
                  ))}
                </div>

                {/* Confidence breakdown */}
                <div className="border border-border bg-card p-5 mb-6">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-4">Match breakdown</div>
                  {[
                    { label: "Exact match (amount + date)",          count: MATCHES.filter(m => m.matchType === "exact").length,  conf: "1.00" },
                    { label: "Fuzzy match (amount + date ±1 day)",   count: MATCHES.filter(m => m.matchType === "fuzzy").length,  conf: "0.84" },
                    { label: "Amount-only match",                    count: MATCHES.filter(m => m.matchType === "amount").length, conf: "0.78" },
                    { label: "Unmatched (missing)",                  count: MISSING.length,                                       conf: "0.00" },
                  ].map(({ label, count, conf }) => (
                    <div key={label} className="flex items-center justify-between gap-4 py-2.5 border-b border-border/40 last:border-0 text-sm">
                      <div className="text-muted-foreground">{label}</div>
                      <div className="flex items-center gap-4 shrink-0">
                        <span className="font-mono text-xs text-muted-foreground">conf {conf}</span>
                        <span className="font-semibold w-4 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Audit log */}
                <div className="border border-border bg-muted/20 p-4 mb-8 font-mono text-xs text-muted-foreground space-y-1">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Audit log</div>
                  <div>{"{"}</div>
                  <div className="pl-4">"event": "reconciliation_run",</div>
                  <div className="pl-4">"timestamp": "{new Date().toISOString()}",</div>
                  <div className="pl-4">"records_processed": 30,</div>
                  <div className="pl-4">"matches_found": 7,</div>
                  <div className="pl-4">"status": "completed"</div>
                  <div>{"}"}</div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-foreground text-background px-7 h-11 text-sm font-semibold hover:bg-foreground/90 transition-colors">
                    Export report (JSON)
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <Link href="/">
                    <button className="w-full sm:w-auto inline-flex items-center justify-center h-11 px-7 text-sm font-medium text-muted-foreground hover:text-foreground border border-border hover:border-foreground/30 transition-colors">
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
        <div className="fixed bottom-0 inset-x-0 z-50 bg-background/95 backdrop-blur-sm border-t border-border/60">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
            <button
              onClick={() => setStep(s => Math.max(s - 1, 0))}
              disabled={step === 0}
              className="inline-flex items-center gap-2 px-5 h-11 text-sm font-medium text-muted-foreground border border-border hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-30 disabled:pointer-events-none"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <button
              onClick={() => setStep(s => Math.min(s + 1, STEPS.length - 1))}
              className="inline-flex items-center gap-2 bg-foreground text-background px-7 h-11 text-sm font-semibold hover:bg-foreground/90 transition-colors"
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
