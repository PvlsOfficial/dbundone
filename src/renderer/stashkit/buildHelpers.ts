import type { KitCategory, SampleCandidate } from "@shared/types"

/** Sub-folder name for descriptor-based splitting (e.g. 808s → by key). */
export function subfolderFor(s: SampleCandidate, cat: KitCategory | undefined): string {
  if (!cat || !cat.splitBy || cat.splitBy === "none") return ""
  switch (cat.splitBy) {
    case "key":
      return s.key ? s.key.replace(/[0-9-]/g, "") || s.key : "Unpitched"
    case "length":
      return s.lengthClass.charAt(0).toUpperCase() + s.lengthClass.slice(1)
    case "distorted":
      return s.distorted ? "Distorted" : "Clean"
    default:
      return ""
  }
}

/** Render a pack cover (gradient + kit name) to PNG bytes for the kit + library. */
export async function generateCoverPng(
  name: string,
  colorA: string,
  colorB: string,
  sampleCount: number,
  size = 1000
): Promise<number[] | null> {
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")
  if (!ctx) return null

  // diagonal gradient
  const g = ctx.createLinearGradient(0, 0, size, size)
  g.addColorStop(0, colorA)
  g.addColorStop(1, colorB)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)

  // subtle darken vignette for text legibility
  const v = ctx.createRadialGradient(size / 2, size / 2, size * 0.2, size / 2, size / 2, size * 0.75)
  v.addColorStop(0, "rgba(0,0,0,0)")
  v.addColorStop(1, "rgba(0,0,0,0.45)")
  ctx.fillStyle = v
  ctx.fillRect(0, 0, size, size)

  ctx.textAlign = "center"
  ctx.fillStyle = "rgba(255,255,255,0.85)"
  ctx.font = `600 ${size * 0.05}px Inter, system-ui, sans-serif`
  ctx.fillText("DRUM KIT", size / 2, size * 0.42)

  // kit name (wrap to ~14 chars/line)
  ctx.fillStyle = "#ffffff"
  ctx.font = `800 ${size * 0.11}px Inter, system-ui, sans-serif`
  const words = (name || "Untitled Kit").split(" ")
  const lines: string[] = []
  let line = ""
  for (const w of words) {
    if ((line + " " + w).trim().length > 14) {
      lines.push(line.trim())
      line = w
    } else {
      line = (line + " " + w).trim()
    }
  }
  if (line) lines.push(line)
  const lh = size * 0.12
  lines.slice(0, 3).forEach((l, i) => ctx.fillText(l, size / 2, size * 0.55 + i * lh))

  ctx.fillStyle = "rgba(255,255,255,0.7)"
  ctx.font = `500 ${size * 0.035}px Inter, system-ui, sans-serif`
  ctx.fillText(`${sampleCount} samples`, size / 2, size * 0.9)

  const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/png"))
  if (!blob) return null
  const buf = new Uint8Array(await blob.arrayBuffer())
  return Array.from(buf)
}

/** Default usage/license agreement bundled into every kit. */
export function defaultAgreement(kitName: string, author = "the creator"): string {
  const year = new Date().getFullYear()
  return `${kitName} — Sample Pack License Agreement
Copyright (c) ${year} ${author}. All rights reserved.

1. GRANT OF LICENSE
You are granted a non-exclusive, non-transferable license to use the sounds in
"${kitName}" (the "Sounds") in your own original musical compositions and
productions, including commercial releases.

2. RESTRICTIONS
You MAY NOT resell, redistribute, repackage, or give away the Sounds as samples,
loops, or sound libraries, either in their original or modified form. You may not
use the Sounds to create a competing sample product.

3. OWNERSHIP
All Sounds remain the intellectual property of the copyright holder. This license
does not transfer ownership.

4. CLEARANCE
No sample clearance is required for music you release that incorporates the Sounds
into a new composition.

By using these Sounds you agree to the terms above.
Generated with the Stash Kit Creator.`
}
