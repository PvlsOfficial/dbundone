import React, { useEffect, useRef, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Square,
  Volume2,
  VolumeX,
  Volume1,
  X,
  Music,
  Repeat,
  Repeat1,
  Shuffle,
  Maximize2,
  Minimize2,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  Star,
} from "lucide-react"
import { cn, assetUrl } from "@/lib/utils"
import { computePeaksViaWebAudio } from "@/lib/audioPeaks"
import { audioAnalyser } from "@/lib/audioAnalyser"
import { useImageUrl } from "@/hooks/useImageUrl"
import { Slider, Tooltip, TooltipContent, TooltipTrigger, TooltipProvider, Badge } from "@/components/ui"
import { AudioPlayerState, Project } from "@shared/types"
import { useTheme } from "./ThemeProvider"

interface AudioPlayerProps {
  playerState: AudioPlayerState
  setPlayerState: React.Dispatch<React.SetStateAction<AudioPlayerState>>
  projects: Project[]
  onOpenProject?: (project: Project) => void
  onPlayProject?: (project: Project) => void
  onRateProject?: (project: Project, rating: number) => void
}

type RepeatMode = "off" | "all" | "one"

// Helper to check if a project has playable audio
const hasPlayableAudio = (p: Project): boolean => {
  return !!(p.audioPreviewPath || p.favoriteVersionId)
}

// Best-effort MIME type from a file extension, so a blob built from raw bytes is
// recognised by the <audio> element across formats.
function guessAudioMime(path: string): string {
  switch (path.split(".").pop()?.toLowerCase()) {
    case "mp3": return "audio/mpeg"
    case "wav": return "audio/wav"
    case "ogg": case "opus": return "audio/ogg"
    case "flac": return "audio/flac"
    case "m4a": case "mp4": case "aac": return "audio/mp4"
    case "webm": return "audio/webm"
    default: return ""
  }
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  playerState,
  setPlayerState,
  projects,
  onOpenProject,
  onPlayProject,
  onRateProject,
}) => {
  const artworkUrl = useImageUrl(playerState.currentTrack?.artworkPath)
  const audioRef = useRef<HTMLAudioElement | null>(null) // HTML5 Audio fallback
  const blobUrlRef = useRef<string | null>(null) // object URL of the current track's audio blob
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const initialSeekTimeRef = useRef<number>(0) // Track initial seek position for restore
  const waveformRequestRef = useRef(0)
  // Local time state - kept separate from playerState to avoid re-rendering the entire app tree (~4Hz)
  const [localCurrentTime, setLocalCurrentTime] = useState(0)
  const [localDuration, setLocalDuration] = useState(0)
  const [isReady, setIsReady] = useState(false)
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off")
  const [isShuffled, setIsShuffled] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [fsHoverRating, setFsHoverRating] = useState(0)
  const [shuffledQueue, setShuffledQueue] = useState<Project[]>([])
  const [waveformPeaks, setWaveformPeaks] = useState<number[]>([])
  const [waveformLoading, setWaveformLoading] = useState(false)
  const handleTrackEndRef = useRef<() => void>(() => {})
  const { accentColor } = useTheme()

  // Helper to convert hex to rgba
  const hexToRgba = (hex: string, alpha: number): string => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  // Helper to play a project - resolves favoriteVersionId if needed
  const playProjectAudio = useCallback((project: Project) => {
    if (onPlayProject) {
      onPlayProject(project)
    } else {
      // Fallback if onPlayProject not provided
      setPlayerState((prev) => ({
        ...prev,
        currentTrack: project,
        isPlaying: true,
        currentTime: 0,
      }))
    }
  }, [onPlayProject, setPlayerState])

  // Generate shuffle queue when shuffle is enabled - use projects with playable audio
  useEffect(() => {
    if (isShuffled && playerState.currentTrack) {
      const playableProjects = projects.filter(hasPlayableAudio)
      // Put current track first, then shuffle the rest
      const otherProjects = playableProjects.filter(p => p.id !== playerState.currentTrack?.id)
      const shuffledOthers = [...otherProjects].sort(() => Math.random() - 0.5)
      // Find current track in playable projects (it might have resolved audio path)
      const currentInQueue = playableProjects.find(p => p.id === playerState.currentTrack?.id)
      if (currentInQueue) {
        setShuffledQueue([currentInQueue, ...shuffledOthers])
      } else {
        setShuffledQueue(shuffledOthers)
      }
    } else if (isShuffled) {
      const shuffled = [...projects.filter(hasPlayableAudio)]
        .sort(() => Math.random() - 0.5)
      setShuffledQueue(shuffled)
    }
  }, [isShuffled, projects, playerState.currentTrack?.id])

  // Cleanup audio element only on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioAnalyser.detach(audioRef.current)
        audioRef.current.pause()
        audioRef.current.src = ''
        audioRef.current = null
      }
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (playerState.currentTrack?.audioPreviewPath) {
      // Capture the initial currentTime for seeking after load
      if (playerState.currentTime > 0) {
        initialSeekTimeRef.current = playerState.currentTime
      }
      
      // Ensure audio element exists
      if (!audioRef.current) {
        audioRef.current = new Audio()
        audioRef.current.preload = 'auto'

        audioRef.current.addEventListener('loadedmetadata', () => {
          setIsReady(true)
          const dur = audioRef.current?.duration || 0
          setLocalDuration(dur)
          setPlayerState((prev) => ({
            ...prev,
            duration: dur,
          }))
          // Seek to initial position if we have one (e.g., restoring from ProjectDetail)
          if (initialSeekTimeRef.current > 0 && audioRef.current) {
            audioRef.current.currentTime = initialSeekTimeRef.current
            initialSeekTimeRef.current = 0 // Reset after seeking
          }
          if (playerState.isPlaying) {
            audioRef.current?.play()
          }
        })

        audioRef.current.addEventListener('timeupdate', () => {
          if (audioRef.current) {
            // Only update local state - do NOT update playerState to avoid re-rendering the entire tree
            setLocalCurrentTime(audioRef.current.currentTime || 0)
          }
        })

        audioRef.current.addEventListener('ended', () => {
          handleTrackEndRef.current()
        })

        audioRef.current.addEventListener('play', () => {
          // A user-gesture-driven play is the right moment to resume the audio
          // context; while suspended the routed element would be silent.
          audioAnalyser.resume()
          setPlayerState((prev) => ({ ...prev, isPlaying: true }))
        })

        audioRef.current.addEventListener('pause', () => {
          setPlayerState((prev) => ({ ...prev, isPlaying: false }))
        })

        audioRef.current.addEventListener('error', (error) => {
          console.error("AudioPlayer: HTML5 Audio error:", error)
          setIsReady(false)
        })
      }

      setIsReady(false)
      const loadAudio = async () => {
        const path = playerState.currentTrack?.audioPreviewPath
        if (!path || !audioRef.current) return
        try {
          // Load the audio as a same-origin blob URL. The cross-origin Tauri asset
          // protocol makes a Web Audio analyser (used by the Visualizer) emit only
          // silence; a blob URL is same-origin so playback AND analysis both work.
          const { readFile } = await import("@tauri-apps/plugin-fs")
          const bytes = await readFile(path)
          if (!audioRef.current) return
          const url = URL.createObjectURL(new Blob([bytes], { type: guessAudioMime(path) }))
          if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
          blobUrlRef.current = url
          audioRef.current.src = url
          audioRef.current.load()
          // Now that the source is same-origin, it's safe to route it through the
          // shared analyser without muting playback.
          audioAnalyser.attach(audioRef.current)
        } catch (error) {
          // Fallback: stream via the asset protocol. Playback is preserved; the
          // Visualizer just won't react for this track.
          console.warn("AudioPlayer: blob load failed, falling back to asset protocol:", error)
          if (audioRef.current) {
            audioRef.current.src = assetUrl(path)
            audioRef.current.load()
          }
          setIsReady(false)
        }
      }
      loadAudio()
    }
  }, [playerState.currentTrack?.id])

  // Load waveform peaks computed server-side in Rust (fast, no large IPC transfer)
  useEffect(() => {
    if (!playerState.currentTrack?.audioPreviewPath) {
      setWaveformPeaks([])
      return
    }

    const thisRequest = ++waveformRequestRef.current
    const audioPath = playerState.currentTrack.audioPreviewPath
    
    setWaveformLoading(true)
    setWaveformPeaks([])

    const loadWaveform = async () => {
      try {
        let peaks: number[] | null | undefined
        try {
          peaks = await window.electron?.computeAudioPeaks(audioPath, 150)
        } catch (err) {
          // Rust decode failed (e.g. unsupported codec) — fall through to fallback
          console.warn("Rust waveform compute failed, trying browser decoder:", err)
          peaks = null
        }
        if (thisRequest !== waveformRequestRef.current) return

        // Fallback: symphonia can't decode some formats the WebView can play
        // (notably Opus-in-Ogg). Decode in the browser and persist for next time.
        if (!peaks || peaks.length === 0) {
          peaks = await computePeaksViaWebAudio(audioPath, 150)
          if (thisRequest !== waveformRequestRef.current) return
          if (peaks && peaks.length > 0) {
            void window.electron?.cacheAudioPeaks?.(audioPath, peaks, 150)
          }
        }

        if (peaks && peaks.length > 0) {
          setWaveformPeaks(peaks)
        } else {
          setWaveformPeaks([])
        }
      } catch (error) {
        if (thisRequest !== waveformRequestRef.current) return
        console.error("Failed to load waveform:", error)
        setWaveformPeaks([])
      } finally {
        if (thisRequest === waveformRequestRef.current) {
          setWaveformLoading(false)
        }
      }
    }
    
    loadWaveform()
  }, [playerState.currentTrack?.audioPreviewPath])

  // Draw waveform on canvas - uses a ref to avoid recreating the callback on every time tick
  const drawWaveformRef = useRef<() => void>(() => {})
  const waveformDepsRef = useRef({ peaks: waveformPeaks, accentColor, localDuration })
  waveformDepsRef.current = { peaks: waveformPeaks, accentColor, localDuration }

  drawWaveformRef.current = () => {
    const canvas = canvasRef.current
    const { peaks, accentColor: color, localDuration: dur } = waveformDepsRef.current
    if (!canvas || peaks.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const width = rect.width
    const height = rect.height
    const barWidth = Math.max(2, width / peaks.length - 1)
    const progress = dur > 0 ? localCurrentTime / dur : 0

    ctx.clearRect(0, 0, width, height)

    peaks.forEach((peak, i) => {
      const x = (i / peaks.length) * width
      const barHeight = Math.max(2, peak * height * 0.9)
      const y = (height - barHeight) / 2

      const isPlayed = (i / peaks.length) < progress
      ctx.fillStyle = isPlayed ? color : hexToRgba(color, 0.3)
      ctx.fillRect(x, y, barWidth, barHeight)
    })
  }

  // Redraw waveform at display refresh rate using rAF, only while playing
  const waveformRafRef = useRef(0)
  useEffect(() => {
    // Always draw once when peaks/expanded/accent change
    drawWaveformRef.current()

    if (!playerState.isPlaying) return

    let running = true
    const tick = () => {
      if (!running) return
      drawWaveformRef.current()
      waveformRafRef.current = requestAnimationFrame(tick)
    }
    waveformRafRef.current = requestAnimationFrame(tick)
    return () => { running = false; cancelAnimationFrame(waveformRafRef.current) }
  }, [waveformPeaks, accentColor, isExpanded, playerState.isPlaying])

  // Redraw on seek while paused (rAF loop above is only active while playing)
  useEffect(() => {
    if (playerState.isPlaying) return
    drawWaveformRef.current()
  }, [localCurrentTime, playerState.isPlaying])

  // Redraw on resize (throttled)
  useEffect(() => {
    let rafId = 0
    const handleResize = () => {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => drawWaveformRef.current())
    }
    window.addEventListener('resize', handleResize)
    return () => { window.removeEventListener('resize', handleResize); cancelAnimationFrame(rafId) }
  }, [])

  useEffect(() => {
    if (!audioRef.current || !isReady) return

    if (playerState.isPlaying) {
      audioRef.current.play()
    } else {
      audioRef.current.pause()
    }
  }, [playerState.isPlaying, isReady])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = playerState.volume
    }
  }, [playerState.volume])

  const handleTrackEnd = () => {
    if (repeatMode === "one") {
      if (audioRef.current) {
        audioRef.current.currentTime = 0
        audioRef.current.play()
      }
    } else if (repeatMode === "all" || isShuffled) {
      handleNext()
    } else {
      const queue = projects.filter(hasPlayableAudio)
      const currentIndex = queue.findIndex(p => p.id === playerState.currentTrack?.id)
      if (currentIndex < queue.length - 1) {
        handleNext()
      } else {
        setPlayerState((prev) => ({
          ...prev,
          isPlaying: false,
          currentTime: 0,
        }))
      }
    }
  }

  // Keep the ref in sync so the 'ended' event listener always calls the latest version
  useEffect(() => {
    handleTrackEndRef.current = handleTrackEnd
  })

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const handlePlayPause = () => {
    setPlayerState((prev) => ({
      ...prev,
      isPlaying: !prev.isPlaying,
    }))
  }

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    setLocalCurrentTime(0)
    setPlayerState((prev) => ({
      ...prev,
      isPlaying: false,
      currentTime: 0,
    }))
  }

  const handlePrevious = () => {
    if (!playerState.currentTrack) return
    
    if (localCurrentTime > 3) {
      if (audioRef.current) {
        audioRef.current.currentTime = 0
      }
      setLocalCurrentTime(0)
      return
    }
    
    const queue = isShuffled ? shuffledQueue : projects.filter(hasPlayableAudio)
    const currentIndex = queue.findIndex((p) => p.id === playerState.currentTrack?.id)
    let prevIndex: number
    
    if (currentIndex > 0) {
      prevIndex = currentIndex - 1
    } else if (repeatMode === "all") {
      prevIndex = queue.length - 1
    } else {
      return
    }
    
    const prevProject = queue[prevIndex]
    if (prevProject) {
      playProjectAudio(prevProject)
    }
  }

  const handleNext = () => {
    if (!playerState.currentTrack) return
    
    const queue = isShuffled ? shuffledQueue : projects.filter(hasPlayableAudio)
    const currentIndex = queue.findIndex((p) => p.id === playerState.currentTrack?.id)
    let nextIndex: number
    
    if (currentIndex < queue.length - 1) {
      nextIndex = currentIndex + 1
    } else if (repeatMode === "all") {
      nextIndex = 0
    } else {
      return
    }
    
    const nextProject = queue[nextIndex]
    if (nextProject) {
      playProjectAudio(nextProject)
    }
  }

  const handleVolumeChange = (value: number[]) => {
    setPlayerState((prev) => ({ ...prev, volume: value[0] }))
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !isReady) return
    const rect = e.currentTarget.getBoundingClientRect()
    const progress = (e.clientX - rect.left) / rect.width
    const newTime = progress * (audioRef.current.duration || 0)
    audioRef.current.currentTime = newTime
    setLocalCurrentTime(newTime)
  }

  const handleClose = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    setLocalCurrentTime(0)
    setLocalDuration(0)
    setPlayerState({
      isPlaying: false,
      currentTrack: null,
      currentTime: 0,
      duration: 0,
      volume: playerState.volume,
    })
  }

  const toggleMute = () => {
    setPlayerState((prev) => ({
      ...prev,
      volume: prev.volume > 0 ? 0 : 0.8,
    }))
  }

  const cycleRepeatMode = () => {
    const modes: RepeatMode[] = ["off", "all", "one"]
    const currentIndex = modes.indexOf(repeatMode)
    setRepeatMode(modes[(currentIndex + 1) % modes.length])
  }

  const getVolumeIcon = () => {
    if (playerState.volume === 0) return <VolumeX className="w-4 h-4" />
    if (playerState.volume < 0.5) return <Volume1 className="w-4 h-4" />
    return <Volume2 className="w-4 h-4" />
  }

  const getRepeatIcon = () => {
    if (repeatMode === "one") return <Repeat1 className="w-4 h-4" />
    return <Repeat className="w-4 h-4" />
  }

  if (!playerState.currentTrack) return null

  const queue = isShuffled ? shuffledQueue : projects.filter(hasPlayableAudio)
  const queueIndex = queue.findIndex(p => p.id === playerState.currentTrack?.id)

  return (
    <TooltipProvider>
      <AnimatePresence>
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className={cn(
            "px-4 flex flex-col relative flex-shrink-0",
            "bg-card border-t border-border/30",
            "shadow-2xl shadow-black/20",
            isExpanded ? "h-36" : "h-20"
          )}
        >
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="absolute left-1/2 -translate-x-1/2 -top-3 w-8 h-3 bg-muted rounded-t-lg flex items-center justify-center hover:bg-muted/80 transition-colors z-10"
            title={isExpanded ? "Collapse player" : "Expand player"}
          >
            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          </button>

          <div className={cn("flex items-center gap-4 flex-1", isExpanded ? "pt-2" : "")}>
            <div className="flex items-center gap-3 w-64 flex-shrink-0">
              <button
                onClick={() => playerState.currentTrack && onOpenProject?.(playerState.currentTrack)}
                className="relative w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0 hover:opacity-80 transition-opacity"
                title="Open project"
              >
                {artworkUrl ? (
                  <img
                    src={artworkUrl}
                    alt={playerState.currentTrack.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                    <Music className="w-5 h-5 text-primary" />
                  </div>
                )}
                {playerState.isPlaying && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <Pause className="w-4 h-4 text-white" />
                  </div>
                )}
              </button>
              <div className="min-w-0">
                <h4 className="text-sm font-medium text-foreground truncate">
                  {playerState.currentTrack.title}
                </h4>
                <p className="text-xs text-muted-foreground truncate">
                  {playerState.currentTrack.bpm > 0 && `${playerState.currentTrack.bpm} BPM`}
                  {playerState.currentTrack.bpm > 0 && playerState.currentTrack.musicalKey !== "None" && " • "}
                  {playerState.currentTrack.musicalKey !== "None" && playerState.currentTrack.musicalKey}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setIsShuffled(!isShuffled)}
                    className={cn(
                      "w-8 h-8 flex items-center justify-center rounded-lg transition-all",
                      isShuffled ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                    title={isShuffled ? "Shuffle On" : "Shuffle Off"}
                  >
                    <Shuffle className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{isShuffled ? "Shuffle On" : "Shuffle Off"}</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={handlePrevious} className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all" title="Previous">
                    <SkipBack className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Previous</TooltipContent>
              </Tooltip>

              <button
                onClick={handlePlayPause}
                className={cn(
                  "w-11 h-11 flex items-center justify-center rounded-full transition-all",
                  "bg-primary text-primary-foreground",
                  "hover:bg-primary/90 hover:scale-105 active:scale-95",
                  "shadow-lg shadow-primary/30"
                )}
                title={playerState.isPlaying ? "Pause" : "Play"}
              >
                {playerState.isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={handleStop} className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all" title="Stop">
                    <Square className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Stop</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={handleNext} className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all" title="Next">
                    <SkipForward className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Next</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={cycleRepeatMode}
                    className={cn(
                      "w-8 h-8 flex items-center justify-center rounded-lg transition-all",
                      repeatMode !== "off" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                    title={repeatMode === "off" ? "Repeat Off" : repeatMode === "all" ? "Repeat All" : "Repeat One"}
                  >
                    {getRepeatIcon()}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {repeatMode === "off" && "Repeat Off"}
                  {repeatMode === "all" && "Repeat All"}
                  {repeatMode === "one" && "Repeat One"}
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="flex-1 flex items-center gap-3 min-w-0">
              <span className="text-xs text-muted-foreground font-mono w-10 text-right">{formatTime(localCurrentTime)}</span>
              <div
                className={cn("flex-1 cursor-pointer rounded-lg overflow-hidden bg-muted/30 relative", isExpanded ? "h-20" : "h-12")}
                onClick={handleSeek}
                title="Seek to position"
              >
                {/* Waveform or simple progress bar */}
                {waveformPeaks.length > 0 ? (
                  <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full"
                  />
                ) : waveformLoading ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-xs text-muted-foreground">Loading waveform...</div>
                  </div>
                ) : (
                  <>
                    <div
                      className="absolute top-0 left-0 h-full bg-primary/60 transition-all duration-100"
                      style={{ width: `${localDuration > 0 ? (localCurrentTime / localDuration) * 100 : 0}%` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-full h-0.5 bg-muted-foreground/20 rounded"></div>
                    </div>
                  </>
                )}
              </div>
              <span className="text-xs text-muted-foreground font-mono w-10">{formatTime(localDuration)}</span>
            </div>

            <div className="flex items-center gap-2">
              {queue.length > 1 && (
                <Badge variant="outline" className="text-xs font-mono">
                  {queueIndex + 1}/{queue.length}
                </Badge>
              )}

              {/* Star rating for current track */}
              {onRateProject && playerState.currentTrack && (() => {
                const track = playerState.currentTrack
                const trackRating = track.rating ?? 0
                return (
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => onRateProject(track, trackRating === star ? 0 : star)}
                        className="transition-transform hover:scale-110 active:scale-95"
                        aria-label={`Rate ${star} star${star !== 1 ? 's' : ''}`}
                      >
                        <Star
                          className="w-3.5 h-3.5 transition-colors"
                          fill={star <= trackRating ? "currentColor" : "none"}
                          style={{ color: star <= trackRating ? "var(--primary)" : undefined }}
                          strokeWidth={star <= trackRating ? 0 : 1.5}
                        />
                      </button>
                    ))}
                  </div>
                )
              })()}

              <div className="flex items-center gap-2 w-32">
                <button type="button" onClick={toggleMute} className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors" title="Toggle mute">
                  {getVolumeIcon()}
                </button>
                <Slider value={[playerState.volume]} onValueChange={handleVolumeChange} max={1} step={0.01} className="w-20" />
              </div>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setIsFullscreen(true)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
                    title="Fullscreen"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Fullscreen</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all" title="Close Player">
                    <X className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Close Player</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Fullscreen overlay */}
      <AnimatePresence>
        {isFullscreen && playerState.currentTrack && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden"
          >
            {/* Blurred artwork background */}
            <div className="absolute inset-0">
              {artworkUrl ? (
                <img
                  src={artworkUrl}
                  alt=""
                  className="w-full h-full object-cover scale-110"
                  style={{ filter: "blur(40px) brightness(0.35) saturate(1.4)" }}
                />
              ) : (
                <div
                  className="w-full h-full"
                  style={{ background: `radial-gradient(ellipse at center, ${hexToRgba(accentColor, 0.3)} 0%, #000 70%)` }}
                />
              )}
              <div className="absolute inset-0 bg-black/50" />
            </div>

            {/* Close button */}
            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              className="absolute top-6 right-6 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-sm"
            >
              <Minimize2 className="w-5 h-5" />
            </button>

            {/* Open project button */}
            {onOpenProject && (
              <button
                type="button"
                onClick={() => { onOpenProject(playerState.currentTrack!); setIsFullscreen(false) }}
                className="absolute top-6 left-6 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-sm"
                title="Open Project"
              >
                <ExternalLink className="w-5 h-5" />
              </button>
            )}

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-lg px-8">
              {/* Artwork */}
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 20 }}
                className="w-64 h-64 rounded-2xl overflow-hidden shadow-2xl flex-shrink-0"
                style={{ boxShadow: `0 30px 80px ${hexToRgba(accentColor, 0.4)}` }}
              >
                {artworkUrl ? (
                  <img src={artworkUrl} alt={playerState.currentTrack.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/30 to-primary/5 flex items-center justify-center">
                    <Music className="w-20 h-20 text-primary/50" />
                  </div>
                )}
              </motion.div>

              {/* Track info + stars */}
              <div className="text-center w-full">
                <h2 className="text-2xl font-bold text-white truncate">{playerState.currentTrack.title}</h2>
                <p className="text-white/60 text-sm mt-1">
                  {[playerState.currentTrack.artists, playerState.currentTrack.genre].filter(Boolean).join(" · ")}
                  {playerState.currentTrack.bpm > 0 && ` · ${playerState.currentTrack.bpm} BPM`}
                </p>

                {/* Star rating */}
                {onRateProject && (
                  <div
                    className="flex items-center justify-center gap-1.5 mt-3"
                    onMouseLeave={() => setFsHoverRating(0)}
                  >
                    {[1, 2, 3, 4, 5].map((star) => {
                      const active = star <= (fsHoverRating || (playerState.currentTrack!.rating ?? 0))
                      return (
                        <button
                          key={star}
                          type="button"
                          onMouseEnter={() => setFsHoverRating(star)}
                          onClick={() => onRateProject(playerState.currentTrack!, (playerState.currentTrack!.rating ?? 0) === star ? 0 : star)}
                          className="transition-transform hover:scale-125 active:scale-95"
                        >
                          <Star
                            className="w-6 h-6 transition-colors drop-shadow"
                            fill={active ? "currentColor" : "none"}
                            style={{ color: active ? "#ffffff" : "rgba(255,255,255,0.3)" }}
                            strokeWidth={active ? 0 : 1.5}
                          />
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Progress bar */}
              <div className="w-full">
                <div
                  className="w-full h-1.5 rounded-full bg-white/20 cursor-pointer relative overflow-hidden"
                  onClick={handleSeek}
                >
                  <div
                    className="absolute left-0 top-0 h-full rounded-full transition-all duration-100"
                    style={{
                      width: `${localDuration > 0 ? (localCurrentTime / localDuration) * 100 : 0}%`,
                      background: accentColor,
                    }}
                  />
                </div>
                <div className="flex justify-between mt-1.5 text-xs text-white/50 font-mono">
                  <span>{formatTime(localCurrentTime)}</span>
                  <span>{formatTime(localDuration)}</span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-6">
                <button
                  type="button"
                  onClick={() => setIsShuffled(!isShuffled)}
                  className={cn("transition-all", isShuffled ? "text-white" : "text-white/40 hover:text-white/70")}
                  style={isShuffled ? { color: accentColor } : {}}
                >
                  <Shuffle className="w-5 h-5" />
                </button>

                <button type="button" onClick={handlePrevious} className="text-white/80 hover:text-white transition-colors">
                  <SkipBack className="w-7 h-7" fill="currentColor" />
                </button>

                <button
                  type="button"
                  onClick={handlePlayPause}
                  className="w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all hover:scale-105 active:scale-95"
                  style={{ background: accentColor, boxShadow: `0 8px 32px ${hexToRgba(accentColor, 0.5)}` }}
                >
                  {playerState.isPlaying
                    ? <Pause className="w-7 h-7 text-white" />
                    : <Play className="w-7 h-7 text-white ml-1" />}
                </button>

                <button type="button" onClick={handleNext} className="text-white/80 hover:text-white transition-colors">
                  <SkipForward className="w-7 h-7" fill="currentColor" />
                </button>

                <button
                  type="button"
                  onClick={cycleRepeatMode}
                  className={cn("transition-all", repeatMode !== "off" ? "text-white" : "text-white/40 hover:text-white/70")}
                  style={repeatMode !== "off" ? { color: accentColor } : {}}
                >
                  {getRepeatIcon()}
                </button>
              </div>

              {/* Volume */}
              <div className="flex items-center gap-3 w-48">
                <button type="button" onClick={toggleMute} className="text-white/50 hover:text-white/80 transition-colors">
                  {getVolumeIcon()}
                </button>
                <Slider value={[playerState.volume]} onValueChange={handleVolumeChange} max={1} step={0.01} className="flex-1" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </TooltipProvider>
  )
}

export default AudioPlayer
