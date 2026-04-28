import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

function VisualPreventBadData() {
  return (
    <div className="relative w-full aspect-[4/3] rounded-[2rem] bg-card border border-border/40 shadow-[0_15px_50px_-15px_rgba(0,0,0,0.1)] overflow-hidden p-6 sm:p-8 flex flex-col justify-center">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-red-500/5 via-transparent to-transparent pointer-events-none" />
      <div className="space-y-4 relative z-10">
        <motion.div
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="bg-background rounded-lg border border-red-500/20 p-3 shadow-sm flex items-center gap-3 relative"
        >
          <div className="h-8 w-8 rounded bg-red-500/10 flex items-center justify-center text-red-500 text-xs font-bold">ERR</div>
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-24 bg-foreground/10 rounded"></div>
            <div className="h-2 w-16 bg-red-500/20 rounded"></div>
          </div>
          <div className="text-sm font-mono text-muted-foreground">$--</div>
        </motion.div>

        <div className="flex justify-center text-muted-foreground/30">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
        </div>

        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-background rounded-lg border border-emerald-500/20 p-3 shadow-sm flex items-center gap-3"
        >
          <div className="h-8 w-8 rounded bg-emerald-500/10 flex items-center justify-center text-emerald-600 text-xs font-bold">OK</div>
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-32 bg-foreground/20 rounded"></div>
            <div className="h-2 w-20 bg-muted-foreground/20 rounded"></div>
          </div>
          <div className="text-sm font-mono font-medium">R 4,250.00</div>
        </motion.div>
      </div>
    </div>
  );
}

function VisualMatchIntelligently() {
  return (
    <div className="relative w-full aspect-[4/3] rounded-[2rem] bg-card border border-border/40 shadow-[0_15px_50px_-15px_rgba(0,0,0,0.1)] overflow-hidden p-6 sm:p-8 flex items-center justify-center">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,_var(--tw-gradient-stops))] from-blue-500/5 via-transparent to-transparent pointer-events-none" />
      <div className="relative w-full max-w-[280px]">
        <div className="bg-background rounded-lg border border-border p-3 shadow-sm mb-16 relative z-10 w-[70%]">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Invoice INV-2023</div>
          <div className="text-sm font-mono font-medium">R 1,200.00</div>
        </div>

        <svg className="absolute top-10 left-[20%] w-[60%] h-20 pointer-events-none z-0" overflow="visible">
          <motion.path
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, ease: "easeInOut" }}
            d="M 0,0 C 0,40 100,20 100,80"
            fill="none" stroke="currentColor" className="text-blue-500/50" strokeWidth="2" strokeDasharray="4 4"
          />
          <motion.path
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, ease: "easeInOut", delay: 0.2 }}
            d="M 0,0 C 0,40 -50,30 -50,90"
            fill="none" stroke="currentColor" className="text-indigo-500/50" strokeWidth="2" strokeDasharray="4 4"
          />
        </svg>

        <div className="absolute top-12 right-0 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold px-2 py-0.5 rounded-full border border-blue-500/20 z-20">94% match</div>
        <div className="absolute top-16 -left-8 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold px-2 py-0.5 rounded-full border border-indigo-500/20 z-20">88% match</div>

        <div className="flex gap-4 justify-end relative z-10">
          <div className="bg-background rounded-lg border border-border p-3 shadow-sm w-1/2">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Stripe</div>
            <div className="text-sm font-mono font-medium">R 1,164.00</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function VisualResolve() {
  return (
    <div className="relative w-full aspect-[4/3] rounded-[2rem] bg-card border border-border/40 shadow-[0_15px_50px_-15px_rgba(0,0,0,0.1)] overflow-hidden p-6 sm:p-8 flex flex-col justify-center items-center">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-amber-500/5 via-transparent to-transparent pointer-events-none" />
      <div className="relative w-full max-w-[280px]">
        <div className="absolute top-0 left-4 right-4 h-full bg-background rounded-xl border border-border/40 shadow-sm transform -translate-y-4 scale-95 opacity-50"></div>
        <div className="absolute top-0 left-2 right-2 h-full bg-background rounded-xl border border-border/60 shadow-sm transform -translate-y-2 scale-[0.98] opacity-75"></div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="relative bg-background rounded-xl border border-border shadow-md overflow-hidden z-10"
        >
          <div className="p-4 border-b border-border/50">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded">Needs review</span>
              <span className="text-xs text-muted-foreground">1 of 12</span>
            </div>
            <div className="text-sm font-medium">Unlinked Payment</div>
            <div className="text-lg font-mono mt-1">R 8,450.00</div>
          </div>
          <div className="grid grid-cols-2 gap-px bg-border/50">
            <button className="bg-background py-2 text-xs font-medium hover:bg-muted transition-colors text-emerald-600">Accept</button>
            <button className="bg-background py-2 text-xs font-medium hover:bg-muted transition-colors">Split</button>
            <button className="bg-background py-2 text-xs font-medium hover:bg-muted transition-colors">Link</button>
            <button className="bg-background py-2 text-xs font-medium hover:bg-muted transition-colors text-muted-foreground">Investigate</button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function VisualExplain() {
  return (
    <div className="relative w-full aspect-[4/3] rounded-[2rem] bg-card border border-border/40 shadow-[0_15px_50px_-15px_rgba(0,0,0,0.1)] overflow-hidden p-6 sm:p-8 flex flex-col justify-center">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent pointer-events-none" />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-background rounded-xl border border-border shadow-sm p-5 relative z-10"
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
          <h4 className="text-sm font-semibold">Audit Trail</h4>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          Matched because <span className="text-foreground font-medium">amount</span>, <span className="text-foreground font-medium">date proximity</span>, <span className="text-foreground font-medium">vendor pattern</span>, and <span className="text-foreground font-medium">reference similarity</span> aligned.
        </p>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-medium bg-muted border border-border/50">Amount: Exact</span>
          <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-medium bg-muted border border-border/50">Date: ±1 day</span>
          <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-medium bg-muted border border-border/50">Ref: 0.89 sim</span>
        </div>
      </motion.div>
    </div>
  );
}

const blocks = [
  {
    id: "block-1",
    eyebrow: "Data Quality",
    label: "Prevent",
    heading: "Stop bad data at the source.",
    copy: "Catches duplicates, missing references, and bad vendor names before they hit your ledger.",
    Visual: VisualPreventBadData,
  },
  {
    id: "block-2",
    eyebrow: "Reconciliation",
    label: "Match",
    heading: "Match with confidence, not rigidity.",
    copy: "Confidence-based matching across payments, invoices, and bank lines.",
    Visual: VisualMatchIntelligently,
  },
  {
    id: "block-3",
    eyebrow: "Workflows",
    label: "Resolve",
    heading: "Focus on exceptions, not the rule.",
    copy: "Skip the hundreds of clean lines. Review only what needs you.",
    Visual: VisualResolve,
  },
  {
    id: "block-4",
    eyebrow: "Compliance",
    label: "Explain",
    heading: "Leave a clear trail for auditors.",
    copy: "Every match carries a reason, a source, and an audit-ready note.",
    Visual: VisualExplain,
  },
];

export function NarrativeBlocks() {
  const [active, setActive] = useState(0);
  const block = blocks[active];
  const Visual = block.Visual;

  return (
    <section className="py-16 sm:py-24 bg-transparent">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-foreground mb-4">
            Four layers, one clean ledger.
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground">
            Tap a layer to see how Addup handles it.
          </p>
        </div>

        {/* Tab strip */}
        <div className="flex justify-center mb-10 sm:mb-12 -mx-6 px-6 overflow-x-auto scrollbar-none">
          <div className="inline-flex items-center gap-1 p-1 rounded-full border border-border/60 bg-muted/40 shrink-0">
            {blocks.map((b, i) => (
              <button
                key={b.id}
                onClick={() => setActive(i)}
                className={`relative px-4 sm:px-5 h-9 sm:h-10 text-[13px] sm:text-sm font-medium rounded-full transition-colors whitespace-nowrap ${
                  active === i
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {active === i && (
                  <motion.div
                    layoutId="narrativeActiveTab"
                    className="absolute inset-0 bg-background rounded-full shadow-sm border border-border/60"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="relative">{b.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Active panel */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 sm:gap-14 items-center min-h-[360px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${block.id}-copy`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="md:order-1"
            >
              <div className="inline-flex items-center rounded-full border border-border/60 bg-muted/40 px-2.5 py-0.5 text-[11px] font-medium tracking-wide uppercase text-muted-foreground mb-4">
                {block.eyebrow}
              </div>
              <h3 className="text-2xl sm:text-3xl lg:text-[2.25rem] lg:leading-[1.15] font-semibold text-foreground mb-4">
                {block.heading}
              </h3>
              <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
                {block.copy}
              </p>

              {/* Progress dots */}
              <div className="mt-8 flex items-center gap-2">
                {blocks.map((b, i) => (
                  <button
                    key={`dot-${b.id}`}
                    onClick={() => setActive(i)}
                    aria-label={`Go to ${b.label}`}
                    className={`h-1.5 rounded-full transition-all ${
                      active === i ? "w-8 bg-primary" : "w-1.5 bg-border hover:bg-muted-foreground/40"
                    }`}
                  />
                ))}
              </div>
            </motion.div>
          </AnimatePresence>

          <AnimatePresence mode="wait">
            <motion.div
              key={`${block.id}-visual`}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="md:order-2"
            >
              <Visual />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
