"use client";

import { Check, Download, Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PRICING_TIERS } from "@/lib/constants";
import { motion } from "framer-motion";
import Link from "next/link";

const tier = PRICING_TIERS[0];

export function PricingCards() {
  return (
    <section id="pricing" className="relative py-32">
      {/* Subtle top/bottom borders to frame the section */}
      <div className="absolute inset-0 border-y border-border/40 bg-card/20" />

      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[500px] w-[800px] rounded-full bg-primary/[0.04] blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-[1200px] px-6">
        {/* Top label */}
        <div className="text-center mb-16">
          <p className="text-xs font-medium uppercase tracking-widest text-primary mb-3">
            Pricing
          </p>
          <h2 className="text-3xl md:text-[2.75rem] font-semibold tracking-[-0.02em] leading-tight mb-4">
            What does it cost?
          </h2>
          <p className="text-muted-foreground text-base max-w-md mx-auto leading-relaxed">
            Funny you should ask.
          </p>
        </div>

        {/* Main card — two columns */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="rounded-2xl border border-border/50 bg-card/50 overflow-hidden"
        >
          <div className="grid lg:grid-cols-[1fr_1.4fr]">
            {/* Left — price + CTA */}
            <div className="flex flex-col justify-center p-10 lg:p-14 border-b lg:border-b-0 lg:border-r border-border/40">
              <div className="mb-8">
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-[5rem] font-bold tracking-tight leading-none text-foreground">
                    $0
                  </span>
                  <span className="text-muted-foreground text-lg">/ forever</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-[280px]">
                  {tier.description}
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <Button
                  asChild
                  size="lg"
                  className="h-11 bg-primary hover:bg-primary/90 text-sm font-medium"
                >
                  <Link href="/download">
                    <Download className="mr-2 h-4 w-4" />
                    {tier.cta}
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="h-11 border-border/60 text-sm font-medium"
                >
                  <Link
                    href="https://github.com/PvlsOfficial/dbundone"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Github className="mr-2 h-4 w-4" />
                    View on GitHub
                  </Link>
                </Button>
              </div>
            </div>

            {/* Right — features grid */}
            <div className="p-10 lg:p-14">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-6">
                Everything included
              </p>
              <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15">
                      <Check className="h-3 w-3 text-primary" />
                    </span>
                    <span className="text-sm text-muted-foreground leading-snug">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <p className="mt-8 text-xs text-muted-foreground/50 leading-relaxed">
                No account required &middot; No telemetry &middot; All future updates free
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
