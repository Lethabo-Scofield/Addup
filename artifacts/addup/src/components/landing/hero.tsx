import React from "react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { HeroVisual } from "./hero-visual";
import heroBg from "@assets/a-chosen-soul-Cp4xHgvXt0M-unsplash_1777332357410.jpg";

export function Hero() {
  const scrollToHowItWorks = () => {
    document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToWaitlist = () => {
    document.getElementById("waitlist")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative overflow-hidden pt-32 pb-16 sm:pt-40 sm:pb-20 md:pt-48 md:pb-28 bg-black">
      {/* Background image */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-center bg-no-repeat bg-cover"
        style={{ backgroundImage: `url(${heroBg})` }}
      />
      {/* Subtle darken for text contrast */}
      <div className="pointer-events-none absolute inset-0 bg-black/35" />
      {/* Vignette + fade to page background at the bottom */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,_transparent_0%,_rgba(0,0,0,0.45)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" />

      <div className="mx-auto max-w-5xl px-6 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-center max-w-4xl mx-auto"
        >
          {/* Eyebrow pill */}
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 backdrop-blur px-3 py-1 text-[12px] font-medium text-white/80 mb-6 sm:mb-8">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Built for African finance teams
          </div>

          <h1 className="text-[2.5rem] leading-[1.05] sm:text-6xl md:text-7xl lg:text-[5.25rem] lg:leading-[1.02] font-semibold text-white mb-5 sm:mb-7">
            Close your books<br className="hidden sm:block" />
            <span className="bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">in minutes, not days.</span>
          </h1>

          <p className="text-lg sm:text-xl md:text-2xl text-white/70 leading-snug max-w-xl mx-auto mb-8 sm:mb-10 font-normal">
            Clean books. Matched bank feeds. Audit-ready in one click.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center">
            <Button
              onClick={scrollToWaitlist}
              className="rounded-full h-12 px-7 text-[15px] font-medium w-full sm:w-auto shadow-none"
            >
              Join the waitlist
            </Button>
            <button
              onClick={scrollToHowItWorks}
              className="group inline-flex items-center gap-1.5 text-[15px] font-medium text-white hover:text-white/80 transition-colors h-12 px-2"
            >
              See how it works
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </motion.div>

        {/* Product hero visual */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="relative mt-14 sm:mt-20 mx-auto max-w-3xl"
        >
          <HeroVisual />
        </motion.div>
      </div>
    </section>
  );
}
