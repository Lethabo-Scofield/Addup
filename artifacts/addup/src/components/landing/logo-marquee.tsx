import React from "react";

type Logo = {
  name: string;
  slug: string;
  color: string;
  height?: number;
};

const logos: Logo[] = [
  { name: "Stripe", slug: "stripe", color: "635BFF", height: 30 },
  { name: "PayPal", slug: "paypal", color: "003087", height: 28 },
  { name: "Adyen", slug: "adyen", color: "0ABF53", height: 26 },
  { name: "Mastercard", slug: "mastercard", color: "EB001B", height: 30 },
  { name: "Visa", slug: "visa", color: "1A1F71", height: 22 },
  { name: "Wise", slug: "wise", color: "163300", height: 26 },
  { name: "Xero", slug: "xero", color: "13B5EA", height: 34 },
  { name: "QuickBooks", slug: "quickbooks", color: "2CA01C", height: 30 },
  { name: "Sage", slug: "sage", color: "00DC06", height: 26 },
  { name: "Shopify", slug: "shopify", color: "7AB55C", height: 30 },
  { name: "Google Sheets", slug: "googlesheets", color: "34A853", height: 28 },
  { name: "HubSpot", slug: "hubspot", color: "FF7A59", height: 28 },
];

export function LogoMarquee() {
  // Duplicate the list so the marquee can loop seamlessly.
  const items = [...logos, ...logos];

  return (
    <section className="relative py-10 sm:py-14 border-y border-border/50 bg-background">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="text-center mb-8 sm:mb-10">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Trusted by finance teams across Africa
          </span>
        </div>

        <div className="group relative overflow-hidden">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-16 sm:w-32 bg-gradient-to-r from-background to-transparent z-10" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-16 sm:w-32 bg-gradient-to-l from-background to-transparent z-10" />

          <div
            className="flex w-max items-center gap-12 sm:gap-16 animate-marquee"
            aria-label="Tools and platforms used by finance teams"
          >
            {items.map((logo, i) => (
              <div
                key={`${logo.name}-${i}`}
                className="shrink-0 opacity-70 hover:opacity-100 transition-opacity duration-300"
                title={logo.name}
              >
                <img
                  src={`https://cdn.simpleicons.org/${logo.slug}/${logo.color}`}
                  alt={logo.name}
                  loading="lazy"
                  decoding="async"
                  className="block w-auto select-none"
                  style={{ height: `${logo.height ?? 28}px` }}
                  draggable={false}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
