import React from "react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { HeroVisual } from "./hero-visual";

export function Hero() {
  const scrollToHowItWorks = () => {
    document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToWaitlist = () => {
    document.getElementById("waitlist")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative overflow-hidden pt-24 pb-16 md:pt-32 md:pb-24">
      {/* Background gradients */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/10 via-background to-background" />
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/5 blur-[100px] rounded-full" />

      <div className="mx-auto max-w-6xl px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-2xl"
          >
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground mb-6 leading-[1.1]">
              Close your books in minutes, not days.
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground mb-8 leading-relaxed max-w-lg">
              Addup cleans, matches, and verifies financial data so finance teams review decisions instead of chasing transactions.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" onClick={scrollToWaitlist} className="h-12 px-8 text-base shadow-sm">
                Join the waitlist
              </Button>
              <Button size="lg" variant="outline" onClick={scrollToHowItWorks} className="h-12 px-8 text-base bg-background/50 backdrop-blur-sm border-border/50 hover:bg-accent/50">
                See how it works
              </Button>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative lg:h-[500px] flex items-center justify-center"
          >
            <HeroVisual />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
