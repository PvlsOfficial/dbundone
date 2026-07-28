// VizStage — mounts the ThreeEngine into the DOM, observes resize and runs the
// render loop, reading the live scene (via ref) and the shared audio analyser.

import React, { useEffect, useRef } from "react"
import { audioAnalyser } from "@/lib/audioAnalyser"
import { ThreeEngine } from "./engine"
import type { VizScene } from "../types"

interface Props {
  sceneRef: React.MutableRefObject<VizScene>
  onCanvas?: (c: HTMLCanvasElement | null) => void
}

export const VizStage: React.FC<Props> = ({ sceneRef, onCanvas }) => {
  const hostRef = useRef<HTMLDivElement>(null)
  const onCanvasRef = useRef(onCanvas)
  onCanvasRef.current = onCanvas

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const engine = new ThreeEngine()
    host.appendChild(engine.domElement)
    engine.domElement.style.width = "100%"
    engine.domElement.style.height = "100%"
    engine.domElement.style.borderRadius = "6px"
    onCanvasRef.current?.(engine.domElement)

    const resize = () => engine.setSize(host.clientWidth || 1, host.clientHeight || 1)
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(host)

    let raf = 0
    const previewStart = performance.now()
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const scene = sceneRef.current
      const t = audioAnalyser.attached ? audioAnalyser.currentTime : (performance.now() - previewStart) / 1000
      const frame = audioAnalyser.frame(t)
      engine.sync(scene)
      engine.render(scene, frame)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      onCanvasRef.current?.(null)
      if (engine.domElement.parentNode === host) host.removeChild(engine.domElement)
      engine.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div ref={hostRef} className="w-full h-full" />
}
