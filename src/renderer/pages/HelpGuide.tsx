import React, { useState, useMemo, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  HelpCircle,
  Music,
  FolderOpen,
  Layers,
  BarChart3,
  Plug,
  FileAudio,
  Search,
  Keyboard,
  ExternalLink,
  Sparkles,
  Puzzle,
  MessageSquarePlus,
  ThumbsUp,
  Send,
  Globe,
  BookOpen,
  Zap,
  X,
  Terminal,
  Copy,
  Check,
  AlertCircle,
  CheckCircle2,

  Compass,
  Download,
  FolderInput,
  Link2,
  Wifi,
} from "lucide-react"
import { Button } from "@/components/ui/button"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { useI18n } from "@/i18n"
import { AppSettings } from "@shared/types"
import { getSupabase } from "@/lib/supabase"

const DiscordIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.947 2.418-2.157 2.418z" />
  </svg>
)

const GitHubIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
)

function CodeBlock({ children }: { children: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(children)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  return (
    <div className="group relative flex items-center gap-2 px-3 py-2 rounded-lg bg-black/40 border border-white/[0.06] font-mono text-xs text-foreground/90 my-1">
      <span className="flex-1 select-all">{children}</span>
      <button type="button" title="Copy to clipboard" onClick={copy} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground">
        {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  )
}

interface HelpGuideProps {
  onBack?: () => void
  onStartTour?: () => void
  settings?: AppSettings
  onSettingsChange?: (settings: Partial<AppSettings>) => void
}

interface Section {
  id: string
  title: string
  icon: React.ReactNode
  color: string
  bgColor: string
  items: { q: string; a: string }[]
}

const SHORTCUTS = [
  { keys: ["Ctrl", "1"], desc: "Go to Dashboard" },
  { keys: ["Ctrl", "2"], desc: "Go to Collections" },
  { keys: ["Ctrl", "3"], desc: "Go to Scheduler" },
  { keys: ["Ctrl", "4"], desc: "Go to Statistics" },
  { keys: ["Ctrl", ","], desc: "Open Settings" },
  { keys: ["Ctrl", "/"], desc: "Open Help" },
  { keys: ["Ctrl", "R"], desc: "Refresh projects" },
  { keys: ["Ctrl", "F"], desc: "Focus search" },
  { keys: ["Ctrl", "N"], desc: "New project" },
  { keys: ["Ctrl", "A"], desc: "Select all (in selection mode)" },
  { keys: ["Space"], desc: "Play / pause preview" },
  { keys: ["Esc"], desc: "Go back / close dialog" },
  { keys: ["Del"], desc: "Delete selected project" },
  { keys: ["Right-click"], desc: "Open context menu on project" },
]

function VSTGuide() {
  return (
    <div className="space-y-8">
      {/* What is it */}
      <div className="p-4 rounded-xl bg-pink-500/5 border border-pink-500/20">
        <div className="flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-pink-500/15 text-pink-400 mt-0.5 shrink-0">
            <Plug className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-1">What is the DBundone Bridge?</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The DBundone Bridge is a VST3 plugin you load inside your DAW (FL Studio, Ableton, etc.).
              It connects to the DBundone desktop app over a local WebSocket and lets you link your open DAW session
              to a specific project — enabling auto-recording, offline render capture, and session tracking without
              leaving your DAW.
            </p>
          </div>
        </div>
      </div>

      {/* Connection info */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
          <Wifi className="w-4 h-4 text-muted-foreground" />
          Connection details
        </h3>
        <div className="p-3 rounded-lg bg-muted/20 border border-border/20 font-mono text-xs space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-16 shrink-0">Protocol</span>
            <span className="text-foreground">WebSocket</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-16 shrink-0">Address</span>
            <span className="text-foreground">ws://127.0.0.1:9847</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-16 shrink-0">Scope</span>
            <span className="text-foreground">Local machine only — no internet required</span>
          </div>
        </div>
      </div>

      {/* Step by step */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Terminal className="w-4 h-4 text-muted-foreground" />
          Setup guide
        </h3>
        <div className="space-y-3">

          {/* Step 1 */}
          <div className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="w-7 h-7 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center shrink-0">1</div>
              <div className="w-px flex-1 bg-border/30 mt-1" />
            </div>
            <div className="pb-4 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Download className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">Download the plugin</p>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                Grab <code className="px-1 py-0.5 rounded bg-muted text-foreground">dbundone-bridge.vst3</code> from the latest GitHub release.
              </p>
              <a
                href="https://github.com/PvlsOfficial/dbundone/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
              >
                github.com/PvlsOfficial/dbundone/releases
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="w-7 h-7 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center shrink-0">2</div>
              <div className="w-px flex-1 bg-border/30 mt-1" />
            </div>
            <div className="pb-4 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <FolderInput className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">Copy to your VST3 folder</p>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                Paste the <code className="px-1 py-0.5 rounded bg-muted text-foreground">.vst3</code> file into the standard VST3 directory for your OS:
              </p>
              <div className="space-y-1">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Windows</p>
                  <CodeBlock>C:\Program Files\Common Files\VST3\</CodeBlock>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">macOS</p>
                  <CodeBlock>/Library/Audio/Plug-Ins/VST3/</CodeBlock>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Linux</p>
                  <CodeBlock>~/.vst3/</CodeBlock>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="w-7 h-7 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center shrink-0">3</div>
              <div className="w-px flex-1 bg-border/30 mt-1" />
            </div>
            <div className="pb-4 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Music className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">Load it in your DAW</p>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                Scan for new plugins in your DAW if needed, then load <strong className="text-foreground font-medium">DBundone Bridge</strong> as an effect on any mixer track. It doesn't process audio — it just needs to be active.
              </p>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <div className="flex items-start gap-2">
                  <span className="text-primary font-bold mt-px">·</span>
                  <span><strong className="text-foreground">FL Studio:</strong> Mixer → any track → Add effect → VST3 → DBundone Bridge</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-primary font-bold mt-px">·</span>
                  <span><strong className="text-foreground">Ableton Live:</strong> Audio Effects → Plug-Ins → VST3 → DBundone Bridge (drag onto any track)</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-primary font-bold mt-px">·</span>
                  <span><strong className="text-foreground">Other DAWs:</strong> Any track that supports VST3 effects will work</span>
                </div>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="w-7 h-7 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center shrink-0">4</div>
              <div className="w-px flex-1 bg-border/30 mt-1" />
            </div>
            <div className="pb-4 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Wifi className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">It connects automatically</p>
              </div>
              <p className="text-xs text-muted-foreground">
                As long as DBundone is open, the plugin will connect on its own via <code className="px-1 py-0.5 rounded bg-muted text-foreground">ws://127.0.0.1:9847</code>.
                You'll see a green status indicator in the plugin UI and in DBundone's Settings → Integrations.
                No configuration needed.
              </p>
            </div>
          </div>

          {/* Step 5 */}
          <div className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="w-7 h-7 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center shrink-0">5</div>
            </div>
            <div className="pb-2 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">Link to a project</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Open a project in DBundone → go to the Project Detail page → click <strong className="text-foreground font-medium">Link Plugin</strong>.
                From that point on, audio renders and recordings in your DAW are automatically associated with that project.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* What it captures */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">What gets captured automatically</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
          {[
            { icon: <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />, text: "Audio renders / exports from your DAW" },
            { icon: <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />, text: "Offline renders (when DAW isn't open)" },
            { icon: <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />, text: "Session start / stop events" },
            { icon: <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />, text: "Version history entries per render" },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground p-2.5 rounded-lg bg-muted/20 border border-border/20">
              {item.icon}
              {item.text}
            </div>
          ))}
        </div>
      </div>

      {/* Troubleshooting */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400" />
          Troubleshooting
        </h3>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
          {[
            {
              problem: "Plugin doesn't appear in my DAW",
              fix: "Trigger a plugin rescan in your DAW settings. In FL Studio: Options → Manage Plugins → Find More. In Ableton: Preferences → Plug-Ins → Rescan.",
            },
            {
              problem: "Plugin shows as disconnected",
              fix: "Make sure DBundone is running first, then reload the plugin in your DAW. The connection is established when the plugin loads.",
            },
            {
              problem: "Renders aren't being captured",
              fix: "Ensure you've linked the plugin to a project via Project Detail → Link Plugin. Without a linked project, captures are ignored.",
            },
          ].map((item, i) => (
            <div key={i} className="p-3 rounded-lg bg-muted/20 border border-border/20">
              <p className="text-xs font-medium text-foreground mb-0.5">{item.problem}</p>
              <p className="text-xs text-muted-foreground">{item.fix}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ShortcutsTable() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
      {SHORTCUTS.map((s, i) => (
        <div key={i} className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl bg-muted/20 border border-border/20 hover:border-border/35 transition-colors">
          <span className="text-sm text-muted-foreground">{s.desc}</span>
          <div className="flex items-center gap-1 shrink-0">
            {s.keys.map((k, ki) => (
              <React.Fragment key={ki}>
                {ki > 0 && <span className="text-muted-foreground/40 text-xs">+</span>}
                <kbd className="px-2 py-0.5 rounded bg-muted border border-border/40 text-xs font-mono text-foreground">{k}</kbd>
              </React.Fragment>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export const HelpGuide: React.FC<HelpGuideProps> = ({ onStartTour, settings, onSettingsChange }) => {
  const { t } = useI18n()
  const [activeSection, setActiveSection] = useState("getting-started")
  const [activeTab, setActiveTab] = useState<"help" | "requests">("help")
  const [searchQuery, setSearchQuery] = useState("")
  const [newTitle, setNewTitle] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [newCategory, setNewCategory] = useState("New Feature")

  const sections: Section[] = useMemo(() => [
    {
      id: "getting-started",
      title: t("help.section.gettingStarted"),
      icon: <Sparkles className="w-4 h-4" />,
      color: "text-yellow-400",
      bgColor: "bg-yellow-400/10",
      items: [
        { q: t("help.gs.q1"), a: t("help.gs.a1") },
        { q: t("help.gs.q2"), a: t("help.gs.a2") },
        { q: t("help.gs.q3"), a: t("help.gs.a3") },
      ],
    },
    {
      id: "projects",
      title: t("help.section.projects"),
      icon: <Music className="w-4 h-4" />,
      color: "text-blue-400",
      bgColor: "bg-blue-400/10",
      items: [
        { q: t("help.proj.q1"), a: t("help.proj.a1") },
        { q: t("help.proj.q2"), a: t("help.proj.a2") },
        { q: t("help.proj.q3"), a: t("help.proj.a3") },
        { q: t("help.proj.q4"), a: t("help.proj.a4") },
      ],
    },
    {
      id: "audio",
      title: t("help.section.audio"),
      icon: <FileAudio className="w-4 h-4" />,
      color: "text-green-400",
      bgColor: "bg-green-400/10",
      items: [
        { q: t("help.audio.q1"), a: t("help.audio.a1") },
        { q: t("help.audio.q2"), a: t("help.audio.a2") },
        { q: t("help.audio.q3"), a: t("help.audio.a3") },
        { q: t("help.audio.q4"), a: t("help.audio.a4") },
      ],
    },
    {
      id: "collections",
      title: "Collections",
      icon: <FolderOpen className="w-4 h-4" />,
      color: "text-orange-400",
      bgColor: "bg-orange-400/10",
      items: [
        { q: t("help.groups.q1"), a: t("help.groups.a1") },
        { q: t("help.groups.q2"), a: t("help.groups.a2") },
      ],
    },
    {
      id: "kanban",
      title: t("help.section.kanban"),
      icon: <Layers className="w-4 h-4" />,
      color: "text-purple-400",
      bgColor: "bg-purple-400/10",
      items: [
        { q: t("help.kanban.q1"), a: t("help.kanban.a1") },
        { q: t("help.kanban.q2"), a: t("help.kanban.a2") },
        { q: t("help.kanban.q3"), a: t("help.kanban.a3") },
      ],
    },
    {
      id: "analysis",
      title: t("help.section.analysis"),
      icon: <Puzzle className="w-4 h-4" />,
      color: "text-cyan-400",
      bgColor: "bg-cyan-400/10",
      items: [
        { q: t("help.analysis.q1"), a: t("help.analysis.a1") },
        { q: t("help.analysis.q2"), a: t("help.analysis.a2") },
        { q: t("help.analysis.q3"), a: t("help.analysis.a3") },
      ],
    },
    {
      id: "plugin-bridge",
      title: t("help.section.pluginBridge"),
      icon: <Plug className="w-4 h-4" />,
      color: "text-pink-400",
      bgColor: "bg-pink-400/10",
      items: [],
    },
    {
      id: "statistics",
      title: t("help.section.statistics"),
      icon: <BarChart3 className="w-4 h-4" />,
      color: "text-emerald-400",
      bgColor: "bg-emerald-400/10",
      items: [
        { q: t("help.stats.q1"), a: t("help.stats.a1") },
      ],
    },
    {
      id: "shortcuts",
      title: t("help.section.shortcuts"),
      icon: <Keyboard className="w-4 h-4" />,
      color: "text-amber-400",
      bgColor: "bg-amber-400/10",
      items: [],
    },
  ], [t])

  // IDs of requests this user submitted (stored locally)
  const myRequestIds = useMemo(
    () => new Set((settings?.featureRequests || []).map(r => r.id)),
    [settings?.featureRequests]
  )

  // All requests fetched from Supabase (shown to everyone)
  const [allRequests, setAllRequests] = useState<{ id: string; title: string; description?: string; category?: string; votes: number; created_at: string }[]>([])
  const [requestsLoading, setRequestsLoading] = useState(false)

  useEffect(() => {
    if (activeTab !== "requests") return
    setRequestsLoading(true)
    getSupabase()
      .from("feature_requests")
      .select("id, title, description, category, votes, created_at")
      .order("votes", { ascending: false })
      .then(({ data }) => {
        if (data) setAllRequests(data)
      })
      .finally(() => setRequestsLoading(false))
  }, [activeTab])

  const handleSubmitRequest = useCallback(async () => {
    if (!newTitle.trim() || !onSettingsChange) return
    const title = newTitle.trim()
    const description = newDescription.trim() || undefined
    const category = newCategory
    setNewTitle("")
    setNewDescription("")
    setNewCategory("New Feature")
    try {
      const sb = getSupabase()
      const { data } = await sb
        .from("feature_requests")
        .insert({ title, description, category })
        .select("id, title, description, category, votes, created_at")
        .single()
      if (data) {
        // Track locally using the Supabase UUID so we can identify ownership
        onSettingsChange({
          featureRequests: [...(settings?.featureRequests || []), {
            id: data.id,
            title: data.title,
            description: data.description ?? undefined,
            category: data.category ?? undefined,
            votes: data.votes,
            createdAt: data.created_at,
          }],
        })
        setAllRequests(prev => [data, ...prev])
      }
    } catch (e) {
      console.warn("[FeatureRequests] Supabase insert failed:", e)
    }
  }, [newTitle, newDescription, newCategory, settings?.featureRequests, onSettingsChange])

  // Removing a request only hides it from the user's local list; the Supabase record stays
  const handleDeleteRequest = useCallback((id: string) => {
    if (!onSettingsChange) return
    onSettingsChange({ featureRequests: (settings?.featureRequests || []).filter(r => r.id !== id) })
  }, [settings?.featureRequests, onSettingsChange])

  const filteredSections = searchQuery.trim()
    ? sections.filter(s =>
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.items.some(i =>
          i.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
          i.a.toLowerCase().includes(searchQuery.toLowerCase())
        )
      )
    : sections

  const currentSection = sections.find(s => s.id === activeSection) ?? sections[0]

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border/30 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <HelpCircle className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">{t("help.title")}</h1>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab("help")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              activeTab === "help"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            )}
          >
            <span className="flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" />Docs</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("requests")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5",
              activeTab === "requests"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            )}
          >
            <MessageSquarePlus className="w-3.5 h-3.5" />
            Ideas
            {allRequests.length > 0 && (
              <span className="ml-0.5 text-[10px] bg-primary/20 text-primary px-1.5 py-px rounded-full font-semibold">
                {allRequests.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "help" ? (
          <motion.div
            key="help"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex-1 flex overflow-hidden"
          >
            {/* Sidebar */}
            <div className="w-56 shrink-0 border-r border-border/30 flex flex-col overflow-hidden bg-background/30">
              {/* Search */}
              <div className="p-3 border-b border-border/20">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search…"
                    className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg bg-muted/30 border border-border/20 focus:outline-none focus:border-primary/40 text-foreground placeholder:text-muted-foreground/60 transition-colors"
                  />
                  {searchQuery && (
                    <button type="button" title="Clear search" onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Nav */}
              <ScrollArea className="flex-1 py-2">
                <div className="px-2 space-y-0.5">
                  {filteredSections.map(s => (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => { setActiveSection(s.id); setSearchQuery("") }}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors text-sm",
                        activeSection === s.id
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                      )}
                    >
                      <div className={cn("shrink-0", activeSection === s.id ? s.color : "")}>
                        {s.icon}
                      </div>
                      <span className="truncate font-medium">{s.title}</span>
                      {s.items.length > 0 && (
                        <span className={cn(
                          "ml-auto text-[10px] px-1.5 py-px rounded-full font-semibold shrink-0",
                          activeSection === s.id ? "bg-primary/20 text-primary" : "bg-muted/50 text-muted-foreground"
                        )}>
                          {s.items.length}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </ScrollArea>

              {/* Community links at bottom of sidebar */}
              <div className="p-3 border-t border-border/20 space-y-1.5">
                <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider px-1 mb-2">Community</p>
                <a
                  href="https://github.com/PvlsOfficial/dbundone"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors group"
                >
                  <GitHubIcon className="w-3.5 h-3.5 shrink-0" />
                  <span>GitHub</span>
                  <ExternalLink className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-50 transition-opacity" />
                </a>
                <a
                  href="https://dbundone.vercel.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors group"
                >
                  <Globe className="w-3.5 h-3.5 shrink-0" />
                  <span>Website</span>
                  <ExternalLink className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-50 transition-opacity" />
                </a>
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-muted-foreground/40 cursor-default">
                  <DiscordIcon className="w-3.5 h-3.5 shrink-0" />
                  <span>Discord</span>
                  <span className="ml-auto text-[9px] bg-muted/40 px-1.5 py-px rounded-full">soon</span>
                </div>
                {onStartTour && (
                  <button
                    type="button"
                    onClick={onStartTour}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors mt-1"
                  >
                    <Compass className="w-3.5 h-3.5 shrink-0" />
                    <span>{t("help.takeTour")}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Content */}
            <ScrollArea className="flex-1">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeSection}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                  className="p-8 h-full"
                >
                  {/* Section header */}
                  <div className="flex items-center gap-3 mb-8">
                    <div className={cn("p-2.5 rounded-xl", currentSection.bgColor)}>
                      <span className={currentSection.color}>{currentSection.icon}</span>
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-foreground">{currentSection.title}</h2>
                      {currentSection.items.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">{currentSection.items.length} topics</p>
                      )}
                    </div>
                  </div>

                  {/* Custom renderers for special sections */}
                  {activeSection === "plugin-bridge" && <VSTGuide />}
                  {activeSection === "shortcuts" && <ShortcutsTable />}

                  {/* Standard FAQ items — 2-col grid on wider screens */}
                  {currentSection.items.length > 0 && (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 content-start">
                      {currentSection.items.map((item, idx) => (
                        <div key={idx} className="p-5 rounded-xl bg-card/40 border border-border/25 hover:border-border/40 transition-colors flex flex-col">
                          <div className="flex items-start gap-2.5 mb-2.5">
                            <Zap className="w-3.5 h-3.5 text-primary/60 mt-0.5 shrink-0" />
                            <h4 className="text-sm font-semibold text-foreground leading-snug">{item.q}</h4>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed pl-6 flex-1">{item.a}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </ScrollArea>
          </motion.div>
        ) : (
          /* Feature Requests */
          <motion.div
            key="requests"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex-1 overflow-hidden"
          >
            <ScrollArea className="h-full">
              <div className="p-8">
                {/* Submit box — full width, prominent */}
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 mb-8">
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-xl bg-primary/15 text-primary shrink-0">
                      <MessageSquarePlus className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-foreground mb-1">{t("help.requests.submit")}</h3>
                      <p className="text-sm text-muted-foreground mb-4">{t("help.requests.submitDesc")}</p>
                      <div className="flex flex-col gap-3">
                        <div className="flex gap-2">
                          <Input
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            placeholder="Short title for your idea *"
                            className="flex-1 bg-background/60"
                            maxLength={120}
                          />
                          <select
                            value={newCategory}
                            onChange={(e) => setNewCategory(e.target.value)}
                            title="Category"
                            aria-label="Category"
                            className="shrink-0 rounded-md border border-input bg-background/60 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                          >
                            <option>New Feature</option>
                            <option>UI / UX</option>
                            <option>Performance</option>
                            <option>Integration</option>
                            <option>Bug</option>
                          </select>
                        </div>
                        <Textarea
                          value={newDescription}
                          onChange={(e) => setNewDescription(e.target.value)}
                          placeholder="Optional: describe what you'd like in more detail…"
                          className="bg-background/60 resize-none"
                          rows={3}
                          maxLength={1000}
                        />
                        <div className="flex justify-end">
                          <Button size="sm" onClick={handleSubmitRequest} disabled={!newTitle.trim()} className="gap-1.5">
                            <Send className="w-3.5 h-3.5" />
                            {t("help.requests.send")}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {requestsLoading ? (
                  <div className="flex items-center justify-center py-24 text-muted-foreground">
                    <span className="text-sm">Loading ideas…</span>
                  </div>
                ) : allRequests.length > 0 ? (
                  <div>
                    <p className="text-xs text-muted-foreground mb-4">{allRequests.length} ideas · sorted by votes</p>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                    {allRequests.map((request) => {
                      const isOwn = myRequestIds.has(request.id)
                      return (
                        <motion.div
                          key={request.id}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-start gap-3 p-4 rounded-xl border border-border/30 bg-card/30 group hover:border-border/50 transition-colors"
                        >
                          <div className="flex flex-col items-center gap-0.5 min-w-[44px] py-2 px-2.5 rounded-lg bg-muted/30 shrink-0">
                            <ThumbsUp className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-xs font-semibold">{request.votes}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <p className="text-sm font-medium text-foreground leading-snug">{request.title}</p>
                              {isOwn && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-medium shrink-0">You</span>
                              )}
                              {request.category && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium shrink-0">{request.category}</span>
                              )}
                            </div>
                            {request.description && (
                              <p className="text-xs text-muted-foreground leading-relaxed mb-1.5">{request.description}</p>
                            )}
                            <p className="text-[10px] text-muted-foreground/60">{new Date(request.created_at).toLocaleDateString()}</p>
                          </div>
                          {isOwn && (
                            <button
                              type="button"
                              title="Remove from your list"
                              onClick={() => handleDeleteRequest(request.id)}
                              className="p-1 rounded-md text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </motion.div>
                      )
                    })}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
                    <MessageSquarePlus className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">{t("help.requests.empty")}</p>
                    <p className="text-sm mt-1 opacity-70">{t("help.requests.emptyHint")}</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default HelpGuide
