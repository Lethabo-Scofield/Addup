import React from "react";

const logos = [
  { name: "Sable", style: "font-bold tracking-tight" },
  { name: "Northwind", style: "font-semibold tracking-tight" },
  { name: "Helio", style: "font-bold italic tracking-tight" },
  { name: "Marula", style: "font-semibold tracking-wide" },
  { name: "Baobab Co", style: "font-bold tracking-tight" },
  { name: "Veld", style: "font-bold tracking-tight uppercase" },
  { name: "Lumen", style: "font-semibold tracking-tight" },
  { name: "Tide & Co", style: "font-medium tracking-tight" },
  { name: "Astra", style: "font-bold tracking-tight" },
  { name: "Karoo", style: "font-semibold italic tracking-tight" },
  { name: "Halo Group", style: "font-semibold tracking-tight" },
  { name: "Indlovu", style: "font-bold tracking-tight" },
];

export function LogoMarquee() {
  // Duplicate the list so the marquee can loop seamlessly
  const items = [...logos, ...logos];

  return (
    <section className="relative py-14 sm:py-20 border-y border-border/50 bg-background">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="text-center mb-8 sm:mb-10">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Trusted by finance teams across Africa
          </span>
        </div>

        <div className="group relative overflow-hidden">
          {/* Edge fades */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-16 sm:w-32 bg-gradient-to-r from-background to-transparent z-10" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-16 sm:w-32 bg-gradient-to-l from-background to-transparent z-10" />

          <div
            className="flex w-max items-center gap-12 sm:gap-16 animate-marquee"
            aria-hidden="true"
          >
            {items.map((logo, i) => (
              <div
                key={`${logo.name}-${i}`}
                className="shrink-0 text-xl sm:text-2xl text-muted-foreground/70 hover:text-foreground transition-colors"
              >
                <span className={logo.style}>{logo.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
