import React from "react";
import standardbank from "@assets/banks/standardbank.png";
import fnb from "@assets/banks/fnb.png";
import absa from "@assets/banks/absa.png";
import nedbank from "@assets/banks/nedbank.png";
import capitec from "@assets/banks/capitec.png";
import gtbank from "@assets/banks/gtbank.png";
import equity from "@assets/banks/equity.png";
import ecobank from "@assets/banks/ecobank.png";

type Logo = {
  name: string;
  src: string;
  height?: number;
};

const banks: Logo[] = [
  { name: "Standard Bank", src: standardbank, height: 40 },
  { name: "FNB", src: fnb, height: 38 },
  { name: "Absa", src: absa, height: 40 },
  { name: "Nedbank", src: nedbank, height: 34 },
  { name: "Capitec", src: capitec, height: 36 },
  { name: "GTBank", src: gtbank, height: 38 },
  { name: "Equity Bank", src: equity, height: 38 },
  { name: "Ecobank", src: ecobank, height: 36 },
];

const platforms: Logo[] = [
  { name: "Stripe", src: "https://cdn.simpleicons.org/stripe/635BFF", height: 40 },
  { name: "Visa", src: "https://cdn.simpleicons.org/visa/1A1F71", height: 30 },
  { name: "Mastercard", src: "https://cdn.simpleicons.org/mastercard/EB001B", height: 40 },
  { name: "PayPal", src: "https://cdn.simpleicons.org/paypal/003087", height: 38 },
  { name: "Xero", src: "https://cdn.simpleicons.org/xero/13B5EA", height: 44 },
  { name: "QuickBooks", src: "https://cdn.simpleicons.org/quickbooks/2CA01C", height: 40 },
  { name: "Sage", src: "https://cdn.simpleicons.org/sage/00DC06", height: 36 },
  { name: "Shopify", src: "https://cdn.simpleicons.org/shopify/7AB55C", height: 40 },
];

function MarqueeRow({
  items,
  reverse = false,
  ariaLabel,
}: {
  items: Logo[];
  reverse?: boolean;
  ariaLabel: string;
}) {
  const doubled = [...items, ...items];
  return (
    <div className="group relative overflow-hidden">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 sm:w-32 bg-gradient-to-r from-background to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 sm:w-32 bg-gradient-to-l from-background to-transparent z-10" />

      <div
        className={`flex w-max items-center gap-16 sm:gap-24 ${reverse ? "animate-marquee-reverse" : "animate-marquee"}`}
        aria-label={ariaLabel}
      >
        {doubled.map((logo, i) => (
          <div
            key={`${logo.name}-${i}`}
            className="shrink-0"
            title={logo.name}
          >
            <img
              src={logo.src}
              alt={logo.name}
              loading="lazy"
              decoding="async"
              className="block w-auto select-none object-contain"
              style={{ height: `${logo.height ?? 36}px` }}
              draggable={false}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function LogoMarquee() {
  return (
    <section className="relative py-12 sm:py-16 border-y border-border/50 bg-background">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="text-center mb-10 sm:mb-12">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Trusted partners
          </span>
        </div>

        <div className="space-y-9 sm:space-y-12">
          <MarqueeRow items={banks} ariaLabel="African banks Addup connects to" />
          <MarqueeRow items={platforms} reverse ariaLabel="Payment and accounting platforms Addup connects to" />
        </div>
      </div>
    </section>
  );
}
