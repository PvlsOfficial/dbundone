import React, { useEffect, useRef } from "react"

interface MiniWaveProps {
  peaks: number[]
  color?: string
  height?: number
  className?: string
}

/**
 * Instant waveform — renders peaks that were embedded by the backend during scan,
 * so there are NO per-item async calls (keeps 1000+ rows snappy).
 */
export const MiniWave: React.FC<MiniWaveProps> = ({ peaks, color = "#8b5cf6", height = 20, className }) => {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth || 120
    canvas.width = w * dpr
    canvas.height = height * dpr
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, w, height)
    if (!peaks || peaks.length === 0) return
    const mid = height / 2
    const bw = w / peaks.length
    ctx.fillStyle = color
    for (let i = 0; i < peaks.length; i++) {
      const amp = Math.max(0.03, peaks[i]) * (height / 2)
      ctx.fillRect(i * bw, mid - amp, Math.max(1, bw - 0.6), amp * 2)
    }
  }, [peaks, color, height])

  return <canvas ref={ref} className={className} style={{ width: "100%", height }} />
}
