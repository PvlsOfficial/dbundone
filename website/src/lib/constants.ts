export const SITE_CONFIG = {
  name: "DBundone",
  description:
    "Auto-discover and organize your DAW projects. Supports FL Studio, Ableton, Logic Pro, Pro Tools, Cubase, Bitwig, Reaper, and Studio One. Audio version control with LUFS analysis, kanban task management, statistics dashboard, and VST3 plugin bridge.",
  url: "https://dbundone.com",
  ogImage: "https://dbundone.com/og-default.png",
  twitter: "@dbundone",
} as const;

export const NAV_LINKS = [
  { label: "Features", href: "/#features" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Download", href: "/download" },
  { label: "Blog", href: "/blog" },
  { label: "Docs", href: "/docs" },
] as const;

export const FEATURES = [
  {
    title: "Auto-Discovery & Scanning",
    description:
      "Point to your DAW folders. DBundone scans projects from FL Studio, Ableton, Logic Pro, Cubase, and more — extracting BPM, key, plugins, samples, and mixer tracks automatically.",
    icon: "Scan",
    span: 2,
  },
  {
    title: "Audio Version Control",
    description:
      "Every render, every bounce — tracked. Compare versions side-by-side with integrated LUFS, RMS, and peak dB analysis. Never lose a good mix again.",
    icon: "GitBranch",
    span: 1,
  },
  {
    title: "Deep FLP Analysis",
    description:
      "Native Rust parser reads .flp files directly — every channel, plugin, sample path, mixer track, and pattern name. No need to open FL Studio.",
    icon: "FileSearch",
    span: 1,
  },
  {
    title: "Task Management",
    description:
      "Full kanban boards per project. Set dependencies between tasks, track priorities, log time, create recurring workflows, use templates.",
    icon: "KanbanSquare",
    span: 1,
  },
  {
    title: "Statistics Dashboard",
    description:
      "Activity heatmaps, plugin usage rankings, time investment analytics, genre distribution, streak tracking. Understand your production habits at a glance.",
    icon: "BarChart3",
    span: 2,
  },
  {
    title: "Cloud Collaboration",
    description:
      "Share projects with your team. Set view or edit permissions, leave timestamped annotations on audio, sync versions across devices.",
    icon: "Users",
    span: 1,
  },
] as const;

export const PRICING_TIERS = [
  {
    name: "Free & Open Source",
    price: "$0",
    period: "forever",
    description: "Everything included. No tiers, no paywalls. Open source on GitHub.",
    features: [
      "Unlimited projects & audio versions",
      "LUFS / RMS / Peak analysis",
      "Full task management & kanban",
      "Statistics dashboard & analytics",
      "VST3 & CLAP plugin bridge",
      "Deep FLP analysis (plugins, samples, mixer)",
      "All future updates included",
      "7 languages supported",
    ],
    cta: "Download Free",
    ctaHref: "/download",
    highlighted: false,
  },
] as const;

export const FAQ_ITEMS = [
  {
    question: "What DAWs does DBundone support?",
    answer:
      "DBundone supports all major DAWs: FL Studio, Ableton Live, Logic Pro, Pro Tools, Cubase, Bitwig, Reaper, and Studio One. FL Studio projects get the deepest analysis — we extract every plugin, channel, sample path, mixer track, and pattern using our native Rust parser. All DAWs get full project management, version tracking, and organization features.",
  },
  {
    question: "Does DBundone work offline?",
    answer:
      "Yes, DBundone is a fully offline desktop application. All your project data stays on your machine in a local SQLite database. Cloud collaboration features are entirely optional — you choose what to share and when.",
  },
  {
    question: "How does the VST3 plugin work?",
    answer:
      "The DBundone Bridge is a VST3 plugin you load inside your DAW (FL Studio or Ableton). It connects to the DBundone app over a local WebSocket connection. It can automatically capture recordings when you hit play, detect offline renders/bounces, and push audio versions directly to the correct project — all without leaving your DAW.",
  },
  {
    question: "Is DBundone really free?",
    answer:
      "Yes — DBundone is completely free and open source. Everything is included with no tiers, paywalls, or subscriptions. You can download it, use it, and contribute on GitHub.",
  },
  {
    question: "What data does DBundone collect?",
    answer:
      "DBundone is privacy-first. The desktop app stores everything locally. We don't have access to your projects, files, or production data. The optional cloud collaboration feature uses Supabase for sharing, and only data you explicitly share leaves your machine.",
  },
  {
    question: "How deep is the analysis for each DAW?",
    answer:
      "FL Studio gets the deepest analysis — our native Rust parser extracts every plugin, channel, sample path, mixer track, and pattern directly from .flp files. Other DAWs get project scanning, metadata extraction, and full organization features. We're continuously expanding deep analysis support to more DAWs.",
  },
  {
    question: "What are the system requirements?",
    answer:
      "Windows 10+ (64-bit) or macOS 12+. The app uses roughly 150MB of RAM. The VST3 plugin requires a VST3-compatible DAW. No internet connection required for core functionality.",
  },
  {
    question: "Can I contribute to DBundone?",
    answer:
      "Absolutely. DBundone is open source on GitHub. Feel free to open issues, submit pull requests, or suggest features. Community contributions are welcome.",
  },
] as const;

export const TESTIMONIALS = [
  {
    name: "pvls",
    role: "Producer",
    text: "Had hundreds of FL projects scattered everywhere. DBundone found them all instantly and organized everything. The FLP analysis is insane — seeing every plugin per project without opening FL is wild.",
  },
  {
    name: "R⌀ft3x",
    role: "Producer",
    text: "The VST bridge changed how I work. Load it once in my template and every bounce gets versioned automatically. I haven't lost a mix since.",
  },
  {
    name: "Grxwl",
    role: "Producer",
    text: "Finally something that actually understands DAW files instead of just being a generic folder manager with a music skin. DBundone gets it.",
  },
  {
    name: "Deqonnector",
    role: "Producer",
    text: "The stats dashboard is addictive. Seeing my production habits laid out — streaks, plugin usage, time per project — actually made me more consistent in the studio.",
  },
  {
    name: "kystar",
    role: "Producer",
    text: "Switched from keeping notes in my phone to full kanban boards per project. Way easier to track what needs mixing, what's done, what's waiting on features.",
  },
  {
    name: "prod. dre2x",
    role: "Beat Producer",
    text: "Being able to compare mixes side by side with actual LUFS readings is a game changer. No more guessing if the new version is actually louder or just different.",
  },
] as const;

export const FOOTER_LINKS = {
  product: [
    { label: "Features", href: "/#features" },
    { label: "Pricing", href: "/#pricing" },
    { label: "Download", href: "/download" },
    { label: "Changelog", href: "/changelog" },
  ],
  resources: [
    { label: "Blog", href: "/blog" },
    { label: "Documentation", href: "/docs" },
    { label: "FAQ", href: "/#faq" },
    { label: "System Requirements", href: "/download#requirements" },
  ],
  legal: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Refund Policy", href: "/refund" },
  ],
  social: [
    { label: "Discord", href: "https://discord.gg/dbundone" },
    { label: "Twitter", href: "https://twitter.com/dbundone" },
    { label: "GitHub", href: "https://github.com/PvlsOfficial/dbundone" },
    { label: "YouTube", href: "https://youtube.com/@dbundone" },
  ],
} as const;
