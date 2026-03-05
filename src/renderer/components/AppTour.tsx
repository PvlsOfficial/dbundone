import React, { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  X,
  ChevronLeft,
  ChevronRight,
  Music,
  FolderOpen,
  FolderSync,
  Layers,
  BarChart3,
  Settings,
  HelpCircle,
  Plug,
  FileAudio,
  ListTodo,
  Search,
  Share2,
  Sparkles,
  MousePointerClick,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/i18n"

type Page = "dashboard" | "groups" | "group-detail" | "scheduler" | "settings" | "statistics" | "project-detail" | "help" | "shared"

/**
 * action: "click-nav"     — user must click the highlighted nav element to proceed (page change detected)
 * action: "click-project" — user must click any project card (page change to project-detail detected)
 * action: "click-element" — user must click the highlighted element (click listener on target)
 * action: "auto"          — step advances via Next button (default)
 */
interface TourStep {
  target: string
  title: string
  description: string
  icon: React.ReactNode
  position?: "top" | "bottom" | "left" | "right" | "center"
  action?: "click-nav" | "click-project" | "click-element" | "auto"
  expectedPage?: Page
  page?: Page
}

interface AppTourProps {
  isOpen: boolean
  onClose: () => void
  onComplete: () => void
  currentPage: Page
  onNavigate: (page: Page) => void
}

export const AppTour: React.FC<AppTourProps> = ({ isOpen, onClose, onComplete, currentPage, onNavigate }) => {
  const { t } = useI18n()
  const [currentStep, setCurrentStep] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [waitingForClick, setWaitingForClick] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const prevPageRef = useRef<Page>(currentPage)
  const advanceRef = useRef<() => void>(() => {})

  // Nav selectors that cover multiple languages
  const navProjects = '[aria-label="Projects"], [aria-label="Projekte"], [aria-label="Proyectos"], [aria-label="Projets"], [aria-label="\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8"], [aria-label="Projetos"], [aria-label="Proiecte"]'
  const navCollections = '[aria-label="Collections"], [aria-label="Sammlungen"], [aria-label="Colecciones"], [aria-label="Colec\u021Bii"], [aria-label="\u30B3\u30EC\u30AF\u30B7\u30E7\u30F3"], [aria-label="Cole\u00E7\u00F5es"]'
  const navKanban = '[aria-label="Project Board"], [aria-label="Projektboard"], [aria-label="Tablero"], [aria-label="Tableau de bord"], [aria-label="\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u30DC\u30FC\u30C9"], [aria-label="Quadro de Projetos"], [aria-label="Panou proiecte"]'
  const navStats = '[aria-label="Statistics"], [aria-label="Statistiken"], [aria-label="Estad\u00EDsticas"], [aria-label="Statistiques"], [aria-label="\u7D71\u8A08"], [aria-label="Estat\u00EDsticas"], [aria-label="Statistici"]'

  const steps: TourStep[] = [
    // 0: Welcome (centered)
    {
      target: "center",
      title: t("tour.welcome.title"),
      description: t("tour.welcome.desc"),
      icon: <Sparkles className="w-6 h-6" />,
      position: "center",
      action: "auto",
      page: "dashboard",
    },
    // 1: Dashboard overview — highlight nav (auto, just explain)
    {
      target: navProjects,
      title: t("tour.dashboard.title"),
      description: t("tour.dashboard.desc"),
      icon: <Music className="w-5 h-5" />,
      position: "right",
      action: "auto",
      page: "dashboard",
    },
    // 2: Scan button — click it
    {
      target: '[aria-label="Scan project folders"]',
      title: t("tour.scan.title"),
      description: t("tour.scan.desc"),
      icon: <FolderSync className="w-5 h-5" />,
      position: "right",
      action: "click-element",
      page: "dashboard",
    },
    // 3: Click a project card
    {
      target: "[data-tour-project-card]",
      title: t("tour.clickProject.title"),
      description: t("tour.clickProject.desc"),
      icon: <MousePointerClick className="w-5 h-5" />,
      position: "right",
      action: "click-project",
      expectedPage: "project-detail",
      page: "dashboard",
    },
    // 4: Project Detail page — overview (centered)
    {
      target: "center",
      title: t("tour.projectDetail.title"),
      description: t("tour.projectDetail.desc"),
      icon: <Music className="w-6 h-6" />,
      position: "center",
      action: "auto",
      page: "project-detail",
    },
    // 5: Audio tab — auto (already showing by default)
    {
      target: "[data-tour-tab='pd-audio']",
      title: t("tour.audioTab.title"),
      description: t("tour.audioTab.desc"),
      icon: <FileAudio className="w-5 h-5" />,
      position: "bottom",
      action: "auto",
      page: "project-detail",
    },
    // 6: Click Tasks tab
    {
      target: "[data-tour-tab='pd-tasks']",
      title: t("tour.tasksTab.title"),
      description: t("tour.tasksTab.desc"),
      icon: <ListTodo className="w-5 h-5" />,
      position: "bottom",
      action: "click-element",
      page: "project-detail",
    },
    // 7: Click Sharing tab
    {
      target: "[data-tour-tab='pd-collaboration']",
      title: t("tour.sharingTab.title"),
      description: t("tour.sharingTab.desc"),
      icon: <Share2 className="w-5 h-5" />,
      position: "bottom",
      action: "click-element",
      page: "project-detail",
    },
    // 8: Click Plugin tab
    {
      target: "[data-tour-tab='pd-plugin']",
      title: t("tour.pluginTab.title"),
      description: t("tour.pluginTab.desc"),
      icon: <Plug className="w-5 h-5" />,
      position: "bottom",
      action: "click-element",
      page: "project-detail",
    },
    // 9: Collections — click to navigate
    {
      target: navCollections,
      title: t("tour.groups.title"),
      description: t("tour.groups.desc"),
      icon: <FolderOpen className="w-5 h-5" />,
      position: "right",
      action: "click-nav",
      expectedPage: "groups",
      page: "project-detail",
    },
    // 10: New Collection button highlight (auto)
    {
      target: "[data-tour-new-collection]",
      title: t("tour.newCollection.title"),
      description: t("tour.newCollection.desc"),
      icon: <FolderOpen className="w-5 h-5" />,
      position: "bottom",
      action: "auto",
      page: "groups",
    },
    // 11: Kanban — click to navigate
    {
      target: navKanban,
      title: t("tour.kanban.title"),
      description: t("tour.kanban.desc"),
      icon: <Layers className="w-5 h-5" />,
      position: "right",
      action: "click-nav",
      expectedPage: "scheduler",
      page: "groups",
    },
    // 12: Statistics — click to navigate
    {
      target: navStats,
      title: t("tour.stats.title"),
      description: t("tour.stats.desc"),
      icon: <BarChart3 className="w-5 h-5" />,
      position: "right",
      action: "click-nav",
      expectedPage: "statistics",
      page: "scheduler",
    },
    // 13: Stats overview tab (auto — default tab visible)
    {
      target: "[data-tour-tab='stats-overview']",
      title: t("tour.statsOverview.title"),
      description: t("tour.statsOverview.desc"),
      icon: <BarChart3 className="w-5 h-5" />,
      position: "bottom",
      action: "auto",
      page: "statistics",
    },
    // 14: Click Plugins stats tab
    {
      target: "[data-tour-tab='stats-plugins']",
      title: t("tour.statsPlugins.title"),
      description: t("tour.statsPlugins.desc"),
      icon: <Plug className="w-5 h-5" />,
      position: "bottom",
      action: "click-element",
      page: "statistics",
    },
    // 15: Click Production stats tab
    {
      target: "[data-tour-tab='stats-production']",
      title: t("tour.statsProduction.title"),
      description: t("tour.statsProduction.desc"),
      icon: <Music className="w-5 h-5" />,
      position: "bottom",
      action: "click-element",
      page: "statistics",
    },
    // 16: Click Explorer stats tab
    {
      target: "[data-tour-tab='stats-explorer']",
      title: t("tour.statsExplorer.title"),
      description: t("tour.statsExplorer.desc"),
      icon: <Search className="w-5 h-5" />,
      position: "bottom",
      action: "click-element",
      page: "statistics",
    },
    // 17: Settings — click to navigate
    {
      target: '[aria-label="Settings"]',
      title: t("tour.settings.title"),
      description: t("tour.settings.desc"),
      icon: <Settings className="w-5 h-5" />,
      position: "top",
      action: "click-nav",
      expectedPage: "settings",
      page: "statistics",
    },
    // 18: Settings overview (centered)
    {
      target: "center",
      title: t("tour.settingsOverview.title"),
      description: t("tour.settingsOverview.desc"),
      icon: <Settings className="w-6 h-6" />,
      position: "center",
      action: "auto",
      page: "settings",
    },
    // 19: Help — click to navigate
    {
      target: '[aria-label="Help & Guide"]',
      title: t("tour.help.title"),
      description: t("tour.help.desc"),
      icon: <HelpCircle className="w-5 h-5" />,
      position: "top",
      action: "click-nav",
      expectedPage: "help",
      page: "settings",
    },
    // 20: Done (centered)
    {
      target: "center",
      title: t("tour.done.title"),
      description: t("tour.done.desc"),
      icon: <Sparkles className="w-6 h-6" />,
      position: "center",
      action: "auto",
      page: "help",
    },
  ]

  const step = steps[currentStep]
  const isFirst = currentStep === 0
  const isLast = currentStep === steps.length - 1
  const progress = ((currentStep + 1) / steps.length) * 100
  const isClickStep = step?.action === "click-nav" || step?.action === "click-project" || step?.action === "click-element"

  // ALL click steps allow pointer events through the backdrop
  const shouldAllowClickThrough = isClickStep

  // ---------- Detect page changes to auto-advance click-nav / click-project steps ----------
  useEffect(() => {
    if (!isOpen || !step) return

    if (step.action === "click-nav" && step.expectedPage && currentPage === step.expectedPage && waitingForClick) {
      setWaitingForClick(false)
      advanceRef.current()
      return
    }

    if (step.action === "click-project" && currentPage === "project-detail" && prevPageRef.current !== "project-detail") {
      setWaitingForClick(false)
      advanceRef.current()
    }

    prevPageRef.current = currentPage
  }, [currentPage, isOpen, waitingForClick])

  // ---------- click-element: add click listener to target ----------
  useEffect(() => {
    if (!isOpen || !step || step.action !== "click-element") return

    let el: Element | null = null
    let removed = false

    const handleClick = () => {
      if (removed) return
      removed = true
      setWaitingForClick(false)
      // Small delay so the tab actually activates before we advance
      setTimeout(() => advanceRef.current(), 120)
    }

    // Retry finding target until found (in case DOM hasn't settled)
    let attempts = 0
    const tryAttach = () => {
      el = document.querySelector(step.target)
      if (el) {
        el.addEventListener("click", handleClick, { once: true })
      } else if (attempts < 10) {
        attempts++
        setTimeout(tryAttach, 200)
      }
    }

    const timer = setTimeout(tryAttach, 150)

    return () => {
      clearTimeout(timer)
      removed = true
      if (el) {
        el.removeEventListener("click", handleClick)
      }
    }
  }, [currentStep, isOpen, step?.action, step?.target])

  // Find and highlight the target element
  useEffect(() => {
    if (!isOpen) return

    if (step.target === "center") {
      setTargetRect(null)
      return
    }

    const findTarget = () => {
      const el = document.querySelector(step.target)
      if (el) {
        const rect = el.getBoundingClientRect()
        setTargetRect(rect)
        el.scrollIntoView({ behavior: "smooth", block: "nearest" })
      } else {
        setTargetRect(null)
      }
    }

    const timer = setTimeout(findTarget, 150)
    const handleResize = () => findTarget()
    window.addEventListener("resize", handleResize)

    return () => {
      clearTimeout(timer)
      window.removeEventListener("resize", handleResize)
    }
  }, [currentStep, isOpen, step.target])

  // When entering a click step, mark waiting
  useEffect(() => {
    if (!isOpen || !step) return
    if (isClickStep) {
      if (step.action === "click-nav" && step.expectedPage === currentPage) {
        setWaitingForClick(false)
      } else {
        setWaitingForClick(true)
      }
    } else {
      setWaitingForClick(false)
    }
  }, [currentStep, isOpen])

  const advanceStep = useCallback(() => {
    if (currentStep >= steps.length - 1) {
      onComplete()
      return
    }
    setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1))
  }, [currentStep, steps.length, onComplete])

  // Keep ref in sync so click handlers always call the latest version
  useEffect(() => {
    advanceRef.current = advanceStep
  }, [advanceStep])

  const handleNext = useCallback(() => {
    if (isLast) {
      onComplete()
      return
    }
    advanceStep()
  }, [isLast, onComplete, advanceStep])

  const handlePrev = useCallback(() => {
    setWaitingForClick(false)
    const prevStep = steps[currentStep - 1]
    if (prevStep) {
      // Navigate to the page context of the previous step
      const targetPage = (prevStep.action === "click-nav" || prevStep.action === "click-project")
        ? prevStep.expectedPage
        : prevStep.page
      if (targetPage && targetPage !== currentPage) {
        onNavigate(targetPage as Page)
      }
    }
    setCurrentStep((prev) => Math.max(prev - 1, 0))
  }, [currentStep, steps, onNavigate, currentPage])

  const handleSkip = useCallback(() => {
    setWaitingForClick(false)
    onClose()
  }, [onClose])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleSkip()
      if ((e.key === "ArrowRight" || e.key === "Enter") && !waitingForClick) handleNext()
      if (e.key === "ArrowLeft" && !isFirst) handlePrev()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, handleSkip, handleNext, handlePrev, waitingForClick, isFirst])

  // Reset step on open and navigate to dashboard
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0)
      setWaitingForClick(false)
      onNavigate("dashboard")
    }
  }, [isOpen])

  if (!isOpen) return null

  // ---------- Smart tooltip positioning ----------
  const getTooltipStyle = (): React.CSSProperties => {
    if (!targetRect || step.position === "center") {
      // Use margin-based centering to avoid transform conflict with framer-motion
      return {
        position: "fixed",
        top: "50%",
        left: "50%",
        marginLeft: -190,
        marginTop: -140,
      }
    }

    const gap = 16
    const tooltipWidth = 380
    const tooltipEstHeight = 260
    const pos = step.position || "right"
    const winH = window.innerHeight
    const winW = window.innerWidth

    if (pos === "top") {
      const leftPos = targetRect.right + gap
      const clampedLeft = Math.min(leftPos, winW - tooltipWidth - 16)
      return {
        position: "fixed",
        bottom: winH - targetRect.top + gap,
        left: Math.max(16, clampedLeft),
      }
    }

    if (pos === "right") {
      let topPos = targetRect.top + targetRect.height / 2
      const maxTop = winH - tooltipEstHeight - 16
      topPos = Math.min(topPos, maxTop)
      topPos = Math.max(16, topPos)
      return {
        position: "fixed",
        top: topPos,
        left: targetRect.right + gap,
        transform: topPos === targetRect.top + targetRect.height / 2 ? "translateY(-50%)" : undefined,
      }
    }

    if (pos === "left") {
      return {
        position: "fixed",
        top: targetRect.top + targetRect.height / 2,
        right: winW - targetRect.left + gap,
        transform: "translateY(-50%)",
      }
    }

    if (pos === "bottom") {
      return {
        position: "fixed",
        top: targetRect.bottom + gap,
        left: Math.max(16, Math.min(targetRect.left, winW - tooltipWidth - 16)),
      }
    }

    return {}
  }

  return (
    <>
      {/* Backdrop overlay with spotlight cutout */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="tour-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[9998]"
            style={{ pointerEvents: shouldAllowClickThrough ? "none" : "auto" }}
            onClick={(e) => {
              if (e.target === e.currentTarget && !isClickStep) handleSkip()
            }}
          >
            <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: "none" }}>
              <defs>
                <mask id="tour-spotlight">
                  <rect width="100%" height="100%" fill="white" />
                  {targetRect && (
                    <motion.rect
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      x={targetRect.left - 6}
                      y={targetRect.top - 6}
                      width={targetRect.width + 12}
                      height={targetRect.height + 12}
                      rx="14"
                      fill="black"
                    />
                  )}
                </mask>
              </defs>
              <rect
                width="100%"
                height="100%"
                fill="rgba(0, 0, 0, 0.7)"
                mask="url(#tour-spotlight)"
              />
            </svg>

            {/* Spotlight ring glow */}
            {targetRect && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute rounded-2xl"
                style={{
                  left: targetRect.left - 8,
                  top: targetRect.top - 8,
                  width: targetRect.width + 16,
                  height: targetRect.height + 16,
                  boxShadow: isClickStep
                    ? "0 0 0 3px hsl(var(--primary) / 0.8), 0 0 30px 8px hsl(var(--primary) / 0.3)"
                    : "0 0 0 3px hsl(var(--primary) / 0.6), 0 0 20px 4px hsl(var(--primary) / 0.2)",
                  borderRadius: 14,
                  pointerEvents: "none",
                }}
              />
            )}

            {/* Pulsing ring for click steps */}
            {targetRect && isClickStep && (
              <motion.div
                animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                className="absolute rounded-2xl pointer-events-none"
                style={{
                  left: targetRect.left - 8,
                  top: targetRect.top - 8,
                  width: targetRect.width + 16,
                  height: targetRect.height + 16,
                  border: "2px solid hsl(var(--primary) / 0.5)",
                  borderRadius: 14,
                }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tooltip card — own AnimatePresence for clean step transitions */}
      <AnimatePresence mode="wait">
        {isOpen && (
          <motion.div
            ref={tooltipRef}
            key={`tour-step-${currentStep}`}
            initial={{ opacity: 0, scale: 0.92, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -6 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            style={getTooltipStyle()}
            className={cn(
              "z-[9999] w-[380px] rounded-2xl border border-border/50",
              "bg-background/95 backdrop-blur-xl shadow-2xl shadow-black/30",
              "overflow-hidden pointer-events-auto"
            )}
          >
            {/* Progress bar */}
            <div className="h-1 w-full bg-muted/30">
              <motion.div
                className="h-full bg-primary rounded-r-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </div>

            <div className="p-5">
              {/* Icon + Step counter */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2.5 rounded-xl",
                    isClickStep ? "bg-primary/20 text-primary" : "bg-primary/10 text-primary"
                  )}>
                    {step.icon}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-foreground leading-tight">
                      {step.title}
                    </h3>
                    <span className="text-[11px] text-muted-foreground">
                      {currentStep + 1} / {steps.length}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleSkip}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  aria-label="Close tour"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Description */}
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                {step.description}
              </p>

              {/* Click instruction badge for interactive steps */}
              {isClickStep && waitingForClick && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20 mb-3"
                >
                  <MousePointerClick className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-xs font-medium text-primary">
                    {step.action === "click-project"
                      ? t("tour.clickProjectHint")
                      : step.action === "click-element"
                      ? t("tour.clickTabHint")
                      : t("tour.clickToNavigate")}
                  </span>
                </motion.div>
              )}

              {/* Navigation buttons */}
              <div className="flex items-center justify-between">
                <button
                  onClick={handleSkip}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t("tour.skip")}
                </button>
                <div className="flex items-center gap-2">
                  {!isFirst && (
                    <button
                      onClick={handlePrev}
                      className={cn(
                        "flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm",
                        "text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                      )}
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      {t("tour.back")}
                    </button>
                  )}
                  {(!waitingForClick || !isClickStep) && (
                    <button
                      onClick={handleNext}
                      className={cn(
                        "flex items-center gap-1 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
                        "bg-primary text-primary-foreground hover:bg-primary/90"
                      )}
                    >
                      {isLast ? t("tour.finish") : t("tour.next")}
                      {!isLast && <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Step dots */}
            <div className="px-5 pb-4 flex justify-center gap-1">
              {steps.map((_, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "h-1 rounded-full transition-all duration-300",
                    idx === currentStep
                      ? "w-4 bg-primary"
                      : idx < currentStep
                      ? "w-1.5 bg-primary/40"
                      : "w-1.5 bg-muted-foreground/20"
                  )}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default AppTour