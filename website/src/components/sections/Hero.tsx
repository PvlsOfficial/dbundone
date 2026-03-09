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

      <div className="mx-auto max-w-300 px-6 pt-32 pb-20 w-full relative z-10">
        <div className="grid lg:grid-cols-[1fr_1.3fr] gap-12 lg:gap-20 items-center">
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
              v1.0 — Windows · macOS Coming Soon
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
                <Link href="https://github.com/PvlsOfficial/dbundone" target="_blank" rel="noopener noreferrer">
                  View on GitHub
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>

            <p className="mt-4 text-xs text-muted-foreground/60">
              Windows 10+ &middot; Free &amp; open source &middot; No account
              required
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
            className="relative hidden md:block"
            style={{ perspective: "1200px" }}
          >
            {/* Ambient glow */}
            <div className="absolute -inset-8 bg-primary/8 rounded-3xl blur-3xl" />

            {/* Screenshot */}
            <div className="relative rounded-xl overflow-hidden border border-border/40 shadow-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/screenshots/dashboard.png"
                alt="DBundone dashboard"
                className="w-2xl h-auto block"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
