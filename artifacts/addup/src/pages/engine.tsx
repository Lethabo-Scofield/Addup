import React, { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, AlertCircle, Check, FileText, Upload,
  Download, X, ArrowRight, ArrowLeft, ChevronRight,
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

type StepId = "upload" | "read" | "match" | "review" | "report";

const STEPS: { id: StepId; label: string; desc: string }[] = [
  { id: "upload", label: "Upload",  desc: "Add your files"          },
  { id: "read",   label: "Read",    desc: "Parse & normalize"        },
  { id: "match",  label: "Match",   desc: "Compare transactions"     },
  { id: "review", label: "Review",  desc: "Resolve flagged items"    },
  { id: "report", label: "Report",  desc: "Export reconciliation"    },
];

const DATE_FORMATS = [
  { raw: "2026-04-01",    norm: "2026-04-01", note: "Standard — no change"     },
  { raw: "01/04/2026",    norm: "2026-04-01", note: "Day/Month/Year"            },
  { raw: "07-04-2026",    norm: "2026-04-07", note: "Dash-separated"            },
  { raw: '"09 Apr 2026"', norm: "2026-04-09", note: "Written month"             },
  { raw: "4/5/2026",      norm: "2026-04-05", note: "Short US format"           },
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
  { id: "B-003", desc: "Coffee Shop, Downtown",  amt:    -4.50, why: "No ledger entry found for this amount on this date."          },
  { id: "B-008", desc: "Wire Transfer Incoming", amt: 10000.00, why: "Large credit in the bank — nothing recorded in the ledger."  },
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
  return `${n < 0 ? "−" : "+"}R\u00a0${abs}`;
}

function qualityChip(q: "perfect" | "close" | "amount") {
  if (q === "perfect") return { label: "Perfect match", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (q === "close")   return { label: "Off by 1 day",  cls: "bg-blue-50 text-blue-700 border-blue-200"         };
  return                { label: "Amount match",        cls: "bg-amber-50 text-amber-700 border-amber-200"      };
}

// ── Sidebar step indicator ────────────────────────────────────────────────────

function StepNode({ n, status }: { n: number; status: "done" | "active" | "pending" }) {
  if (status === "done") return (
    <span className="w-7 h-7 flex items-center justify-center bg-emerald-500 shrink-0">
      <Check className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
    </span>
  );
  if (status === "active") return (
    <span className="w-7 h-7 flex items-center justify-center bg-gray-900 shrink-0">
      <span className="text-white text-xs font-bold">{n}</span>
    </span>
  );
  return (
    <span className="w-7 h-7 flex items-center justify-center border border-gray-200 shrink-0">
      <span className="text-gray-300 text-xs font-medium">{n}</span>
    </span>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Engine() {
  const [loading,  setLoading]  = useState(true);
  const [step,     setStep]     = useState(0);
  const [filter,   setFilter]   = useState<"all" | "clean" | "flagged">("all");
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLoaderDone = useCallback(() => setLoading(false), []);
  const resolve = (id: string) => setResolved(p => new Set([...p, id]));

  const stepId = STEPS[step].id;
  const isLast = step === STEPS.length - 1;

  const visibleMatches =
    filter === "clean"   ? MATCHES.filter(m => m.flags.length === 0) :
    filter === "flagged" ? MATCHES.filter(m => m.flags.length  >  0) : MATCHES;

  function generatePDF() {
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
    y = secLabel("How matches were found", y);
    ([
      ["Perfect match — same amount and date", MATCHES.filter(m=>m.quality==="perfect").length],
      ["Close match — same amount, date off by 1", MATCHES.filter(m=>m.quality==="close").length],
      ["Amount match — date differed significantly", MATCHES.filter(m=>m.quality==="amount").length],
      ["No match found", MISSING.length],
    ] as [string,number][]).forEach(([l,c])=>{
      doc.setFontSize(9); doc.setTextColor(90,90,90); doc.text(l,col,y);
      doc.setTextColor(17,17,17); doc.setFont("helvetica","bold"); right(String(c),y,9); doc.setFont("helvetica","normal"); y+=6;
    });
    y+=4; hline(y); y+=8;
    y = secLabel("Transaction matches", y);
    const cw=[28,60,38,25,22];
    doc.setFontSize(7.5); doc.setTextColor(120,120,120); doc.setFont("helvetica","bold");
    let cx=col;
    ["Bank ID","Description","Amount","Confidence","Result"].forEach((h,i)=>{doc.text(h,cx,y);cx+=cw[i];});
    doc.setFont("helvetica","normal"); y+=1.5; hline(y); y+=4;
    doc.setFontSize(8.5);
    MATCHES.forEach(m=>{
      cx=col;
      doc.setTextColor(90,90,90); doc.text(m.bank.id,cx,y); cx+=cw[0];
      doc.setTextColor(17,17,17); doc.text(m.bank.desc.slice(0,28),cx,y); cx+=cw[1];
      doc.text(fmtAmt(m.bank.amt).replace("−","-").replace("\u00a0"," "),cx,y); cx+=cw[2];
      doc.setTextColor(90,90,90); doc.text(`${m.conf}%`,cx,y); cx+=cw[3];
      doc.text(m.quality==="perfect"?"Perfect":m.quality==="close"?"Close":"Amount",cx,y); y+=5.5;
    });
    MISSING.forEach(m=>{
      cx=col;
      doc.setTextColor(90,90,90); doc.text(m.id,cx,y); cx+=cw[0];
      doc.setTextColor(200,80,80); doc.text(m.desc.slice(0,28),cx,y); cx+=cw[1];
      doc.text(fmtAmt(m.amt).replace("−","-").replace("\u00a0"," "),cx,y); cx+=cw[2];
      doc.setTextColor(200,80,80); doc.text("—",cx,y); cx+=cw[3]; doc.text("No match",cx,y); y+=5.5;
    });
    y+=4; hline(y); y+=8;
    y = secLabel("Issues flagged", y);
    doc.setFontSize(8.5);
    ISSUES.forEach(iss=>{
      if(y>260){doc.addPage();y=20;}
      doc.setTextColor(17,17,17); doc.setFont("helvetica","bold"); doc.text(iss.title,col,y); y+=5;
      doc.setFont("helvetica","normal"); doc.setTextColor(90,90,90);
      const w=doc.splitTextToSize(iss.plain,W-margin*2);
      doc.text(w,col,y); y+=w.length*4.5+4;
    });
    y+=2; hline(y); y+=8;
    doc.setFontSize(7.5); doc.setTextColor(160,160,160);
    doc.text(`Generated by Addup on ${new Date().toISOString()}`,col,y); right("addup.co",y,7.5);
    doc.save("addup-reconciliation-april-2026.pdf");
  }

  // ── Sidebar content ──────────────────────────────────────────────────────

  const SidebarInner = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-100">
        <Link href="/" onClick={() => setSidebarOpen(false)}>
          <img src={addupLogo} alt="Addup" className="h-6 w-auto" />
        </Link>
        <p className="text-[10px] text-gray-400 mt-1.5 font-medium uppercase tracking-widest">
          Reconciliation
        </p>
      </div>

      {/* Period badge */}
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500 font-medium">Period</span>
          <span className="text-xs font-semibold text-gray-900 bg-gray-100 px-2 py-0.5">April 2026</span>
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-500 font-medium">Status</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 border ${
            isLast ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                   : "bg-amber-50 text-amber-700 border-amber-200"
          }`}>
            {isLast ? "Complete" : "In progress"}
          </span>
        </div>
      </div>

      {/* Steps */}
      <nav className="flex-1 px-4 py-5 space-y-1 overflow-y-auto">
        {STEPS.map((s, i) => {
          const status = i < step ? "done" : i === step ? "active" : "pending";
          const canClick = i <= step;
          return (
            <button
              key={s.id}
              onClick={() => { if (canClick) { setStep(i); setSidebarOpen(false); }}}
              disabled={!canClick}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors group
                ${status === "active"
                  ? "bg-gray-50 border-l-2 border-gray-900"
                  : canClick
                    ? "hover:bg-gray-50 border-l-2 border-transparent"
                    : "border-l-2 border-transparent opacity-50 cursor-default"
                }`}
            >
              <StepNode n={i + 1} status={status} />
              <div className="min-w-0">
                <div className={`text-sm font-semibold leading-tight ${
                  status === "active" ? "text-gray-900"
                  : status === "done" ? "text-gray-500"
                  : "text-gray-300"
                }`}>{s.label}</div>
                <div className="text-[11px] text-gray-400 leading-tight mt-0.5">{s.desc}</div>
              </div>
            </button>
          );
        })}
      </nav>

      {/* Live summary (shows after match step) */}
      {step >= 2 && (
        <div className="px-6 py-4 border-t border-gray-100 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Run summary</p>
          {[
            { lbl: "Bank entries",   val: "9",    cls: "text-gray-900" },
            { lbl: "Matched",        val: "7",    cls: "text-emerald-600" },
            { lbl: "Unmatched",      val: "2",    cls: "text-amber-600"  },
            { lbl: "Issues",         val: `${ISSUES.length - resolved.size} left`, cls: resolved.size === ISSUES.length ? "text-emerald-600" : "text-red-500" },
            { lbl: "Avg confidence", val: `${AVG_CONF}%`, cls: "text-gray-900" },
          ].map(({ lbl, val, cls }) => (
            <div key={lbl} className="flex items-center justify-between">
              <span className="text-xs text-gray-400">{lbl}</span>
              <span className={`text-xs font-semibold font-mono ${cls}`}>{val}</span>
            </div>
          ))}
        </div>
      )}

      {/* Exit */}
      <div className="px-6 py-4 border-t border-gray-100">
        <Link href="/" className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-700 transition-colors">
          <X className="h-3.5 w-3.5" />
          Exit reconciliation
        </Link>
      </div>
    </div>
  );

  return (
    <>
      <AnimatePresence>
        {loading && <EngineLoader onDone={handleLoaderDone} />}
      </AnimatePresence>

      <div className="flex h-[100svh] bg-white overflow-hidden">

        {/* ── Desktop sidebar ── */}
        <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r border-gray-100 h-full overflow-hidden">
          <SidebarInner />
        </aside>

        {/* ── Mobile sidebar overlay ── */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-black/20 lg:hidden"
                onClick={() => setSidebarOpen(false)}
              />
              <motion.aside
                initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="fixed left-0 top-0 bottom-0 z-50 w-64 bg-white border-r border-gray-100 lg:hidden overflow-y-auto"
              >
                <SidebarInner />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* ── Main content ── */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

          {/* Mobile topbar */}
          <div className="lg:hidden flex items-center justify-between px-4 h-14 border-b border-gray-100 shrink-0">
            <button onClick={() => setSidebarOpen(true)} className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <img src={addupLogo} alt="Addup" className="h-5 w-auto" />
            </button>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">{step + 1} / {STEPS.length}</span>
              <Link href="/" className="text-gray-400 hover:text-gray-700">
                <X className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-[2px] bg-gray-100 shrink-0">
            <motion.div className="h-full bg-gray-900"
              animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>

          {/* Scrollable content */}
          <main className="flex-1 overflow-y-auto">
            <AnimatePresence mode="wait">
              <motion.div key={step}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="min-h-full"
              >
                <div className="max-w-2xl mx-auto px-6 py-10 sm:py-14">

                  {/* ── STEP 1: Upload ── */}
                  {stepId === "upload" && (
                    <>
                      <StepMeta n={1} title="Upload your two files"
                        sub="Addup needs your bank statement and your accounting ledger — then it compares them automatically."
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                        {[
                          { label: "Bank Statement",  file: "bank.csv",   rows: 19, size: "4.2 KB",
                            note: "FNB Business · April 2026",  tip: "Export from your online banking portal." },
                          { label: "General Ledger",  file: "ledger.csv", rows: 11, size: "2.8 KB",
                            note: "Xero export · April 2026",    tip: "Export from Xero, QuickBooks, or Sage." },
                        ].map((f) => (
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
                    </>
                  )}

                  {/* ── STEP 2: Read ── */}
                  {stepId === "read" && (
                    <>
                      <StepMeta n={2} title="Files read successfully"
                        sub="19 bank transactions and 11 ledger entries found. All dates were standardized to one format so comparisons are accurate."
                      />
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
                        {[["19","Bank transactions"],["11","Ledger entries"],["5","Date formats"],["0","Invalid rows"]].map(([v,l])=>(
                          <StatCard key={l} val={v} label={l} />
                        ))}
                      </div>
                      <SectionLabel>Date formats recognized automatically</SectionLabel>
                      <div className="border border-gray-100 mb-8">
                        <div className="grid grid-cols-3 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                          {["In your file","Format","Converted to"].map(h=>(
                            <span key={h} className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{h}</span>
                          ))}
                        </div>
                        {DATE_FORMATS.map((r,i)=>(
                          <div key={i} className="grid grid-cols-3 px-4 py-3 border-b border-gray-50 last:border-0 items-center">
                            <span className="font-mono text-[11px] text-gray-500">{r.raw}</span>
                            <span className="text-xs text-gray-400">{r.note}</span>
                            <span className="font-mono text-xs text-gray-900 font-medium flex items-center gap-1.5">
                              <Check className="h-3 w-3 text-emerald-500 shrink-0" />{r.norm}
                            </span>
                          </div>
                        ))}
                      </div>
                      <Note>Your files don't need consistent formatting. Addup handles mixed date styles, extra columns, and different delimiters automatically.</Note>
                    </>
                  )}

                  {/* ── STEP 3: Match ── */}
                  {stepId === "match" && (
                    <>
                      <StepMeta n={3} title="Comparing bank vs. ledger"
                        sub="Every bank entry is compared against the ledger using three passes — exact, fuzzy, then amount-only."
                      />

                      {/* Summary row */}
                      <div className="grid grid-cols-3 gap-px bg-gray-100 border border-gray-100 mb-6">
                        {[
                          { val:"7", lbl:"Matched",        cls:"text-emerald-600" },
                          { val:`${AVG_CONF}%`, lbl:"Avg confidence", cls:"text-gray-900" },
                          { val:"2", lbl:"No match found", cls:"text-amber-600" },
                        ].map(({val,lbl,cls})=>(
                          <div key={lbl} className="bg-white px-4 py-4 text-center">
                            <div className={`text-xl font-bold font-mono ${cls}`}>{val}</div>
                            <div className="text-[11px] text-gray-400 mt-0.5">{lbl}</div>
                          </div>
                        ))}
                      </div>

                      {/* Legend */}
                      <div className="flex flex-wrap gap-2 mb-5">
                        {[
                          { cls:"bg-emerald-50 text-emerald-700 border-emerald-200", lbl:"Perfect — same amount + date" },
                          { cls:"bg-blue-50 text-blue-700 border-blue-200",         lbl:"Off by 1 day" },
                          { cls:"bg-amber-50 text-amber-700 border-amber-200",      lbl:"Amount match only" },
                        ].map(({cls,lbl})=>(
                          <span key={lbl} className={`text-[10px] font-semibold px-2 py-1 border ${cls}`}>{lbl}</span>
                        ))}
                      </div>

                      {/* Filter tabs */}
                      <div className="flex border border-gray-100 mb-5">
                        {(["all","clean","flagged"] as const).map(f=>(
                          <button key={f} onClick={()=>setFilter(f)}
                            className={`flex-1 h-9 text-xs font-medium transition-colors border-r border-gray-100 last:border-0
                              ${filter===f ? "bg-gray-900 text-white" : "text-gray-400 hover:bg-gray-50"}`}
                          >
                            {f==="all"?`All (${MATCHES.length})`:f==="clean"?`Clean (${MATCHES.filter(m=>m.flags.length===0).length})`:`Flagged (${MATCHES.filter(m=>m.flags.length>0).length})`}
                          </button>
                        ))}
                      </div>

                      {/* Match list */}
                      <div className="border border-gray-100 divide-y divide-gray-50">
                        {visibleMatches.map((m) => {
                          const qc = qualityChip(m.quality);
                          return (
                            <div key={m.bank.id} className="p-4">
                              <div className="flex items-start justify-between gap-3 mb-3">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap gap-1.5 mb-1.5">
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 border ${qc.cls}`}>{qc.label}</span>
                                    {m.flags.map(f=>(
                                      <span key={f} className="text-[10px] font-medium px-1.5 py-0.5 border bg-gray-50 text-gray-500 border-gray-200">{f}</span>
                                    ))}
                                  </div>
                                  <div className="text-sm font-semibold text-gray-900">{m.bank.desc}</div>
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="text-sm font-mono font-bold text-gray-900">{fmtAmt(m.bank.amt)}</div>
                                  <div className="text-[10px] text-gray-400 mt-0.5">{m.conf}% confidence</div>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {[{label:"Bank",date:m.bank.date,desc:m.bank.desc},{label:"Ledger",date:m.ledger.date,desc:m.ledger.desc}].map(({label,date,desc})=>(
                                  <div key={label} className="bg-gray-50 px-3 py-2">
                                    <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">{label}</div>
                                    <div className="text-xs font-semibold text-gray-700">{date}</div>
                                    <div className="text-xs text-gray-400 truncate">{desc}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}

                        {(filter==="all"||filter==="flagged") && MISSING.map(m=>(
                          <div key={m.id} className="p-4 bg-amber-50/30">
                            <div className="flex items-start justify-between gap-3 mb-1">
                              <div className="min-w-0">
                                <span className="text-[10px] font-bold px-1.5 py-0.5 border bg-amber-50 text-amber-700 border-amber-200 inline-block mb-1.5">Not in ledger</span>
                                <div className="text-sm font-semibold text-gray-900">{m.desc}</div>
                              </div>
                              <span className="font-mono text-sm font-bold text-gray-900 shrink-0">{fmtAmt(m.amt)}</span>
                            </div>
                            <p className="text-xs text-gray-400">{m.why}</p>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {/* ── STEP 4: Review ── */}
                  {stepId === "review" && (
                    <>
                      <div className="flex items-end justify-between gap-4 mb-8">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Step 4 of 5</p>
                          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">
                            {ISSUES.length} items need attention
                          </h1>
                          <p className="text-gray-500 text-sm mt-2 leading-relaxed">
                            Everything else matched cleanly. Read each one and decide what to do.
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-2xl font-bold font-mono text-gray-900">{resolved.size}<span className="text-gray-300">/{ISSUES.length}</span></div>
                          <div className="text-[10px] text-gray-400 font-medium">resolved</div>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="h-1.5 bg-gray-100 mb-8">
                        <motion.div className="h-full bg-emerald-500"
                          animate={{ width: `${(resolved.size/ISSUES.length)*100}%` }}
                          transition={{ duration: 0.4 }}
                        />
                      </div>

                      <div className="space-y-3">
                        {ISSUES.map((iss) => {
                          const done = resolved.has(iss.id);
                          return (
                            <motion.div key={iss.id} layout
                              className={`border transition-all duration-200 ${done ? "border-gray-100 opacity-40" : "border-gray-100"}`}
                            >
                              <div className="p-4 sm:p-5">
                                <div className="flex items-start justify-between gap-3 mb-3">
                                  <div className="flex items-start gap-2.5 min-w-0">
                                    {done
                                      ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                                      : <AlertCircle  className="h-4 w-4 text-amber-400 shrink-0 mt-0.5"   />}
                                    <div className="min-w-0">
                                      <div className="text-sm font-bold text-gray-900 leading-snug">{iss.title}</div>
                                      <div className="font-mono text-[10px] text-gray-400 mt-0.5">{iss.id}</div>
                                    </div>
                                  </div>
                                  <span className="font-mono text-sm font-bold text-gray-900 shrink-0">{fmtAmt(iss.amt)}</span>
                                </div>

                                {iss.kind !== "missing" && (
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
                                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                                    <Check className="h-3.5 w-3.5" /> Done
                                  </span>
                                ) : (
                                  <div className="flex flex-wrap gap-2">
                                    <button onClick={()=>resolve(iss.id)}
                                      className="px-4 h-9 bg-gray-900 text-white text-xs font-bold hover:bg-gray-700 transition-colors flex items-center gap-1.5">
                                      <Check className="h-3 w-3" />{iss.action}
                                    </button>
                                    <button onClick={()=>resolve(iss.id)}
                                      className="px-4 h-9 border border-gray-200 text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors">
                                      Mark for follow-up
                                    </button>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {/* ── STEP 5: Report ── */}
                  {stepId === "report" && (
                    <>
                      {/* Hero */}
                      <motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}}
                        transition={{duration:0.35,ease:[0.16,1,0.3,1]}}
                        className="flex flex-col items-center text-center mb-12"
                      >
                        <div className="w-14 h-14 bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-5">
                          <CheckCircle2 className="h-7 w-7 text-emerald-500" />
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">April 2026 is reconciled</h1>
                        <p className="text-gray-500 text-sm max-w-sm">
                          7 out of 9 bank transactions matched your ledger.
                          2 entries are flagged for follow-up. Your books are ready to close.
                        </p>
                      </motion.div>

                      {/* Stats grid */}
                      <div className="grid grid-cols-3 gap-px bg-gray-100 border border-gray-100 mb-6">
                        {[
                          {val:"7 / 9",       lbl:"Matched",        sub:"2 need follow-up"},
                          {val:`${AVG_CONF}%`, lbl:"Avg confidence", sub:"Across all matches"},
                          {val:"4",           lbl:"Issues reviewed", sub:"All actioned"},
                        ].map(({val,lbl,sub})=>(
                          <div key={lbl} className="bg-white px-3 py-4 text-center">
                            <div className="text-lg font-bold font-mono text-gray-900">{val}</div>
                            <div className="text-xs font-semibold text-gray-600 mt-0.5">{lbl}</div>
                            <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>
                          </div>
                        ))}
                      </div>

                      {/* Match breakdown */}
                      <div className="border border-gray-100 mb-6">
                        <div className="px-4 py-3 border-b border-gray-50 bg-gray-50">
                          <span className="text-xs font-bold uppercase tracking-widest text-gray-500">How matches were found</span>
                        </div>
                        {[
                          {lbl:"Perfect match — same amount and date",      val:MATCHES.filter(m=>m.quality==="perfect").length, cls:"text-emerald-600"},
                          {lbl:"Close match — same amount, date off by 1",  val:MATCHES.filter(m=>m.quality==="close").length,   cls:"text-blue-600"},
                          {lbl:"Amount match — date differed significantly", val:MATCHES.filter(m=>m.quality==="amount").length,  cls:"text-amber-600"},
                          {lbl:"No match found",                            val:MISSING.length,                                  cls:"text-red-500"},
                        ].map(({lbl,val,cls})=>(
                          <div key={lbl} className="flex items-center justify-between gap-4 px-4 py-3 border-b border-gray-50 last:border-0">
                            <span className="text-sm text-gray-500">{lbl}</span>
                            <span className={`font-mono text-sm font-bold shrink-0 ${cls}`}>{val}</span>
                          </div>
                        ))}
                      </div>

                      <Note>
                        In production, your bank feed and ledger connect directly. Addup runs this automatically every period — no manual work required.
                      </Note>

                      <div className="flex flex-col sm:flex-row gap-3 mt-8">
                        <button onClick={generatePDF}
                          className="inline-flex items-center justify-center gap-2 bg-gray-900 text-white px-6 h-11 text-sm font-bold hover:bg-gray-700 transition-colors"
                        >
                          <Download className="h-4 w-4" />
                          Download PDF report
                        </button>
                        <Link href="/">
                          <button className="w-full sm:w-auto inline-flex items-center justify-center h-11 px-6 text-sm font-medium text-gray-400 border border-gray-200 hover:border-gray-300 hover:text-gray-700 transition-colors">
                            Back to home
                          </button>
                        </Link>
                      </div>
                    </>
                  )}

                  {/* ── Navigation buttons ── */}
                  {!isLast && (
                    <div className="flex items-center justify-between mt-12 pt-8 border-t border-gray-100">
                      <button
                        onClick={()=>setStep(s=>Math.max(s-1,0))}
                        disabled={step===0}
                        className="inline-flex items-center gap-2 h-10 px-5 text-sm font-medium text-gray-400 border border-gray-200 hover:text-gray-700 hover:border-gray-300 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                      >
                        <ArrowLeft className="h-4 w-4" /> Back
                      </button>
                      <button
                        onClick={()=>setStep(s=>Math.min(s+1,STEPS.length-1))}
                        className="inline-flex items-center gap-2 h-10 px-6 bg-gray-900 text-white text-sm font-bold hover:bg-gray-700 transition-colors"
                      >
                        {step===3?"Generate report":"Continue"}
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
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

// ── Small components ──────────────────────────────────────────────────────────

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
