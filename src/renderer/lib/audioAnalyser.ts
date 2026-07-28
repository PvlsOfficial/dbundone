// Shared audio analyser — a single AudioContext + AnalyserNode tapped onto the
// main AudioPlayer's <audio> element, so anything in the app (the Visualizer)
// can read realtime FFT/waveform data from whatever the main player is playing.
//
// Important Web Audio gotchas this module handles:
//  • createMediaElementSource() may be called at most once per element, and once
//    an element is routed through the graph it is silent until the node chain
//    reaches ctx.destination — so we always connect analyser → destination.
//  • A fresh AudioContext starts "suspended"; while suspended the routed element
//    produces NO sound. We resume() on user gestures (play) to fix this.

import type { AudioFrame } from "../vizlab/types"

const FFT_SIZE = 2048
const BINS = FFT_SIZE / 2

class AudioAnalyser {
  private ctx: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private splitter: ChannelSplitterNode | null = null
  private analyserL: AnalyserNode | null = null
  private analyserR: AnalyserNode | null = null
  private streamDest: MediaStreamAudioDestinationNode | null = null
  private source: MediaElementAudioSourceNode | null = null
  private attachedEl: HTMLAudioElement | null = null

  private freq = new Uint8Array(BINS)
  private wave = new Uint8Array(FFT_SIZE).fill(128)
  private waveL = new Uint8Array(FFT_SIZE).fill(128)
  private waveR = new Uint8Array(FFT_SIZE).fill(128)
  private freqL = new Uint8Array(BINS)
  private freqR = new Uint8Array(BINS)
  // Smoothed band energies so motion eases instead of strobing frame-to-frame.
  private sLevel = 0
  private sBass = 0
  private sMid = 0
  private sTreble = 0
  private sRmsL = 0
  private sRmsR = 0

  /** True once an element is routed through the analyser. */
  get attached(): boolean {
    return !!this.source
  }

  /** Current playback position of the attached element (smooth, read per-frame). */
  get currentTime(): number {
    return this.attachedEl?.currentTime ?? 0
  }

  /** Audio track for muxing into a recorded export, or null before any setup. */
  get audioStream(): MediaStream | null {
    return this.streamDest?.stream ?? null
  }

  private ensureCtx() {
    if (this.ctx) return
    const ctx = new AudioContext()
    const analyser = ctx.createAnalyser()
    analyser.fftSize = FFT_SIZE
    analyser.smoothingTimeConstant = 0.8
    const streamDest = ctx.createMediaStreamDestination()
    // Wire the output BEFORE any element is tapped, so a tapped element is never
    // left dangling without a path to the speakers.
    analyser.connect(ctx.destination)
    analyser.connect(streamDest)
    // Side branch for per-channel (stereo) analysis. These analysers are passive
    // sinks — they don't need to reach the destination.
    const splitter = ctx.createChannelSplitter(2)
    const analyserL = ctx.createAnalyser()
    const analyserR = ctx.createAnalyser()
    analyserL.fftSize = FFT_SIZE
    analyserR.fftSize = FFT_SIZE
    analyserL.smoothingTimeConstant = 0.8
    analyserR.smoothingTimeConstant = 0.8
    splitter.connect(analyserL, 0)
    splitter.connect(analyserR, 1)
    this.ctx = ctx
    this.analyser = analyser
    this.splitter = splitter
    this.analyserL = analyserL
    this.analyserR = analyserR
    this.streamDest = streamDest
  }

  /**
   * Route a media element through the analyser. Safe to call repeatedly; only
   * the first call for a given element creates a source node. If Web Audio setup
   * fails the element is left untouched so normal playback still works.
   */
  attach(el: HTMLAudioElement) {
    if (this.attachedEl === el && this.source) return
    try {
      this.ensureCtx()
      if (this.attachedEl !== el) {
        try {
          this.source?.disconnect()
        } catch {
          /* previous element already gone */
        }
        this.source = this.ctx!.createMediaElementSource(el)
        this.source.connect(this.analyser!)
        if (this.splitter) this.source.connect(this.splitter)
        this.attachedEl = el
      }
      this.resume()
    } catch (err) {
      // Leave the element playing normally; visualization just stays idle.
      console.warn("[audioAnalyser] attach failed:", err)
    }
  }

  /** Drop the source for an element (on AudioPlayer unmount). */
  detach(el: HTMLAudioElement) {
    if (this.attachedEl !== el) return
    try {
      this.source?.disconnect()
    } catch {
      /* ignore */
    }
    this.source = null
    this.attachedEl = null
  }

  resume() {
    if (this.ctx?.state === "suspended") void this.ctx.resume()
  }

  /** Sample the analyser and roll the smoothed band energies forward one frame. */
  frame(time: number): AudioFrame {
    if (this.analyser) {
      this.analyser.getByteFrequencyData(this.freq)
      this.analyser.getByteTimeDomainData(this.wave)
    }
    if (this.analyserL && this.analyserR) {
      this.analyserL.getByteTimeDomainData(this.waveL)
      this.analyserR.getByteTimeDomainData(this.waveR)
      this.analyserL.getByteFrequencyData(this.freqL)
      this.analyserR.getByteFrequencyData(this.freqR)
    }
    const bass = bandEnergy(this.freq, 0, 0.08)
    const mid = bandEnergy(this.freq, 0.08, 0.4)
    const treble = bandEnergy(this.freq, 0.4, 1)
    const level = (bass + mid + treble) / 3
    const rmsL = waveRms(this.waveL)
    const rmsR = waveRms(this.waveR)

    // Asymmetric smoothing: snap up fast on transients, fall back gently.
    this.sLevel = approach(this.sLevel, level, 0.5, 0.12)
    this.sBass = approach(this.sBass, bass, 0.6, 0.12)
    this.sMid = approach(this.sMid, mid, 0.55, 0.14)
    this.sTreble = approach(this.sTreble, treble, 0.5, 0.16)
    this.sRmsL = approach(this.sRmsL, rmsL, 0.6, 0.1)
    this.sRmsR = approach(this.sRmsR, rmsR, 0.6, 0.1)

    return {
      freq: this.freq,
      wave: this.wave,
      waveL: this.waveL,
      waveR: this.waveR,
      freqL: this.freqL,
      freqR: this.freqR,
      level: this.sLevel,
      bass: this.sBass,
      mid: this.sMid,
      treble: this.sTreble,
      rmsL: this.sRmsL,
      rmsR: this.sRmsR,
      time,
    }
  }
}

/** Average a normalized [lo,hi) slice of the FFT bins, scaled to 0..1. */
function bandEnergy(freq: Uint8Array, lo: number, hi: number): number {
  const a = Math.floor(lo * freq.length)
  const b = Math.max(a + 1, Math.floor(hi * freq.length))
  let sum = 0
  for (let i = a; i < b; i++) sum += freq[i]
  return sum / (b - a) / 255
}

/** RMS amplitude of a time-domain buffer (centered on 128), scaled to ~0..1. */
function waveRms(wave: Uint8Array): number {
  let sum = 0
  for (let i = 0; i < wave.length; i++) {
    const v = (wave[i] - 128) / 128
    sum += v * v
  }
  return Math.min(1, Math.sqrt(sum / wave.length) * 1.6)
}

/** Ease `cur` toward `target` using a faster rate when rising than falling. */
function approach(cur: number, target: number, up: number, down: number): number {
  const rate = target > cur ? up : down
  return cur + (target - cur) * rate
}

/** App-wide singleton. */
export const audioAnalyser = new AudioAnalyser()
