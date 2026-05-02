import React from "react";
import { Linkedin, Twitter, Github } from "lucide-react";
import addupLogo from "@assets/Addup_1777332904059.png";

type LinkItem = { label: string; href: string };

const productLinks: LinkItem[] = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Integrations", href: "#integrations" },
  { label: "Built for Africa", href: "#built-for-africa" },
  { label: "News", href: "#news" },
];

const companyLinks: LinkItem[] = [
  { label: "Contact", href: "mailto:hello@addup.finance" },
];

const resourceLinks: LinkItem[] = [];

const legalLinks: LinkItem[] = [];

const socials = [
  { label: "LinkedIn", href: "https://www.linkedin.com/", Icon: Linkedin },
  { label: "X", href: "https://x.com/", Icon: Twitter },
  { label: "GitHub", href: "https://github.com/", Icon: Github },
];

export function Footer() {
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
    <footer className="bg-background border-t border-border/60">
      <div className="mx-auto max-w-6xl px-6 lg:px-8 pt-16 pb-10 sm:pt-20 sm:pb-12">
        {/* Top: brand + columns */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-12 gap-10 lg:gap-8">
          {/* Brand block */}
          <div className="col-span-2 sm:col-span-4 lg:col-span-4">
            <a href="/" aria-label="Addup home" className="inline-block">
              <img src={addupLogo} alt="Addup" className="h-8 w-auto" />
            </a>
            <p className="mt-4 text-[14px] leading-relaxed text-muted-foreground max-w-xs">
              The financial data reliability layer for African finance teams.
            </p>
          </div>

          {/* Link columns — only render columns with items */}
          <FooterColumn title="Product" items={productLinks} onClick={handleNavClick} />
          {companyLinks.length > 0 && <FooterColumn title="Company" items={companyLinks} onClick={handleNavClick} />}
        </div>

        {/* Bottom bar */}
        <div className="mt-14 sm:mt-16 pt-8 border-t border-border/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <p className="text-[12px] text-muted-foreground">
            © {year} Addup. Johannesburg, South Africa.
          </p>

          <div className="flex items-center gap-5">
            <div className="flex items-center gap-3">
              {socials.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
            <span className="text-[12px] text-muted-foreground/70">
              by{" "}
              <a
                href="https://olyxee.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
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
      <h4 className="text-[13px] font-semibold text-foreground mb-4">{title}</h4>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.label}>
            <a
              href={item.href}
              onClick={(e) => onClick(e, item.href)}
              className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
