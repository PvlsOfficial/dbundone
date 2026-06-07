/**
 * CSGO-style case opening animation for random project selection.
 *
 * The reel scrolls from fast → slow → snap on winner.
 * Uses requestAnimationFrame + CSS transforms for smooth animation.
 */
import React, { useEffect, useRef, useState, useCallback } from "react"
import { motion, AnimatePresence, useAnimationControls } from "framer-motion"
import { X, Dices, Zap, Activity, Calendar, Clock, Star, Layers } from "lucide-react"
import { Project } from "@shared/types"
import { cn, assetUrl } from "@/lib/utils"

interface Tier {
  color: string
  glow: string
  label: string
  range: string
}

interface RarityMode {
  id: ModeId
  label: string
  hint: string
  icon: React.ComponentType<{ className?: string }>
  tiers: Tier[]
  getTier: (p: Project) => number
  getMetric: (p: Project) => string | null
}

type ModeId = "bpm" | "age" | "status" | "time" | "rating"

const PAL = {
  blue:   { color: "#60a5fa", glow: "rgba(96,165,250,0.55)" },
  green:  { color: "#34d399", glow: "rgba(52,211,153,0.55)" },
  yellow: { color: "#facc15", glow: "rgba(250,204,21,0.6)"  },
  orange: { color: "#fb923c", glow: "rgba(251,146,60,0.65)" },
  red:    { color: "#ef4444", glow: "rgba(239,68,68,0.7)"   },
  purple: { color: "#a78bfa", glow: "rgba(167,139,250,0.5)" },
}

const DAY_MS = 86400000

const RARITY_MODES: Record<ModeId, RarityMode> = {
  bpm: {
    id: "bpm",
    label: "BPM",
    hint: "By tempo",
    icon: Activity,
    tiers: [
      { ...PAL.blue,   label: "Chill",   range: "< 80 BPM"    },
      { ...PAL.green,  label: "Groove",  range: "80–100 BPM"  },
      { ...PAL.yellow, label: "Bounce",  range: "100–120 BPM" },
      { ...PAL.orange, label: "Hype",    range: "120–140 BPM" },
      { ...PAL.red,    label: "Fire",    range: "140+ BPM"    },
      { ...PAL.purple, label: "Unknown", range: "No BPM"      },
    ],
    getTier: (p) => {
      const bpm = p.bpm
      if (!bpm || bpm <= 0) return 5
      if (bpm < 80) return 0
      if (bpm < 100) return 1
      if (bpm < 120) return 2
      if (bpm < 140) return 3
      return 4
    },
    getMetric: (p) => (p.bpm > 0 ? `${p.bpm} BPM` : null),
  },
  age: {
    id: "age",
    label: "Freshness",
    hint: "By recency",
    icon: Calendar,
    tiers: [
      { ...PAL.red,    label: "Fresh",   range: "Today"        },
      { ...PAL.orange, label: "Recent",  range: "This week"    },
      { ...PAL.yellow, label: "Settled", range: "This month"   },
      { ...PAL.green,  label: "Aging",   range: "< 3 months"   },
      { ...PAL.blue,   label: "Dusty",   range: "3+ months"    },
      { ...PAL.purple, label: "Lost",    range: "Unknown date" },
    ],
    getTier: (p) => {
      const t = p.fileModifiedAt || p.updatedAt || p.createdAt
      if (!t) return 5
      const days = (Date.now() - new Date(t).getTime()) / DAY_MS
      if (days < 1) return 0
      if (days < 7) return 1
      if (days < 30) return 2
      if (days < 90) return 3
      return 4
    },
    getMetric: (p) => {
      const t = p.fileModifiedAt || p.updatedAt || p.createdAt
      if (!t) return null
      const days = Math.floor((Date.now() - new Date(t).getTime()) / DAY_MS)
      if (days < 1) return "today"
      if (days < 30) return `${days}d ago`
      if (days < 365) return `${Math.floor(days / 30)}mo ago`
      return `${Math.floor(days / 365)}y ago`
    },
  },
  status: {
    id: "status",
    label: "Stage",
    hint: "By progress",
    icon: Layers,
    tiers: [
      { ...PAL.blue,   label: "Spark",    range: "Idea"        },
      { ...PAL.green,  label: "Building", range: "In progress" },
      { ...PAL.yellow, label: "Mixing",   range: "Mix phase"   },
      { ...PAL.orange, label: "Polish",   range: "Mastering"   },
      { ...PAL.red,    label: "Released", range: "Done"        },
    ],
    getTier: (p) => {
      switch (p.status) {
        case "idea": return 0
        case "in-progress": return 1
        case "mixing": return 2
        case "mastering": return 3
        case "completed":
        case "released":
        default: return 4
      }
    },
    getMetric: () => null,
  },
  time: {
    id: "time",
    label: "Time spent",
    hint: "By hours invested",
    icon: Clock,
    tiers: [
      { ...PAL.blue,   label: "Sketch",    range: "< 30 min"  },
      { ...PAL.green,  label: "Session",   range: "30 min–2h" },
      { ...PAL.yellow, label: "Steady",    range: "2–8 h"     },
      { ...PAL.orange, label: "Deep",      range: "8–24 h"    },
      { ...PAL.red,    label: "Marathon",  range: "24 h+"     },
      { ...PAL.purple, label: "Untracked", range: "No data"   },
    ],
    getTier: (p) => {
      const m = p.timeSpent
      if (m == null || m < 0) return 5
      if (m < 30) return 0
      if (m < 120) return 1
      if (m < 480) return 2
      if (m < 1440) return 3
      return 4
    },
    getMetric: (p) => {
      const m = p.timeSpent
      if (m == null || m <= 0) return null
      if (m < 60) return `${m}m`
      const h = m / 60
      if (h < 10) return `${h.toFixed(1)}h`
      return `${Math.floor(h)}h`
    },
  },
  rating: {
    id: "rating",
    label: "Rating",
    hint: "By stars",
    icon: Star,
    tiers: [
      { ...PAL.blue,   label: "Rough",       range: "1 ★"       },
      { ...PAL.green,  label: "Decent",      range: "2 ★"       },
      { ...PAL.yellow, label: "Solid",       range: "3 ★"       },
      { ...PAL.orange, label: "Great",       range: "4 ★"       },
      { ...PAL.red,    label: "Masterpiece", range: "5 ★"       },
      { ...PAL.purple, label: "Unrated",     range: "No rating" },
    ],
    getTier: (p) => {
      const r = p.rating
      if (r == null || r <= 0) return 5
      return Math.min(4, Math.max(0, Math.round(r) - 1))
    },
    getMetric: (p) => {
      const r = p.rating
      if (r == null || r <= 0) return null
      return "★".repeat(Math.round(r))
    },
  },
}

const MODE_STORAGE_KEY = "caseOpening.mode"

const ITEM_W = 148
const ITEM_GAP = 6
const ITEM_STRIDE = ITEM_W + ITEM_GAP
const VISIBLE_ITEMS = 7  // must be odd so center slot exists
const REEL_W = VISIBLE_ITEMS * ITEM_STRIDE - ITEM_GAP
const REEL_H = 200

const WINNER_IDX_IN_REEL = 52

function buildReel(projects: Project[], winner: Project): Project[] {
  const pool = projects.length >= 2 ? projects : [...projects, ...projects]
  const reel: Project[] = []
  for (let i = 0; i < 60; i++) {
    if (i === WINNER_IDX_IN_REEL) {
      reel.push(winner)
    } else {
      let p: Project
      do { p = pool[Math.floor(Math.random() * pool.length)] } while (reel[reel.length - 1]?.id === p.id)
      reel.push(p)
    }
  }
  return reel
}

// 12 particle angles (evenly spaced radians)
const PARTICLE_ANGLES = Array.from({ length: 12 }, (_, i) => (i / 12) * Math.PI * 2)

// Reads --accent-hsl from the CSS root and returns {hex, rgb} for use in
// dynamic Framer Motion keyframes (which can't accept CSS variables directly).
function useAccentColor(): { hex: string; rgb: string } {
  const [accent, setAccent] = useState({ hex: "#6366f1", rgb: "99,102,241" })
  useEffect(() => {
    const hsl = getComputedStyle(document.documentElement).getPropertyValue("--accent-color").trim()
    if (!hsl) return
    const el = document.createElement("div")
    el.style.color = `hsl(${hsl})`
    document.body.appendChild(el)
    const computed = getComputedStyle(el).color // "rgb(r, g, b)"
    document.body.removeChild(el)
    const match = computed.match(/\d+/g)
    if (match && match.length >= 3) {
      const [r, g, b] = match
      const hex = "#" + [r, g, b].map((x) => parseInt(x).toString(16).padStart(2, "0")).join("")
      setAccent({ hex, rgb: `${r},${g},${b}` })
    }
  }, [])
  return accent
}

interface Props {
  projects: Project[]
  onOpen: (project: Project) => void
  onClose: () => void
}

export function CaseOpening({ projects, onOpen, onClose }: Props) {
  const [phase, setPhase] = useState<"idle" | "spinning" | "done">("idle")
  const [winner, setWinner] = useState<Project | null>(null)
  const [reel, setReel] = useState<Project[]>([])
  const [flash, setFlash] = useState(false)
  const [modeId, setModeId] = useState<ModeId>(() => {
    try {
      const saved = localStorage.getItem(MODE_STORAGE_KEY)
      if (saved && saved in RARITY_MODES) return saved as ModeId
    } catch {}
    return "bpm"
  })
  const activeMode = RARITY_MODES[modeId]

  useEffect(() => {
    try { localStorage.setItem(MODE_STORAGE_KEY, modeId) } catch {}
  }, [modeId])
  const reelRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)
  const posRef = useRef(0)
  const targetPosRef = useRef(0)
  const velRef = useRef(0)
  const containerControls = useAnimationControls()
  const reelBoxControls = useAnimationControls()
  const { hex: accentHex, rgb: accentRgb } = useAccentColor()

  // Flash + shake when winner lands
  useEffect(() => {
    if (phase === "done") {
      setFlash(true)
      setTimeout(() => setFlash(false), 500)
      // Shake the whole panel
      containerControls.start({
        x: [0, -5, 5, -4, 4, -2, 2, 0],
        transition: { duration: 0.45, ease: "easeOut" },
      })
      // Pulse the reel box border
      reelBoxControls.start({
        boxShadow: [
          "inset 0 2px 24px rgba(0,0,0,0.6), 0 0 0px 0px transparent",
          `inset 0 2px 24px rgba(0,0,0,0.6), 0 0 60px 12px rgba(${accentRgb},0.5)`,
          `inset 0 2px 24px rgba(0,0,0,0.6), 0 0 20px 4px rgba(${accentRgb},0.2)`,
        ],
        transition: { duration: 0.6, ease: "easeOut" },
      })
    }
  }, [phase, accentRgb])

  // Core spin — no phase guard so both startSpin and reroll can call it
  const executeSpin = useCallback(() => {
    if (projects.length === 0) return
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    const picked = projects[Math.floor(Math.random() * projects.length)]
    const newReel = buildReel(projects, picked)
    setWinner(picked)
    setReel(newReel)
    setPhase("spinning")
    setFlash(false)

    if (reelRef.current) reelRef.current.style.transform = "translateX(0px)"

    const finalPos = -(WINNER_IDX_IN_REEL * ITEM_STRIDE)
    targetPosRef.current = finalPos
    posRef.current = 0
    velRef.current = -96
    const totalDistance = Math.abs(finalPos)

    const animate = () => {
      const remaining = posRef.current - targetPosRef.current
      const progress = 1 - remaining / totalDistance
      const speedFactor = Math.max(0.012, 1 - Math.sqrt(Math.max(0, progress - 0.25) / 0.75))
      velRef.current = -96 * speedFactor
      posRef.current += velRef.current

      if (posRef.current <= targetPosRef.current) {
        posRef.current = targetPosRef.current
        if (reelRef.current) reelRef.current.style.transform = `translateX(${posRef.current}px)`
        setPhase("done")
        return
      }

      if (reelRef.current) reelRef.current.style.transform = `translateX(${posRef.current}px)`
      rafRef.current = requestAnimationFrame(animate)
    }

    setTimeout(() => { rafRef.current = requestAnimationFrame(animate) }, 30)
  }, [projects])

  const startSpin = useCallback(() => {
    if (phase === "spinning") return
    executeSpin()
  }, [phase, executeSpin])

  const reroll = useCallback(() => { executeSpin() }, [executeSpin])

  useEffect(() => {
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  const isDone = phase === "done"
  const isSpinning = phase === "spinning"
  const winnerTier = winner ? activeMode.tiers[activeMode.getTier(winner)] : null
  const winnerMetric = winner ? activeMode.getMetric(winner) : null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(12px)" }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        {/* Flash overlay */}
        <AnimatePresence>
          {flash && (
            <motion.div
              key="flash"
              initial={{ opacity: 0.7 }}
              animate={{ opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="fixed inset-0 pointer-events-none z-[201]"
              style={{ background: winnerTier ? winnerTier.color : accentHex }}
            />
          )}
        </AnimatePresence>

        <motion.div
          animate={containerControls}
          initial={false}
          className="relative flex flex-col items-center gap-6 w-full max-w-[1060px] px-6"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Entry animation wrapper */}
          <motion.div
            initial={{ scale: 0.92, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.92, y: 20, opacity: 0 }}
            transition={{ type: "spring", damping: 22, stiffness: 260 }}
            className="flex flex-col items-center gap-6 w-full"
          >
            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              title="Close"
              className="absolute -top-2 -right-2 p-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/40 hover:text-white/70 transition-colors z-10"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Title */}
            <div className="flex flex-col items-center gap-1">
              <h2 className="text-white/90 text-xl font-bold tracking-tight">Open a Project</h2>
              <p className="text-white/35 text-sm">Spin to get inspired — let fate decide what you work on.</p>
            </div>

            {/* Rarity mode picker */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              {(Object.values(RARITY_MODES) as RarityMode[]).map((m) => {
                const Icon = m.icon
                const active = modeId === m.id
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => { if (!isSpinning) setModeId(m.id) }}
                    disabled={isSpinning}
                    title={m.hint}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                      active
                        ? "bg-white/10 text-white"
                        : "text-white/45 hover:text-white/75 hover:bg-white/[0.04]",
                      isSpinning && "opacity-40 cursor-not-allowed"
                    )}
                    style={active ? { boxShadow: `inset 0 0 0 1px rgba(${accentRgb},0.35)` } : {}}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {m.label}
                  </button>
                )
              })}
            </div>

            {/* ─── Reel container ─── */}
            <motion.div
              animate={reelBoxControls}
              className="relative overflow-hidden rounded-2xl"
              style={{
                width: REEL_W,
                height: REEL_H,
                background: "rgba(0,0,0,0.55)",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "inset 0 2px 24px rgba(0,0,0,0.6)",
              }}
            >
              {/* gradient fade edges */}
              <div className="absolute inset-y-0 left-0 w-28 z-10 pointer-events-none" style={{ background: "linear-gradient(90deg, rgba(0,0,0,0.92), transparent)" }} />
              <div className="absolute inset-y-0 right-0 w-28 z-10 pointer-events-none" style={{ background: "linear-gradient(-90deg, rgba(0,0,0,0.92), transparent)" }} />

              {/* Particle burst — renders at the center of the reel on done */}
              {isDone && winnerTier && (
                <div
                  className="absolute z-30 pointer-events-none"
                  style={{ left: "50%", top: "50%", transform: "translate(-50%,-50%)" }}
                >
                  {PARTICLE_ANGLES.map((angle, i) => (
                    <motion.div
                      key={i}
                      initial={{ x: 0, y: 0, opacity: 1, scale: 1.2 }}
                      animate={{
                        x: Math.cos(angle) * 160,
                        y: Math.sin(angle) * 80,
                        opacity: 0,
                        scale: 0.2,
                      }}
                      transition={{ duration: 0.75, ease: "easeOut", delay: i * 0.015 }}
                      style={{
                        position: "absolute",
                        width: i % 3 === 0 ? 8 : 5,
                        height: i % 3 === 0 ? 8 : 5,
                        borderRadius: "50%",
                        background: winnerTier.color,
                        boxShadow: `0 0 6px 2px ${winnerTier.glow}`,
                      }}
                    />
                  ))}
                </div>
              )}

              {/* ── Centre selector frame — always visible ── */}
              <div
                className="absolute inset-y-0 z-20 pointer-events-none"
                style={{ left: "50%", transform: "translateX(-50%)", width: ITEM_W + 8 }}
              >
                {/* Full border box — pulsing while spinning, solid when done */}
                <motion.div
                  className="absolute inset-0 rounded-xl"
                  animate={
                    isDone && winnerTier
                      ? {
                          boxShadow: [
                            `0 0 24px 6px ${winnerTier.glow}, inset 0 0 16px ${winnerTier.glow}`,
                            `0 0 40px 10px ${winnerTier.glow}, inset 0 0 24px ${winnerTier.glow}`,
                            `0 0 24px 6px ${winnerTier.glow}, inset 0 0 16px ${winnerTier.glow}`,
                          ],
                          borderColor: winnerTier.color,
                        }
                      : isSpinning
                      ? {
                          boxShadow: [
                            `0 0 6px 1px rgba(${accentRgb},0.25)`,
                            `0 0 18px 4px rgba(${accentRgb},0.65)`,
                            `0 0 6px 1px rgba(${accentRgb},0.25)`,
                          ],
                          borderColor: `rgba(${accentRgb},0.7)`,
                        }
                      : {
                          boxShadow: "0 0 0px 0px transparent",
                          borderColor: `rgba(${accentRgb},0.3)`,
                        }
                  }
                  transition={
                    isSpinning
                      ? { repeat: Infinity, duration: 0.7, ease: "easeInOut" }
                      : isDone
                      ? { repeat: Infinity, duration: 1.4, ease: "easeInOut" }
                      : { duration: 0.3 }
                  }
                  style={{
                    border: `2px solid rgba(${accentRgb},0.3)`,
                  }}
                />
              </div>

              {/* Reel track */}
              <div className="absolute top-0 left-0 h-full flex items-center" style={{ paddingLeft: REEL_W / 2 - ITEM_W / 2 }}>
                <div
                  ref={reelRef}
                  className="flex items-center"
                  style={{ gap: ITEM_GAP, willChange: "transform", transform: "translateX(0px)" }}
                >
                  {reel.length === 0 ? (
                    Array.from({ length: VISIBLE_ITEMS }).map((_, i) => (
                      <IdleItem key={i} />
                    ))
                  ) : (
                    reel.map((p, i) => {
                      const tier = activeMode.tiers[activeMode.getTier(p)]
                      const metric = activeMode.getMetric(p)
                      const isWinner = isDone && i === WINNER_IDX_IN_REEL
                      return <ReelItem key={i} project={p} tier={tier} metric={metric} isWinner={isWinner} />
                    })
                  )}
                </div>
              </div>
            </motion.div>

            {/* ─── Winner reveal ─── */}
            <AnimatePresence>
              {isDone && winner && winnerTier && (
                <WinnerReveal winner={winner} tier={winnerTier} metric={winnerMetric} onOpen={() => onOpen(winner)} onReroll={reroll} />
              )}
            </AnimatePresence>

            {/* ─── Spin button ─── */}
            {!isDone && (
              <motion.button
                type="button"
                onClick={startSpin}
                disabled={phase === "spinning" || projects.length === 0}
                whileHover={phase !== "spinning" ? { scale: 1.04 } : {}}
                whileTap={phase !== "spinning" ? { scale: 0.96 } : {}}
                className={cn(
                  "flex items-center gap-2.5 px-8 py-3 rounded-xl font-semibold text-base transition-all",
                  phase === "spinning"
                    ? "bg-white/5 text-white/30 cursor-not-allowed border border-white/10"
                    : "text-white border border-transparent cursor-pointer"
                )}
                style={phase !== "spinning" ? {
                  background: `linear-gradient(135deg, ${accentHex}, ${accentHex}aa)`,
                  boxShadow: `0 4px 28px rgba(${accentRgb},0.5)`,
                } : {}}
              >
                <Dices className={cn("w-5 h-5", phase === "spinning" && "animate-spin")} />
                {phase === "idle" ? "Spin the reel" : "Spinning…"}
              </motion.button>
            )}

            <p className="text-white/20 text-xs">{projects.length} project{projects.length !== 1 ? "s" : ""} in the pool</p>
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ─── Reel item ───────────────────────────────────────────────────────────────
function ReelItem({ project, tier, metric, isWinner }: { project: Project; tier: Tier; metric: string | null; isWinner: boolean }) {
  const artSrc = project.artworkPath ? assetUrl(project.artworkPath) : null

  return (
    <motion.div
      animate={isWinner ? { scale: 1.07, y: -2 } : { scale: 1, y: 0 }}
      transition={{ type: "spring", damping: 12, stiffness: 220 }}
      style={{
        width: ITEM_W,
        height: REEL_H - 20,
        flexShrink: 0,
        borderRadius: 12,
        overflow: "hidden",
        position: "relative",
        background: "#0d0d0d",
        border: `1px solid ${tier.color}45`,
        boxShadow: isWinner ? `0 0 28px 6px ${tier.glow}, 0 0 60px 10px ${tier.glow}` : `0 0 0 0 transparent`,
      }}
    >
      {/* tier color bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, ${tier.color}, ${tier.color}88)`,
        borderRadius: "12px 12px 0 0",
      }} />

      {artSrc ? (
        <img src={artSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: isWinner ? 0.85 : 0.6 }} />
      ) : (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 38, opacity: 0.6 }}>
          🎵
        </div>
      )}

      {/* gradient overlay */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.2) 55%, transparent 100%)" }} />

      {/* metric badge top-left */}
      {metric && (
        <div style={{
          position: "absolute", top: 8, left: 7,
          background: `${tier.color}20`,
          border: `1px solid ${tier.color}55`,
          borderRadius: 5,
          padding: "1px 5px",
          fontSize: 8,
          color: tier.color,
          fontWeight: 700,
          fontFamily: "monospace",
          letterSpacing: "0.04em",
        }}>
          {metric}
        </div>
      )}

      {/* Tier label top-right */}
      <div style={{
        position: "absolute", top: 8, right: 7,
        background: `${tier.color}18`,
        border: `1px solid ${tier.color}45`,
        borderRadius: 5,
        padding: "1px 5px",
        fontSize: 8,
        color: tier.color,
        fontWeight: 700,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
      }}>
        {tier.label}
      </div>

      {/* title + key */}
      <div style={{ position: "absolute", bottom: 8, left: 8, right: 8 }}>
        <div style={{ color: "#fff", fontSize: 11, fontWeight: 700, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
          {project.title}
        </div>
        {project.musicalKey && (
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 9, fontWeight: 500, marginTop: 2, fontFamily: "monospace" }}>
            {project.musicalKey}
          </div>
        )}
      </div>
    </motion.div>
  )
}

function IdleItem() {
  return (
    <div style={{
      width: ITEM_W,
      height: REEL_H - 20,
      flexShrink: 0,
      borderRadius: 12,
      background: "rgba(255,255,255,0.025)",
      border: "1px solid rgba(255,255,255,0.05)",
    }} />
  )
}

// ─── Winner reveal panel ─────────────────────────────────────────────────────
function WinnerReveal({ winner, tier, metric, onOpen, onReroll }: {
  winner: Project
  tier: Tier
  metric: string | null
  onOpen: () => void
  onReroll: () => void
}) {
  const artSrc = winner.artworkPath ? assetUrl(winner.artworkPath) : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.88 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      transition={{ type: "spring", damping: 16, stiffness: 280, delay: 0.06 }}
      className="flex items-center gap-5 rounded-2xl px-5 py-4"
      style={{
        background: `linear-gradient(135deg, rgba(0,0,0,0.7) 0%, ${tier.color}12 100%)`,
        border: `1px solid ${tier.color}50`,
        boxShadow: `0 4px 48px ${tier.glow}, 0 0 0 1px ${tier.color}20`,
        width: REEL_W,
      }}
    >
      {/* artwork */}
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 14, stiffness: 300, delay: 0.1 }}
        className="flex-shrink-0 rounded-xl overflow-hidden"
        style={{
          width: 80,
          height: 80,
          background: "#161616",
          border: `2px solid ${tier.color}60`,
          boxShadow: `0 0 20px ${tier.glow}`,
        }}
      >
        {artSrc
          ? <img src={artSrc} alt="" className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-3xl">🎵</div>
        }
      </motion.div>

      {/* info */}
      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
          className="flex items-center gap-2"
        >
          <span className="text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded-md" style={{ color: tier.color, background: `${tier.color}18`, border: `1px solid ${tier.color}40` }}>
            {tier.label}
          </span>
          <span className="text-white/30 text-xs">{tier.range}</span>
          {metric && (
            <>
              <span className="text-white/20 text-xs">·</span>
              <span className="text-white/40 text-xs font-mono font-semibold">{metric}</span>
            </>
          )}
        </motion.div>
        <motion.span
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="text-white font-bold text-xl leading-tight truncate"
        >
          {winner.title}
        </motion.span>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.28 }}
          className="flex items-center gap-3 text-white/35 text-xs"
        >
          {winner.musicalKey && <span className="font-mono">{winner.musicalKey}</span>}
          {winner.genre && <span>{winner.genre}</span>}
          {winner.status && <span className="capitalize">{winner.status.replace("-", " ")}</span>}
        </motion.div>
      </div>

      {/* actions */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", damping: 16, stiffness: 300, delay: 0.18 }}
        className="flex items-center gap-2 flex-shrink-0"
      >
        <button
          type="button"
          onClick={onReroll}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white/50 hover:text-white/80 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
        >
          <Dices className="w-3.5 h-3.5" />
          Reroll
        </button>
        <motion.button
          type="button"
          onClick={onOpen}
          animate={{
            boxShadow: [
              `0 4px 20px ${tier.glow}`,
              `0 4px 36px ${tier.glow}, 0 0 0 3px ${tier.color}30`,
              `0 4px 20px ${tier.glow}`,
            ],
          }}
          transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.96 }}
          className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-bold text-white transition-all"
          style={{
            background: `linear-gradient(135deg, ${tier.color}, ${tier.color}bb)`,
          }}
        >
          <Zap className="w-4 h-4" />
          Open Project
        </motion.button>
      </motion.div>
    </motion.div>
  )
}
