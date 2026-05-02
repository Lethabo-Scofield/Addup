import React from "react";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import newsImage1 from "@assets/image_1777329299792.png";
import newsImage2 from "@assets/image_1777329317085.png";
import newsImage3 from "@assets/image_1777329386613.png";

interface NewsItem {
  image: string;
  source: string;
  date: string;
  title: string;
  excerpt: string;
  featured?: boolean;
}

const items: NewsItem[] = [
  {
    image: newsImage1,
    source: "Google",
    date: "Aug 2023",
    title: "Featured at Google's SMB Support Stakeholder Workshop.",
    excerpt:
      "Joining Google and African SMB leaders to shape what reliable financial infrastructure should look like for small businesses across the continent.",
    featured: true,
  },
  {
    image: newsImage2,
    source: "New Generation Awards",
    date: "Nov 2023",
    title: "Recognised at the New Generation Awards.",
    excerpt: "Celebrating the teams building the next wave of African digital infrastructure.",
  },
  {
    image: newsImage3,
    source: "Industry Roundtable",
    date: "Mar 2024",
    title: "In the room with African finance leaders.",
    excerpt: "Working alongside CFOs and controllers to define what trust in financial data really means.",
  },
];

export function News() {
  return (
    <section id="news" className="relative py-16 sm:py-24 bg-muted/40 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent pointer-events-none" />

      <div className="relative mx-auto max-w-6xl px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5 mb-10 sm:mb-12">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 border border-border/60 bg-background/70 backdrop-blur px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-4">
              <span className="h-1.5 w-1.5 bg-primary"></span>
              In the news
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] lg:leading-[1.05] font-semibold text-foreground">
              Where Addup is being talked about.
            </h2>
          </div>
          <p className="text-base sm:text-lg text-muted-foreground sm:text-right max-w-sm">
            Press, awards, and the rooms where we're shaping the conversation.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 lg:grid-rows-2 gap-5 sm:gap-6">
          {items.map((item, i) => (
            <NewsCard
              key={item.title}
              item={item}
              index={i}
              className={item.featured ? "lg:col-span-2 lg:row-span-2" : ""}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function NewsCard({
  item,
  index,
  className = "",
}: {
  item: NewsItem;
  index: number;
  className?: string;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
      className={`group relative overflow-hidden border border-border/40 bg-card hover:shadow-[0_25px_70px_-20px_rgba(0,0,0,0.18)] transition-all duration-500 hover:-translate-y-1 ${className}`}
    >
      <div
        className={`relative overflow-hidden bg-muted ${
          item.featured ? "aspect-[16/11] lg:aspect-auto lg:h-[55%]" : "aspect-[16/10]"
        }`}
      >
        <img
          src={item.image}
          alt={item.title}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-60 pointer-events-none" />

        <div className="absolute top-4 left-4 inline-flex items-center gap-1.5 bg-background/90 backdrop-blur px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-foreground shadow-sm">
          {item.source}
        </div>

        <div className="absolute top-4 right-4 h-9 w-9 bg-background/90 backdrop-blur flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-300">
          <ArrowUpRight className="h-4 w-4 text-foreground" />
        </div>
      </div>

      <div className={`p-6 sm:p-7 ${item.featured ? "lg:p-8" : ""}`}>
        <div className="text-xs font-medium text-muted-foreground mb-3">{item.date}</div>
        <h3
          className={`font-bold tracking-tight text-foreground leading-snug mb-3 ${
            item.featured ? "text-xl sm:text-2xl lg:text-3xl" : "text-lg sm:text-xl"
          }`}
        >
          {item.title}
        </h3>
        <p
          className={`text-muted-foreground leading-relaxed ${
            item.featured ? "text-base sm:text-lg" : "text-sm sm:text-base"
          }`}
        >
          {item.excerpt}
        </p>
      </div>
    </motion.article>
  );
}
