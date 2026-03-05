"use client";

import {
  Scan,
  GitBranch,
  FileSearch,
  KanbanSquare,
  BarChart3,
  Users,
} from "lucide-react";
import { FEATURES } from "@/lib/constants";
import { motion } from "framer-motion";
import { useRef, MouseEvent } from "react";

const iconMap: Record<string, React.ElementType> = {
  Scan,
  GitBranch,
  FileSearch,
  KanbanSquare,
  BarChart3,
  Users,
};

export function FeatureGrid() {
  return (
    <section id="features" className="relative py-32">
      <div className="dot-grid absolute inset-0 pointer-events-none" />

      <div className="mx-auto max-w-[1200px] px-6 relative z-10">
        <div className="text-center max-w-[600px] mx-auto mb-16">
          <p className="text-xs font-medium uppercase tracking-widest text-primary mb-3">
            Features
          </p>
          <h2 className="text-3xl md:text-[2.75rem] font-semibold tracking-[-0.02em] leading-tight mb-4">
            Everything you need to manage your productions
          </h2>
          <p className="text-muted-foreground text-base leading-relaxed">
            From automatic project discovery to audio analysis — DBundone is the
            command center for your music production workflow.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {FEATURES.map((feature, i) => (
            <FeatureCard key={feature.title} feature={feature} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  feature,
  index,
}: {
  feature: (typeof FEATURES)[number];
  index: number;
}) {
  const Icon = iconMap[feature.icon];
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: MouseEvent) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    card.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
    card.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
  };

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{
        duration: 0.5,
        delay: index * 0.08,
        ease: [0.21, 0.47, 0.32, 0.98],
      }}
      onMouseMove={handleMouseMove}
      className={`spotlight-card rounded-xl border border-border/50 bg-card/50 p-6 ${
        feature.span === 2 ? "md:col-span-2" : ""
      }`}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 border border-primary/15 mb-4">
        {Icon && <Icon className="h-[18px] w-[18px] text-primary" />}
      </div>
      <h3 className="text-[15px] font-semibold mb-2 tracking-tight">
        {feature.title}
      </h3>
      <p className="text-[13px] text-muted-foreground leading-relaxed">
        {feature.description}
      </p>
    </motion.div>
  );
}
