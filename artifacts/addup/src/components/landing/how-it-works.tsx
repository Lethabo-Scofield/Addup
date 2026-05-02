import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type TabId = "capture" | "clean" | "match" | "resolve" | "verify";

interface Tab {
  id: TabId;
  label: string;
}

const tabs: Tab[] = [
  { id: "capture", label: "Capture" },
  { id: "clean", label: "Clean" },
  { id: "match", label: "Match" },
  { id: "resolve", label: "Resolve" },
  { id: "verify", label: "Verify" },
];

export function HowItWorks() {
  const [activeTab, setActiveTab] = useState<TabId>("capture");

  return (
    <section id="how-it-works" className="py-16 sm:py-24 bg-muted/30">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-foreground mb-4">
            How Addup works.
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground">
            Five steps. Zero spreadsheets.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 lg:gap-12">
          {/* Tabs */}
          <div className="lg:col-span-4 -mx-6 px-6 lg:mx-0 lg:px-0 flex flex-row lg:flex-col overflow-x-auto lg:overflow-visible gap-0 pb-4 lg:pb-0 scrollbar-none border-b lg:border-b-0 lg:border-r border-border/40">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center px-5 min-h-11 py-3 text-[14px] font-medium transition-colors whitespace-nowrap lg:whitespace-normal text-left border-b border-border/30 last:border-b-0 ${
                  activeTab === tab.id
                    ? "text-foreground bg-background border-l-2 border-l-primary lg:border-l-2"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* UI Panel */}
          <div className="lg:col-span-8">
            <div className="border border-border/40 bg-card shadow-[0_15px_50px_-15px_rgba(0,0,0,0.12)] overflow-hidden min-h-[420px] sm:h-[400px] flex flex-col">
              {/* Header */}
              <div className="h-10 border-b border-border/50 bg-muted/30 flex items-center px-4 gap-3 shrink-0">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 bg-border"></div>
                  <div className="w-2.5 h-2.5 bg-border"></div>
                  <div className="w-2.5 h-2.5 bg-border"></div>
                </div>
                <div className="text-xs font-mono text-muted-foreground">
                  addup.finance/app
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 p-4 sm:p-6 bg-background relative overflow-y-auto">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <MockPanelContent activeTab={activeTab} />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function MockPanelContent({ activeTab }: { activeTab: TabId }) {
  if (activeTab === "capture") {
    return (
      <div className="space-y-4">
        <div className="text-sm font-semibold mb-4 border-b pb-2">Syncing Data Sources</div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between p-3 border border-border/50 bg-muted/10">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 bg-muted flex items-center justify-center">
                  <div className="w-4 h-4 bg-foreground/20"></div>
                </div>
                <div>
                  <div className="text-sm font-medium">Bank Feed {i}</div>
                  <div className="text-xs text-muted-foreground">Last synced 2m ago</div>
                </div>
              </div>
              <div className="text-xs font-mono bg-emerald-500/10 text-emerald-600 px-2 py-1">Active</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (activeTab === "clean") {
    return (
      <div className="space-y-4">
        <div className="text-sm font-semibold mb-4 border-b pb-2">Standardizing Formats</div>
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full text-left text-sm min-w-[280px]">
            <thead>
              <tr className="text-muted-foreground text-xs uppercase border-b">
                <th className="pb-2 font-medium">Raw Input</th>
                <th className="pb-2 font-medium">Cleaned Output</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              <tr>
                <td className="py-3 pr-2 text-muted-foreground font-mono text-[11px] sm:text-xs break-all">aws_sub_1234_usd</td>
                <td className="py-3 font-medium text-sm">Amazon Web Services</td>
              </tr>
              <tr>
                <td className="py-3 pr-2 text-muted-foreground font-mono text-[11px] sm:text-xs break-all">stripe*inv_4992</td>
                <td className="py-3 font-medium text-sm">Stripe</td>
              </tr>
              <tr>
                <td className="py-3 pr-2 text-muted-foreground font-mono text-[11px] sm:text-xs break-all">ACH // GITHUB // 000</td>
                <td className="py-3 font-medium text-sm">GitHub</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (activeTab === "match") {
    return (
      <div className="space-y-4">
        <div className="text-sm font-semibold mb-4 border-b pb-2">Confidence Matching</div>
        <div className="space-y-4">
          <div className="p-4 border border-border bg-background shadow-sm">
            <div className="flex justify-between items-start gap-3 mb-4">
              <div className="font-medium text-sm min-w-0 truncate">Stripe Payout</div>
              <div className="font-mono text-sm font-medium whitespace-nowrap">R 12,450.00</div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <div className="bg-background border px-2 py-1 text-xs text-muted-foreground">Inv-201</div>
              <div className="bg-background border px-2 py-1 text-xs text-muted-foreground">Inv-202</div>
              <div className="bg-blue-500/10 border border-blue-500/20 text-blue-600 px-2 py-1 text-[10px] font-bold ml-auto">98% Match</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === "resolve") {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center mb-4 border-b pb-2">
          <div className="text-sm font-semibold">Exception Queue</div>
          <div className="text-xs bg-amber-500/10 text-amber-600 px-2 py-0.5 font-medium">3 needs review</div>
        </div>
        <div className="border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex justify-between gap-3 mb-2">
            <div className="font-medium text-sm min-w-0 truncate">Uncategorized Wire</div>
            <div className="font-mono text-sm whitespace-nowrap">R 4,000.00</div>
          </div>
          <div className="text-xs text-muted-foreground mb-4">No matching invoice found within 30 days.</div>
          <div className="flex flex-wrap gap-2">
            <button className="px-3 py-2 bg-background border text-xs font-medium hover:bg-muted">Request Info</button>
            <button className="px-3 py-2 bg-primary text-primary-foreground text-xs font-medium">Manual Link</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4 border-b pb-2">
        <div className="text-sm font-semibold">Ledger Verification</div>
        <div className="text-xs bg-emerald-500/10 text-emerald-600 px-2 py-0.5 font-medium flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          In sync
        </div>
      </div>
      <div className="space-y-2">
        {[
          { label: "Assets", val: "R 1,240,500.00" },
          { label: "Liabilities", val: "R 450,200.00" },
          { label: "Equity", val: "R 790,300.00" },
        ].map((row, i) => (
          <div key={i} className="flex justify-between items-center gap-3 py-2 text-sm">
            <div className="text-muted-foreground">{row.label}</div>
            <div className="font-mono font-medium whitespace-nowrap">{row.val}</div>
          </div>
        ))}
      </div>
      <div className="mt-6 pt-4 border-t border-border flex justify-end">
        <button className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium shadow-sm">Export to ERP</button>
      </div>
    </div>
  );
}
