import React from "react";

export function Footer() {
  return (
    <footer className="bg-background border-t border-border py-12">
      <div className="mx-auto max-w-6xl px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
        <p className="text-sm text-muted-foreground font-medium">
          Olyxee — Research and Infrastructure for Artificial Intelligence
        </p>
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
          <a href="#" className="hover:text-foreground transition-colors">Contact</a>
        </div>
      </div>
    </footer>
  );
}
