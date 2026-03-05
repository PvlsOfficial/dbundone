"use client";

import { TESTIMONIALS } from "@/lib/constants";
import { motion } from "framer-motion";
import { Quote } from "lucide-react";

export function Testimonials() {
  // Split into columns for masonry
  const col1 = TESTIMONIALS.filter((_, i) => i % 3 === 0);
  const col2 = TESTIMONIALS.filter((_, i) => i % 3 === 1);
  const col3 = TESTIMONIALS.filter((_, i) => i % 3 === 2);

  return (
    <section className="relative py-32 bg-[oklch(0.03_0.005_270)]">
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="text-center max-w-[600px] mx-auto mb-16">
          <p className="text-xs font-medium uppercase tracking-widest text-primary mb-3">
            Testimonials
          </p>
          <h2 className="text-3xl md:text-[2.75rem] font-semibold tracking-[-0.02em] leading-tight mb-4">
            Producers are switching
          </h2>
          <p className="text-muted-foreground text-base leading-relaxed">
            Hear from beatmakers, composers, and mixing engineers who use
            DBundone daily.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <Column items={col1} offset={0} />
          <Column items={col2} offset={0.1} />
          <Column items={col3} offset={0.2} />
        </div>
      </div>
    </section>
  );
}

function Column({
  items,
  offset,
}: {
  items: (typeof TESTIMONIALS)[number][];
  offset: number;
}) {
  return (
    <div className="space-y-4">
      {items.map((t, i) => (
        <motion.div
          key={t.name}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{
            duration: 0.5,
            delay: offset + i * 0.1,
            ease: [0.21, 0.47, 0.32, 0.98],
          }}
          className="rounded-xl border border-border/50 bg-card/30 p-5"
        >
          <Quote className="h-4 w-4 text-primary/40 mb-3" />
          <p className="text-[13px] text-muted-foreground leading-relaxed mb-4">
            {t.text}
          </p>
          <div>
            <p className="text-sm font-medium">{t.name}</p>
            <p className="text-[12px] text-muted-foreground/60">{t.role}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
