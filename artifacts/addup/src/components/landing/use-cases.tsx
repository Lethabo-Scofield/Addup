import React from "react";
import { motion } from "framer-motion";

export function UseCases() {
  const cards = [
    {
      title: "Finance teams",
      pain: "Spending week one of every month hunting down loose receipts and untangling messy bank feeds.",
      outcome: "Close the books by day two with a clean, fully-matched ledger."
    },
    {
      title: "Accountants",
      pain: "Wasting billable hours playing middleman between client systems and the general ledger.",
      outcome: "Focus on advisory while infrastructure handles the ingestion and formatting."
    },
    {
      title: "SMEs",
      pain: "Relying on manual spreadsheets that break as transaction volume scales.",
      outcome: "Scale operations without needing to immediately hire a larger back office."
    },
    {
      title: "Multi-entity businesses",
      pain: "Consolidating books across different subsidiaries, currencies, and disconnected banking portals.",
      outcome: "Unify all transaction flows into one standardized, auditable queue."
    }
  ];

  return (
    <section className="py-20 sm:py-32 bg-background">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-14 sm:mb-20">
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-foreground mb-5">
            Built for complexity.
          </h2>
          <p className="text-lg sm:text-xl text-muted-foreground font-normal">
            Whether you're closing a single entity or consolidating ten, Addup restores order to your financial data.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
          {cards.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="bg-card rounded-[2rem] p-8 sm:p-10 border border-border/40 hover:border-border transition-all relative overflow-hidden group hover:shadow-[0_20px_60px_-20px_rgba(0,0,0,0.12)]"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <h3 className="text-2xl font-semibold text-foreground mb-6 relative z-10">{card.title}</h3>
              <div className="space-y-5 relative z-10">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-2">Before</span>
                  <p className="text-[15px] text-foreground/70 leading-relaxed">{card.pain}</p>
                </div>
                <div className="h-px w-full bg-border/60" />
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-primary block mb-2">With Addup</span>
                  <p className="text-[15px] font-medium text-foreground leading-relaxed">{card.outcome}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
