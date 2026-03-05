import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import Link from "next/link";
import { Download, FolderOpen, Plug, BarChart3, Users, Palette } from "lucide-react";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "Get started with DBundone. Learn how to set up project scanning, use the VST3 plugin, and manage your music productions.",
  alternates: { canonical: "https://dbundone.com/docs" },
};

const steps = [
  {
    icon: Download,
    title: "1. Download & Install",
    content:
      "Download DBundone for Windows or macOS from the download page. Run the installer — it includes both the desktop app and the VST3 plugin. No account required to get started.",
    link: { label: "Download page", href: "/download" },
  },
  {
    icon: FolderOpen,
    title: "2. Add Your DAW Folders",
    content:
      "Open Settings and add the folders where your DAW projects live. DBundone will scan for FL Studio (.flp), Ableton (.als), Logic Pro, Pro Tools, Cubase, Bitwig, Reaper, and Studio One project files. Metadata like BPM, key, and creation date is extracted automatically.",
  },
  {
    icon: Plug,
    title: "3. Set Up the VST3 Plugin",
    content:
      'Load "DBundone Bridge" as a VST3 plugin on your master bus (or any bus) in your DAW. It auto-discovers the DBundone app on your machine. Link it to a project, and it will capture recordings, bounces, and renders automatically.',
  },
  {
    icon: BarChart3,
    title: "4. Organize & Track",
    content:
      "Use the dashboard to browse, filter, and search your projects. Set statuses (Idea, In Progress, Mixing, Mastering, Released). Create kanban boards with tasks, priorities, and deadlines. Track time spent per project.",
  },
  {
    icon: Users,
    title: "5. Collaborate (Optional)",
    content:
      "Create an account to unlock cloud collaboration. Share projects with teammates, set view or edit permissions, leave timestamped annotations on audio versions, and sync across devices.",
  },
  {
    icon: Palette,
    title: "6. Generate Artwork (Optional)",
    content:
      "Use the AI artwork feature to generate cover art for your projects. Supports DALL-E, Stable Diffusion (local or API), Replicate, or any OpenAI-compatible endpoint. Configure your API keys in Settings.",
  },
];

export default function DocsPage() {
  return (
    <>
      <Header />
      <main className="pt-32 pb-20">
        <div className="mx-auto max-w-[680px] px-6">
          <h1 className="text-3xl font-semibold tracking-tight mb-2">
            Getting Started
          </h1>
          <p className="text-sm text-muted-foreground mb-12">
            Set up DBundone in under 5 minutes.
          </p>

          <div className="space-y-10">
            {steps.map((step) => (
              <div key={step.title} className="flex gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/15 mt-0.5">
                  <step.icon className="h-[18px] w-[18px] text-primary" />
                </div>
                <div>
                  <h2 className="text-[15px] font-semibold mb-2">
                    {step.title}
                  </h2>
                  <p className="text-[14px] text-muted-foreground leading-relaxed">
                    {step.content}
                  </p>
                  {step.link && (
                    <Link
                      href={step.link.href}
                      className="inline-block mt-2 text-[13px] text-primary hover:underline"
                    >
                      {step.link.label} &rarr;
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-16 rounded-xl border border-border/50 bg-card/30 p-6">
            <h3 className="text-[15px] font-semibold mb-2">
              Keyboard Shortcuts
            </h3>
            <div className="grid grid-cols-2 gap-3 text-[13px]">
              {[
                ["Ctrl/Cmd + F", "Search projects"],
                ["Ctrl/Cmd + N", "New project"],
                ["Ctrl/Cmd + ,", "Open settings"],
                ["Space", "Play/pause audio preview"],
                ["1-7", "Set project status"],
                ["Ctrl/Cmd + G", "Toggle grid/list view"],
              ].map(([key, action]) => (
                <div key={key} className="flex items-center gap-2">
                  <code className="bg-muted/50 px-1.5 py-0.5 rounded text-[11px] font-mono text-muted-foreground">
                    {key}
                  </code>
                  <span className="text-muted-foreground">{action}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              Need help?{" "}
              <a
                href="https://discord.gg/dbundone"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Join our Discord
              </a>{" "}
              or email{" "}
              <a
                href="mailto:support@dbundone.com"
                className="text-primary hover:underline"
              >
                support@dbundone.com
              </a>
              .
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
