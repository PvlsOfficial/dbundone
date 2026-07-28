import React, { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

interface NumberInputProps {
  value: number
  min?: number
  max?: number
  step?: number
  onChange: (value: number) => void
  className?: string
  ariaLabel?: string
}

function decimalsFor(step?: number): number {
  if (!step || step >= 1) return step && step >= 1 ? 0 : 2
  const s = String(step)
  const dot = s.indexOf(".")
  return dot === -1 ? 0 : s.length - dot - 1
}

/** A compact numeric field that lets you type an exact value (clamped on commit). */
export const NumberInput: React.FC<NumberInputProps> = ({ value, min, max, step, onChange, className, ariaLabel }) => {
  const dec = decimalsFor(step)
  const [text, setText] = useState(value.toFixed(dec))

  // Keep the field in sync when the value changes externally (slider, undo, presets).
  useEffect(() => {
    setText(value.toFixed(dec))
  }, [value, dec])

  const commit = () => {
    let n = parseFloat(text)
    if (Number.isNaN(n)) {
      setText(value.toFixed(dec))
      return
    }
    if (min != null) n = Math.max(min, n)
    if (max != null) n = Math.min(max, n)
    onChange(n)
    setText(n.toFixed(dec))
  }

  return (
    <input
      type="number"
      value={text}
      min={min}
      max={max}
      step={step}
      aria-label={ariaLabel}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur()
      }}
      className={cn(
        "w-16 h-6 px-1.5 rounded bg-muted/40 border border-border/40 text-[11px] font-mono tabular-nums text-right text-foreground/90 focus:outline-none focus:ring-1 focus:ring-primary/50",
        className
      )}
    />
  )
}
