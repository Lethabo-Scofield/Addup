import React from "react";
import { Nav } from "@/components/landing/nav";
import { Hero } from "@/components/landing/hero";
import { TrustStrip } from "@/components/landing/trust-strip";
import { NarrativeBlocks } from "@/components/landing/narrative-blocks";
import { HowItWorks } from "@/components/landing/how-it-works";
import { ProductPreview } from "@/components/landing/product-preview";
import { UseCases } from "@/components/landing/use-cases";
import { TargetMarket } from "@/components/landing/target-market";
import { News } from "@/components/landing/news";
import { WaitlistSection } from "@/components/landing/waitlist-section";
import { Footer } from "@/components/landing/footer";

export default function Landing() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background selection:bg-primary/10">
      <Nav />
      <main className="flex-1">
        <Hero />
        <TrustStrip />
        <NarrativeBlocks />
        <HowItWorks />
        <ProductPreview />
        <TargetMarket />
        <UseCases />
        <News />
        <WaitlistSection />
      </main>
      <Footer />
    </div>
  );
}
