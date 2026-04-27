import React from "react";
import { motion } from "framer-motion";

const accountingTools = [
  { name: "Xero", style: "font-bold tracking-tight" },
  { name: "QuickBooks", style: "font-semibold tracking-tight" },
  { name: "Sage", style: "font-bold italic tracking-tight" },
  { name: "Wave", style: "font-bold tracking-tight" },
  { name: "Zoho Books", style: "font-semibold tracking-tight" },
  { name: "FreshBooks", style: "font-semibold tracking-tight" },
];

const banks = [
  { name: "Standard Bank", style: "font-semibold tracking-tight" },
  { name: "FNB", style: "font-bold tracking-wider" },
  { name: "Absa", style: "font-bold tracking-tight" },
  { name: "Nedbank", style: "font-semibold tracking-tight" },
  { name: "Capitec", style: "font-semibold tracking-tight" },
  { name: "Stripe", style: "font-bold tracking-tight" },
];

export function IntegrationLogos() {
  return (
    <section
      id="trust-layer"
      className="relative py-20 sm:py-28 bg-muted/40 overflow-hidden"
    >
      <div className="relative mx-auto max-w-6xl px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 backdrop-blur px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary"></span>
            Trust layer
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-foreground mb-4">
            Connects to the tools your books already live in.
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground font-normal">
            Your accounting software. Your bank. Your payment processor.
          </p>
        </div>

        {/* Accounting platforms */}
        <LogoRow label="Accounting platforms" items={accountingTools} delayBase={0} />

        {/* Divider */}
        <div className="my-8 sm:my-10 h-px w-full bg-gradient-to-r from-transparent via-border to-transparent" />

        {/* Banks & payments */}
        <LogoRow label="Banks & payments" items={banks} delayBase={0.15} />
      </div>
    </section>
  );
}

function LogoRow({
  label,
  items,
  delayBase,
}: {
  label: string;
  items: { name: string; style: string }[];
  delayBase: number;
}) {
  return (
    <div>
      <div className="text-center mb-5 sm:mb-6">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
          {label}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {items.map((item, i) => (
          <motion.div
            key={item.name}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.4, delay: delayBase + i * 0.05 }}
            className="group h-16 sm:h-20 rounded-2xl border border-border/40 bg-background/70 backdrop-blur flex items-center justify-center px-3 transition-all hover:border-border hover:bg-background hover:shadow-[0_10px_30px_-10px_rgba(0,0,0,0.1)] hover:-translate-y-0.5"
          >
            <span
              className={`text-base sm:text-lg text-muted-foreground/80 group-hover:text-foreground transition-colors ${item.style}`}
            >
              {item.name}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
