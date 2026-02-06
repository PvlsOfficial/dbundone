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
  const currentAudioUrl = useRef<string>('')

  // Fetch waveform peaks from main process
  useEffect(() => {
    if (!audioUrl || audioUrl === currentAudioUrl.current) return

    let cancelled = false
    currentAudioUrl.current = audioUrl
    setIsLoading(true)
    setError(null)

    const loadPeaks = async () => {
      try {
        const numPeaks = 200 // Number of bars in waveform
        const waveformPeaks = await window.electron.getWaveformPeaks(audioUrl, numPeaks)
        
        if (cancelled) return
        
        setPeaks(waveformPeaks)
        setIsLoading(false)
      } catch (err) {
        if (cancelled) return
        console.error('Failed to load waveform:', err)
        setError((err as Error).message)
        setIsLoading(false)
      }
    }

    loadPeaks()

    return () => {
      cancelled = true
    }
  }, [audioUrl])

  // Draw waveform on canvas
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container || peaks.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1
    const rect = container.getBoundingClientRect()
    
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`
    ctx.scale(dpr, dpr)

    // Clear canvas
    ctx.clearRect(0, 0, rect.width, rect.height)

    const barWidth = rect.width / peaks.length
    const barGap = Math.max(1, barWidth * 0.2)
    const actualBarWidth = barWidth - barGap
    const centerY = rect.height / 2
    const progress = duration > 0 ? currentTime / duration : 0

    // Draw waveform bars
    peaks.forEach((peak, i) => {
      const x = i * barWidth + barGap / 2
      const barHeight = Math.max(2, peak * (rect.height * 0.9))
      const halfBarHeight = barHeight / 2
      
      // Determine if this bar is in the "played" region
      const barProgress = (i + 0.5) / peaks.length
      const isPlayed = barProgress <= progress

      ctx.fillStyle = isPlayed ? progressColor : waveColor
      
      // Draw symmetrical bar (top half and bottom half)
      ctx.fillRect(x, centerY - halfBarHeight, actualBarWidth, barHeight)
    })
  }, [peaks, currentTime, duration, waveColor, progressColor])

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      // Trigger re-render by forcing peaks update
      setPeaks(p => [...p])
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
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
