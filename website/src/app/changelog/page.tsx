import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Changelog",
  description: "DBundone release history and version updates.",
  alternates: { canonical: "https://dbundone.com/changelog" },
};

const releases = [
  {
    version: "1.0.0",
    date: "March 1, 2026",
    label: "Initial Release",
    changes: [
      "Auto-discover and scan FL Studio, Ableton Live, Logic Pro, Pro Tools, Cubase, Bitwig, Reaper, and Studio One projects",
      "Deep FLP analysis: plugins, channels, mixer tracks, patterns, samples",
      "Audio version control with LUFS, RMS, and peak analysis",
      "Kanban task management with dependencies, priorities, and time tracking",
      "Statistics dashboard with activity heatmaps and plugin usage rankings",
      "VST3 plugin bridge with auto-recording and render capture",
      "Cloud collaboration with permissions and annotations",
      "AI artwork generation (DALL-E, Stable Diffusion, Replicate)",
      "7 languages: English, German, Spanish, French, Japanese, Portuguese, Romanian",
      "Windows 10+ and macOS 12+ support",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <>
      <Header />
      <main className="pt-32 pb-20">
        <div className="mx-auto max-w-[680px] px-6">
          <h1 className="text-3xl font-semibold tracking-tight mb-2">
            Changelog
          </h1>
          <p className="text-sm text-muted-foreground mb-12">
            All notable changes to DBundone.
          </p>

          <div className="space-y-12">
            {releases.map((release) => (
              <div key={release.version} className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <span className="inline-flex items-center rounded-md bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-xs font-semibold text-primary">
                    v{release.version}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {release.date}
                  </span>
                  {release.label && (
                    <span className="text-sm font-medium text-foreground">
                      — {release.label}
                    </span>
                  )}
                </div>
                <ul className="space-y-2 pl-1">
                  {release.changes.map((change, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0 mt-2" />
                      <span className="text-[14px] text-muted-foreground leading-relaxed">
                        {change}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
