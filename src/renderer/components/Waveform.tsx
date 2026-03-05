import React, { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface WaveformProps {
  audioUrl: string
  isPlaying: boolean
  currentTime: number
  duration: number
  onSeek: (time: number) => void
  onReady?: (duration: number) => void
  height?: number
  waveColor?: string
  progressColor?: string
  className?: string
}

const NUM_WAVEFORM_PEAKS = 200

// Module-level cache so peaks survive component remounts and version switches
const peaksCache = new Map<string, number[]>()

export const Waveform: React.FC<WaveformProps> = ({
  audioUrl,
  currentTime,
  duration,
  onSeek,
  height = 64,
  waveColor = 'rgba(139, 92, 246, 0.3)',
  progressColor = 'rgba(139, 92, 246, 1)',
  className,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [peaks, setPeaks] = useState<number[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestIdRef = useRef(0)

  // Stable draw function ref to avoid re-creating on every render
  const drawRef = useRef<() => void>()

  // Load waveform peaks — check memory cache, then disk cache (instant), then compute
  useEffect(() => {
    if (!audioUrl) return

    // 1. Memory cache — instant, no IPC
    const cached = peaksCache.get(audioUrl)
    if (cached) {
      setPeaks(cached)
      setIsLoading(false)
      setError(null)
      return
    }

    const thisRequest = ++requestIdRef.current

    // 2. Try disk cache first (very fast IPC, no audio decode)
    const loadPeaks = async () => {
      try {
        // Fast path: disk cache lookup — typically < 1ms
        const diskCached = await window.electron?.getCachedPeaks(audioUrl, NUM_WAVEFORM_PEAKS)
        if (thisRequest !== requestIdRef.current) return

        if (diskCached && diskCached.length > 0) {
          peaksCache.set(audioUrl, diskCached)
          setPeaks(diskCached)
          setIsLoading(false)
          setError(null)
          return
        }

        // 3. Slow path: compute peaks (runs on background thread in Rust)
        setIsLoading(true)
        setError(null)
        setPeaks([])

        const computed = await window.electron?.computeAudioPeaks(audioUrl, NUM_WAVEFORM_PEAKS)
        if (thisRequest !== requestIdRef.current) return

        if (computed && computed.length > 0) {
          peaksCache.set(audioUrl, computed)
          setPeaks(computed)
        } else {
          setError('Could not compute waveform')
        }
      } catch (err) {
        if (thisRequest !== requestIdRef.current) return
        console.error('Failed to load waveform:', err)
        setError('Waveform unavailable')
      } finally {
        if (thisRequest === requestIdRef.current) {
          setIsLoading(false)
        }
      }
    }

    loadPeaks()
  }, [audioUrl])

  // Draw waveform on canvas — update the ref so RAF can call it
  drawRef.current = () => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container || peaks.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = container.getBoundingClientRect()

    // Only resize canvas when dimensions actually change
    const targetW = Math.round(rect.width * dpr)
    const targetH = Math.round(rect.height * dpr)
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW
      canvas.height = targetH
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    ctx.clearRect(0, 0, rect.width, rect.height)

    const barWidth = rect.width / peaks.length
    const barGap = Math.max(1, barWidth * 0.2)
    const actualBarWidth = barWidth - barGap
    const centerY = rect.height / 2
    const progress = duration > 0 ? currentTime / duration : 0

    // Batch by color to minimize fillStyle switches
    ctx.fillStyle = waveColor
    for (let i = 0; i < peaks.length; i++) {
      const barProgress = (i + 0.5) / peaks.length
      if (barProgress > progress) {
        const x = i * barWidth + barGap / 2
        const barHeight = Math.max(2, peaks[i] * (rect.height * 0.9))
        ctx.fillRect(x, centerY - barHeight / 2, actualBarWidth, barHeight)
      }
    }

    ctx.fillStyle = progressColor
    for (let i = 0; i < peaks.length; i++) {
      const barProgress = (i + 0.5) / peaks.length
      if (barProgress <= progress) {
        const x = i * barWidth + barGap / 2
        const barHeight = Math.max(2, peaks[i] * (rect.height * 0.9))
        ctx.fillRect(x, centerY - barHeight / 2, actualBarWidth, barHeight)
      }
    }
  }

  // Resize counter to trigger redraw on window resize without cloning arrays
  const [resizeCounter, setResizeCounter] = useState(0)

  // Redraw via requestAnimationFrame, throttled to avoid redundant draws
  const rafIdRef = useRef<number>(0)
  useEffect(() => {
    if (peaks.length === 0) return
    cancelAnimationFrame(rafIdRef.current)
    rafIdRef.current = requestAnimationFrame(() => {
      drawRef.current?.()
    })
    return () => cancelAnimationFrame(rafIdRef.current)
  }, [peaks, currentTime, duration, waveColor, progressColor, resizeCounter])
  useEffect(() => {
    let rafId = 0
    const handleResize = () => {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => setResizeCounter(c => c + 1))
    }
    window.addEventListener('resize', handleResize)
    return () => { window.removeEventListener('resize', handleResize); cancelAnimationFrame(rafId) }
  }, [])

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const clickPosition = (e.clientX - rect.left) / rect.width
    const seekTime = clickPosition * duration
    onSeek(Math.max(0, Math.min(seekTime, duration)))
  }, [duration, onSeek])

  if (error) {
    return (
      <div
        onClick={handleClick}
        className={cn(
          "w-full cursor-pointer rounded-lg overflow-hidden relative flex items-center justify-center",
          className
        )}
        style={{ height, backgroundColor: waveColor }}
      >
        <span className="text-xs text-muted-foreground">Waveform unavailable</span>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      className={cn(
        "w-full cursor-pointer rounded-lg overflow-hidden relative",
        className
      )}
      style={{ height }}
    >
      {isLoading ? (
        <div
          className="absolute inset-0 rounded-lg animate-pulse"
          style={{ backgroundColor: waveColor }}
        />
      ) : (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
        />
      )}
    </div>
  )
}

export default Waveform
