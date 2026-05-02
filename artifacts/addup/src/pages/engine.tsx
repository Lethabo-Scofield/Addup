import React, { useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, ArrowLeft, CheckCircle2, AlertCircle,
  X, Check,
} from "lucide-react";
import addupLogo from "@assets/Addup_1777332904059.png";

type StepId = "sources" | "clean" | "match" | "review" | "done";
const STEPS: { id: StepId; label: string }[] = [
  { id: "sources", label: "Sources" },
  { id: "clean",   label: "Clean"   },
  { id: "match",   label: "Match"   },
  { id: "review",  label: "Review"  },
  { id: "done",    label: "Done"    },
];

const SOURCES = [
  { name: "FNB Business",   sub: "Bank account", count: 1247, abbr: "FN", color: "bg-blue-500/10 text-blue-700"    },
  { name: "Standard Bank",  sub: "Bank account", count: 893,  abbr: "SB", color: "bg-sky-500/10 text-sky-700"      },
  { name: "Nedbank",        sub: "Bank account", count: 412,  abbr: "NB", color: "bg-emerald-500/10 text-emerald-700" },
  { name: "Stripe",         sub: "Payments",     count: 334,  abbr: "ST", color: "bg-purple-500/10 text-purple-700" },
];

const CLEANING_STATS = [
  { val: "23",  label: "Duplicates removed"   },
  { val: "156", label: "Vendors normalized"    },
  { val: "89",  label: "Dates standardized"   },
  { val: "12",  label: "Errors caught"         },
];

const CLEANING_SAMPLES = [
  { raw: "aws_sub_1234_usd",     clean: "Amazon Web Services" },
  { raw: "stripe*inv_4992",      clean: "Stripe"              },
  { raw: "ACH // GITHUB // 000", clean: "GitHub"              },
  { raw: "FNB/PYMT/2026/0412",   clean: "FNB Payment"         },
  { raw: "SAPO-LOGISTICS-JHB",   clean: "SA Post Office"      },
];

const MATCHES_DATA = [
  { id: 1, desc: "Stripe Payout",    amt: 12450, target: "FNB Deposit",     conf: 98, type: "matched"   as const },
  { id: 2, desc: "INV-2341 Payment", amt: 8200,  target: "STD Bank Credit", conf: 95, type: "matched"   as const },
  { id: 3, desc: "Payroll Run",      amt: 48200, target: "STD Bank Batch",  conf: 94, type: "matched"   as const },
  { id: 4, desc: "Subscription Fee", amt: 4990,  target: "FNB Debit",       conf: 91, type: "matched"   as const },
  { id: 5, desc: "AWS Invoice",      amt: 2340,  target: "Card Pmt R2,315", conf: 72, type: "exception" as const },
  { id: 6, desc: "Consulting Fee",   amt: 35000, target: null,              conf: 0,  type: "unmatched" as const },
];

const EXCEPTIONS_DATA = [
  {
    id: 1, desc: "AWS Invoice", amt: 2340,
    issue:  "Amount mismatch — R25 difference",
    detail: "FNB Debit shows R2,315. Likely a bank processing fee was deducted.",
  },
  {
    id: 2, desc: "Consulting Fee", amt: 35000,
    issue:  "No bank match within 7 days",
    detail: "Payment may still be in transit. Check your STD Bank statement.",
  },
  {
    id: 3, desc: "Unknown Wire", amt: 4000,
    issue:  "Unidentified sender",
    detail: "Ref: PMT/2026/0412. Contact your bank for remittance advice.",
  },
];

function fmt(n: number) {
  return "R\u00a0" + n.toLocaleString("en", { minimumFractionDigits: 2 });
}

export default function Engine() {
  const [step, setStep]       = useState(0);
  const [filter, setFilter]   = useState<"all" | "matched" | "exceptions">("all");
  const [resolved, setResolved] = useState<Set<number>>(new Set());

  const stepId = STEPS[step].id;
  const isLast = step === STEPS.length - 1;

  const resolve = (id: number) =>
    setResolved((prev) => new Set([...prev, id]));

  const visibleMatches =
    filter === "matched"    ? MATCHES_DATA.filter((m) => m.type === "matched")
    : filter === "exceptions" ? MATCHES_DATA.filter((m) => m.type !== "matched")
    : MATCHES_DATA;

  return (
    <div className="min-h-[100svh] bg-background flex flex-col">

      {/* ── Header ── */}
      <header className="fixed inset-x-0 top-0 z-50 h-14 bg-black border-b border-white/10">
        <div className="h-full max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/">
              <img
                src={addupLogo}
                alt="Addup"
                className="h-6 w-auto"
                style={{ filter: "brightness(0) invert(1)" }}
              />
            </Link>
            <span className="text-white/20 text-sm hidden sm:block">|</span>
            <span className="text-white/55 text-xs font-semibold uppercase tracking-widest hidden sm:block">
              Engine
            </span>
          </div>

          {/* Step breadcrumb — desktop */}
          <ol className="hidden sm:flex items-center gap-0.5">
            {STEPS.map((s, i) => (
              <React.Fragment key={s.id}>
                <li>
                  <button
                    onClick={() => i <= step && setStep(i)}
                    disabled={i > step}
                    className={`px-2.5 py-1 text-xs font-medium transition-colors rounded-none
                      ${i === step
                        ? "text-white"
                        : i < step
                        ? "text-white/40 hover:text-white/60 cursor-pointer"
                        : "text-white/20 cursor-default"}`}
                  >
                    {i < step
                      ? <span className="text-emerald-400 mr-0.5">✓</span>
                      : <span className="mr-0.5 text-white/30">{i + 1}.</span>}
                    {s.label}
                  </button>
                </li>
                {i < STEPS.length - 1 && (
                  <li className="text-white/15 text-xs select-none">›</li>
                )}
              </React.Fragment>
            ))}
          </ol>

          {/* Step counter — mobile */}
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
        <div
          className="h-full bg-blue-500 transition-all duration-500 ease-out"
          style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
        />
      </div>

      {/* ── Main content ── */}
      <main className="flex-1 pt-14 pb-28">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >

            {/* ─── STEP 1: Sources ─── */}
            {stepId === "sources" && (
              <section className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Step 1 of 5</p>
                <h1 className="text-2xl sm:text-3xl font-semibold mb-2">Data sources ready</h1>
                <p className="text-muted-foreground text-sm sm:text-base mb-8">
                  Sample financial data pre-loaded across 4 sources. Connect your real accounts in production.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
                  {SOURCES.map((src) => (
                    <div key={src.name} className="border border-border bg-card p-4 flex items-center gap-4">
                      <div className={`h-10 w-10 flex items-center justify-center text-xs font-bold shrink-0 ${src.color}`}>
                        {src.abbr}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{src.name}</div>
                        <div className="text-xs text-muted-foreground">{src.sub}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-mono font-semibold">{src.count.toLocaleString()}</div>
                        <div className="text-[10px] text-emerald-600 font-semibold">Active</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-px bg-border border border-border">
                  {[
                    { val: "2,886",    lbl: "Transactions" },
                    { val: "4",        lbl: "Sources"       },
                    { val: "May 2026", lbl: "Period"        },
                  ].map(({ val, lbl }) => (
                    <div key={lbl} className="bg-card p-4 sm:p-5 text-center">
                      <div className="text-xl sm:text-2xl font-semibold font-mono">{val}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{lbl}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ─── STEP 2: Clean ─── */}
            {stepId === "clean" && (
              <section className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Step 2 of 5</p>
                <h1 className="text-2xl sm:text-3xl font-semibold mb-2">Data cleaned</h1>
                <p className="text-muted-foreground text-sm sm:text-base mb-8">
                  2,886 transactions standardized. Duplicates removed, vendors normalized.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
                  {CLEANING_STATS.map((s) => (
                    <div key={s.label} className="border border-border bg-card p-4">
                      <div className="text-2xl font-semibold font-mono">{s.val}</div>
                      <div className="text-xs text-muted-foreground mt-1 leading-snug">{s.label}</div>
                    </div>
                  ))}
                </div>

                <div className="border border-border overflow-hidden">
                  <div className="bg-muted/50 px-4 py-2.5 border-b border-border grid grid-cols-2 gap-4">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Raw input</span>
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cleaned output</span>
                  </div>
                  {CLEANING_SAMPLES.map((row, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-2 gap-4 px-4 py-3 border-b border-border/50 last:border-0 items-center"
                    >
                      <span className="font-mono text-[11px] sm:text-xs text-muted-foreground break-all">{row.raw}</span>
                      <span className="text-sm font-medium flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        {row.clean}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ─── STEP 3: Match ─── */}
            {stepId === "match" && (
              <section className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Step 3 of 5</p>
                <h1 className="text-2xl sm:text-3xl font-semibold mb-2">Matching results</h1>
                <p className="text-muted-foreground text-sm sm:text-base mb-6">
                  2,880 transactions auto-matched. 6 exceptions flagged for review.
                </p>

                <div className="grid grid-cols-3 gap-px bg-border border border-border mb-6">
                  {[
                    { val: "2,880",  lbl: "Matched",    cls: "text-emerald-600" },
                    { val: "99.8%",  lbl: "Match rate", cls: "text-blue-600"    },
                    { val: "6",      lbl: "Exceptions", cls: "text-amber-600"   },
                  ].map(({ val, lbl, cls }) => (
                    <div key={lbl} className="bg-card p-4 sm:p-5 text-center">
                      <div className={`text-xl sm:text-2xl font-semibold font-mono ${cls}`}>{val}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{lbl}</div>
                    </div>
                  ))}
                </div>

                {/* Filter tabs */}
                <div className="flex border border-border mb-4">
                  {(["all", "matched", "exceptions"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`flex-1 h-9 text-xs font-medium capitalize transition-colors border-r border-border last:border-r-0 ${
                        filter === f ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                <div className="border border-border divide-y divide-border">
                  {visibleMatches.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 sm:gap-4 px-4 py-3.5">
                      <div className="shrink-0">
                        {m.type === "matched"   && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                        {m.type === "exception" && <AlertCircle  className="h-4 w-4 text-amber-500"   />}
                        {m.type === "unmatched" && <X            className="h-4 w-4 text-destructive"  />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{m.desc}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {m.target ?? "No match found"}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-mono font-medium">{fmt(m.amt)}</div>
                        {m.conf > 0 && (
                          <div className={`text-[10px] font-bold ${
                            m.conf >= 90 ? "text-emerald-600" : m.conf >= 70 ? "text-amber-600" : "text-muted-foreground"
                          }`}>
                            {m.conf}% match
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ─── STEP 4: Review ─── */}
            {stepId === "review" && (
              <section className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
                <div className="flex items-end justify-between gap-4 mb-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Step 4 of 5</p>
                    <h1 className="text-2xl sm:text-3xl font-semibold">Review exceptions</h1>
                  </div>
                  <span className="text-sm font-medium bg-amber-500/10 text-amber-600 px-3 py-1 shrink-0 mb-0.5">
                    {resolved.size} / {EXCEPTIONS_DATA.length} resolved
                  </span>
                </div>
                <p className="text-muted-foreground text-sm sm:text-base mb-8">
                  These transactions need your input before the books can close.
                </p>

                <div className="space-y-4">
                  {EXCEPTIONS_DATA.map((ex) => {
                    const done = resolved.has(ex.id);
                    return (
                      <div
                        key={ex.id}
                        className={`border p-5 transition-all duration-200 ${
                          done ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/25 bg-amber-500/5"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            {done
                              ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                              : <AlertCircle  className="h-4 w-4 text-amber-500 shrink-0"   />}
                            <span className="font-semibold text-sm truncate">{ex.desc}</span>
                          </div>
                          <span className="font-mono text-sm font-semibold shrink-0">{fmt(ex.amt)}</span>
                        </div>
                        <p className="text-xs font-medium text-foreground/70 mb-1 pl-6">{ex.issue}</p>
                        <p className="text-xs text-muted-foreground mb-5 pl-6">{ex.detail}</p>

                        {done ? (
                          <div className="pl-6 text-xs text-emerald-600 font-semibold">Resolved</div>
                        ) : (
                          <div className="flex flex-wrap gap-2 pl-6">
                            <button
                              onClick={() => resolve(ex.id)}
                              className="px-4 py-2 bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-colors"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => resolve(ex.id)}
                              className="px-4 py-2 border border-border text-xs font-medium hover:bg-muted transition-colors"
                            >
                              Link manually
                            </button>
                            <button
                              onClick={() => resolve(ex.id)}
                              className="px-4 py-2 border border-border text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
                            >
                              Investigate
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ─── STEP 5: Done ─── */}
            {stepId === "done" && (
              <section className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
                <motion.div
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="text-center mb-10"
                >
                  <div className="mx-auto w-16 h-16 flex items-center justify-center bg-emerald-500/10 mb-6">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-semibold mb-2">Books closed</h1>
                  <p className="text-muted-foreground text-sm sm:text-base max-w-md mx-auto">
                    May 2026 is reconciled. Every transaction is matched, verified, and audit-ready.
                  </p>
                </motion.div>

                <div className="grid grid-cols-3 gap-px bg-border border border-border mb-6">
                  {[
                    { val: "2,886",  lbl: "Transactions" },
                    { val: "99.8%",  lbl: "Match rate"   },
                    { val: "0",      lbl: "Open items"   },
                  ].map(({ val, lbl }) => (
                    <div key={lbl} className="bg-card p-4 sm:p-6 text-center">
                      <div className="text-xl sm:text-2xl font-semibold font-mono">{val}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{lbl}</div>
                    </div>
                  ))}
                </div>

                <div className="border border-border bg-card p-5 mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-2 w-2 bg-emerald-500"></div>
                    <span className="text-sm font-semibold">Balance check passed</span>
                  </div>
                  {[
                    { label: "Assets",      val: "R 1,240,500.00" },
                    { label: "Liabilities", val: "R\u00a0\u00a0450,200.00" },
                    { label: "Equity",      val: "R\u00a0\u00a0790,300.00" },
                  ].map((row) => (
                    <div key={row.label} className="flex justify-between items-center py-2 text-sm border-b border-border/40 last:border-0">
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className="font-mono font-medium">{row.val}</span>
                    </div>
                  ))}
                  <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-sm">
                    <span className="font-medium text-muted-foreground">Assets = Liabilities + Equity</span>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-foreground text-background px-7 h-11 text-sm font-semibold hover:bg-foreground/90 transition-colors">
                    Export report
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

      {/* ── Bottom navigation ── */}
      {!isLast && (
        <div className="fixed bottom-0 inset-x-0 z-50 bg-background/95 backdrop-blur-sm border-t border-border/60">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
            <button
              onClick={() => setStep((s) => Math.max(s - 1, 0))}
              disabled={step === 0}
              className="inline-flex items-center gap-2 px-5 h-11 text-sm font-medium text-muted-foreground border border-border hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-30 disabled:pointer-events-none"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <button
              onClick={() => setStep((s) => Math.min(s + 1, STEPS.length - 1))}
              className="inline-flex items-center gap-2 bg-foreground text-background px-7 h-11 text-sm font-semibold hover:bg-foreground/90 transition-colors"
            >
              {step === 3 ? "Close books" : "Continue"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
