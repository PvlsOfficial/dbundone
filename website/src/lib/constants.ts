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
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Get started with the essentials",
    features: [
      "Up to 25 projects",
      "Basic scanning & metadata extraction",
      "3 audio versions per project",
      "Project status tracking",
      "Basic search & filtering",
      "7 languages supported",
    ],
    cta: "Download Free",
    ctaHref: "/download",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$79",
    period: "one-time",
    description: "Everything you need. Pay once, own it forever.",
    features: [
      "Unlimited projects & audio versions",
      "LUFS / RMS / Peak analysis",
      "Full task management & kanban",
      "Statistics dashboard & analytics",
      "AI artwork generation",
      "VST3 plugin bridge",
      "Cloud collaboration & sharing",
      "Deep FLP analysis (plugins, samples, mixer)",
      "All future updates included",
      "Priority support",
    ],
    cta: "Buy Now",
    ctaHref: "/api/checkout",
    highlighted: true,
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
    question: "What's included in the free version?",
    answer:
      "The free version gives you full access to project scanning, metadata extraction, search & filtering, status tracking, and basic organization for up to 25 projects with 3 audio versions each. It's not a trial — it works forever.",
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
    question: "What's your refund policy?",
    answer:
      "We offer a full refund within 14 days of purchase, no questions asked. If DBundone doesn't fit your workflow, we'll refund you immediately. Contact us at support@dbundone.com.",
  },
] as const;

export const TESTIMONIALS = [
  {
    name: "Marcus T.",
    role: "Hip-Hop Producer",
    text: "I had 400+ FL Studio projects scattered across three drives. DBundone found all of them in under a minute and organized everything. The FLP analysis showing all my plugins per project is insane.",
  },
  {
    name: "Sarah K.",
    role: "Electronic Music Artist",
    text: "The audio version control alone is worth it. Being able to A/B compare mixes with actual LUFS readings instead of just guessing? Game changer for my mastering workflow.",
  },
  {
    name: "DJ Rhythm",
    role: "Beatmaker & YouTuber",
    text: "I was using spreadsheets to track my beats. Now I have a kanban board, automatic BPM detection, and stats showing me I actually spend more time in the studio than I thought. My workflow has never been this clean.",
  },
  {
    name: "Alex Chen",
    role: "Film Composer",
    text: "The VST plugin bridge is brilliant. I load it in my template, and every recording session gets automatically versioned and linked to the project. No more manually exporting and renaming files.",
  },
  {
    name: "Luna Beats",
    role: "Lo-Fi Producer",
    text: "Finally something built for how producers actually work. Not another generic project manager with a music skin — DBundone understands DAW files natively.",
  },
  {
    name: "Kai Westbrook",
    role: "Mixing Engineer",
    text: "Being able to see every plugin used across all my client projects from one dashboard saved me hours of troubleshooting. I can instantly find which projects use a specific VST.",
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
    { label: "GitHub", href: "https://github.com/dbundone" },
    { label: "YouTube", href: "https://youtube.com/@dbundone" },
  ],
} as const;
