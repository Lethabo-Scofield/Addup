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
    <section className="py-24 bg-background">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl mb-4">
            Built for complexity.
          </h2>
          <p className="text-lg text-muted-foreground">
            Whether you're closing a single entity or consolidating ten, Addup restores order to your financial data.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {cards.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="bg-card rounded-2xl p-8 border border-border/60 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <h3 className="text-xl font-bold text-foreground mb-4 relative z-10">{card.title}</h3>
              <div className="space-y-4 relative z-10">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">Before</span>
                  <p className="text-sm text-foreground/80 leading-relaxed">{card.pain}</p>
                </div>
                <div className="h-px w-full bg-border/50" />
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-primary block mb-1">With Addup</span>
                  <p className="text-sm font-medium text-foreground leading-relaxed">{card.outcome}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
