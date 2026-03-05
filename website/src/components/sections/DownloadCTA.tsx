"use client";

import { Download, Monitor, Apple } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import Link from "next/link";

export function DownloadCTA() {
  return (
    <section className="relative py-32 overflow-hidden">
      {/* Gradient accent */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.03] to-transparent pointer-events-none" />

      <div className="mx-auto max-w-[1200px] px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{
            duration: 0.6,
            ease: [0.21, 0.47, 0.32, 0.98],
          }}
          className="text-center max-w-[600px] mx-auto"
        >
          <h2 className="text-3xl md:text-[2.75rem] font-semibold tracking-[-0.02em] leading-tight mb-4">
            Ready to organize
            <br />
            your productions?
          </h2>
          <p className="text-muted-foreground text-base leading-relaxed mb-10">
            Download DBundone for free. No account required, no time limits.
            Upgrade to Pro when you&#39;re ready.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              asChild
              size="lg"
              className="h-12 px-8 bg-primary hover:bg-primary/90 text-sm font-medium"
            >
              <Link href="/download">
                <Monitor className="mr-2 h-4 w-4" />
                Download for Windows
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 px-8 text-sm font-medium border-border/60"
            >
              <Link href="/download">
                <Apple className="mr-2 h-4 w-4" />
                Download for macOS
              </Link>
            </Button>
          </div>

          <div className="mt-6 flex items-center justify-center gap-6 text-xs text-muted-foreground/50">
            <span>Windows 10+</span>
            <span className="w-1 h-1 rounded-full bg-muted-foreground/20" />
            <span>macOS 12+</span>
            <span className="w-1 h-1 rounded-full bg-muted-foreground/20" />
            <span>~150MB</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
