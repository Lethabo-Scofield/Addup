import React from "react";

import { Nav } from "@/components/landing/nav";
import { Hero } from "@/components/landing/hero";
import { LogoMarquee } from "@/components/landing/logo-marquee";
import { NarrativeBlocks } from "@/components/landing/narrative-blocks";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Integrations } from "@/components/landing/integrations";
import { UseCases } from "@/components/landing/use-cases";
import { TargetMarket } from "@/components/landing/target-market";
import { News } from "@/components/landing/news";
import { Footer } from "@/components/landing/footer";
import { WaitlistProvider } from "@/components/landing/waitlist-dialog";

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background px-3 sm:px-5 lg:px-6 py-2 sm:py-3">
      <div className="mx-auto bg-[#f5f5f7] rounded-[28px] sm:rounded-[40px] overflow-hidden">
        {children}
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <WaitlistProvider>
      <div className="flex min-h-[100dvh] flex-col bg-background selection:bg-primary/10">
        <Nav />
        <main className="flex-1">
          <Hero />
          <LogoMarquee />
          <Panel>
            <NarrativeBlocks />
          </Panel>
          <HowItWorks />
          <Integrations />
          <TargetMarket />
          <Panel>
            <UseCases />
          </Panel>
          <News />
        </main>
        <Footer />
      </div>
    </WaitlistProvider>
  );
}
