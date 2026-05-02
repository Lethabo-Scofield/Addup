import React, { useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, ArrowLeft, CheckCircle2, AlertCircle,
  X, Check, FileText, Upload, Download,
} from "lucide-react";
import addupLogo from "@assets/Addup_1777332904059.png";
import jsPDF from "jspdf";

/* ─────────────────────────────────────────────
   STEPS
───────────────────────────────────────────── */
type StepId = "upload" | "read" | "match" | "review" | "report";

const STEPS: { id: StepId; label: string }[] = [
  { id: "upload", label: "Upload" },
  { id: "read",   label: "Read"   },
  { id: "match",  label: "Match"  },
  { id: "review", label: "Review" },
  { id: "report", label: "Report" },
];

/* ─────────────────────────────────────────────
   DEMO DATA
───────────────────────────────────────────── */
const DATE_FORMATS = [
  { raw: "2026-04-01",    norm: "2026-04-01", note: "Standard format — no change needed"      },
  { raw: "01/04/2026",    norm: "2026-04-01", note: "Day/Month/Year — corrected"              },
  { raw: "07-04-2026",    norm: "2026-04-07", note: "Dash-separated — corrected"              },
  { raw: '"09 Apr 2026"', norm: "2026-04-09", note: "Written month — corrected"               },
  { raw: "4/5/2026",      norm: "2026-04-05", note: "Short US format — corrected"             },
];

const MATCHES = [
  { bank: { id: "B-001", date: "1 Apr", desc: "Salary Payment",            amt:  3500.00 },
    ledger:{ id: "L-001", date: "1 Apr", desc: "Salary",                    amt:  3500.00 },
    quality: "perfect" as const, conf: 100, flags: [] },
  { bank: { id: "B-002", date: "2 Apr", desc: "Online Transfer to Savings", amt: -500.00 },
    ledger:{ id: "L-002", date: "3 Apr", desc: "Savings Transfer",           amt: -500.00 },
    quality: "close"   as const, conf: 84,  flags: ["Different descriptions"] },
  { bank: { id: "B-004", date: "6 Apr", desc: "Direct Debit Electricity",   amt:  -95.67 },
    ledger:{ id: "L-003", date: "28 Mar",desc: "Electricity DD",             amt:  -95.67 },
    quality: "amount"  as const, conf: 78,  flags: ["Dates 9 days apart"]    },
  { bank: { id: "B-005", date: "7 Apr", desc: "Online Payment - Amazon",    amt:  -87.99 },
    ledger:{ id: "L-004", date: "7 Apr", desc: "Online Purchase",            amt:  -87.99 },
    quality: "perfect" as const, conf: 100, flags: ["Different descriptions"] },
  { bank: { id: "B-006", date: "10 Apr",desc: "Check Deposit",              amt:  500.00 },
    ledger:{ id: "L-005", date: "10 Apr",desc: "Check Deposit",              amt:  500.00 },
    quality: "perfect" as const, conf: 100, flags: [] },
  { bank: { id: "B-007", date: "12 Apr",desc: "Interest Credit",            amt:    2.35 },
    ledger:{ id: "L-006", date: "15 Apr",desc: "Interest",                   amt:    2.35 },
    quality: "amount"  as const, conf: 78,  flags: ["Dates 3 days apart"]    },
  { bank: { id: "B-009", date: "19 Apr",desc: "Payroll Tax",                amt: -450.00 },
    ledger:{ id: "L-007", date: "19 Apr",desc: "Payroll Tax",                amt: -450.00 },
    quality: "perfect" as const, conf: 100, flags: [] },
];

const MISSING = [
  { id: "B-003", desc: "Coffee Shop, Downtown",  amt:  -4.50,  why: "No ledger entry found for this amount on this date." },
  { id: "B-008", desc: "Wire Transfer Incoming",  amt: 10000.00, why: "Large credit in the bank — nothing recorded in the ledger." },
];

const ISSUES = [
  { id: "B-002::L-002", kind: "desc"    as const,
    title: "Bank and ledger use different names",
    bank: "Online Transfer to Savings", ledger: "Savings Transfer",
    amt: -500.00, conf: 84,
    plain: "The bank says 'Online Transfer to Savings', your ledger says 'Savings Transfer'. These are likely the same transaction — the wording is just different.",
    action: "Accept as match" },
  { id: "B-004::L-003", kind: "date"    as const,
    title: "Dates are 9 days apart",
    bank: "Bank: 6 Apr 2026", ledger: "Ledger: 28 Mar 2026",
    amt: -95.67, conf: 78,
    plain: "The electricity direct debit appears on 6 April in the bank but 28 March in the ledger. The amounts match exactly — this may be a posting delay or a recording error.",
    action: "Confirm and accept" },
  { id: "B-005::L-004", kind: "desc"    as const,
    title: "Amazon payment recorded generically",
    bank: "Online Payment - Amazon", ledger: "Online Purchase",
    amt: -87.99, conf: 100,
    plain: "The bank identifies this as an Amazon payment. The ledger just says 'Online Purchase'. Consider updating the ledger description for clarity.",
    action: "Accept as match" },
  { id: "B-007::L-006", kind: "date"    as const,
    title: "Interest credit dates are 3 days apart",
    bank: "Bank: 12 Apr 2026", ledger: "Ledger: 15 Apr 2026",
    amt: 2.35, conf: 78,
    plain: "Small interest credit — the bank shows it on the 12th, the ledger on the 15th. Timing differences like this are common for interest postings.",
    action: "Apply fix" },
  { id: "B-003", kind: "missing" as const,
    title: "Coffee shop charge not in ledger",
    bank: "Coffee Shop, Downtown", ledger: "—",
    amt: -4.50, conf: 0,
    plain: "A R4.50 charge appears in your bank statement but nothing matches in your ledger. This could be an unrecorded petty cash expense.",
    action: "Add to ledger" },
  { id: "B-008", kind: "missing" as const,
    title: "R10,000 wire transfer not recorded",
    bank: "Wire Transfer Incoming", ledger: "—",
    amt: 10000.00, conf: 0,
    plain: "A R10,000 incoming wire appears in your bank with no matching ledger entry. This is a significant amount — confirm the source and record it.",
    action: "Request data" },
];

const AVG_CONF = Math.round(MATCHES.reduce((s, m) => s + m.conf, 0) / MATCHES.length);

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
function fmtAmt(n: number) {
  const abs = Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${n < 0 ? "−" : "+"}R ${abs}`;
}

function qualityChip(q: "perfect" | "close" | "amount") {
  if (q === "perfect") return { label: "Perfect match",      cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (q === "close")   return { label: "Off by 1 day",       cls: "bg-blue-50 text-blue-700 border-blue-200"         };
  return                { label: "Amount matches",           cls: "bg-amber-50 text-amber-700 border-amber-200"      };
}

/* ─────────────────────────────────────────────
   MAIN
───────────────────────────────────────────── */
export default function Engine() {
  const [step,     setStep]     = useState(0);
  const [filter,   setFilter]   = useState<"all" | "clean" | "flagged">("all");
  const [resolved, setResolved] = useState<Set<string>>(new Set());

  const stepId = STEPS[step].id;
  const isLast = step === STEPS.length - 1;
  const resolve = (id: string) => setResolved(p => new Set([...p, id]));

  function generatePDF() {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const W = 210;
    const margin = 18;
    const col = margin;
    let y = 0;

    const right = (text: string, yy: number, size = 9) => {
      doc.setFontSize(size);
      doc.text(text, W - margin, yy, { align: "right" });
    };
    const line = (yy: number) => {
      doc.setDrawColor(220, 220, 220);
      doc.line(margin, yy, W - margin, yy);
    };
    const sectionLabel = (text: string, yy: number) => {
      doc.setFontSize(7.5);
      doc.setTextColor(150, 150, 150);
      doc.setFont("helvetica", "bold");
      doc.text(text.toUpperCase(), col, yy);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 30, 30);
      return yy + 5;
    };

    /* ── Header band ── */
    doc.setFillColor(17, 17, 17);
    doc.rect(0, 0, W, 22, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Addup", col, 14);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.text("Reconciliation Report — April 2026", col + 22, 14);
    doc.setFontSize(8);
    right(new Date().toLocaleDateString("en-ZA", { day: "2-digit", month: "long", year: "numeric" }), 14);
    y = 32;

    /* ── Summary headline ── */
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("April 2026 is reconciled", col, y);
    y += 7;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text("7 out of 9 bank transactions matched your ledger. 2 entries are flagged for follow-up.", col, y);
    y += 12;
    line(y); y += 8;

    /* ── Key stats ── */
    y = sectionLabel("Summary", y);
    const stats = [
      ["Transactions matched", "7 / 9"],
      ["Average confidence",   `${AVG_CONF}%`],
      ["Issues reviewed",      "4"],
      ["Unmatched entries",    "2"],
    ];
    doc.setFontSize(9);
    stats.forEach(([label, val]) => {
      doc.setTextColor(90, 90, 90);  doc.text(label, col, y);
      doc.setTextColor(17, 17, 17);  doc.setFont("helvetica", "bold");
      right(val, y, 9);
      doc.setFont("helvetica", "normal");
      y += 6;
    });
    y += 4; line(y); y += 8;

    /* ── Match breakdown ── */
    y = sectionLabel("How matches were found", y);
    const breakdown = [
      ["Perfect match — same amount and date",      MATCHES.filter(m => m.quality === "perfect").length],
      ["Close match — same amount, date off by 1",  MATCHES.filter(m => m.quality === "close").length  ],
      ["Amount match — date differed significantly", MATCHES.filter(m => m.quality === "amount").length  ],
      ["No match found",                            MISSING.length                                       ],
    ];
    doc.setFontSize(9);
    breakdown.forEach(([label, count]) => {
      doc.setTextColor(90, 90, 90);  doc.text(String(label), col, y);
      doc.setTextColor(17, 17, 17);  doc.setFont("helvetica", "bold");
      right(String(count), y, 9);
      doc.setFont("helvetica", "normal");
      y += 6;
    });
    y += 4; line(y); y += 8;

    /* ── All matches ── */
    y = sectionLabel("Transaction matches", y);
    const colW = [28, 60, 38, 25, 22];
    const headers = ["Bank ID", "Description", "Amount", "Confidence", "Result"];
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.setFont("helvetica", "bold");
    let cx = col;
    headers.forEach((h, i) => { doc.text(h, cx, y); cx += colW[i]; });
    doc.setFont("helvetica", "normal");
    y += 1.5;
    line(y); y += 4;

    doc.setFontSize(8.5);
    MATCHES.forEach((m) => {
      const qualLabel = m.quality === "perfect" ? "Perfect" : m.quality === "close" ? "Close" : "Amount";
      cx = col;
      doc.setTextColor(90, 90, 90);   doc.text(m.bank.id, cx, y);   cx += colW[0];
      doc.setTextColor(17, 17, 17);   doc.text(m.bank.desc.slice(0, 28), cx, y); cx += colW[1];
      doc.text(fmtAmt(m.bank.amt).replace("−", "-"), cx, y);       cx += colW[2];
      doc.setTextColor(90, 90, 90);   doc.text(`${m.conf}%`, cx, y);              cx += colW[3];
      doc.text(qualLabel, cx, y);
      y += 5.5;
    });

    /* Unmatched */
    MISSING.forEach((m) => {
      cx = col;
      doc.setTextColor(90, 90, 90);   doc.text(m.id, cx, y);        cx += colW[0];
      doc.setTextColor(200, 80, 80);  doc.text(m.desc.slice(0, 28), cx, y); cx += colW[1];
      doc.text(fmtAmt(m.amt).replace("−", "-"), cx, y);             cx += colW[2];
      doc.setTextColor(200, 80, 80);  doc.text("—", cx, y);         cx += colW[3];
      doc.text("No match", cx, y);
      y += 5.5;
    });

    y += 4; line(y); y += 8;

    /* ── Issues ── */
    y = sectionLabel("Issues flagged", y);
    doc.setFontSize(8.5);
    ISSUES.forEach((iss) => {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setTextColor(17, 17, 17);
      doc.setFont("helvetica", "bold");
      doc.text(iss.title, col, y); y += 5;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(90, 90, 90);
      const wrapped = doc.splitTextToSize(iss.plain, W - margin * 2);
      doc.text(wrapped, col, y);
      y += wrapped.length * 4.5 + 4;
    });

    y += 2; line(y); y += 8;

    /* ── Footer ── */
    doc.setFontSize(7.5);
    doc.setTextColor(160, 160, 160);
    doc.text(`Generated by Addup on ${new Date().toISOString()}`, col, y);
    right("addup.co", y, 7.5);

    doc.save("addup-reconciliation-april-2026.pdf");
  }

  const visibleMatches =
    filter === "clean"   ? MATCHES.filter(m => m.flags.length === 0) :
    filter === "flagged" ? MATCHES.filter(m => m.flags.length  >  0) : MATCHES;

  return (
    <div className="min-h-[100svh] bg-white flex flex-col">

      {/* ── Header ── */}
      <header className="fixed inset-x-0 top-0 z-50 h-16 bg-white border-b border-gray-100">
        <div className="h-full max-w-4xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-4">
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
                      ${i === step ? "text-gray-900"
                      : i < step   ? "text-gray-400 hover:text-gray-600 cursor-pointer"
                                   : "text-gray-300 cursor-default"}`}
                  >
                    {i < step && <span className="text-emerald-500 mr-1">✓</span>}
                    {s.label}
                  </button>
                </li>
                {i < STEPS.length - 1 && <li className="text-gray-200 text-xs select-none">›</li>}
              </React.Fragment>
            ))}
          </ol>

          <span className="sm:hidden text-xs text-gray-400 font-medium">{step + 1} / {STEPS.length}</span>

          <Link href="/" className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors shrink-0">
            <X className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Exit</span>
          </Link>
        </div>
      </header>

      {/* ── Progress bar ── */}
      <div className="fixed top-16 inset-x-0 z-40 h-[2px] bg-gray-100">
        <div className="h-full bg-gray-900 transition-all duration-500 ease-out"
          style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>

      {/* ── Content ── */}
      <main className="flex-1 pt-16 pb-28">
        <AnimatePresence mode="wait">
          <motion.div key={step}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >

            {/* ─── STEP 1: Upload ─── */}
            {stepId === "upload" && (
              <section className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
                <StepLabel n={1} />
                <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2">
                  Upload your two files
                </h1>
                <p className="text-gray-500 text-sm sm:text-[15px] mb-2 leading-relaxed">
                  Addup needs your <strong className="font-medium text-gray-700">bank statement</strong> and your{" "}
                  <strong className="font-medium text-gray-700">accounting ledger</strong> — then it compares them automatically.
                </p>
                <p className="text-xs text-gray-400 mb-10">Works with CSV or Excel exports from any bank or accounting tool.</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                  {[
                    {
                      label: "Bank Statement",
                      file: "bank.csv",
                      rows: 19, size: "4.2 KB",
                      note: "FNB Business · April 2026",
                      tip:  "Export this from your online banking portal.",
                    },
                    {
                      label: "General Ledger",
                      file: "ledger.csv",
                      rows: 11, size: "2.8 KB",
                      note: "Xero export · April 2026",
                      tip:  "Export this from Xero, QuickBooks, or Sage.",
                    },
                  ].map((f) => (
                    <div key={f.file} className="border border-dashed border-gray-200 p-5 hover:border-gray-300 transition-colors">
                      <div className="flex items-center gap-3 mb-1">
                        <div className="w-9 h-9 bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
                          <FileText className="h-4 w-4 text-gray-400" />
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-gray-900">{f.label}</div>
                          <div className="text-xs text-gray-400">{f.note}</div>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 mb-3 pl-12">{f.tip}</p>
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

                <Callout>
                  Both files are pre-loaded with sample April 2026 data so you can see the full workflow right now.
                </Callout>
              </section>
            )}

            {/* ─── STEP 2: Read ─── */}
            {stepId === "read" && (
              <section className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
                <StepLabel n={2} />
                <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2">
                  Files read successfully
                </h1>
                <p className="text-gray-500 text-sm sm:text-[15px] mb-10 leading-relaxed">
                  Addup found <strong className="font-medium text-gray-700">19 bank transactions</strong> and{" "}
                  <strong className="font-medium text-gray-700">11 ledger entries</strong>. All dates were standardized
                  to a single format so comparisons are accurate.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
                  {[
                    { val: "19", lbl: "Bank transactions"  },
                    { val: "11", lbl: "Ledger entries"      },
                    { val: "5",  lbl: "Date formats found"  },
                    { val: "0",  lbl: "Unreadable rows"     },
                  ].map(({ val, lbl }) => (
                    <div key={lbl} className="border border-gray-100 p-4">
                      <div className="text-2xl font-semibold font-mono text-gray-900">{val}</div>
                      <div className="text-xs text-gray-400 mt-1 leading-snug">{lbl}</div>
                    </div>
                  ))}
                </div>

                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">
                  Date formats recognized automatically
                </p>
                <div className="border border-gray-100 overflow-hidden mb-8">
                  <div className="grid grid-cols-3 gap-4 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                    {["As written in the file", "Format", "Converted to"].map(h => (
                      <span key={h} className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{h}</span>
                    ))}
                  </div>
                  {DATE_FORMATS.map((row, i) => (
                    <div key={i} className="grid grid-cols-3 gap-4 px-4 py-3 border-b border-gray-50 last:border-0 items-start">
                      <span className="font-mono text-[11px] text-gray-500 pt-0.5">{row.raw}</span>
                      <span className="text-xs text-gray-500">{row.note}</span>
                      <span className="font-mono text-xs text-gray-900 font-medium flex items-center gap-1.5">
                        <Check className="h-3 w-3 text-emerald-500 shrink-0" />{row.norm}
                      </span>
                    </div>
                  ))}
                </div>

                <Callout>
                  Your files don't need to be formatted consistently. Addup handles mixed date styles,
                  extra columns, and different delimiters automatically.
                </Callout>
              </section>
            )}

            {/* ─── STEP 3: Match ─── */}
            {stepId === "match" && (
              <section className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
                <StepLabel n={3} />
                <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2">
                  Comparing bank vs. ledger
                </h1>
                <p className="text-gray-500 text-sm sm:text-[15px] mb-8 leading-relaxed">
                  Every bank entry is compared against the ledger. Addup found{" "}
                  <strong className="font-medium text-gray-700">7 matches</strong> out of 9 bank transactions.{" "}
                  2 entries have no match in the ledger at all.
                </p>

                {/* Summary row */}
                <div className="grid grid-cols-3 gap-px bg-gray-100 border border-gray-100 mb-4">
                  {[
                    { val: "7", lbl: "Matched",       cls: "text-emerald-600" },
                    { val: `${AVG_CONF}%`, lbl: "Avg confidence", cls: "text-gray-900" },
                    { val: "2", lbl: "No match found", cls: "text-amber-600"  },
                  ].map(({ val, lbl, cls }) => (
                    <div key={lbl} className="bg-white p-4 sm:p-5 text-center">
                      <div className={`text-xl sm:text-2xl font-semibold font-mono ${cls}`}>{val}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{lbl}</div>
                    </div>
                  ))}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-2 mb-5 text-xs">
                  {[
                    { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", lbl: "Perfect match — same amount and date" },
                    { cls: "bg-blue-50 text-blue-700 border-blue-200",         lbl: "Off by 1 day — amounts match"         },
                    { cls: "bg-amber-50 text-amber-700 border-amber-200",      lbl: "Amount matches — date differs"        },
                  ].map(({ cls, lbl }) => (
                    <span key={lbl} className={`px-2 py-1 border text-[10px] font-medium ${cls}`}>{lbl}</span>
                  ))}
                </div>

                {/* Filter */}
                <div className="flex border border-gray-100 mb-5">
                  {(["all", "clean", "flagged"] as const).map((f) => (
                    <button key={f} onClick={() => setFilter(f)}
                      className={`flex-1 h-9 text-xs font-medium capitalize transition-colors border-r border-gray-100 last:border-r-0
                        ${filter === f ? "bg-gray-900 text-white" : "text-gray-400 hover:text-gray-700 hover:bg-gray-50"}`}
                    >
                      {f === "all"     ? `All matches (${MATCHES.length})`
                        : f === "clean"  ? `No issues (${MATCHES.filter(m => m.flags.length === 0).length})`
                        : `Has a note (${MATCHES.filter(m => m.flags.length > 0).length})`}
                    </button>
                  ))}
                </div>

                <div className="border border-gray-100 divide-y divide-gray-50">
                  {visibleMatches.map((m) => {
                    const qc = qualityChip(m.quality);
                    return (
                      <div key={m.bank.id} className="p-4">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap gap-1.5 mb-1.5">
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 border ${qc.cls}`}>{qc.label}</span>
                              {m.flags.map(flag => (
                                <span key={flag} className="text-[10px] font-medium px-1.5 py-0.5 border bg-gray-50 text-gray-500 border-gray-200">{flag}</span>
                              ))}
                            </div>
                            <div className="text-sm font-medium text-gray-900">{m.bank.desc}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-sm font-mono font-semibold text-gray-900">{fmtAmt(m.bank.amt)}</div>
                            <div className="text-[10px] text-gray-400 mt-0.5">{m.conf}% confidence</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {[{ label: "Bank", date: m.bank.date, desc: m.bank.desc },
                            { label: "Ledger", date: m.ledger.date, desc: m.ledger.desc }].map(({ label, date, desc }) => (
                            <div key={label} className="bg-gray-50 px-3 py-2">
                              <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">{label}</div>
                              <div className="font-medium text-gray-700">{date}</div>
                              <div className="text-gray-400 truncate">{desc}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {/* Unmatched */}
                  {(filter === "all" || filter === "flagged") && MISSING.map((m) => (
                    <div key={m.id} className="p-4 bg-amber-50/40">
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <div className="min-w-0">
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 border bg-amber-50 text-amber-700 border-amber-200 inline-block mb-1.5">
                            Not in ledger
                          </span>
                          <div className="text-sm font-medium text-gray-900">{m.desc}</div>
                        </div>
                        <div className="text-sm font-mono font-semibold text-gray-900 shrink-0">{fmtAmt(m.amt)}</div>
                      </div>
                      <p className="text-xs text-gray-400">{m.why}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ─── STEP 4: Review ─── */}
            {stepId === "review" && (
              <section className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
                <StepLabel n={4} />
                <div className="flex items-baseline justify-between gap-4 mb-2">
                  <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
                    {ISSUES.length} entries need your attention
                  </h1>
                  <span className="text-xs font-medium text-gray-400 shrink-0">
                    {resolved.size} / {ISSUES.length} done
                  </span>
                </div>
                <p className="text-gray-500 text-sm sm:text-[15px] mb-10 leading-relaxed">
                  These are the only transactions you need to look at. Everything else matched cleanly.
                  Read each one and choose what to do.
                </p>

                <div className="space-y-3">
                  {ISSUES.map((iss) => {
                    const done = resolved.has(iss.id);
                    return (
                      <div key={iss.id}
                        className={`border p-4 sm:p-5 transition-all duration-200 ${
                          done ? "border-gray-100 opacity-40" : "border-gray-100 bg-white"
                        }`}
                      >
                        {/* Title row */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-start gap-2 min-w-0">
                            {done
                              ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                              : <AlertCircle  className="h-4 w-4 text-amber-400 shrink-0 mt-0.5"   />}
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-gray-900 leading-snug">{iss.title}</div>
                              <div className="font-mono text-[10px] text-gray-400 mt-0.5">{iss.id}</div>
                            </div>
                          </div>
                          <span className="font-mono text-sm font-semibold text-gray-900 shrink-0">{fmtAmt(iss.amt)}</span>
                        </div>

                        {/* What we see */}
                        {iss.kind !== "missing" && (
                          <div className="grid grid-cols-2 gap-2 mb-3">
                            {[{ label: "Bank says", val: iss.bank }, { label: "Ledger says", val: iss.ledger }].map(({ label, val }) => (
                              <div key={label} className="bg-gray-50 px-3 py-2">
                                <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">{label}</div>
                                <div className="text-xs font-medium text-gray-700 leading-snug">{val}</div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Plain-English explanation */}
                        <p className="text-sm text-gray-500 leading-relaxed mb-4">{iss.plain}</p>

                        {done ? (
                          <span className="text-xs text-emerald-600 font-semibold">Done</span>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => resolve(iss.id)}
                              className="px-4 py-2 bg-gray-900 text-white text-xs font-semibold hover:bg-gray-700 transition-colors">
                              {iss.action}
                            </button>
                            <button onClick={() => resolve(iss.id)}
                              className="px-4 py-2 border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                              Mark for follow-up
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ─── STEP 5: Report ─── */}
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
                  <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-3">
                    April 2026 is reconciled
                  </h1>
                  <p className="text-gray-500 text-sm sm:text-[15px] max-w-md mx-auto">
                    7 out of 9 bank transactions matched your ledger. 2 entries are flagged for follow-up.
                    Your books are ready to close.
                  </p>
                </motion.div>

                {/* Big numbers */}
                <div className="grid grid-cols-3 gap-px bg-gray-100 border border-gray-100 mb-6">
                  {[
                    { val: "7 / 9",   lbl: "Transactions matched", sub: "2 need follow-up"     },
                    { val: `${AVG_CONF}%`, lbl: "Match confidence",  sub: "Across all matches"  },
                    { val: "4",       lbl: "Issues reviewed",       sub: "All resolved"         },
                  ].map(({ val, lbl, sub }) => (
                    <div key={lbl} className="bg-white p-4 sm:p-5 text-center">
                      <div className="text-lg sm:text-xl font-semibold font-mono text-gray-900">{val}</div>
                      <div className="text-xs font-medium text-gray-600 mt-0.5">{lbl}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>
                    </div>
                  ))}
                </div>

                {/* What matched */}
                <div className="border border-gray-100 mb-6">
                  <div className="px-4 py-3 border-b border-gray-50">
                    <span className="text-sm font-semibold text-gray-700">How matches were found</span>
                  </div>
                  {[
                    { label: "Perfect match — same amount and date",      count: MATCHES.filter(m => m.quality === "perfect").length },
                    { label: "Close match — same amount, date off by 1",  count: MATCHES.filter(m => m.quality === "close").length   },
                    { label: "Amount match — date differed significantly", count: MATCHES.filter(m => m.quality === "amount").length  },
                    { label: "No match found",                            count: MISSING.length                                       },
                  ].map(({ label, count }) => (
                    <div key={label} className="flex items-center justify-between gap-4 px-4 py-3 border-b border-gray-50 last:border-0">
                      <div className="text-sm text-gray-500">{label}</div>
                      <div className="font-semibold text-gray-900 shrink-0">{count}</div>
                    </div>
                  ))}
                </div>

                <Callout>
                  In production, you would connect your bank feed and ledger directly. Addup runs this automatically
                  every period so you never do it manually.
                </Callout>

                <div className="flex flex-col sm:flex-row items-center gap-3 mt-8">
                  <button
                    onClick={generatePDF}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gray-900 text-white px-7 h-11 text-sm font-semibold hover:bg-gray-700 transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    Download PDF report
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

/* ─────────────────────────────────────────────
   SMALL COMPONENTS
───────────────────────────────────────────── */
function StepLabel({ n }: { n: number }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-4">
      Step {n} of 5
    </p>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-500 leading-relaxed">
      <span className="font-semibold text-gray-600">Note: </span>{children}
    </div>
  );
}
