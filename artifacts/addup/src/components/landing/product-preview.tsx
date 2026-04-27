import React from "react";
import { motion } from "framer-motion";
import { ArrowLeftRight, ReceiptText, Building2, CreditCard } from "lucide-react";
import previewImage from "@assets/image_1777329458934.png";

const featureChips = [
  { icon: ArrowLeftRight, label: "Transfers" },
  { icon: ReceiptText, label: "Statements" },
  { icon: Building2, label: "Banking" },
  { icon: CreditCard, label: "Payments" },
];

export function ProductPreview() {
  return (
    <section id="product" className="relative py-20 sm:py-32 bg-background overflow-hidden">
      {/* Soft background accents */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/8 via-transparent to-transparent" />
      <div className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-primary/5 blur-[120px] rounded-full" />

      <div className="relative mx-auto max-w-6xl px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-14 sm:mb-20">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary"></span>
            Inside Addup
          </div>
          <h2 className="text-4xl sm:text-5xl lg:text-[3.5rem] lg:leading-[1.05] font-semibold text-foreground mb-5">
            One workspace for every reconciliation.
          </h2>
          <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed font-normal">
            See your statements, variances, and exception queue side by side — with AI-driven suggestions guiding every match.
          </p>
        </div>

        {/* Product image */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="relative mx-auto max-w-5xl"
        >
          {/* Glow */}
          <div className="absolute -inset-4 sm:-inset-8 bg-gradient-to-tr from-primary/20 via-primary/10 to-transparent rounded-[2rem] blur-2xl opacity-60 pointer-events-none" />

          {/* Frame */}
          <div className="relative rounded-[1.75rem] sm:rounded-[2rem] border border-border/40 bg-card shadow-[0_30px_90px_-20px_rgba(0,0,0,0.18)] overflow-hidden p-2 sm:p-3">
            <div className="rounded-[1.25rem] sm:rounded-[1.5rem] bg-gradient-to-br from-muted/40 to-background overflow-hidden">
              <img
                src={previewImage}
                alt="Addup workspace showing reconciliation statement, variance analysis, and AI suggestions"
                loading="lazy"
                className="w-full h-auto block"
              />
            </div>
          </div>

          {/* Subtle reflection */}
          <div className="absolute inset-x-12 -bottom-2 h-8 bg-foreground/10 blur-2xl rounded-full opacity-50 pointer-events-none" />
        </motion.div>

        {/* Feature chips */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-10 sm:mt-14 flex flex-wrap items-center justify-center gap-3 sm:gap-4"
        >
          {featureChips.map((chip) => (
            <div
              key={chip.label}
              className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/80 backdrop-blur px-4 py-2 text-sm font-medium text-foreground hover:border-border transition-colors"
            >
              <chip.icon className="h-4 w-4 text-primary" />
              {chip.label}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
