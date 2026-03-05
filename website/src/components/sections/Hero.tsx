"use client";

import Link from "next/link";
import { ArrowRight, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

export function Hero() {
  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden">
      {/* Gradient blobs */}
      <div className="gradient-blob w-[600px] h-[600px] bg-primary/[0.07] -top-[200px] -left-[200px]" />
      <div className="gradient-blob w-[500px] h-[500px] bg-violet-500/[0.05] top-[100px] right-[-100px]" />

      <div className="mx-auto max-w-[1200px] px-6 pt-32 pb-20 w-full relative z-10">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-16 items-center">
          {/* Left — copy */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] }}
          >
            <Badge
              variant="outline"
              className="mb-6 px-3 py-1 text-[11px] font-medium tracking-wide border-primary/30 text-primary bg-primary/5"
            >
              v1.0 — Now Available for Windows & Mac
            </Badge>

            <h1 className="text-[clamp(2.5rem,5vw,4.25rem)] font-semibold leading-[1.05] tracking-[-0.03em] mb-6">
              Your music
              <br />
              production,{" "}
              <span className="text-gradient">finally organized.</span>
            </h1>

            <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-[500px] mb-8">
              DBundone auto-discovers projects from FL Studio, Ableton, Logic
              Pro, Cubase, and every major DAW. Track audio versions with
              loudness analysis and manage your productions from one dashboard.
            </p>

            <div className="flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="h-11 px-6 bg-primary hover:bg-primary/90 text-sm font-medium"
              >
                <Link href="/download">
                  <Download className="mr-2 h-4 w-4" />
                  Download Free
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-11 px-6 text-sm font-medium border-border/60 hover:bg-accent"
              >
                <Link href="#pricing">
                  View Pricing
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>

            <p className="mt-4 text-xs text-muted-foreground/60">
              Windows 10+ & macOS 12+ &middot; Free tier available &middot; No
              account required
            </p>
          </motion.div>

          {/* Right — screenshot */}
          <motion.div
            initial={{ opacity: 0, y: 40, rotateY: -4 }}
            animate={{ opacity: 1, y: 0, rotateY: -4 }}
            transition={{
              duration: 0.8,
              delay: 0.15,
              ease: [0.21, 0.47, 0.32, 0.98],
            }}
            className="relative hidden lg:block"
            style={{ perspective: "1200px" }}
          >
            {/* Ambient glow */}
            <div className="absolute -inset-8 bg-primary/[0.08] rounded-3xl blur-3xl" />

            {/* Window frame */}
            <div className="window-frame relative">
              <div className="window-frame-bar">
                <div className="window-dot bg-[#ff5f57]" />
                <div className="window-dot bg-[#febc2e]" />
                <div className="window-dot bg-[#28c840]" />
                <span className="ml-3 text-[11px] text-muted-foreground/50 font-mono">
                  DBundone
                </span>
              </div>
              <div className="aspect-[16/10] bg-muted/30 flex items-center justify-center">
                <div className="text-center p-8">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <span className="text-2xl font-bold text-primary">D</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Dashboard screenshot
                  </p>
                  <p className="text-xs text-muted-foreground/50 mt-1">
                    1200 &times; 800px recommended
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
