"use client";

import { Monitor, Apple, Download, Check, HardDrive, Cpu, MemoryStick } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const requirements = [
  {
    platform: "Windows",
    icon: Monitor,
    items: [
      "Windows 10 or later (64-bit)",
      "4 GB RAM (8 GB recommended)",
      "200 MB disk space",
      "VST3-compatible DAW (for plugin)",
    ],
  },
  {
    platform: "macOS",
    icon: Apple,
    items: [
      "macOS 12 (Monterey) or later",
      "4 GB RAM (8 GB recommended)",
      "200 MB disk space",
      "VST3-compatible DAW (for plugin)",
    ],
  },
];

export function DownloadPage() {
  return (
    <section className="pt-32 pb-20">
      <div className="mx-auto max-w-[900px] px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.6,
            ease: [0.21, 0.47, 0.32, 0.98],
          }}
          className="text-center mb-16"
        >
          <h1 className="text-4xl md:text-5xl font-semibold tracking-[-0.03em] mb-4">
            Download DBundone
          </h1>
          <p className="text-muted-foreground text-lg max-w-[500px] mx-auto">
            Free to start. No account required. No time limits.
          </p>
        </motion.div>

        {/* Download buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.5,
            delay: 0.1,
            ease: [0.21, 0.47, 0.32, 0.98],
          }}
          className="grid sm:grid-cols-2 gap-4 max-w-[600px] mx-auto mb-20"
        >
          <div className="rounded-xl border border-border/50 bg-card/50 p-6 text-center">
            <Monitor className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <h2 className="text-lg font-semibold mb-1">Windows</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Windows 10+ (64-bit)
            </p>
            <Button className="w-full h-10 bg-primary hover:bg-primary/90 text-sm font-medium">
              <Download className="mr-2 h-4 w-4" />
              Download .exe
            </Button>
            <p className="mt-2 text-[11px] text-muted-foreground/50">
              v1.0.0 &middot; ~85 MB
            </p>
          </div>

          <div className="rounded-xl border border-border/50 bg-card/50 p-6 text-center">
            <Apple className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <h2 className="text-lg font-semibold mb-1">macOS</h2>
            <p className="text-xs text-muted-foreground mb-4">
              macOS 12+ (Monterey)
            </p>
            <Button className="w-full h-10 bg-primary hover:bg-primary/90 text-sm font-medium">
              <Download className="mr-2 h-4 w-4" />
              Download .dmg
            </Button>
            <p className="mt-2 text-[11px] text-muted-foreground/50">
              v1.0.0 &middot; ~90 MB
            </p>
          </div>
        </motion.div>

        {/* What's included */}
        <div className="mb-20">
          <h3 className="text-lg font-semibold text-center mb-8">
            What&apos;s included
          </h3>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              {
                icon: HardDrive,
                title: "Desktop App",
                desc: "The full DBundone application",
              },
              {
                icon: Cpu,
                title: "VST3 Plugin",
                desc: "DBundone Bridge for your DAW",
              },
              {
                icon: MemoryStick,
                title: "Auto-Updater",
                desc: "Get updates as they ship",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-lg border border-border/50 bg-card/30 p-4 text-center"
              >
                <item.icon className="h-5 w-5 mx-auto mb-2 text-primary" />
                <p className="text-sm font-medium mb-0.5">{item.title}</p>
                <p className="text-[12px] text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* System requirements */}
        <div id="requirements">
          <h3 className="text-lg font-semibold text-center mb-8">
            System requirements
          </h3>
          <div className="grid sm:grid-cols-2 gap-6">
            {requirements.map((req) => (
              <div
                key={req.platform}
                className="rounded-xl border border-border/50 bg-card/30 p-6"
              >
                <div className="flex items-center gap-2.5 mb-4">
                  <req.icon className="h-5 w-5 text-muted-foreground" />
                  <h4 className="text-sm font-semibold">{req.platform}</h4>
                </div>
                <ul className="space-y-2">
                  {req.items.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                      <span className="text-[13px] text-muted-foreground">
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
