import React, { useCallback, useEffect, useRef, useState } from "react"
import { Check, Eraser, Paintbrush, Trash2 } from "lucide-react"
import { Button } from "@/components/ui"
import { CoverEngine } from "../engine/CoverEngine"
import { CoverDoc } from "../engine/types"

interface CanvasStageProps {
  doc: CoverDoc
  playing: boolean
  onEngineReady: (engine: CoverEngine) => void
  onErrors?: (errors: Map<string, string>) => void
  /** When true, a paint overlay lets the user mask where motion effects apply. */
  maskMode?: boolean
  /** Existing mask (PNG data URL) for the active target, used to seed the overlay. */
  maskSrc?: string
  /**
   * Identity of the mask being painted (e.g. "doc" or an effect instance id). The
   * overlay re-seeds from maskSrc whenever this changes, so switching between the
   * global mask and a per-effect mask shows the right painting.
   */
  maskKey?: string
  /** Caption shown under the overlay, e.g. which effect's mask is being painted. */
  maskLabel?: string
  onMaskChange?: (dataUrl: string | undefined) => void
  onExitMaskMode?: () => void
}

/** Longest side of the offscreen mask bitmap (kept small — it's a soft mask). */
const MASK_MAX = 768
const MASK_TINT = "rgba(96,165,250,1)"

export const CanvasStage: React.FC<CanvasStageProps> = ({
  doc,
  playing,
  onEngineReady,
  onErrors,
  maskMode = false,
  maskSrc,
  maskKey,
  maskLabel,
  onMaskChange,
  onExitMaskMode,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<CoverEngine | null>(null)
  const timeRef = useRef(0)
  const rafRef = useRef(0)
  const playingRef = useRef(playing)
  playingRef.current = playing

  // ── Mask painting state ─────────────────────────────────────────────────────
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const tintCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawingRef = useRef(false)
  const lastPtRef = useRef<{ x: number; y: number } | null>(null)
  const maskSrcRef = useRef(maskSrc)
  maskSrcRef.current = maskSrc
  const [brush, setBrush] = useState(60)
  const [erase, setErase] = useState(false)
  const eraseRef = useRef(erase)
  eraseRef.current = erase
  const brushRef = useRef(brush)
  brushRef.current = brush

  const aspect = doc.width / doc.height
  const maskW = aspect >= 1 ? MASK_MAX : Math.max(8, Math.round(MASK_MAX * aspect))
  const maskH = aspect >= 1 ? Math.max(8, Math.round(MASK_MAX / aspect)) : MASK_MAX

  // Create the engine once.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let engine: CoverEngine | null = null
    try {
      engine = new CoverEngine(canvas)
    } catch (e) {
      console.error("Failed to init Cover Lab engine:", e)
      onErrors?.(new Map([["__engine__", String(e instanceof Error ? e.message : e)]]))
      return
    }
    engineRef.current = engine
    if (onErrors) engine.setErrorHandler(onErrors)
    onEngineReady(engine)
    return () => {
      cancelAnimationFrame(rafRef.current)
      engine?.dispose()
      engineRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Push doc changes into the engine and render a fresh frame.
  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    engine.setDoc(doc)
    let cancelled = false
    const draw = () => {
      if (cancelled || !engineRef.current) return
      try {
        engine.render(timeRef.current)
      } catch (e) {
        console.error("render error:", e)
      }
    }
    draw() // instant feedback (images may pop in after load)
    engine.ensureImages().then(() => {
      if (!cancelled) {
        engine.invalidateSource()
        draw()
      }
    })
    return () => {
      cancelled = true
    }
  }, [doc])

  // Animation loop.
  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    if (!playing) {
      cancelAnimationFrame(rafRef.current)
      return
    }
    let last = performance.now()
    const loop = () => {
      if (!playingRef.current || !engineRef.current) return
      const now = performance.now()
      timeRef.current += (now - last) / 1000
      last = now
      try {
        engine.render(timeRef.current)
      } catch (e) {
        console.error("animation render error:", e)
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [playing])

  // ── Mask painting ───────────────────────────────────────────────────────────

  /** Dimmed veil with painted (= will-move) areas revealed and softly tinted. */
  const redrawOverlay = useCallback(() => {
    const overlay = overlayRef.current
    const mask = maskCanvasRef.current
    if (!overlay || !mask || overlay.width === 0) return
    const ctx = overlay.getContext("2d")!
    ctx.globalCompositeOperation = "source-over"
    ctx.globalAlpha = 1
    ctx.clearRect(0, 0, overlay.width, overlay.height)
    ctx.fillStyle = "rgba(8,8,14,0.55)"
    ctx.fillRect(0, 0, overlay.width, overlay.height)
    ctx.globalCompositeOperation = "destination-out"
    ctx.drawImage(mask, 0, 0, overlay.width, overlay.height)
    // Tint the painted areas so they read even over bright artwork.
    let tint = tintCanvasRef.current
    if (!tint) tint = tintCanvasRef.current = document.createElement("canvas")
    tint.width = mask.width
    tint.height = mask.height
    const tctx = tint.getContext("2d")!
    tctx.globalCompositeOperation = "source-over"
    tctx.drawImage(mask, 0, 0)
    tctx.globalCompositeOperation = "source-in"
    tctx.fillStyle = MASK_TINT
    tctx.fillRect(0, 0, tint.width, tint.height)
    ctx.globalCompositeOperation = "source-over"
    ctx.globalAlpha = 0.3
    ctx.drawImage(tint, 0, 0, overlay.width, overlay.height)
    ctx.globalAlpha = 1
  }, [])

  /** Keep the overlay exactly covering the WebGL canvas. */
  const syncOverlay = useCallback(() => {
    const canvas = canvasRef.current
    const stage = stageRef.current
    const overlay = overlayRef.current
    if (!canvas || !stage || !overlay) return
    const c = canvas.getBoundingClientRect()
    const s = stage.getBoundingClientRect()
    overlay.style.left = `${c.left - s.left}px`
    overlay.style.top = `${c.top - s.top}px`
    overlay.style.width = `${c.width}px`
    overlay.style.height = `${c.height}px`
    const w = Math.max(1, Math.round(c.width))
    const h = Math.max(1, Math.round(c.height))
    if (overlay.width !== w || overlay.height !== h) {
      overlay.width = w
      overlay.height = h
    }
    redrawOverlay()
  }, [redrawOverlay])

  // Enter mask mode (or switch which mask is being painted): rebuild the offscreen
  // mask sized to the canvas and seed it from the active target's saved mask
  // (maskSrc). Re-runs when maskKey changes so picking a different effect's mask
  // loads that effect's painting rather than carrying the previous one over.
  useEffect(() => {
    if (!maskMode) return
    let mask = maskCanvasRef.current
    if (!mask) mask = maskCanvasRef.current = document.createElement("canvas")
    mask.width = maskW
    mask.height = maskH
    const ctx = mask.getContext("2d")!
    ctx.globalCompositeOperation = "source-over"
    ctx.clearRect(0, 0, maskW, maskH)
    let cancelled = false
    const src = maskSrcRef.current
    if (src) {
      const img = new Image()
      img.onload = () => {
        if (cancelled) return
        ctx.globalCompositeOperation = "source-over"
        ctx.clearRect(0, 0, maskW, maskH)
        ctx.drawImage(img, 0, 0, maskW, maskH)
        redrawOverlay()
      }
      img.src = src
    }
    syncOverlay()
    const canvas = canvasRef.current
    const ro = canvas ? new ResizeObserver(syncOverlay) : null
    if (canvas && ro) ro.observe(canvas)
    window.addEventListener("resize", syncOverlay)
    return () => {
      cancelled = true
      ro?.disconnect()
      window.removeEventListener("resize", syncOverlay)
    }
  }, [maskMode, maskKey, maskW, maskH, syncOverlay, redrawOverlay])

  const stamp = useCallback((x: number, y: number, radius: number) => {
    const mask = maskCanvasRef.current
    if (!mask) return
    const ctx = mask.getContext("2d")!
    ctx.globalCompositeOperation = eraseRef.current ? "destination-out" : "source-over"
    const g = ctx.createRadialGradient(x, y, radius * 0.45, x, y, radius)
    g.addColorStop(0, "rgba(255,255,255,1)")
    g.addColorStop(1, "rgba(255,255,255,0)")
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
  }, [])

  const toMaskPoint = useCallback(
    (e: React.PointerEvent) => {
      const overlay = overlayRef.current!
      const r = overlay.getBoundingClientRect()
      return {
        x: ((e.clientX - r.left) / r.width) * maskW,
        y: ((e.clientY - r.top) / r.height) * maskH,
        radius: ((brushRef.current / 2) * maskW) / r.width,
      }
    },
    [maskW, maskH]
  )

  const commitMask = useCallback(() => {
    const mask = maskCanvasRef.current
    if (!mask || !onMaskChange) return
    const ctx = mask.getContext("2d")!
    const data = ctx.getImageData(0, 0, mask.width, mask.height).data
    let painted = false
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 0) {
        painted = true
        break
      }
    }
    onMaskChange(painted ? mask.toDataURL("image/png") : undefined)
  }, [onMaskChange])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return
      e.currentTarget.setPointerCapture(e.pointerId)
      drawingRef.current = true
      const p = toMaskPoint(e)
      lastPtRef.current = p
      stamp(p.x, p.y, p.radius)
      redrawOverlay()
    },
    [toMaskPoint, stamp, redrawOverlay]
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drawingRef.current) return
      const p = toMaskPoint(e)
      const last = lastPtRef.current || p
      const dx = p.x - last.x
      const dy = p.y - last.y
      const dist = Math.hypot(dx, dy)
      const step = Math.max(1, p.radius * 0.35)
      for (let d = 0; d <= dist; d += step) {
        const f = dist === 0 ? 0 : d / dist
        stamp(last.x + dx * f, last.y + dy * f, p.radius)
      }
      lastPtRef.current = p
      redrawOverlay()
    },
    [toMaskPoint, stamp, redrawOverlay]
  )

  const onPointerUp = useCallback(() => {
    if (!drawingRef.current) return
    drawingRef.current = false
    lastPtRef.current = null
    commitMask()
  }, [commitMask])

  const clearMask = useCallback(() => {
    const mask = maskCanvasRef.current
    if (mask) mask.getContext("2d")!.clearRect(0, 0, mask.width, mask.height)
    onMaskChange?.(undefined)
    redrawOverlay()
  }, [onMaskChange, redrawOverlay])

  return (
    <div
      ref={stageRef}
      className="flex-1 flex items-center justify-center overflow-hidden p-6 coverlab-stage min-h-0 relative"
    >
      <canvas
        ref={canvasRef}
        className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
        style={{ aspectRatio: `${doc.width} / ${doc.height}`, imageRendering: "auto" }}
      />
      {maskMode && (
        <>
          <canvas
            ref={overlayRef}
            className="absolute rounded-lg cursor-crosshair touch-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-border/50 bg-background/90 backdrop-blur shadow-lg">
            <Button
              size="sm"
              variant={erase ? "ghost" : "secondary"}
              className="h-7 px-2 text-xs gap-1"
              onClick={() => setErase(false)}
            >
              <Paintbrush className="w-3.5 h-3.5" /> Paint
            </Button>
            <Button
              size="sm"
              variant={erase ? "secondary" : "ghost"}
              className="h-7 px-2 text-xs gap-1"
              onClick={() => setErase(true)}
            >
              <Eraser className="w-3.5 h-3.5" /> Erase
            </Button>
            <input
              type="range"
              min={10}
              max={220}
              value={brush}
              onChange={(e) => setBrush(Number(e.target.value))}
              className="w-24 accent-primary"
              title="Brush size"
            />
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1" onClick={clearMask}>
              <Trash2 className="w-3.5 h-3.5" /> Clear
            </Button>
            <Button size="sm" variant="secondary" className="h-7 px-2 text-xs gap-1" onClick={onExitMaskMode}>
              <Check className="w-3.5 h-3.5" /> Done
            </Button>
          </div>
          <p className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full bg-background/80 backdrop-blur text-[11px] text-muted-foreground pointer-events-none">
            {maskLabel || "Paint where motion applies"}
          </p>
        </>
      )}
    </div>
  )
}
