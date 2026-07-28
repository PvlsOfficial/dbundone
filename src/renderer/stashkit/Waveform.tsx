import React, { useEffect, useRef, useState } from "react"
import { computeAudioPeaks, getCachedPeaks } from "../lib/tauriApi"

interface WaveformProps {
  filePath: string
  color?: string
  height?: number
  numPeaks?: number
  className?: string
}

/** Tiny waveform thumbnail backed by the existing peaks pipeline (with disk cache). */
export const Waveform: React.FC<WaveformProps> = ({
  filePath,
  color = "#8b5cf6",
  height = 28,
  numPeaks = 80,
  className,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [peaks, setPeaks] = useState<number[] | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        let p = await getCachedPeaks(filePath, numPeaks)
        if (!p) p = await computeAudioPeaks(filePath, numPeaks)
        if (!cancelled) setPeaks(p)
      } catch {
        if (!cancelled) setPeaks([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [filePath, numPeaks])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !peaks) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = height
    canvas.width = w * dpr
    canvas.height = h * dpr
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, w, h)
    if (peaks.length === 0) return
    const mid = h / 2
    const bw = w / peaks.length
    ctx.fillStyle = color
    for (let i = 0; i < peaks.length; i++) {
      const amp = Math.max(0.02, peaks[i]) * (h / 2)
      ctx.fillRect(i * bw, mid - amp, Math.max(1, bw - 0.5), amp * 2)
    }
  }, [peaks, color, height])

  return <canvas ref={canvasRef} className={className} style={{ width: "100%", height }} />
}
