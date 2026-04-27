import React from "react";
import { motion } from "framer-motion";

export function TrustStrip() {
  const labels = [
    "Bank feeds",
    "Accounting systems",
    "Invoices",
    "Audit logs"
  ];

  return (
    <section className="py-12 border-y border-border/40 bg-muted/20">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="flex flex-col items-center text-center">
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-sm font-medium text-muted-foreground mb-6"
          >
            Built for finance teams that need cleaner books, faster closes, and fewer reconciliation surprises.
          </motion.p>
          
          <div className="flex flex-wrap justify-center items-center gap-x-8 gap-y-4">
            {labels.map((label, i) => (
              <React.Fragment key={label}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  className="flex items-center text-sm font-semibold tracking-tight text-foreground/70"
                >
                  {label}
                </motion.div>
                {i < labels.length - 1 && (
                  <div className="hidden sm:block h-4 w-px bg-border" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
