# DBundone — Music Project Manager

<p align="center">
  <img src="assets/logo%20dbundone.svg" alt="DBundone logo" width="120" />
</p>

<p align="center">
  <strong>Offline-first desktop app for organising, analysing, and sharing music production projects.</strong><br />
  Built with <a href="https://v2.tauri.app">Tauri v2</a>, React 18, and Rust.
</p>

<p align="center">
  <a href="#features">Features</a> ·
  <a href="#screenshots">Screenshots</a> ·
  <a href="#quickstart">Quickstart</a> ·
  <a href="#project-structure">Structure</a> ·
  <a href="#vst-plugin">VST Plugin</a> ·
  <a href="#website">Website</a> ·
  <a href="#contributing">Contributing</a> ·
  <a href="#license">License</a>
</p>

---

## Features

| Category | Highlights |
|----------|-----------|
| **Project Management** | Grid / List / Gallery views, rich metadata (BPM, key, tags, collections), DAW quick-launch, artwork generation |
| **Audio Previews** | Built-in player with WaveSurfer.js waveform, scrub, volume control |
| **FLP Analysis** | Deep-parse FL Studio projects — plugins, samples, mixer tracks, patterns, channel racks |
| **Collections** | Organise projects into named collections with custom artwork & descriptions |
| **Task Board** | Kanban-style scheduler (To Do → In Progress → Done) with due-date tracking |
| **Statistics** | Plugin usage heatmaps, sample pack rankings, most reused individual samples, FL version distribution |
| **Sharing** | Supabase-backed collaboration — share projects, accept/decline, real-time status |
| **VST Bridge** | Companion CLAP/VST3 plugin sends live session data (play state, BPM, transport) to the app via WebSocket |
| **ZIP Import** | Import `.zip` archives containing FLP projects directly from the file picker |
| **Internationalization** | 7 languages — English, German, Spanish, French, Japanese, Portuguese, Romanian |
| **Guided Tour** | 21-step interactive app tour for new users |
| **Theming** | Dark / Light / System themes with accent-colour customisation |

## Screenshots

> no screenshots yet.

## Quickstart

### Prerequisites

| Tool | Version |
|------|---------|
| **Node.js** | ≥ 18 |
| **Rust** | ≥ 1.77 (install via [rustup](https://rustup.rs)) |
| **Tauri CLI** | `npm i -g @tauri-apps/cli@^2` |

Platform-specific Tauri v2 dependencies: <https://v2.tauri.app/start/prerequisites/>

### Install & Run

```bash
# 1. Clone
git clone https://github.com/YOUR_USERNAME/dbundone.git
cd dbundone

# 2. Install JS dependencies
npm install

# 3. Start Tauri dev server (compiles Rust + launches app)
npm run dev
```

### Build for Production

```bash
npm run build          # NSIS installer → src-tauri/target/release/bundle/
```

## Project Structure

```
dbundone/
├── src/
│   ├── renderer/          # React 18 + TypeScript frontend
│   │   ├── components/    # Reusable UI components (ProjectCard, AudioPlayer, …)
│   │   ├── pages/         # Route pages (Dashboard, Statistics, Settings, …)
│   │   ├── contexts/      # React contexts (auth, theme)
│   │   ├── hooks/         # Custom hooks
│   │   ├── i18n/          # Translations (en, de, es, fr, ja, pt, ro)
│   │   ├── lib/           # Utilities, Supabase client, Tauri API bridge
│   │   ├── styles/        # Global CSS
│   │   └── types/         # Frontend-only types
│   └── shared/
│       └── types.ts       # Types shared between renderer & Tauri
├── src-tauri/             # Tauri v2 Rust backend
│   ├── src/
│   │   ├── lib.rs         # Plugin registration & command setup
│   │   ├── commands.rs    # IPC command handlers
│   │   ├── database.rs    # SQLite (rusqlite) schema & queries
│   │   ├── scanner.rs     # Folder scanner, ZIP extractor
│   │   ├── flp_parser.rs  # FL Studio .flp binary parser
│   │   ├── audio_analysis.rs  # Audio feature extraction (symphonia)
│   │   └── websocket.rs   # WebSocket server for VST bridge
│   ├── Cargo.toml
│   └── tauri.conf.json
├── dbundone-vst/          # Companion CLAP / VST3 plugin (Rust)
│   ├── plugins/
│   │   └── dbundone-bridge/   # NIH-plug based bridge plugin
│   └── xtask/                 # Build helper (bundle task)
├── website/               # Next.js 16 marketing site
│   ├── src/app/           # App Router pages (/, /docs, /pricing, /blog, …)
│   ├── src/components/    # Landing page sections, shared UI
│   └── src/content/       # MDX blog posts & docs
├── assets/                # Icons, logo, intro audio
├── supabase-schema.sql    # Supabase database schema for sharing features
├── package.json           # Root workspace scripts
└── LICENSE                # MIT
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop framework | Tauri v2 |
| Frontend | React 18 · TypeScript · Vite 5 · Tailwind CSS 3 |
| Backend | Rust (2021 edition) · rusqlite · symphonia · tokio |
| UI primitives | Radix UI · shadcn/ui · Framer Motion · Lucide icons |
| Audio | WaveSurfer.js (waveform) · symphonia (analysis) |
| Cloud (optional) | Supabase (auth + sharing) · Stripe (payments) |
| VST plugin | NIH-plug (CLAP + VST3) · WebSocket bridge |
| Website | Next.js 16 · React 19 · Tailwind CSS 4 · MDX |

## VST Plugin

The `dbundone-vst/` directory contains a companion **CLAP / VST3** plugin built with [NIH-plug](https://github.com/robbert-vdh/nih-plug). When loaded in your DAW, it connects to the desktop app over a local WebSocket and streams live session data (transport state, BPM, project info).

### Building the Plugin

```bash
cd dbundone-vst
cargo xtask bundle dbundone-bridge --release
# Output: target/bundled/dbundone-bridge.clap  +  dbundone-bridge.vst3/
```

Copy the resulting files to your system's plugin folder.

### Main App

The desktop app embeds a **Supabase anon/publishable key** in `src/renderer/lib/supabase.ts` — this is safe for client-side use (protected by Row Level Security). No `.env` file is required for the desktop app to function.

### Website (`website/.env.example`)

Copy `website/.env.example` to `website/.env.local` and fill in your Stripe credentials.

## Database

Local project data is stored in an **SQLite** database in the user's app-data directory:

| OS | Path |
|----|------|
| Windows | `%APPDATA%/com.dbundone.app/` |
| macOS | `~/Library/Application Support/com.dbundone.app/` |
| Linux | `~/.config/com.dbundone.app/` |

For cloud sharing features, see `supabase-schema.sql` for the required Supabase tables.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Space` | Play / Pause audio preview |
| `Escape` | Close modal |
| `Ctrl+K` | Focus search |

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

## License

[MIT](LICENSE) — © 2026 DBundone
