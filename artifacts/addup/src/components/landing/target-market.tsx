import React from "react";
import { motion } from "framer-motion";
import targetImage from "@assets/image_1777329171721.png";

const AFRICA_PATH =
  "M252 38 C 286 28, 326 30, 358 44 C 392 58, 412 84, 426 116 C 442 152, 444 188, 432 222 C 422 252, 410 282, 408 312 C 408 342, 422 372, 432 402 C 442 432, 442 462, 426 488 C 408 516, 376 532, 344 530 C 312 528, 286 510, 264 488 C 240 464, 220 438, 198 418 C 176 398, 150 386, 128 366 C 108 348, 96 322, 96 294 C 96 266, 108 238, 122 212 C 138 184, 158 158, 174 130 C 190 102, 202 74, 222 56 C 232 46, 242 42, 252 38 Z";

export function TargetMarket() {
  return (
    <section id="built-for-africa" className="relative py-16 sm:py-24 lg:py-28 overflow-hidden bg-background">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent pointer-events-none" />
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 sm:gap-12 lg:gap-16 items-center">
          {/* Africa-shaped photo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="relative order-2 lg:order-1 mx-auto w-full max-w-[320px] sm:max-w-[400px] lg:max-w-[460px]"
          >
            <AfricaShapedImage src={targetImage} />
          </motion.div>

          {/* Copy */}
          <div className="order-1 lg:order-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground mb-4 sm:mb-5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary"></span>
              Built for Africa
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground mb-4 sm:mb-5">
              Made for the businesses that move Africa forward.
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed mb-6 sm:mb-8">
              From a single café in Cape Town to a multi-branch retailer in Lagos, Addup is built for African finance teams who need clean books without enterprise overhead. We speak Rand, naira, shilling, and cedi — and every reconciliation rule we ship reflects how local businesses actually trade.
            </p>
            <ul className="space-y-3">
              {[
                "Local bank feeds and mobile-money rails, treated as first-class data sources.",
                "Multi-currency reconciliation that respects how cross-border trade actually happens.",
                "Designed for owners and controllers who wear five hats before lunch.",
              ].map((line) => (
                <li key={line} className="flex items-start gap-3 text-sm text-foreground/80">
                  <svg
                    className="h-5 w-5 flex-shrink-0 text-primary mt-0.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function AfricaShapedImage({ src }: { src: string }) {
  return (
    <div className="relative w-full aspect-[540/600]">
      {/* Soft ambient glow */}
      <div className="absolute -inset-6 bg-gradient-to-br from-primary/15 via-blue-500/10 to-transparent blur-3xl pointer-events-none" />

      <svg
        viewBox="0 0 540 600"
        className="relative w-full h-full drop-shadow-[0_20px_40px_rgba(30,80,180,0.15)]"
        aria-hidden="true"
      >
        <defs>
          <clipPath id="africaClip">
            <path d={AFRICA_PATH} />
          </clipPath>
          <linearGradient id="africaStroke" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#1e40af" stopOpacity="0.55" />
          </linearGradient>
        </defs>

        {/* Image clipped to Africa silhouette */}
        <image
          href={src}
          x="40"
          y="0"
          width="500"
          height="600"
          preserveAspectRatio="xMidYMid slice"
          clipPath="url(#africaClip)"
        />

        {/* Subtle gradient outline */}
        <path
          d={AFRICA_PATH}
          fill="none"
          stroke="url(#africaStroke)"
          strokeWidth="3"
          strokeLinejoin="round"
        />
      </svg>

      {/* Pin marker hovering near the South */}
      <motion.div
        initial={{ y: -6, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.5, duration: 0.5 }}
        className="absolute bottom-[18%] left-[42%] flex items-center gap-2"
      >
        <div className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60"></span>
          <span className="relative inline-flex h-3 w-3 rounded-full bg-primary border-2 border-background shadow-md"></span>
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground bg-background/90 backdrop-blur px-2 py-0.5 rounded border border-border/60 shadow-sm">
          Cape Town
        </span>
      </motion.div>
    </div>
  );
}
