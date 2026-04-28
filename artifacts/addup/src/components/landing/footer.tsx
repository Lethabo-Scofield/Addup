import React from "react";
import { Linkedin, Twitter, Github, Mail, MapPin } from "lucide-react";
import addupLogo from "@assets/Addup_1777332904059.png";
import footerBg from "@assets/image_1777333498297.png";
import { Button } from "@/components/ui/button";
import { useWaitlist } from "./waitlist-dialog";

type LinkItem = { label: string; href: string };

const productLinks: LinkItem[] = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Product", href: "#product" },
  { label: "Integrations", href: "#integrations" },
  { label: "Built for Africa", href: "#built-for-africa" },
];

const companyLinks: LinkItem[] = [
  { label: "About", href: "#" },
  { label: "News", href: "#news" },
  { label: "Careers", href: "#" },
  { label: "Contact", href: "mailto:hello@addup.finance" },
];

const resourceLinks: LinkItem[] = [
  { label: "Help centre", href: "#" },
  { label: "Changelog", href: "#" },
  { label: "Status", href: "#" },
  { label: "Press kit", href: "#" },
];

const legalLinks: LinkItem[] = [
  { label: "Privacy", href: "#" },
  { label: "Terms", href: "#" },
  { label: "Security", href: "#" },
  { label: "POPIA", href: "#" },
];

const socials = [
  { label: "LinkedIn", href: "https://www.linkedin.com/", Icon: Linkedin },
  { label: "X", href: "https://x.com/", Icon: Twitter },
  { label: "GitHub", href: "https://github.com/", Icon: Github },
];

export function Footer() {
  const { open: openWaitlist } = useWaitlist();
  const year = new Date().getFullYear();

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!href.startsWith("#") || href === "#") return;
    const el = document.querySelector(href);
    if (el) {
      e.preventDefault();
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <footer className="relative bg-[#0a0a0c] text-white/80 overflow-hidden">
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none"
        style={{ backgroundImage: `url(${footerBg})` }}
        aria-hidden="true"
      />
      {/* Darkening + readability overlays */}
      <div className="absolute inset-0 bg-[#0a0a0c]/70 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0c]/95 via-[#0a0a0c]/55 to-[#0a0a0c]/95 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/15 via-transparent to-transparent pointer-events-none" />

      <div className="relative mx-auto max-w-6xl px-6 lg:px-8 pt-16 pb-10 sm:pt-20 sm:pb-12">
        {/* Top: brand + columns */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-12 gap-10 lg:gap-12">
          {/* Brand block */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-5">
            <div className="inline-flex items-center bg-white rounded-xl px-3 py-2 mb-5">
              <img src={addupLogo} alt="Addup" className="h-7 w-auto" />
            </div>
            <p className="text-[15px] text-white/70 leading-relaxed max-w-sm mb-6">
              The financial data reliability layer for African finance teams. Clean books, closed in minutes.
            </p>

            <Button
              onClick={openWaitlist}
              className="rounded-full px-5 h-10 text-[13px] font-medium shadow-none mb-7"
            >
              Join the waitlist
            </Button>

            <ul className="space-y-2.5 text-[13px] text-white/70">
              <li>
                <a
                  href="mailto:hello@addup.finance"
                  className="inline-flex items-center gap-2 hover:text-white transition-colors"
                >
                  <Mail className="h-4 w-4 text-primary" />
                  hello@addup.finance
                </a>
              </li>
              <li className="inline-flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                Cape Town, South Africa
              </li>
            </ul>

            <div className="mt-6 flex items-center gap-2">
              {socials.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="h-9 w-9 inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80 hover:text-white hover:border-white/30 hover:bg-white/10 transition-colors"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          <FooterColumn title="Product" items={productLinks} onClick={handleNavClick} />
          <FooterColumn title="Company" items={companyLinks} onClick={handleNavClick} />
          <FooterColumn title="Resources" items={resourceLinks} onClick={handleNavClick} />
          <FooterColumn title="Legal" items={legalLinks} onClick={handleNavClick} />
        </div>

        {/* Divider */}
        <div className="mt-12 sm:mt-14 mb-6 h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent" />

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-[12px] text-white/50">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>© {year} Addup. All rights reserved.</span>
            <span className="hidden sm:inline h-1 w-1 rounded-full bg-white/30" />
            <span>Built in Cape Town for Africa.</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[11px] font-medium text-white/70">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              All systems normal
            </span>
            <span className="text-white/40">
              Developed by{" "}
              <a
                href="https://olyxee.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-white/70 hover:text-white transition-colors"
              >
                Olyxee
              </a>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  items,
  onClick,
}: {
  title: string;
  items: LinkItem[];
  onClick: (e: React.MouseEvent<HTMLAnchorElement>, href: string) => void;
}) {
  return (
    <div className="lg:col-span-2">
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50 mb-4">
        {title}
      </h4>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.label}>
            <a
              href={item.href}
              onClick={(e) => onClick(e, item.href)}
              className="text-[14px] text-white/75 hover:text-white transition-colors"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
