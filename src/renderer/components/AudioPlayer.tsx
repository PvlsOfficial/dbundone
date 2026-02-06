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
  ChevronUp,
  ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Slider, Tooltip, TooltipContent, TooltipTrigger, TooltipProvider, Badge } from "@/components/ui"
import { AudioPlayerState, Project } from "@shared/types"
import { useTheme } from "./ThemeProvider"

interface AudioPlayerProps {
  playerState: AudioPlayerState
  setPlayerState: React.Dispatch<React.SetStateAction<AudioPlayerState>>
  projects: Project[]
  onOpenProject?: (project: Project) => void
  onPlayProject?: (project: Project) => void
}

type RepeatMode = "off" | "all" | "one"

// Helper to check if a project has playable audio
const hasPlayableAudio = (p: Project): boolean => {
  return !!(p.audioPreviewPath || p.favoriteVersionId)
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  playerState,
  setPlayerState,
  projects,
  onOpenProject,
  onPlayProject,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null) // HTML5 Audio fallback
  const blobUrlRef = useRef<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const initialSeekTimeRef = useRef<number>(0) // Track initial seek position for restore
  const [isReady, setIsReady] = useState(false)
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off")
  const [isShuffled, setIsShuffled] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [shuffledQueue, setShuffledQueue] = useState<Project[]>([])
  const [waveformPeaks, setWaveformPeaks] = useState<number[]>([])
  const [waveformLoading, setWaveformLoading] = useState(false)
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

  useEffect(() => {
    // TEMPORARILY DISABLE WaveSurfer to prevent crashes - using HTML5 Audio fallback

    return () => {
      // Clean up blob URL
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
        audioRef.current = null
      }
    }
  }, [isExpanded])

  useEffect(() => {
    if (playerState.currentTrack?.audioPreviewPath) {
      // Capture the initial currentTime for seeking after load
      if (playerState.currentTime > 0) {
        initialSeekTimeRef.current = playerState.currentTime
      }
      
      // Ensure audio element exists
      if (!audioRef.current) {
        audioRef.current = new Audio()

        audioRef.current.addEventListener('loadedmetadata', () => {
          setIsReady(true)
          setPlayerState((prev) => ({
            ...prev,
            duration: audioRef.current?.duration || 0,
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
            setPlayerState((prev) => ({
              ...prev,
              currentTime: audioRef.current?.currentTime || 0,
            }))
          }
        })

        audioRef.current.addEventListener('ended', () => {
          handleTrackEnd()
        })

        audioRef.current.addEventListener('play', () => {
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
        try {
          // Clean up previous blob URL
          if (blobUrlRef.current) {
            URL.revokeObjectURL(blobUrlRef.current)
            blobUrlRef.current = null
          }

          if (!playerState.currentTrack || !playerState.currentTrack.audioPreviewPath) return

          const arrayBuffer = await window.electron?.loadAudioFile(playerState.currentTrack.audioPreviewPath)
          if (!arrayBuffer) {
            throw new Error("Failed to load audio file")
          }

          // Determine MIME type based on file extension
          const filePath = playerState.currentTrack.audioPreviewPath.toLowerCase()
          let mimeType = 'audio/mpeg' // default
          if (filePath.endsWith('.wav')) {
            mimeType = '' // Let browser detect for WAV
          } else if (filePath.endsWith('.flac')) {
            mimeType = 'audio/flac'
          } else if (filePath.endsWith('.ogg')) {
            mimeType = 'audio/ogg'
          } else if (filePath.endsWith('.m4a') || filePath.endsWith('.aac')) {
            mimeType = 'audio/mp4'
          }

          const blob = new Blob([arrayBuffer], mimeType ? { type: mimeType } : {})
          const blobUrl = URL.createObjectURL(blob)
          blobUrlRef.current = blobUrl

          audioRef.current!.src = blobUrl
          audioRef.current!.load()
        } catch (error) {
          console.error("AudioPlayer: Failed to load audio:", error)
          setIsReady(false)
        }
      }
      loadAudio()
    }
  }, [playerState.currentTrack?.id])

  // Load waveform peaks when track changes
  useEffect(() => {
    const loadWaveform = async () => {
      if (!playerState.currentTrack?.audioPreviewPath) {
        setWaveformPeaks([])
        return
      }
      
      setWaveformLoading(true)
      try {
        const peaks = await window.electron?.getWaveformPeaks(playerState.currentTrack.audioPreviewPath, 150)
        if (peaks && peaks.length > 0) {
          setWaveformPeaks(peaks)
        } else {
          setWaveformPeaks([])
        }
      } catch (error) {
        console.error("Failed to load waveform:", error)
        setWaveformPeaks([])
      } finally {
        setWaveformLoading(false)
      }
    }
    
    loadWaveform()
  }, [playerState.currentTrack?.audioPreviewPath])

  // Draw waveform on canvas
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || waveformPeaks.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const width = rect.width
    const height = rect.height
    const barWidth = Math.max(2, width / waveformPeaks.length - 1)
    const gap = 1
    const progress = playerState.duration > 0 ? playerState.currentTime / playerState.duration : 0

    ctx.clearRect(0, 0, width, height)

    waveformPeaks.forEach((peak, i) => {
      const x = (i / waveformPeaks.length) * width
      const barHeight = Math.max(2, peak * height * 0.9)
      const y = (height - barHeight) / 2

      const isPlayed = (i / waveformPeaks.length) < progress
      ctx.fillStyle = isPlayed ? accentColor : hexToRgba(accentColor, 0.3)
      ctx.fillRect(x, y, barWidth, barHeight)
    })
  }, [waveformPeaks, playerState.currentTime, playerState.duration, accentColor])

  // Redraw waveform when needed
  useEffect(() => {
    drawWaveform()
  }, [drawWaveform, isExpanded])

  // Redraw on resize
  useEffect(() => {
    const handleResize = () => drawWaveform()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [drawWaveform])

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
    setPlayerState((prev) => ({
      ...prev,
      isPlaying: false,
      currentTime: 0,
    }))
  }

  const handlePrevious = () => {
    if (!playerState.currentTrack) return
    
    if (playerState.currentTime > 3) {
      if (audioRef.current) {
        audioRef.current.currentTime = 0
      }
      setPlayerState((prev) => ({ ...prev, currentTime: 0 }))
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
    setPlayerState((prev) => ({ ...prev, currentTime: newTime }))
  }

  const handleClose = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
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

  const queue = isShuffled ? shuffledQueue : projects.filter(p => p.audioPreviewPath)
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
            "bg-card/95 backdrop-blur-xl border-t border-border/30",
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
                {playerState.currentTrack.artworkPath ? (
                  <img
                    src={`appfile://${playerState.currentTrack.artworkPath.replace(/\\/g, "/")}`}
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
                    <div className="flex gap-0.5">
                      {[...Array(3)].map((_, i) => (
                        <motion.div
                          key={i}
                          className="w-1 bg-primary rounded-full"
                          animate={{ height: [8, 16, 8] }}
                          transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                        />
                      ))}
                    </div>
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
              <span className="text-xs text-muted-foreground font-mono w-10 text-right">{formatTime(playerState.currentTime)}</span>
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
                      style={{ width: `${playerState.duration > 0 ? (playerState.currentTime / playerState.duration) * 100 : 0}%` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-full h-0.5 bg-muted-foreground/20 rounded"></div>
                    </div>
                  </>
                )}
              </div>
              <span className="text-xs text-muted-foreground font-mono w-10">{formatTime(playerState.duration)}</span>
            </div>

            <div className="flex items-center gap-2">
              {queue.length > 1 && (
                <Badge variant="outline" className="text-xs font-mono">
                  {queueIndex + 1}/{queue.length}
                </Badge>
              )}

              <div className="flex items-center gap-2 w-32">
                <button onClick={toggleMute} className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors" title="Toggle mute">
                  {getVolumeIcon()}
                </button>
                <Slider value={[playerState.volume]} onValueChange={handleVolumeChange} max={1} step={0.01} className="w-20" />
              </div>

              {onOpenProject && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => playerState.currentTrack && onOpenProject(playerState.currentTrack)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
                      title="Open Project"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Open Project</TooltipContent>
                </Tooltip>
              )}

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
    </TooltipProvider>
  )
}

export default AudioPlayer
