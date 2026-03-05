import React, { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Plug,
  Unplug,
  Radio,
  Circle,
  Link,
  Link2Off,
  Mic,
  MicOff,
  Square,
  ChevronDown,
  ChevronUp,
  Loader2,
  Music,
  Headphones,
  Monitor,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Button,
  Badge,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
  ScrollArea,
  Separator,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui"
import type { PluginSession, Project } from "@shared/types"

interface PluginStatusProps {
  sessions: PluginSession[]
  projects: Project[]
  currentProjectId?: string
  onLinkPlugin: (sessionId: string, projectId: string) => Promise<void>
  onUnlinkPlugin: (sessionId: string) => Promise<void>
  onStartRecording: (sessionId: string) => Promise<void>
  onStopRecording: (sessionId: string) => Promise<void>
  onToggleAutoRecord?: (sessionId: string, enabled: boolean) => void
  onToggleOfflineCapture?: (sessionId: string, enabled: boolean) => void
  compact?: boolean
}

// Format seconds to mm:ss
const formatDuration = (secs: number): string => {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

export const PluginStatus: React.FC<PluginStatusProps> = ({
  sessions,
  projects,
  currentProjectId,
  onLinkPlugin,
  onUnlinkPlugin,
  onStartRecording,
  onStopRecording,
  onToggleOfflineCapture,
  compact = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(true)
  const [linkingSession, setLinkingSession] = useState<string | null>(null)

  // Sessions linked to the current project
  const linkedSessions = currentProjectId
    ? sessions.filter((s) => s.linkedProjectId === currentProjectId)
    : []

  // All unlinked sessions
  const unlinkedSessions = sessions.filter((s) => !s.linkedProjectId)

  const connectedCount = sessions.length
  const linkedCount = linkedSessions.length
  const isRecording = linkedSessions.some((s) => s.isRecording)

  const handleLink = async (sessionId: string, projectId: string) => {
    setLinkingSession(sessionId)
    try {
      await onLinkPlugin(sessionId, projectId)
    } finally {
      setLinkingSession(null)
    }
  }

  // Compact indicator for project cards
  if (compact) {
    if (linkedCount === 0) return null
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1">
              <div className={cn(
                "w-2 h-2 rounded-full",
                isRecording ? "bg-red-500 animate-pulse" : "bg-green-500"
              )} />
              <Plug className="w-3 h-3 text-green-500" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{linkedCount} plugin{linkedCount !== 1 ? "s" : ""} connected</p>
            {isRecording && <p className="text-red-400">Recording...</p>}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <div className="rounded-xl border border-border/30 bg-card/50 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-1.5 rounded-lg",
            connectedCount > 0
              ? "bg-green-500/15 text-green-500"
              : "bg-muted text-muted-foreground"
          )}>
            {connectedCount > 0 ? (
              <Plug className="w-4 h-4" />
            ) : (
              <Unplug className="w-4 h-4" />
            )}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">VST3 Plugin Bridge</span>
              {connectedCount > 0 && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] px-1.5 py-0",
                    isRecording
                      ? "border-red-500/40 text-red-400 bg-red-500/10"
                      : "border-green-500/40 text-green-400 bg-green-500/10"
                  )}
                >
                  {isRecording ? (
                    <><Circle className="w-2 h-2 fill-red-500 text-red-500 mr-1 animate-pulse" /> REC</>
                  ) : (
                    <>{connectedCount} connected</>
                  )}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {connectedCount === 0
                ? "No plugins connected"
                : linkedCount > 0
                  ? linkedSessions.map(s => {
                      const daw = s.dawName && s.dawName !== "Unknown DAW" && s.dawName !== "Unknown" ? s.dawName : null
                      return daw || s.pluginName
                    }).join(", ") + ` · linked`
                  : `${connectedCount} plugin${connectedCount !== 1 ? "s" : ""} available`
              }
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isRecording && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-500/10 border border-red-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] font-medium text-red-400">RECORDING</span>
            </div>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <Separator />
            <div className="p-3 space-y-3">
              {connectedCount === 0 ? (
                <div className="text-center py-6">
                  <Unplug className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">No VST3 plugins connected</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Load the DBundone VST3 plugin in your DAW to connect
                  </p>
                  <div className="mt-3 p-2 rounded-lg bg-muted/30 border border-border/20">
                    <p className="text-[10px] font-mono text-muted-foreground">
                      Plugin server running on port 9847
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Linked sessions */}
                  {linkedSessions.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
                        Linked to this project
                      </p>
                      <div className="space-y-2">
                        {linkedSessions.map((session) => (
                          <PluginSessionCard
                            key={session.sessionId}
                            session={session}
                            onUnlink={() => onUnlinkPlugin(session.sessionId)}
                            onStartRecording={() => onStartRecording(session.sessionId)}
                            onStopRecording={() => onStopRecording(session.sessionId)}
                            onToggleOfflineCapture={onToggleOfflineCapture
                              ? (enabled) => onToggleOfflineCapture(session.sessionId, enabled)
                              : undefined
                            }
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Unlinked sessions */}
                  {unlinkedSessions.length > 0 && currentProjectId && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
                        Available plugins
                      </p>
                      <div className="space-y-2">
                        {unlinkedSessions.map((session) => (
                          <div
                            key={session.sessionId}
                            className="flex items-center justify-between p-2.5 rounded-lg bg-muted/20 border border-border/20"
                          >
                            <div className="flex items-center gap-2">
                              <Headphones className="w-3.5 h-3.5 text-muted-foreground" />
                              <div>
                                <p className="text-xs font-medium">
                                  {cleanDawName(session.dawName) || session.pluginName}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  {cleanDawName(session.dawName) ? session.pluginName : "VST3 Plugin"}
                                  {session.trackName && ` · ${session.trackName}`}
                                </p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1.5"
                              disabled={linkingSession === session.sessionId}
                              onClick={() => handleLink(session.sessionId, currentProjectId)}
                            >
                              {linkingSession === session.sessionId ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Link className="w-3 h-3" />
                              )}
                              Link
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sessions linked to other projects */}
                  {sessions.filter(
                    (s) => s.linkedProjectId && s.linkedProjectId !== currentProjectId
                  ).length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
                        Linked to other projects
                      </p>
                      <div className="space-y-1">
                        {sessions
                          .filter(
                            (s) =>
                              s.linkedProjectId && s.linkedProjectId !== currentProjectId
                          )
                          .map((session) => {
                            const linkedProject = projects.find(
                              (p) => p.id === session.linkedProjectId
                            )
                            return (
                              <div
                                key={session.sessionId}
                                className="flex items-center gap-2 p-2 rounded-lg bg-muted/10 text-xs text-muted-foreground"
                              >
                                <Music className="w-3 h-3" />
                                <span>{cleanDawName(session.dawName) || session.pluginName}</span>
                                <span className="text-muted-foreground/50">-</span>
                                <span className="truncate">
                                  {linkedProject?.title || "Unknown project"}
                                </span>
                              </div>
                            )
                          })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Individual session card with controls
const PluginSessionCard: React.FC<{
  session: PluginSession
  onUnlink: () => void
  onStartRecording: () => void
  onStopRecording: () => void
  onToggleOfflineCapture?: (enabled: boolean) => void
}> = ({ session, onUnlink, onStartRecording, onStopRecording, onToggleOfflineCapture }) => {
  return (
    <div className={cn(
      "rounded-lg border overflow-hidden",
      session.isRecording
        ? "border-red-500/30 bg-red-500/5"
        : "border-border/20 bg-muted/20"
    )}>
      {/* Session info row */}
      <div className="flex items-center justify-between p-2.5">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-2 h-2 rounded-full",
            session.isRecording
              ? "bg-red-500 animate-pulse"
              : session.isArmed
                ? "bg-yellow-500"
                : "bg-green-500"
          )} />
          <div>
            <p className="text-xs font-medium">
              {cleanDawName(session.dawName) || session.pluginName}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {cleanDawName(session.dawName) ? session.pluginName : "VST3 Plugin"}
              {session.trackName && ` · ${session.trackName}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Auto-record indicator */}
          {session.autoRecord && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1 py-0 border-yellow-500/30 text-yellow-400 bg-yellow-500/10"
                  >
                    AUTO
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>Auto-record follows DAW transport</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Record/Stop button */}
          {session.isRecording ? (
            <Button
              size="sm"
              variant="destructive"
              className="h-7 w-7 p-0"
              onClick={onStopRecording}
            >
              <Square className="w-3 h-3" />
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-7 p-0 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
              onClick={onStartRecording}
            >
              <Circle className="w-3 h-3 fill-current" />
            </Button>
          )}

          {/* Unlink button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  onClick={onUnlink}
                >
                  <Link2Off className="w-3 h-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Unlink from project</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  )
}

// Small colored icon for project detail header — shows plugin bridge state at a glance
/** Clean up DAW name for display - remove .exe suffix and filter known non-DAW names */
function cleanDawName(dawName: string): string | null {
  if (!dawName || dawName === "Unknown DAW" || dawName === "Unknown") return null
  const nonDaw = ["explorer.exe", "explorer", "svchost.exe", "cmd.exe", "powershell.exe", "conhost.exe"]
  if (nonDaw.includes(dawName.toLowerCase())) return null
  // Strip .exe suffix
  return dawName.replace(/\.exe$/i, "")
}

export const PluginStatusIcon: React.FC<{
  sessions: PluginSession[]
  currentProjectId?: string
  pluginLinked?: boolean
}> = ({ sessions, currentProjectId, pluginLinked }) => {
  const linkedSessions = currentProjectId
    ? sessions.filter((s) => s.linkedProjectId === currentProjectId)
    : []
  const isRecording = linkedSessions.some((s) => s.isRecording)
  const hasLinked = linkedSessions.length > 0
  const hasAvailable = sessions.length > 0
  // Check if any plugin remembers being linked to this project (lastProjectId persists across DAW sessions)
  const hasLastLinked = !hasLinked && currentProjectId
    ? sessions.some((s) => s.lastProjectId === currentProjectId)
    : false
  // Persistent flag from database: project was linked to the plugin at some point
  const wasLinkedBefore = !hasLinked && !hasLastLinked && !!pluginLinked

  // Don't render anything if no sessions at all and no memory of linking and never linked
  if (!hasAvailable && !hasLastLinked && !wasLinkedBefore) return null

  // Determine color: red=recording, green=linked, blue=previously linked, indigo=remembered, yellow=available, gray=none
  const color = isRecording
    ? "bg-red-500"
    : hasLinked
      ? "bg-green-500"
      : hasLastLinked
        ? "bg-indigo-400"
        : wasLinkedBefore
          ? "bg-violet-400"
          : hasAvailable
            ? "bg-yellow-500"
            : "bg-muted-foreground/30"

  const label = isRecording
    ? `Recording (${linkedSessions.filter(s => s.isRecording).length})`
    : hasLinked
      ? `${linkedSessions.length} plugin${linkedSessions.length !== 1 ? "s" : ""} linked`
      : hasLastLinked
        ? "Previously linked via plugin"
        : wasLinkedBefore
          ? "Plugin-linked project"
          : hasAvailable
            ? `${sessions.length} plugin${sessions.length !== 1 ? "s" : ""} available`
            : "No plugins connected"

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 cursor-default">
            {(hasLinked || isRecording) ? (
              <>
                <div className={cn(
                  "w-2 h-2 rounded-full flex-shrink-0 transition-colors",
                  color,
                  isRecording && "animate-pulse"
                )} />
                <Plug className={cn(
                  "w-3.5 h-3.5",
                  isRecording ? "text-red-400" : "text-green-400"
                )} />
              </>
            ) : hasLastLinked ? (
              <Plug className="w-3.5 h-3.5 text-indigo-400/60" />
            ) : wasLinkedBefore ? (
              <Plug className="w-3.5 h-3.5 text-violet-400/50" />
            ) : null}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <p className="font-medium">VST3 Plugin Bridge</p>
          <p className="text-muted-foreground">{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Small badge for the navigation/title area showing global plugin status
export const PluginStatusBadge: React.FC<{
  sessions: PluginSession[]
}> = ({ sessions }) => {
  if (sessions.length === 0) return null

  const isRecording = sessions.some((s) => s.isRecording)

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium",
            isRecording
              ? "bg-red-500/10 text-red-400 border border-red-500/20"
              : "bg-green-500/10 text-green-400 border border-green-500/20"
          )}>
            {isRecording ? (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                REC
              </>
            ) : (
              <>
                <Plug className="w-3 h-3" />
                {sessions.length}
              </>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{sessions.length} plugin{sessions.length !== 1 ? "s" : ""} connected</p>
          {isRecording && <p className="text-red-400">Recording in progress</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export default PluginStatus
