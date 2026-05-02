import React from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import heroBg from "@assets/a-chosen-soul-Cp4xHgvXt0M-unsplash_1777332357410.jpg";

export function Hero() {
  const scrollToHowItWorks = () => {
    document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative overflow-hidden min-h-[100svh] flex items-center pt-28 pb-16 sm:pt-32 sm:pb-20 md:pt-36 md:pb-24 bg-black">
      {/* Background image */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-center bg-no-repeat bg-cover"
        style={{ backgroundImage: `url(${heroBg})` }}
      />
      <div className="pointer-events-none absolute inset-0 bg-black/50" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,_transparent_0%,_rgba(0,0,0,0.5)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" />

      <div className="mx-auto max-w-4xl px-6 lg:px-8 relative z-10 w-full text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <h1 className="text-[2.75rem] leading-[1.05] sm:text-5xl md:text-[4rem] lg:text-[5rem] lg:leading-[1.02] font-semibold text-white mb-8 sm:mb-10">
            Close your books{" "}
            <span className="bg-gradient-to-b from-white to-white/50 bg-clip-text text-transparent">
              in minutes, not days.
            </span>
          </h1>

          <button
            onClick={scrollToHowItWorks}
            className="group inline-flex items-center gap-1.5 text-[15px] font-medium text-white hover:text-white/80 transition-colors h-12"
          >
            See how it works
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </motion.div>
      </div>
    </section>
  );
}
