import React from "react";
import { motion } from "framer-motion";

export function TrustStrip() {
  const labels = [
    "Bank feeds",
    "Accounting systems",
    "Invoices",
    "Audit logs",
  ];

  return (
    <section className="py-14 sm:py-20">
      <div className="mx-auto max-w-5xl px-6 lg:px-8">
        <div className="flex flex-col items-center text-center">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-base sm:text-lg text-muted-foreground/90 max-w-xl mb-8 sm:mb-10 font-normal"
          >
            One source of truth across every system you already use.
          </motion.p>

          <div className="flex flex-wrap justify-center items-center gap-x-8 sm:gap-x-12 gap-y-4">
            {labels.map((label, i) => (
              <React.Fragment key={label}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                  className="text-sm font-medium tracking-tight text-foreground/60"
                >
                  {label}
                </motion.div>
                {i < labels.length - 1 && (
                  <div className="hidden sm:block h-1 w-1 rounded-full bg-border" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
