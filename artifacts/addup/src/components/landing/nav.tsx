import React from "react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export function Nav() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-transparent bg-background/80 backdrop-blur-md transition-colors">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </div>
            <span className="text-lg font-semibold tracking-tight">Addup</span>
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
