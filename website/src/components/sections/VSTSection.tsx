"use client";

import { Cable, Radio, HardDrive, Zap } from "lucide-react";
import { motion } from "framer-motion";

const steps = [
  {
    icon: Cable,
    label: "Load Plugin",
    description: "Drop the DBundone Bridge VST3 into any track in your DAW",
  },
  {
    icon: Radio,
    label: "Auto-Connect",
    description: "The plugin discovers the DBundone app over local WebSocket",
  },
  {
    icon: HardDrive,
    label: "Capture Everything",
    description:
      "Recordings, renders, and bounces are auto-versioned to the right project",
  },
  {
    icon: Zap,
    label: "Stay in Flow",
    description:
      "Manage tasks, view versions, and track time without leaving your DAW",
  },
];

export function VSTSection() {
  return (
    <section className="relative py-32 bg-[oklch(0.03_0.005_270)]">
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left — copy */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{
              duration: 0.6,
              ease: [0.21, 0.47, 0.32, 0.98],
            }}
          >
            <p className="text-xs font-medium uppercase tracking-widest text-primary mb-3">
              VST3 Plugin Bridge
            </p>
            <h2 className="text-3xl md:text-[2.75rem] font-semibold tracking-[-0.02em] leading-tight mb-4">
              Bridge your DAW
              <br />
              to your dashboard
            </h2>
            <p className="text-muted-foreground text-base leading-relaxed mb-10 max-w-[440px]">
              The DBundone Bridge is a VST3 plugin that works with any
              VST3-compatible DAW — FL Studio, Ableton, Logic Pro, Cubase, and
              more. It captures every recording and bounce automatically, links
              them to the right project, and runs audio analysis — all without
              interrupting your creative flow.
            </p>

            <div className="space-y-6">
              {steps.map((step, i) => (
                <motion.div
                  key={step.label}
                  initial={{ opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{
                    duration: 0.4,
                    delay: i * 0.1,
                    ease: [0.21, 0.47, 0.32, 0.98],
                  }}
                  className="flex gap-4"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/15">
                    <step.icon className="h-[18px] w-[18px] text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-0.5">{step.label}</p>
                    <p className="text-[13px] text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right — diagram / screenshot placeholder */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{
              duration: 0.6,
              delay: 0.15,
              ease: [0.21, 0.47, 0.32, 0.98],
            }}
          >
            {/* Connection diagram */}
            <div className="rounded-xl border border-border/50 bg-card/30 p-8">
              <div className="space-y-4">
                {/* DAW */}
                <div className="rounded-lg border border-border/50 bg-muted/30 p-4 text-center">
                  <p className="text-xs text-muted-foreground/60 uppercase tracking-wider mb-1">
                    Your DAW
                  </p>
                  <p className="text-sm font-medium">
                    Any VST3-Compatible DAW
                  </p>
                </div>

                {/* Arrow */}
                <div className="flex justify-center">
                  <div className="w-px h-6 bg-primary/30" />
                </div>

                {/* Plugin */}
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-center">
                  <p className="text-xs text-primary/60 uppercase tracking-wider mb-1">
                    VST3 Plugin
                  </p>
                  <p className="text-sm font-medium text-primary">
                    DBundone Bridge
                  </p>
                  <div className="flex justify-center gap-6 mt-3">
                    <span className="text-[11px] text-muted-foreground">
                      Auto-Record
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Level Metering
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Render Capture
                    </span>
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex justify-center">
                  <div className="flex flex-col items-center">
                    <div className="w-px h-3 bg-primary/30" />
                    <span className="text-[10px] text-muted-foreground/50 font-mono px-2">
                      WebSocket (localhost)
                    </span>
                    <div className="w-px h-3 bg-primary/30" />
                  </div>
                </div>

                {/* App */}
                <div className="rounded-lg border border-border/50 bg-muted/30 p-4 text-center">
                  <p className="text-xs text-muted-foreground/60 uppercase tracking-wider mb-1">
                    Desktop App
                  </p>
                  <p className="text-sm font-medium">DBundone</p>
                  <div className="flex justify-center gap-6 mt-3">
                    <span className="text-[11px] text-muted-foreground">
                      Version Control
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      LUFS Analysis
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Task Board
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
