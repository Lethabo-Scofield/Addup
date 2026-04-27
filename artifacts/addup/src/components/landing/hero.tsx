import React from "react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { HeroVisual } from "./hero-visual";

export function Hero() {
  const scrollToHowItWorks = () => {
    document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToWaitlist = () => {
    document.getElementById("waitlist")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative overflow-hidden pt-16 pb-16 sm:pt-24 sm:pb-20 md:pt-32 md:pb-28">
      {/* Background — soft Apple-style halo */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,_var(--tw-gradient-stops))] from-primary/12 via-background to-background" />
      <div className="pointer-events-none absolute top-10 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-primary/8 blur-[120px] rounded-full" />

      <div className="mx-auto max-w-5xl px-6 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-center max-w-4xl mx-auto"
        >
          {/* Eyebrow pill */}
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 backdrop-blur px-3 py-1 text-[12px] font-medium text-muted-foreground mb-6 sm:mb-8">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Built for African finance teams
          </div>

          <h1 className="text-[2.5rem] leading-[1.05] sm:text-6xl md:text-7xl lg:text-[5.25rem] lg:leading-[1.02] font-semibold text-foreground mb-5 sm:mb-7">
            Close your books<br className="hidden sm:block" />
            <span className="bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text text-transparent">in minutes, not days.</span>
          </h1>

          <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground leading-snug max-w-xl mx-auto mb-8 sm:mb-10 font-normal">
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
              className="group inline-flex items-center gap-1.5 text-[15px] font-medium text-primary hover:text-primary/80 transition-colors h-12 px-2"
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
