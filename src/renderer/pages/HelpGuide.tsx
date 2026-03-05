import React, { useState, useMemo, useCallback } from "react"
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
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Sparkles,
  Puzzle,
  Share2,
  Compass,
  MessageSquarePlus,
  ThumbsUp,
  Send,
  Globe,
  BookOpen,
  Zap,
  ArrowRight,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useI18n } from "@/i18n"
import { AppSettings } from "@shared/types"

// Discord icon SVG inline
const DiscordIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.947 2.418-2.157 2.418z" />
  </svg>
)

// GitHub icon SVG inline
const GitHubIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
)

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

export const HelpGuide: React.FC<HelpGuideProps> = ({ onStartTour, settings, onSettingsChange }) => {
  const { t } = useI18n()
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["getting-started"]))
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState<"help" | "requests">("help")
  const [newRequest, setNewRequest] = useState("")

  const sections: Section[] = useMemo(() => [
  {
    id: "getting-started",
    title: t("help.section.gettingStarted"),
    icon: <Sparkles className="w-4 h-4" />,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
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
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
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
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    items: [
      { q: t("help.audio.q1"), a: t("help.audio.a1") },
      { q: t("help.audio.q2"), a: t("help.audio.a2") },
      { q: t("help.audio.q3"), a: t("help.audio.a3") },
      { q: t("help.audio.q4"), a: t("help.audio.a4") },
    ],
  },
  {
    id: "groups",
    title: t("help.section.groups"),
    icon: <FolderOpen className="w-4 h-4" />,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    items: [
      { q: t("help.groups.q1"), a: t("help.groups.a1") },
      { q: t("help.groups.q2"), a: t("help.groups.a2") },
    ],
  },
  {
    id: "kanban",
    title: t("help.section.kanban"),
    icon: <Layers className="w-4 h-4" />,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
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
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10",
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
    color: "text-pink-500",
    bgColor: "bg-pink-500/10",
    items: [
      { q: t("help.bridge.q1"), a: t("help.bridge.a1") },
      { q: t("help.bridge.q2"), a: t("help.bridge.a2") },
      { q: t("help.bridge.q3"), a: t("help.bridge.a3") },
    ],
  },
  {
    id: "statistics",
    title: t("help.section.statistics"),
    icon: <BarChart3 className="w-4 h-4" />,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    items: [
      { q: t("help.stats.q1"), a: t("help.stats.a1") },
    ],
  },
  {
    id: "shortcuts",
    title: t("help.section.shortcuts"),
    icon: <Keyboard className="w-4 h-4" />,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    items: [
      { q: t("help.shortcuts.q1"), a: t("help.shortcuts.a1") },
    ],
  },
  ], [t])

  const toggleSection = (id: string) => {
    const next = new Set(expandedSections)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpandedSections(next)
  }

  const expandAll = () => {
    setExpandedSections(new Set(sections.map(s => s.id)))
  }

  const collapseAll = () => {
    setExpandedSections(new Set())
  }

  const filteredSections = searchQuery.trim()
    ? sections.map(s => ({
        ...s,
        items: s.items.filter(
          i =>
            i.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
            i.a.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      })).filter(s => s.items.length > 0)
    : sections

  const totalQuestions = sections.reduce((acc, s) => acc + s.items.length, 0)

  // Feature requests
  const featureRequests = settings?.featureRequests || []

  const handleSubmitRequest = useCallback(() => {
    if (!newRequest.trim() || !onSettingsChange) return
    const request = {
      id: Date.now().toString(),
      text: newRequest.trim(),
      votes: 1,
      createdAt: new Date().toISOString(),
    }
    onSettingsChange({
      featureRequests: [...featureRequests, request],
    })
    setNewRequest("")
  }, [newRequest, featureRequests, onSettingsChange])

  const handleVote = useCallback((id: string) => {
    if (!onSettingsChange) return
    onSettingsChange({
      featureRequests: featureRequests.map(r =>
        r.id === id ? { ...r, votes: r.votes + 1 } : r
      ),
    })
  }, [featureRequests, onSettingsChange])

  const handleDeleteRequest = useCallback((id: string) => {
    if (!onSettingsChange) return
    onSettingsChange({
      featureRequests: featureRequests.filter(r => r.id !== id),
    })
  }, [featureRequests, onSettingsChange])

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="px-6 py-5 border-b border-border/30"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-xl bg-primary/10">
              <HelpCircle className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">{t("help.title")}</h1>
          </div>
          <div className="flex items-center gap-2">
            {onStartTour && (
              <Button
                variant="outline"
                size="sm"
                onClick={onStartTour}
                className="gap-2"
              >
                <Compass className="w-4 h-4" />
                {t("help.takeTour")}
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-6">
          <button
            onClick={() => setActiveTab("help")}
            className={cn(
              "flex items-center gap-2 pb-2 text-sm font-medium transition-colors border-b-2",
              activeTab === "help"
                ? "text-primary border-primary"
                : "text-muted-foreground border-transparent hover:text-foreground"
            )}
          >
            <BookOpen className="w-4 h-4" />
            {t("help.tab.helpCenter")}
          </button>
          <button
            onClick={() => setActiveTab("requests")}
            className={cn(
              "flex items-center gap-2 pb-2 text-sm font-medium transition-colors border-b-2",
              activeTab === "requests"
                ? "text-primary border-primary"
                : "text-muted-foreground border-transparent hover:text-foreground"
            )}
          >
            <MessageSquarePlus className="w-4 h-4" />
            {t("help.tab.featureRequests")}
            {featureRequests.length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {featureRequests.length}
              </Badge>
            )}
          </button>
        </div>
      </motion.div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <AnimatePresence mode="wait">
          {activeTab === "help" ? (
            <motion.div
              key="help"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
              className="p-6"
            >
              {/* Quick start hero cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {/* Take a Tour card */}
                {onStartTour && (
                  <motion.button
                    onClick={onStartTour}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className="group relative overflow-hidden rounded-xl border border-border/30 bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 p-5 text-left transition-colors hover:border-primary/30"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -translate-y-8 translate-x-8 group-hover:scale-150 transition-transform duration-500" />
                    <div className="relative">
                      <div className="p-2 w-fit rounded-lg bg-primary/15 text-primary mb-3">
                        <Compass className="w-5 h-5" />
                      </div>
                      <h3 className="font-semibold text-foreground mb-1">{t("help.quickStart.tour")}</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">{t("help.quickStart.tourDesc")}</p>
                      <div className="flex items-center gap-1 mt-3 text-xs text-primary font-medium">
                        {t("help.quickStart.startTour")}
                        <ArrowRight className="w-3 h-3" />
                      </div>
                    </div>
                  </motion.button>
                )}

                {/* Keyboard shortcuts card */}
                <motion.button
                  onClick={() => {
                    setExpandedSections(new Set(["shortcuts"]))
                    setTimeout(() => {
                      document.getElementById("section-shortcuts")?.scrollIntoView({ behavior: "smooth" })
                    }, 100)
                  }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="group relative overflow-hidden rounded-xl border border-border/30 bg-gradient-to-br from-amber-500/5 via-amber-500/10 to-amber-500/5 p-5 text-left transition-colors hover:border-amber-500/30"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full -translate-y-8 translate-x-8 group-hover:scale-150 transition-transform duration-500" />
                  <div className="relative">
                    <div className="p-2 w-fit rounded-lg bg-amber-500/15 text-amber-500 mb-3">
                      <Keyboard className="w-5 h-5" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-1">{t("help.quickStart.shortcuts")}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{t("help.quickStart.shortcutsDesc")}</p>
                    <div className="flex items-center gap-1 mt-3 text-xs text-amber-500 font-medium">
                      {t("help.quickStart.viewShortcuts")}
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  </div>
                </motion.button>

                {/* VST Plugin card */}
                <motion.button
                  onClick={() => {
                    setExpandedSections(new Set(["plugin-bridge"]))
                    setTimeout(() => {
                      document.getElementById("section-plugin-bridge")?.scrollIntoView({ behavior: "smooth" })
                    }, 100)
                  }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="group relative overflow-hidden rounded-xl border border-border/30 bg-gradient-to-br from-pink-500/5 via-pink-500/10 to-pink-500/5 p-5 text-left transition-colors hover:border-pink-500/30"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-pink-500/5 rounded-full -translate-y-8 translate-x-8 group-hover:scale-150 transition-transform duration-500" />
                  <div className="relative">
                    <div className="p-2 w-fit rounded-lg bg-pink-500/15 text-pink-500 mb-3">
                      <Plug className="w-5 h-5" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-1">{t("help.quickStart.plugin")}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{t("help.quickStart.pluginDesc")}</p>
                    <div className="flex items-center gap-1 mt-3 text-xs text-pink-500 font-medium">
                      {t("help.quickStart.learnMore")}
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  </div>
                </motion.button>
              </div>

              {/* Search + controls */}
              <div className="flex items-center gap-3 mb-5">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t("help.searchPlaceholder")}
                    className="pl-9 bg-muted/30"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={expandAll} className="text-xs">
                    {t("help.expandAll")}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={collapseAll} className="text-xs">
                    {t("help.collapseAll")}
                  </Button>
                </div>
                <Badge variant="secondary" className="text-xs whitespace-nowrap">
                  {totalQuestions} {t("help.topics")}
                </Badge>
              </div>

              {/* FAQ sections — full-width 2 column grid on large screens */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 mb-8">
                {filteredSections.map(section => (
                  <div
                    key={section.id}
                    id={`section-${section.id}`}
                    className={cn(
                      "rounded-xl border bg-card/30 overflow-hidden transition-colors",
                      expandedSections.has(section.id) && "border-border/50"
                    )}
                  >
                    <button
                      onClick={() => toggleSection(section.id)}
                      className="w-full flex items-center gap-3 p-4 hover:bg-accent/30 transition-colors text-left"
                    >
                      <div className={cn("p-1.5 rounded-lg", section.bgColor)}>
                        <span className={section.color}>{section.icon}</span>
                      </div>
                      <span className="font-medium flex-1 text-sm">{section.title}</span>
                      <Badge variant="secondary" className="text-[10px]">{section.items.length}</Badge>
                      {expandedSections.has(section.id) ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>
                    <AnimatePresence>
                      {expandedSections.has(section.id) && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 space-y-2.5">
                            {section.items.map((item, idx) => (
                              <div key={idx} className="p-3 rounded-lg bg-muted/20 border border-border/20">
                                <h4 className="text-sm font-medium mb-1.5 flex items-center gap-2">
                                  <Zap className="w-3 h-3 text-primary/60 shrink-0" />
                                  {item.q}
                                </h4>
                                <p className="text-sm text-muted-foreground leading-relaxed pl-5">{item.a}</p>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>

              {filteredSections.length === 0 && (
                <div className="text-center py-16 text-muted-foreground">
                  <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">{t("help.noResults", { query: searchQuery })}</p>
                  <p className="text-sm mt-1 opacity-70">{t("help.tryDifferent")}</p>
                </div>
              )}

              {/* Community & Links section */}
              <div className="border-t border-border/30 pt-8">
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-primary" />
                  {t("help.community.title")}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Discord */}
                  <a
                    href="https://discord.gg/dbundone"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-3 p-4 rounded-xl border border-border/30 bg-card/30 hover:bg-[#5865F2]/5 hover:border-[#5865F2]/30 transition-all"
                  >
                    <div className="p-2 rounded-lg bg-[#5865F2]/10 text-[#5865F2] group-hover:bg-[#5865F2]/15 transition-colors">
                      <DiscordIcon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground">Discord</div>
                      <div className="text-xs text-muted-foreground">{t("help.community.discord")}</div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-[#5865F2] transition-colors" />
                  </a>

                  {/* GitHub */}
                  <a
                    href="https://github.com/piwi3910/dbundone"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-3 p-4 rounded-xl border border-border/30 bg-card/30 hover:bg-foreground/5 hover:border-foreground/20 transition-all"
                  >
                    <div className="p-2 rounded-lg bg-foreground/10 text-foreground group-hover:bg-foreground/15 transition-colors">
                      <GitHubIcon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground">GitHub</div>
                      <div className="text-xs text-muted-foreground">{t("help.community.github")}</div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
                  </a>

                  {/* Website - Coming soon */}
                  <div
                    className="flex items-center gap-3 p-4 rounded-xl border border-border/30 bg-card/30 opacity-60 cursor-default"
                  >
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <Globe className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground flex items-center gap-2">
                        {t("help.community.website")}
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0">{t("help.community.comingSoon")}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">dbundone.com</div>
                    </div>
                  </div>

                  {/* Twitter/X */}
                  <a
                    href="https://x.com/dbundone"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-3 p-4 rounded-xl border border-border/30 bg-card/30 hover:bg-foreground/5 hover:border-foreground/20 transition-all"
                  >
                    <div className="p-2 rounded-lg bg-foreground/10 text-foreground group-hover:bg-foreground/15 transition-colors">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground">X (Twitter)</div>
                      <div className="text-xs text-muted-foreground">{t("help.community.twitter")}</div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
                  </a>
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-border/30 mt-8 pt-6 pb-4 text-center">
                <p className="text-xs text-muted-foreground">
                  dbundone v1.0.0 &middot; {t("help.footer")}
                </p>
              </div>
            </motion.div>
          ) : (
            /* Feature Requests Tab */
            <motion.div
              key="requests"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="p-6"
            >
              {/* Submit new request */}
              <div className="rounded-xl border border-border/30 bg-card/30 p-5 mb-6">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <MessageSquarePlus className="w-4 h-4 text-primary" />
                  {t("help.requests.submit")}
                </h3>
                <p className="text-xs text-muted-foreground mb-3">{t("help.requests.submitDesc")}</p>
                <div className="flex gap-2">
                  <Input
                    value={newRequest}
                    onChange={(e) => setNewRequest(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmitRequest()}
                    placeholder={t("help.requests.placeholder")}
                    className="flex-1 bg-muted/30"
                    maxLength={200}
                  />
                  <Button
                    size="sm"
                    onClick={handleSubmitRequest}
                    disabled={!newRequest.trim()}
                    className="gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {t("help.requests.send")}
                  </Button>
                </div>
              </div>

              {/* Request list */}
              {featureRequests.length > 0 ? (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-foreground">
                      {t("help.requests.list")} ({featureRequests.length})
                    </h3>
                  </div>
                  {[...featureRequests]
                    .sort((a, b) => b.votes - a.votes)
                    .map((request) => (
                      <motion.div
                        key={request.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-start gap-3 p-4 rounded-xl border border-border/30 bg-card/30 group"
                      >
                        <button
                          onClick={() => handleVote(request.id)}
                          className="flex flex-col items-center gap-0.5 min-w-[40px] py-1 px-2 rounded-lg bg-muted/30 hover:bg-primary/10 hover:text-primary transition-colors"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                          <span className="text-xs font-medium">{request.votes}</span>
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground">{request.text}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {new Date(request.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteRequest(request.id)}
                          className="p-1 rounded-md text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                          aria-label="Delete request"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </motion.div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-16 text-muted-foreground">
                  <MessageSquarePlus className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">{t("help.requests.empty")}</p>
                  <p className="text-sm mt-1 opacity-70">{t("help.requests.emptyHint")}</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </ScrollArea>
    </div>
  )
}

export default HelpGuide
