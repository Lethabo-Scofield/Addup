import React from "react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import heroBg from "@assets/a-chosen-soul-Cp4xHgvXt0M-unsplash_1777332357410.jpg";
import heroMockup from "@assets/image_1777334043100.png";
import { useWaitlist } from "./waitlist-dialog";

export function Hero() {
  const { open: openWaitlist } = useWaitlist();
  const scrollToHowItWorks = () => {
    document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative overflow-hidden pt-32 pb-16 sm:pt-36 sm:pb-20 md:pt-40 md:pb-24 bg-black">
      {/* Background image */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-center bg-no-repeat bg-cover"
        style={{ backgroundImage: `url(${heroBg})` }}
      />
      {/* Subtle darken for text contrast */}
      <div className="pointer-events-none absolute inset-0 bg-black/40" />
      {/* Vignette + fade to page background at the bottom */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,_transparent_0%,_rgba(0,0,0,0.45)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" />

      <div className="mx-auto max-w-6xl px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-center">
          {/* Left: text */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-6 text-center lg:text-left"
          >
            <h1 className="text-[2.5rem] leading-[1.05] sm:text-5xl md:text-6xl lg:text-[4.25rem] lg:leading-[1.02] font-semibold text-white mb-8 sm:mb-10">
              Close your books{" "}
              <span className="bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
                in minutes, not days.
              </span>
            </h1>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start items-center">
              <Button
                onClick={openWaitlist}
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

          {/* Right: product mockup */}
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-6 relative"
          >
            <div className="relative mx-auto lg:mx-0 max-w-lg lg:max-w-none">
              {/* Soft glow behind the mockup */}
              <div
                aria-hidden
                className="absolute -inset-6 sm:-inset-10 rounded-[3rem] bg-primary/20 blur-3xl opacity-60 pointer-events-none"
              />
              <img
                src={heroMockup}
                alt="Addup dashboard showing a business bank account being reconciled"
                className="relative w-full h-auto select-none drop-shadow-[0_30px_60px_rgba(0,0,0,0.45)]"
                draggable={false}
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
