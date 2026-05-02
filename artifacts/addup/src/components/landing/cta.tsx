import React from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useWaitlist } from "./waitlist-dialog";

export function CTA() {
  const { open } = useWaitlist();

  return (
    <section className="relative py-24 sm:py-32 bg-black overflow-hidden">
      {/* Subtle grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      {/* Glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_60%,_rgba(59,130,246,0.18)_0%,_transparent_100%)]" />

      <div className="relative mx-auto max-w-3xl px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50 mb-5">
            Early access
          </p>
          <h2 className="text-4xl sm:text-5xl lg:text-[3.5rem] lg:leading-[1.06] font-semibold text-white mb-6">
            Ready to reconcile in minutes?
          </h2>
          <p className="text-base sm:text-lg text-white/55 leading-relaxed mb-10 max-w-xl mx-auto">
            Join the waitlist and be first to run reconciliation on your real data. No spreadsheets, no manual matching, no chasing exceptions.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={open}
              className="group inline-flex items-center gap-2 bg-white text-black px-7 h-12 text-[15px] font-semibold hover:bg-white/90 transition-colors"
            >
              Try it
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
            <a
              href="#how-it-works"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="inline-flex items-center h-12 px-7 text-[15px] font-medium text-white/60 hover:text-white border border-white/15 hover:border-white/30 transition-colors"
            >
              See how it works
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
