import React from "react";
import { motion } from "framer-motion";
import { CheckCircle2, ArrowLeftRight, ShieldCheck } from "lucide-react";

const entities = [
  { city: "Lagos", currency: "NGN", flag: "NG", status: "Closed Apr", state: "ok" },
  { city: "Nairobi", currency: "KES", flag: "KE", status: "Closed Apr", state: "ok" },
  { city: "Johannesburg", currency: "ZAR", flag: "ZA", status: "Closed Apr", state: "ok" },
  { city: "Accra", currency: "GHS", flag: "GH", status: "In review", state: "warn" },
];

const currencies = ["ZAR", "NGN", "KES", "USD", "GBP", "EUR", "GHS", "+5"];

export function UseCases() {
  return (
    <section className="py-16 sm:py-24 bg-transparent">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
          <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.16em] text-primary mb-4">
            Multi-entity
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-foreground mb-4 tracking-tight">
            Built for complexity.
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground leading-snug">
            One entity or ten. Addup keeps every book in order, across currencies,
            jurisdictions, and time zones.
          </p>
        </div>

        {/* Bento grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 lg:auto-rows-[minmax(0,1fr)] gap-4 sm:gap-5">
          {/* HERO: Entity tree */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-7 lg:row-span-3 relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#0b0d12] via-[#10141c] to-[#0b0d12] text-white p-7 sm:p-9 min-h-[420px] flex flex-col"
          >
            {/* subtle grid bg */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.06]"
              style={{
                backgroundImage:
                  "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
                backgroundSize: "32px 32px",
              }}
            />
            {/* glow */}
            <div className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-primary/25 blur-3xl" />

            <div className="relative z-10">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">
                Group consolidation
              </span>
              <h3 className="text-xl sm:text-2xl font-semibold mt-2">
                Pan-Africa Holdings
              </h3>
              <p className="text-sm text-white/55 mt-1">
                4 entities · 4 currencies · 1 close
              </p>
            </div>

            {/* Tree */}
            <div className="relative z-10 mt-8 sm:mt-10 flex-1 flex flex-col">
              {/* Group node */}
              <div className="flex justify-center">
                <div className="rounded-2xl bg-white/[0.06] border border-white/10 backdrop-blur px-5 py-3 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-white/50">
                    Group HQ
                  </div>
                  <div className="text-sm font-semibold mt-0.5">Pan-Africa Holdings</div>
                </div>
              </div>

              {/* Connector lines via SVG */}
              <svg
                aria-hidden
                viewBox="0 0 400 60"
                preserveAspectRatio="none"
                className="w-full h-10 sm:h-12 mt-2 text-white/20"
              >
                <path
                  d="M200 0 V20 M50 50 V35 H350 V50 M125 50 V40 M275 50 V40"
                  stroke="currentColor"
                  strokeWidth="1"
                  fill="none"
                />
              </svg>

              {/* Entity row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                {entities.map((e, i) => (
                  <motion.div
                    key={e.city}
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.15 + i * 0.07 }}
                    className="rounded-xl bg-white/[0.04] border border-white/10 px-3 py-3"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
                        {e.flag}
                      </span>
                      <span className="text-[10px] font-mono text-white/55">
                        {e.currency}
                      </span>
                    </div>
                    <div className="text-[13px] font-semibold leading-tight">
                      {e.city}
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <span
                        className={`inline-block h-1.5 w-1.5 rounded-full ${
                          e.state === "ok" ? "bg-emerald-400" : "bg-amber-400"
                        }`}
                      />
                      <span className="text-[10px] text-white/55">{e.status}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Multi-currency */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-5 rounded-[24px] bg-card border border-border/50 p-6 sm:p-7 hover:shadow-[0_20px_60px_-20px_rgba(0,0,0,0.1)] transition-shadow"
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-5 w-5" strokeWidth={2.2} />
              </div>
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Currency
                </span>
                <h3 className="text-lg font-semibold text-foreground mt-0.5">
                  12 currencies, one truth
                </h3>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Daily FX rates with gains and losses auto-posted to the right account.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {currencies.map((c) => (
                <span
                  key={c}
                  className="text-[11px] font-mono font-semibold px-2 py-1 rounded-md bg-muted text-foreground/70"
                >
                  {c}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Intercompany */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-5 rounded-[24px] bg-card border border-border/50 p-6 sm:p-7 hover:shadow-[0_20px_60px_-20px_rgba(0,0,0,0.1)] transition-shadow"
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <ArrowLeftRight className="h-5 w-5" strokeWidth={2.2} />
              </div>
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Intercompany
                </span>
                <h3 className="text-lg font-semibold text-foreground mt-0.5">
                  Auto-netting and elimination
                </h3>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Match cross-entity transactions instantly. Clean group accounts every time.
            </p>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono px-2 py-1 rounded-md bg-muted text-foreground/70">
                NG · Lagos
              </span>
              <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px] font-mono px-2 py-1 rounded-md bg-muted text-foreground/70">
                ZA · Joburg
              </span>
              <span className="ml-auto text-[11px] font-semibold text-emerald-600">
                Matched
              </span>
            </div>
          </motion.div>

          {/* Audit trail */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-5 rounded-[24px] bg-card border border-border/50 p-6 sm:p-7 hover:shadow-[0_20px_60px_-20px_rgba(0,0,0,0.1)] transition-shadow"
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <ShieldCheck className="h-5 w-5" strokeWidth={2.2} />
              </div>
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Audit
                </span>
                <h3 className="text-lg font-semibold text-foreground mt-0.5">
                  Every change, signed
                </h3>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Reviewer, timestamp, and before-after on every line. Export-ready for
              SARS, FRC, and KRA.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
