import { assetUrl } from "./utils"

// A single shared AudioContext is reused for all decoding. Decoding works even
// while the context is suspended, so we never need to resume/play it.
let sharedCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null
  if (!sharedCtx) {
    const Ctor =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    sharedCtx = new Ctor()
  }
  return sharedCtx
}

/**
 * Fallback waveform peak computation using the browser's own audio decoder.
 *
 * The Rust/symphonia path can't decode every format the WebView can play —
 * notably Opus-in-Ogg, which Chromium/WebView2 plays fine but symphonia 0.5 has
 * no decoder for. When the Rust path returns no peaks, we fetch the file through
 * the Tauri asset protocol and decode it here instead.
 *
 * Returns normalized peaks (0..1) with `numPeaks` entries, or null on failure.
 */
export async function computePeaksViaWebAudio(
  filePath: string,
  numPeaks: number = 200
): Promise<number[] | null> {
  const ctx = getAudioContext()
  if (!ctx) return null

  const url = assetUrl(filePath)
  if (!url) return null

  try {
    const resp = await fetch(url)
    if (!resp.ok) return null
    const arrayBuf = await resp.arrayBuffer()
    const audioBuf = await ctx.decodeAudioData(arrayBuf)

    const channel = audioBuf.getChannelData(0)
    const total = channel.length
    if (total === 0) return null

    const samplesPerPeak = Math.floor(total / numPeaks)
    if (samplesPerPeak === 0) return null

    const peaks = new Array<number>(numPeaks).fill(0)
    for (let i = 0; i < numPeaks; i++) {
      const start = i * samplesPerPeak
      const end = i === numPeaks - 1 ? total : (i + 1) * samplesPerPeak
      let max = 0
      for (let j = start; j < end; j++) {
        const abs = Math.abs(channel[j])
        if (abs > max) max = abs
      }
      peaks[i] = max
    }

    // Match the Rust path's quiet-file normalization so waveforms look consistent.
    const maxPeak = peaks.reduce((m, p) => (p > m ? p : m), 0)
    if (maxPeak > 0 && maxPeak < 0.5) {
      const boost = 0.8 / maxPeak
      for (let i = 0; i < peaks.length; i++) peaks[i] = Math.min(peaks[i] * boost, 1)
    }

    return peaks
  } catch (err) {
    console.warn("Web Audio waveform fallback failed:", err)
    return null
  }
}
