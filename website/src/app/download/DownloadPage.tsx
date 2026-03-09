"use client";

import { Monitor, Apple, Download, Check, HardDrive, Cpu, Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import Link from "next/link";

const WINDOWS_APP_URL =
  "https://github.com/PvlsOfficial/dbundone/releases/download/v1.0.0/DBundone_1.0.0_x64-setup.exe";
const WINDOWS_VST3_URL =
  "https://github.com/PvlsOfficial/dbundone/releases/download/v1.0.0/dbundone-bridge.vst3";
const WINDOWS_CLAP_URL =
  "https://github.com/PvlsOfficial/dbundone/releases/download/v1.0.0/dbundone-bridge.clap";

const requirements = [
  {
    platform: "Windows",
    icon: Monitor,
    items: [
      "Windows 10 or later (64-bit)",
      "4 GB RAM (8 GB recommended)",
      "200 MB disk space",
      "VST3 or CLAP-compatible DAW (for plugin)",
    ],
  },
  {
    platform: "macOS",
    icon: Apple,
    items: [
      "macOS 12 (Monterey) or later",
      "4 GB RAM (8 GB recommended)",
      "200 MB disk space",
      "VST3 or CLAP-compatible DAW (for plugin)",
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
          <p className="text-muted-foreground text-lg max-w-[500px] mx-auto mb-6">
            Free and open source. No account required. No limits.
          </p>
          <Link
            href="https://github.com/PvlsOfficial/dbundone"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Github className="h-4 w-4" />
            github.com/PvlsOfficial/dbundone
          </Link>
        </motion.div>

        {/* Platform downloads */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.5,
            delay: 0.1,
            ease: [0.21, 0.47, 0.32, 0.98],
          }}
          className="grid sm:grid-cols-2 gap-4 max-w-[600px] mx-auto mb-12"
        >
          {/* Windows */}
          <div className="rounded-xl border border-border/50 bg-card/50 p-6 text-center">
            <Monitor className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <h2 className="text-lg font-semibold mb-1">Windows</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Windows 10+ (64-bit)
            </p>
            <Button
              asChild
              className="w-full h-10 bg-primary hover:bg-primary/90 text-sm font-medium"
            >
              <a href={WINDOWS_APP_URL} download>
                <Download className="mr-2 h-4 w-4" />
                Download .exe
              </a>
            </Button>
            <p className="mt-2 text-[11px] text-muted-foreground/50">
              v1.0.0
            </p>
          </div>

          {/* macOS */}
          <div className="rounded-xl border border-border/50 bg-card/50 p-6 text-center opacity-60">
            <Apple className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <h2 className="text-lg font-semibold mb-1">macOS</h2>
            <p className="text-xs text-muted-foreground mb-4">
              macOS 12+ (Monterey)
            </p>
            <Button
              disabled
              className="w-full h-10 text-sm font-medium cursor-not-allowed"
              variant="outline"
            >
              Coming Soon
            </Button>
            <p className="mt-2 text-[11px] text-muted-foreground/50">
              Not yet available
            </p>
          </div>
        </motion.div>

        {/* Plugin downloads */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.5,
            delay: 0.18,
            ease: [0.21, 0.47, 0.32, 0.98],
          }}
          className="mb-20"
        >
          <h3 className="text-base font-semibold text-center mb-2">
            DAW Plugin (Windows)
          </h3>
          <p className="text-center text-xs text-muted-foreground mb-6">
            Load the bridge plugin in your DAW to auto-capture recordings and
            bounces. Choose one — VST3 or CLAP, not both.
          </p>
          <div className="grid sm:grid-cols-2 gap-4 max-w-[600px] mx-auto">
            <div className="rounded-xl border border-border/50 bg-card/30 p-5 text-center">
              <Cpu className="h-6 w-6 mx-auto mb-2 text-primary" />
              <p className="text-sm font-medium mb-1">VST3 Plugin</p>
              <p className="text-[12px] text-muted-foreground mb-4">
                Works with FL Studio, Ableton, Cubase & most DAWs
              </p>
              <Button
                asChild
                variant="outline"
                className="w-full h-9 text-sm border-border/60"
              >
                <a href={WINDOWS_VST3_URL} download>
                  <Download className="mr-2 h-3.5 w-3.5" />
                  Download .vst3
                </a>
              </Button>
            </div>
            <div className="rounded-xl border border-border/50 bg-card/30 p-5 text-center">
              <Cpu className="h-6 w-6 mx-auto mb-2 text-primary" />
              <p className="text-sm font-medium mb-1">CLAP Plugin</p>
              <p className="text-[12px] text-muted-foreground mb-4">
                Alternative format — Bitwig, Reaper, and CLAP-first DAWs
              </p>
              <Button
                asChild
                variant="outline"
                className="w-full h-9 text-sm border-border/60"
              >
                <a href={WINDOWS_CLAP_URL} download>
                  <Download className="mr-2 h-3.5 w-3.5" />
                  Download .clap
                </a>
              </Button>
            </div>
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
                title: "VST3 & CLAP Plugin",
                desc: "DBundone Bridge for your DAW",
              },
              {
                icon: Github,
                title: "Open Source",
                desc: "Full source code on GitHub",
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
                className={`rounded-xl border border-border/50 bg-card/30 p-6 ${
                  req.platform === "macOS" ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-center gap-2.5 mb-4">
                  <req.icon className="h-5 w-5 text-muted-foreground" />
                  <h4 className="text-sm font-semibold">
                    {req.platform}
                    {req.platform === "macOS" && (
                      <span className="ml-2 text-[10px] font-normal text-muted-foreground/60 uppercase tracking-wider">
                        Coming Soon
                      </span>
                    )}
                  </h4>
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
