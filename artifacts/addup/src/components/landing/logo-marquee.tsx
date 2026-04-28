import React from "react";
import standardbank from "@assets/banks/standardbank.png";
import fnb from "@assets/banks/fnb.png";
import absa from "@assets/banks/absa.png";
import nedbank from "@assets/banks/nedbank.png";
import capitec from "@assets/banks/capitec.png";
import tymebank from "@assets/banks/tymebank.png";
import discovery from "@assets/banks/discovery.png";
import investec from "@assets/banks/investec.png";
import gtbank from "@assets/banks/gtbank.png";
import zenith from "@assets/banks/zenith.png";
import equity from "@assets/banks/equity.png";
import kcb from "@assets/banks/kcb.png";
import ecobank from "@assets/banks/ecobank.png";
import kuda from "@assets/banks/kuda.png";
import paystack from "@assets/banks/paystack.png";
import flutterwave from "@assets/banks/flutterwave.png";

type Logo = {
  name: string;
  src: string;
  height?: number;
};

const banks: Logo[] = [
  { name: "Standard Bank", src: standardbank, height: 30 },
  { name: "FNB", src: fnb, height: 28 },
  { name: "Absa", src: absa, height: 30 },
  { name: "Nedbank", src: nedbank, height: 24 },
  { name: "Capitec", src: capitec, height: 26 },
  { name: "TymeBank", src: tymebank, height: 28 },
  { name: "Discovery Bank", src: discovery, height: 28 },
  { name: "Investec", src: investec, height: 22 },
  { name: "GTBank", src: gtbank, height: 28 },
  { name: "Zenith Bank", src: zenith, height: 26 },
  { name: "Equity Bank", src: equity, height: 28 },
  { name: "KCB", src: kcb, height: 26 },
  { name: "Ecobank", src: ecobank, height: 26 },
  { name: "Kuda", src: kuda, height: 26 },
  { name: "Paystack", src: paystack, height: 26 },
  { name: "Flutterwave", src: flutterwave, height: 26 },
];

const platforms: Logo[] = [
  { name: "Stripe", src: "https://cdn.simpleicons.org/stripe/635BFF", height: 30 },
  { name: "PayPal", src: "https://cdn.simpleicons.org/paypal/003087", height: 28 },
  { name: "Adyen", src: "https://cdn.simpleicons.org/adyen/0ABF53", height: 26 },
  { name: "Mastercard", src: "https://cdn.simpleicons.org/mastercard/EB001B", height: 30 },
  { name: "Visa", src: "https://cdn.simpleicons.org/visa/1A1F71", height: 22 },
  { name: "Wise", src: "https://cdn.simpleicons.org/wise/163300", height: 26 },
  { name: "Xero", src: "https://cdn.simpleicons.org/xero/13B5EA", height: 34 },
  { name: "QuickBooks", src: "https://cdn.simpleicons.org/quickbooks/2CA01C", height: 30 },
  { name: "Sage", src: "https://cdn.simpleicons.org/sage/00DC06", height: 26 },
  { name: "Shopify", src: "https://cdn.simpleicons.org/shopify/7AB55C", height: 30 },
  { name: "Google Sheets", src: "https://cdn.simpleicons.org/googlesheets/34A853", height: 28 },
  { name: "HubSpot", src: "https://cdn.simpleicons.org/hubspot/FF7A59", height: 28 },
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
        className={`flex w-max items-center gap-12 sm:gap-16 ${reverse ? "animate-marquee-reverse" : "animate-marquee"}`}
        aria-label={ariaLabel}
      >
        {doubled.map((logo, i) => (
          <div
            key={`${logo.name}-${i}`}
            className="shrink-0 opacity-70 hover:opacity-100 transition-opacity duration-300"
            title={logo.name}
          >
            <img
              src={logo.src}
              alt={logo.name}
              loading="lazy"
              decoding="async"
              className="block w-auto select-none object-contain"
              style={{ height: `${logo.height ?? 28}px` }}
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
    <section className="relative py-10 sm:py-14 border-y border-border/50 bg-background">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="text-center mb-8 sm:mb-10">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Trusted partners
          </span>
        </div>

        <div className="space-y-7 sm:space-y-9">
          <MarqueeRow items={banks} ariaLabel="African banks Addup connects to" />
          <MarqueeRow items={platforms} reverse ariaLabel="Payment and accounting platforms Addup connects to" />
        </div>
      </div>
    </section>
  );
}
