import React, { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Plug,
  Music2,
  Layers,
  Headphones,
  FileAudio,
  Puzzle,
  Camera,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Folder,
  Copy,
  ExternalLink,
  Search,
  SlidersHorizontal,
  Grid3X3,
  List,
  X,
  Volume2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { Project, FlpAnalysis, FlpPlugin, FlpChannel, FlpMixerTrack } from "@shared/types"

const isElectron = () => typeof window !== "undefined" && typeof window.electron !== "undefined"

type AnalysisTab = "plugins" | "channels" | "mixer" | "samples" | "patterns"

const CHANNEL_TYPE_ICONS: Record<string, React.ReactNode> = {
  sampler: <Volume2 className="w-3.5 h-3.5" />,
  generator: <Plug className="w-3.5 h-3.5" />,
  layer: <Layers className="w-3.5 h-3.5" />,
  audio_clip: <FileAudio className="w-3.5 h-3.5" />,
  unknown: <Music2 className="w-3.5 h-3.5" />,
}

const CHANNEL_TYPE_COLORS: Record<string, string> = {
  sampler: "text-yellow-500",
  generator: "text-blue-500",
  layer: "text-purple-500",
  audio_clip: "text-green-500",
  unknown: "text-gray-500",
}

interface ProjectAnalysisProps {
  project: Project
  onScreenshot?: (pluginName: string) => Promise<void>
}

export const ProjectAnalysis: React.FC<ProjectAnalysisProps> = ({
  project,
  onScreenshot,
}) => {
  const [analysis, setAnalysis] = useState<FlpAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<AnalysisTab>("plugins")
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedChannels, setExpandedChannels] = useState<Set<number>>(new Set())

  const loadAnalysis = useCallback(async (forceRefresh = false) => {
    if (!isElectron() || !project.dawProjectPath) return

    setLoading(true)
    setError(null)
    try {
      if (forceRefresh) {
        await window.electron?.clearFlpAnalysisCache?.(project.id)
      }
      const result = await window.electron?.analyzeFlpProject?.(project.id, project.dawProjectPath)
      if (result) {
        setAnalysis(result)
      }
    } catch (err: any) {
      setError(err?.message || err?.toString() || "Analysis failed")
    } finally {
      setLoading(false)
    }
  }, [project.id, project.dawProjectPath])

  useEffect(() => {
    if (project.dawProjectPath?.endsWith(".flp")) {
      loadAnalysis()
    }
  }, [project.dawProjectPath, loadAnalysis])

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const handleScreenshot = async (pluginName: string) => {
    if (onScreenshot) {
      await onScreenshot(pluginName)
    }
  }

  const toggleChannel = (index: number) => {
    setExpandedChannels(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  if (!project.dawProjectPath?.endsWith(".flp")) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Puzzle className="w-5 h-5 mr-2 opacity-50" />
        <span>Project analysis is available for FL Studio (.flp) projects</span>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-5 h-5 mr-2 animate-spin text-primary" />
        <span className="text-muted-foreground">Analyzing project file...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <div className="text-destructive text-sm">{error}</div>
        <Button variant="outline" size="sm" onClick={() => loadAnalysis(true)}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    )
  }

  if (!analysis) return null

  // Safe-access arrays that may be undefined/null from the backend
  const plugins = analysis.plugins ?? []
  const channels = analysis.channels ?? []
  const mixerTracks = analysis.mixerTracks ?? []
  const samples = analysis.samples ?? []
  const patterns = analysis.patterns ?? []

  // Count channels that have mixer routing assigned
  const channelsWithMixerRouting = channels.filter(c => c.mixerTrack !== null && c.mixerTrack !== undefined).length

  const tabs: { id: AnalysisTab; label: string; icon: React.ReactNode; count: number }[] = [
    { id: "plugins", label: "Plugins", icon: <Plug className="w-4 h-4" />, count: plugins.length },
    { id: "channels", label: "Channels", icon: <SlidersHorizontal className="w-4 h-4" />, count: channels.length },
    { id: "mixer", label: "Mixer", icon: <Headphones className="w-4 h-4" />, count: mixerTracks.length || channelsWithMixerRouting },
    { id: "samples", label: "Samples", icon: <FileAudio className="w-4 h-4" />, count: samples.length },
    { id: "patterns", label: "Patterns", icon: <Grid3X3 className="w-4 h-4" />, count: patterns.length },
  ]

  const filteredPlugins = plugins.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.channelName?.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const filteredChannels = channels.filter(c =>
    (c.name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (c.pluginName?.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const filteredSamples = samples.filter(s =>
    s.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Header with version info & refresh */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Puzzle className="w-5 h-5 text-primary" />
          Project Analysis
          {analysis.flVersion && (
            <Badge variant="secondary" className="text-xs">
              FL Studio {analysis.flVersion}
            </Badge>
          )}
        </h2>
        <Button variant="ghost" size="sm" onClick={() => loadAnalysis(true)} className="h-7">
          <RefreshCw className="w-3.5 h-3.5 mr-1" />
          Refresh
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-5 gap-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-lg transition-all text-xs",
              "hover:bg-accent/50 border border-transparent",
              activeTab === tab.id && "bg-accent border-border shadow-sm"
            )}
          >
            <span className={cn("text-muted-foreground", activeTab === tab.id && "text-primary")}>
              {tab.icon}
            </span>
            <span className="font-medium">{tab.count}</span>
            <span className="text-muted-foreground">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={`Search ${activeTab}...`}
          className="pl-8 h-8 text-sm"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <Separator />

      {/* Tab Content */}
      <div className="flex-1 min-h-0">
        <AnimatePresence mode="wait">
          {activeTab === "plugins" && (
            <motion.div
              key="plugins"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex flex-col gap-1.5"
            >
              {filteredPlugins.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8">
                  {searchQuery ? "No plugins match your search" : "No plugins detected"}
                </div>
              ) : (
                filteredPlugins.map((plugin, i) => (
                  <ContextMenu key={i}>
                    <ContextMenuTrigger>
                      <div className="flex items-center justify-between p-2.5 rounded-lg hover:bg-accent/50 transition-colors group">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                            plugin.dllName === "Sampler"
                              ? "bg-green-500/15 text-green-500"
                              : plugin.isInstrument
                                ? "bg-blue-500/15 text-blue-500"
                                : "bg-orange-500/15 text-orange-500"
                          )}>
                            {plugin.dllName === "Sampler"
                              ? <Volume2 className="w-4 h-4" />
                              : <Plug className="w-4 h-4" />
                            }
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{plugin.name}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {plugin.channelName && plugin.dllName !== "Sampler" && <span>{plugin.channelName}</span>}
                              {plugin.dllName && plugin.dllName !== "Sampler" && (
                                <span className="ml-1 opacity-60">({plugin.dllName})</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Badge variant="secondary" className="text-[10px]">
                            {plugin.dllName === "Sampler" ? "Sampler" : plugin.isInstrument ? "Instrument" : "Effect"}
                          </Badge>
                          {onScreenshot && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => handleScreenshot(plugin.name)}
                                >
                                  <Camera className="w-3.5 h-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Screenshot Plugin</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem onClick={() => handleCopy(plugin.name)}>
                        <Copy className="w-3.5 h-3.5 mr-2" />
                        Copy Plugin Name
                      </ContextMenuItem>
                      {plugin.dllName && (
                        <ContextMenuItem onClick={() => handleCopy(plugin.dllName!)}>
                          <Copy className="w-3.5 h-3.5 mr-2" />
                          Copy DLL Name
                        </ContextMenuItem>
                      )}
                      {onScreenshot && (
                        <ContextMenuItem onClick={() => handleScreenshot(plugin.name)}>
                          <Camera className="w-3.5 h-3.5 mr-2" />
                          Capture Screenshot
                        </ContextMenuItem>
                      )}
                    </ContextMenuContent>
                  </ContextMenu>
                ))
              )}
            </motion.div>
          )}

          {activeTab === "channels" && (
            <motion.div
              key="channels"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex flex-col gap-1"
            >
              {filteredChannels.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8">
                  {searchQuery ? "No channels match your search" : "No channels detected"}
                </div>
              ) : (
                filteredChannels.map((channel, i) => (
                  <ContextMenu key={i}>
                    <ContextMenuTrigger>
                      <div
                        className="rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                        onClick={() => toggleChannel(channel.index)}
                      >
                        <div className="flex items-center gap-3 p-2.5">
                          {/* Color indicator */}
                          <div
                            className="w-1 h-8 rounded-full flex-shrink-0"
                            style={{ backgroundColor: channel.color || '#6366f1' }}
                          />
                          {/* Type icon */}
                          <div className={cn("flex-shrink-0", CHANNEL_TYPE_COLORS[channel.channelType] || "text-gray-500")}>
                            {CHANNEL_TYPE_ICONS[channel.channelType] || CHANNEL_TYPE_ICONS.unknown}
                          </div>
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">
                              {channel.name || `Channel ${channel.index + 1}`}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {channel.channelType}
                              {channel.pluginName && ` • ${channel.pluginName}`}
                            </div>
                          </div>
                          {/* Expand indicator */}
                          {(channel.pluginName || channel.samplePath) && (
                            expandedChannels.has(channel.index)
                              ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                              : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                          )}
                        </div>

                        {/* Expanded detail */}
                        <AnimatePresence>
                          {expandedChannels.has(channel.index) && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="px-2.5 pb-2.5 ml-8 flex flex-col gap-1 text-xs text-muted-foreground">
                                {channel.pluginName && (
                                  <div className="flex items-center gap-2">
                                    <Plug className="w-3 h-3" />
                                    <span className="truncate">{channel.pluginName}</span>
                                  </div>
                                )}
                                {channel.samplePath && (
                                  <div className="flex items-center gap-2">
                                    <FileAudio className="w-3 h-3" />
                                    <span className="truncate font-mono text-[11px]">{channel.samplePath}</span>
                                  </div>
                                )}
                                {channel.mixerTrack !== null && channel.mixerTrack !== undefined && (
                                  <div className="flex items-center gap-2">
                                    <Headphones className="w-3 h-3" />
                                    <span>Mixer Track {channel.mixerTrack}</span>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      {channel.name && (
                        <ContextMenuItem onClick={() => handleCopy(channel.name!)}>
                          <Copy className="w-3.5 h-3.5 mr-2" />
                          Copy Channel Name
                        </ContextMenuItem>
                      )}
                      {channel.pluginName && (
                        <ContextMenuItem onClick={() => handleCopy(channel.pluginName!)}>
                          <Copy className="w-3.5 h-3.5 mr-2" />
                          Copy Plugin Name
                        </ContextMenuItem>
                      )}
                      {channel.samplePath && (
                        <ContextMenuItem onClick={() => handleCopy(channel.samplePath!)}>
                          <Copy className="w-3.5 h-3.5 mr-2" />
                          Copy Sample Path
                        </ContextMenuItem>
                      )}
                    </ContextMenuContent>
                  </ContextMenu>
                ))
              )}
            </motion.div>
          )}

          {activeTab === "mixer" && (
            <motion.div
              key="mixer"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex flex-col gap-1.5"
            >
              {mixerTracks.length === 0 ? (
                <div className="flex flex-col items-center text-sm text-muted-foreground text-center py-8 gap-2">
                  <Headphones className="w-5 h-5 opacity-40" />
                  <span>No mixer inserts with content</span>
                  <span className="text-xs opacity-60">
                    Only inserts with names or effect plugins appear here.
                  </span>
                </div>
              ) : (
                mixerTracks.map((track, i) => (
                  <ContextMenu key={i}>
                    <ContextMenuTrigger>
                      <div className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-accent/50 transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center flex-shrink-0 text-xs font-mono font-bold text-muted-foreground mt-0.5">
                          {track.index}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {track.name || `Insert ${track.index}`}
                          </div>
                          {track.plugins && track.plugins.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {track.plugins.map((plugin, j) => (
                                <span
                                  key={j}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-accent/60 text-muted-foreground"
                                >
                                  <Plug className="w-2.5 h-2.5" />
                                  {plugin}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      {track.name && (
                        <ContextMenuItem onClick={() => handleCopy(track.name!)}>
                          <Copy className="w-3.5 h-3.5 mr-2" />
                          Copy Track Name
                        </ContextMenuItem>
                      )}
                    </ContextMenuContent>
                  </ContextMenu>
                ))
              )}
            </motion.div>
          )}

          {activeTab === "samples" && (
            <motion.div
              key="samples"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex flex-col gap-1.5"
            >
              {filteredSamples.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8">
                  {searchQuery ? "No samples match your search" : "No sample files detected"}
                </div>
              ) : (
                filteredSamples.map((sample, i) => {
                  const filename = sample.split(/[/\\]/).pop() || sample
                  const folder = sample.substring(0, sample.length - filename.length - 1)
                  return (
                    <ContextMenu key={i}>
                      <ContextMenuTrigger>
                        <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent/50 transition-colors group">
                          <FileAudio className="w-4 h-4 text-green-500 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">{filename}</div>
                            <div className="text-xs text-muted-foreground truncate font-mono">{folder}</div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleCopy(sample)}
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem onClick={() => handleCopy(sample)}>
                          <Copy className="w-3.5 h-3.5 mr-2" />
                          Copy Full Path
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => handleCopy(filename)}>
                          <Copy className="w-3.5 h-3.5 mr-2" />
                          Copy Filename
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => {
                          if (folder && window.electron?.openFolder) {
                            window.electron.openFolder(folder)
                          }
                        }}>
                          <Folder className="w-3.5 h-3.5 mr-2" />
                          Open Folder
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  )
                })
              )}
            </motion.div>
          )}

          {activeTab === "patterns" && (
            <motion.div
              key="patterns"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex flex-col gap-1.5"
            >
              {patterns.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8">
                  No patterns detected
                </div>
              ) : (
                patterns.map((pattern, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors">
                    <div className="w-6 h-6 rounded flex items-center justify-center bg-accent text-xs font-mono text-muted-foreground">
                      {pattern.index + 1}
                    </div>
                    <span className="text-sm">
                      {pattern.name || `Pattern ${pattern.index + 1}`}
                    </span>
                  </div>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
