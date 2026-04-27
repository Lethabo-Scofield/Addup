import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import addupLogo from "@assets/Addup_Nae_1777329017881.png";

const links = [
  { label: "How it works", id: "how-it-works" },
  { label: "Product", id: "product" },
  { label: "Integrations", id: "integrations" },
  { label: "News", id: "news" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full pt-3 sm:pt-4 px-3 sm:px-6">
      <div
        className={`mx-auto flex max-w-5xl items-center justify-between rounded-full border px-3 sm:px-4 h-12 sm:h-14 transition-all duration-300 ${
          scrolled
            ? "bg-background/75 backdrop-blur-xl border-border/60 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.08)]"
            : "bg-white/80 backdrop-blur-xl border-white/40 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.25)]"
        }`}
      >
        <Link href="/" className="flex items-center pl-1 transition-opacity hover:opacity-80" aria-label="Addup home">
          <img src={addupLogo} alt="Addup" className="h-7 sm:h-8 w-auto" />
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <button
              key={l.id}
              onClick={() => scrollTo(l.id)}
              className="px-3 py-1.5 text-[13px] font-medium text-foreground/70 hover:text-foreground rounded-full transition-colors"
            >
              {l.label}
            </button>
          ))}
        </nav>

        <Button
          onClick={() => scrollTo("waitlist")}
          className="rounded-full px-4 sm:px-5 h-8 sm:h-9 text-[13px] font-medium shadow-none"
        >
          Join waitlist
        </Button>
      </div>
    </header>
  );
}
