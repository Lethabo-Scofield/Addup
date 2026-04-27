import React from "react";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import integrationImage from "@assets/image_1777329495911.png";

const points = [
  {
    title: "Bank statement to balance.",
    body: "Pull statements straight from the bank, match them to entries in Xero, QuickBooks, or Sage, and watch the variance close to R 0.00.",
  },
  {
    title: "No re-keying, no exports.",
    body: "Addup writes back into the accounting system you already use — your team keeps its workflow, just without the manual reconciliation.",
  },
  {
    title: "Confidence at a glance.",
    body: "Every line carries a status — matched, flagged, or under review — so you always know exactly where the books stand.",
  },
];

export function Integrations() {
  return (
    <section id="integrations" className="relative py-16 sm:py-24 lg:py-28 overflow-hidden bg-background">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent pointer-events-none" />

      <div className="relative mx-auto max-w-6xl px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 sm:gap-12 lg:gap-16 items-center">
          {/* Copy */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="order-2 lg:order-1"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground mb-4 sm:mb-5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary"></span>
              Works with your stack
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground mb-4 sm:mb-5">
              Match your bank. Match your books.
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed mb-6 sm:mb-8">
              Addup sits between your bank feeds and your accounting system, reconciling every transaction down to the cent. When the closing balance lines up, you'll know — instantly.
            </p>

            <ul className="space-y-5 sm:space-y-6">
              {points.map((p) => (
                <li key={p.title} className="flex gap-3 sm:gap-4">
                  <div className="shrink-0 mt-0.5 h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-foreground mb-1">{p.title}</div>
                    <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">{p.body}</p>
                  </div>
                </li>
              ))}
            </ul>

            {/* Trust line */}
            <div className="mt-8 sm:mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Plays nicely with</span>
              <span className="text-foreground/80">Xero</span>
              <span className="h-1 w-1 rounded-full bg-border"></span>
              <span className="text-foreground/80">QuickBooks</span>
              <span className="h-1 w-1 rounded-full bg-border"></span>
              <span className="text-foreground/80">Sage</span>
              <span className="h-1 w-1 rounded-full bg-border"></span>
              <span className="text-foreground/80">Wave</span>
            </div>
          </motion.div>

          {/* Image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="order-1 lg:order-2 relative"
          >
            {/* Glow */}
            <div className="absolute -inset-4 sm:-inset-6 bg-gradient-to-tr from-primary/30 via-primary/15 to-transparent rounded-[2rem] blur-2xl opacity-60 pointer-events-none" />

            {/* Frame */}
            <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden border border-border/60 bg-card shadow-2xl">
              <img
                src={integrationImage}
                alt="Bank statement reconciliation showing matched balances in Xero"
                loading="lazy"
                className="w-full h-auto block"
              />
            </div>

            {/* Floating callout */}
            <div className="absolute -bottom-3 -left-3 sm:-bottom-5 sm:-left-5 bg-background border border-border rounded-xl shadow-xl px-3 py-2 sm:px-4 sm:py-3 flex items-center gap-2 sm:gap-3">
              <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-500" />
              </div>
              <div>
                <div className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground font-semibold">Balances match</div>
                <div className="text-sm sm:text-base font-bold text-foreground font-mono">R 0.00</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
