import React from "react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import addupLogo from "@assets/Addup_Nae_1777329017881.png";

export function Nav() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-transparent bg-background/80 backdrop-blur-md transition-colors">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center transition-opacity hover:opacity-80" aria-label="Addup home">
            <img src={addupLogo} alt="Addup" className="h-9 w-auto" />
          </Link>
        </div>
        <nav className="flex items-center gap-4">
          <Button 
            onClick={() => {
              document.getElementById("waitlist")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="rounded-full shadow-xs px-5 h-9"
          >
            Join the waitlist
          </Button>
        </nav>
      </div>
    </header>
  );
}
