/**
 * Thin control bar rendered above tldraw (outside the tldraw DOM tree).
 * No overlap with tldraw's native toolbar/menu.
 */
import React from "react"
import { Maximize, Maximize2, Minimize2 } from "lucide-react"
import { cn } from "@/lib/utils"

export type CanvasMode = "normal" | "expanded" | "fullscreen"

interface CanvasOverlayProps {
  saveStatus: "saved" | "saving" | "unsaved"
  mode?: CanvasMode
  onSetMode?: (m: CanvasMode) => void
}

export function CanvasOverlay({ saveStatus, mode = "normal", onSetMode }: CanvasOverlayProps) {
  const saveColor = cn(
    saveStatus === "saved"   && "text-primary/60",
    saveStatus === "saving"  && "text-white/30",
    saveStatus === "unsaved" && "text-red-400/70",
  )

  const btnClass =
    "w-7 h-7 rounded-md text-white/35 hover:text-white/70 hover:bg-white/[0.06] flex items-center justify-center transition-colors cursor-pointer"

  return (
    <div className="flex items-center justify-between h-8 px-3 shrink-0 bg-[#0d0d0d] border-b border-white/[0.05] select-none">
      {/* Save status */}
      <span
        className={cn(
          "text-[10px] font-medium [font-family:system-ui,sans-serif]",
          saveColor,
        )}
      >
        {saveStatus === "saved" ? "● saved" : saveStatus === "saving" ? "● saving…" : "● unsaved"}
      </span>

      {/* Mode buttons */}
      {onSetMode && (
        <div className="flex items-center gap-0.5">
          {mode === "fullscreen" ? (
            <button type="button" onClick={() => onSetMode("normal")} title="Exit fullscreen" className={btnClass}>
              <Minimize2 size={13} />
            </button>
          ) : (
            <>
              {mode === "normal" ? (
                <button type="button" onClick={() => onSetMode("expanded")} title="Expand" className={btnClass}>
                  <Maximize size={13} />
                </button>
              ) : (
                <button type="button" onClick={() => onSetMode("normal")} title="Restore" className={btnClass}>
                  <Minimize2 size={13} />
                </button>
              )}
              <button type="button" onClick={() => onSetMode("fullscreen")} title="Fullscreen" className={btnClass}>
                <Maximize2 size={13} />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
