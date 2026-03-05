"use client";

import { motion } from "framer-motion";

const daws = [
  {
    name: "FL Studio",
    svg: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M2 2h20v20H2V2zm2 2v16h16V4H4zm3 3h2v10H7V7zm4 2h2v8h-2V9zm4-1h2v9h-2V8z" />
      </svg>
    ),
  },
  {
    name: "Ableton Live",
    svg: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M3 3h2v18H3V3zm4 0h2v18H7V3zm4 0h2v18h-2V3zm4 0h2v18h-2V3zm4 0h2v18h-2V3z" />
      </svg>
    ),
  },
  {
    name: "Logic Pro",
    svg: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-11l5 3-5 3V9z" />
      </svg>
    ),
  },
  {
    name: "Pro Tools",
    svg: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2zm0-12h2v14H3V4zm9 0h2v14h-2V4zm9 0h2v14h-2V4z" />
      </svg>
    ),
  },
  {
    name: "Cubase",
    svg: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.18L19.27 7.5 12 10.82 4.73 7.5 12 4.18zM4 8.82l7 3.5V19l-7-3.5V8.82zm9 10.18v-6.68l7-3.5V15.5l-7 3.5z" />
      </svg>
    ),
  },
  {
    name: "Bitwig",
    svg: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M4 4h4v4H4V4zm6 0h4v4h-4V4zm6 0h4v4h-4V4zM4 10h4v4H4v-4zm6 0h4v4h-4v-4zm6 0h4v4h-4v-4zM4 16h4v4H4v-4zm6 0h4v4h-4v-4zm6 0h4v4h-4v-4z" />
      </svg>
    ),
  },
  {
    name: "Reaper",
    svg: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm1-13h-2v5.41l3.29 3.3 1.42-1.42L13 11.17V7z" />
      </svg>
    ),
  },
  {
    name: "Studio One",
    svg: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 2c4.41 0 8 3.59 8 8s-3.59 8-8 8-8-3.59-8-8 3.59-8 8-8zm-1 3v4H7v2h4v4h2v-4h4v-2h-4V7h-2z" />
      </svg>
    ),
  },
];

export function LogoCloud() {
  return (
    <section className="relative border-y border-border/30">
      <div className="mx-auto max-w-[1200px] px-6 py-10">
        <p className="text-center text-xs font-medium uppercase tracking-widest text-muted-foreground/50 mb-8">
          Supports all major DAWs
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 md:gap-x-12">
          {daws.map((daw, i) => (
            <motion.div
              key={daw.name}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.3,
                delay: i * 0.04,
                ease: [0.21, 0.47, 0.32, 0.98],
              }}
              className="flex items-center gap-2 text-muted-foreground/35 hover:text-muted-foreground/60 transition-colors"
            >
              {daw.svg}
              <span className="text-[13px] font-medium">{daw.name}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
