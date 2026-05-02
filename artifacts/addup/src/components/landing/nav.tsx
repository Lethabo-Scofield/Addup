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
      className={`fixed top-0 left-0 right-0 z-50 w-full transition-[padding] duration-500 ease-out ${
        scrolled ? "pt-3 sm:pt-4 px-3 sm:px-6" : "pt-0 px-0"
      }`}
    >
      <div
        className={`mx-auto flex items-center justify-between border transition-all duration-500 ease-out ${
          scrolled
            ? "max-w-5xl rounded-full px-3 sm:px-4 h-12 sm:h-14 bg-background/75 backdrop-blur-xl border-border/60 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.08)]"
            : "max-w-7xl rounded-none px-6 sm:px-8 h-16 sm:h-20 bg-transparent backdrop-blur-0 border-transparent shadow-none"
        }`}
      >
        <Link
          href="/"
          className="flex items-center pl-1 transition-opacity hover:opacity-80"
          aria-label="Addup home"
        >
          <img
            src={addupLogo}
            alt="Addup"
            className={`w-auto transition-all duration-500 ease-out ${
              scrolled ? "h-7 sm:h-8" : "h-8 sm:h-9 brightness-0 invert"
            }`}
          />
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <button
              key={l.id}
              onClick={() => scrollTo(l.id)}
              className={`px-3 py-1.5 text-[13px] font-medium rounded-full transition-colors duration-500 ${
                scrolled
                  ? "text-foreground/70 hover:text-foreground"
                  : "text-white/85 hover:text-white"
              }`}
            >
              {l.label}
            </button>
          ))}
        </nav>

        <Button
          onClick={openWaitlist}
          className="rounded-full px-4 sm:px-5 h-8 sm:h-9 text-[13px] font-medium shadow-none"
        >
          Join waitlist
        </Button>
      </div>
    </header>
  );
}
