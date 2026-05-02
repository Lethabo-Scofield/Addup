import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import addupLogo from "@assets/Addup_1777332904059.png";
import { useWaitlist } from "./waitlist-dialog";

const links = [
  { label: "How it works", id: "how-it-works" },
  { label: "Integrations", id: "integrations" },
  { label: "Built for Africa", id: "built-for-africa" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const { open: openWaitlist } = useWaitlist();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 w-full transition-all duration-300 ${
        scrolled ? "bg-background/90 backdrop-blur-xl border-b border-border/50 shadow-sm" : ""
      }`}
    >
      <div className="mx-auto max-w-7xl flex items-center justify-between px-6 sm:px-8 h-16 sm:h-20">
        <Link
          href="/"
          className="flex items-center transition-opacity hover:opacity-80"
          aria-label="Addup home"
        >
          <img
            src={addupLogo}
            alt="Addup"
            className="w-auto h-8 sm:h-9"
          />
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <button
              key={l.id}
              onClick={() => scrollTo(l.id)}
              className={`px-3 py-1.5 text-[13px] font-medium transition-colors duration-300 ${
                scrolled ? "text-foreground/70 hover:text-foreground" : "text-white/85 hover:text-white"
              }`}
            >
              {l.label}
            </button>
          ))}
        </nav>

        <Button
          onClick={openWaitlist}
          className="rounded-none px-4 sm:px-5 h-8 sm:h-9 text-[13px] font-medium shadow-none"
        >
          Join waitlist
        </Button>
      </div>
    </header>
  );
}
