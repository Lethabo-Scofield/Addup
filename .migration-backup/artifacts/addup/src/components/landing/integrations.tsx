import React from "react";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import hubImage from "@assets/hub.png";

const points = [
  {
    title: "Bank statement to balance.",
    body: "Pulls bank statements. Matches your ledger. Closes the variance.",
  },
  {
    title: "No re-keying. No exports.",
    body: "Writes straight back into Xero, QuickBooks, or Sage.",
  },
  {
    title: "Status at a glance.",
    body: "Every line marked matched, flagged, or under review.",
  },
];

export function Integrations() {
  return (
    <section id="integrations" className="relative py-16 sm:py-24 overflow-hidden bg-muted/40">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent pointer-events-none" />

      <div className="relative mx-auto max-w-6xl px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 sm:gap-14 items-center">
          {/* Copy */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="order-2 lg:order-1"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 backdrop-blur px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary"></span>
              Works with your stack
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] lg:leading-[1.05] font-semibold text-foreground mb-4">
              Connects to everything your books already live in.
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground leading-snug mb-7">
              Addup sits between your bank, your accounting platform, and your payment processor, reconciled to the cent.
            </p>

            <ul className="space-y-4">
              {points.map((p) => (
                <li key={p.title} className="flex gap-3">
                  <div className="shrink-0 mt-0.5 h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-foreground mb-0.5">{p.title}</div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{p.body}</p>
                  </div>
                </li>
              ))}
            </ul>

            {/* Trust line */}
            <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
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

          {/* Hub diagram */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="order-1 lg:order-2 relative"
          >
            <div className="absolute -inset-4 sm:-inset-8 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/20 via-primary/5 to-transparent blur-2xl pointer-events-none" />
            <img
              src={hubImage}
              alt="Addup connecting accounting tools, bank feeds, and payment processors"
              loading="lazy"
              className="relative w-full h-auto block"
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
