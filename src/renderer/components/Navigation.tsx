import React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Music, FolderOpen, Layers, Settings, Sparkles, FolderSync, BarChart3, HelpCircle, Share2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui"
import { Separator } from "@/components/ui"
import { useI18n, type TranslationKey } from "@/i18n"

type NavPage = "dashboard" | "groups" | "scheduler" | "settings" | "statistics" | "help" | "shared"
type Page = NavPage | "project-detail" | "group-detail"

interface NavigationProps {
  currentPage: Page
  onPageChange: (page: NavPage) => void
  onScanFolder?: () => void
  onScanFolderWithSelection?: () => void
  scanProgress?: {
    current: number;
    total: number;
    daw: string;
    file: string;
    isScanning: boolean;
    phase?: string;
  } | null
}

const navItems: { id: NavPage; labelKey: TranslationKey; icon: React.ComponentType<{ className?: string }> }[] = [
  {
    id: "dashboard",
    labelKey: "nav.projects",
    icon: Music,
  },
  {
    id: "groups",
    labelKey: "nav.groups",
    icon: FolderOpen,
  },
  {
    id: "scheduler",
    labelKey: "nav.projectBoard",
    icon: Layers,
  },
  {
    id: "statistics",
    labelKey: "nav.statistics",
    icon: BarChart3,
  },
  {
    id: "shared",
    labelKey: "nav.shared",
    icon: Share2,
  },
]

export const Navigation: React.FC<NavigationProps> = ({
  currentPage,
  onPageChange,
  onScanFolder,
  onScanFolderWithSelection,
  scanProgress,
}) => {
  const { t } = useI18n()

  function getPhaseLabel(phase?: string): string {
    switch (phase) {
      case "scanning": return t('scan.scanning')
      case "filtering": return t('scan.filtering')
      case "extracting_metadata": return t('scan.extractingMetadata')
      case "checking_existing": return t('scan.checkingExisting')
      case "saving_projects": return t('scan.saving')
      case "complete": return t('scan.complete')
      default: return t('scan.default')
    }
  }

  return (
    <nav className="w-[72px] h-full flex flex-col items-center py-4 bg-card border-r border-border/30 z-50 relative">
        {/* Main Navigation */}
        <div className="flex flex-col items-center gap-1 flex-1">
          {navItems.map((item) => {
            const isActive = currentPage === item.id || (item.id === "groups" && currentPage === "group-detail")
            const Icon = item.icon
            const label = t(item.labelKey)
            return (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onPageChange(item.id)}
                    aria-label={label}
                    className={cn(
                      "relative w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200",
                      isActive
                        ? "text-primary bg-primary/10"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeNavIndicator"
                        className="absolute inset-0 rounded-xl bg-primary/10 border border-primary/20"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                      />
                    )}
                    <Icon className={cn("w-5 h-5 relative z-10", isActive && "text-primary")} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                  {label}
                </TooltipContent>
              </Tooltip>
            )
          })}
          
          <Separator className="my-2 w-8" />
          
          {/* Scan FL Projects Button + Progress Panel */}
          <div className="relative">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onScanFolder}
                  aria-label="Scan project folders"
                  onContextMenu={(e) => {
                    e.preventDefault()
                    onScanFolderWithSelection?.()
                  }}
                  className={cn(
                    "w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 group",
                    scanProgress?.isScanning 
                      ? "text-primary bg-primary/10 animate-pulse" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <FolderSync className={cn("w-5 h-5 transition-colors", scanProgress?.isScanning ? "text-primary" : "group-hover:text-primary")} />
                </button>
              </TooltipTrigger>
              {!scanProgress?.isScanning && (
                <TooltipContent side="right" className="font-medium">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                      {t('nav.scanProjectFolders')}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t('nav.scanLeftClick')}<br />
                      {t('nav.scanRightClick')}
                    </div>
                  </div>
                </TooltipContent>
              )}
            </Tooltip>

            {/* Scan Progress Panel - anchored to the right of the scan button */}
            <AnimatePresence>
              {scanProgress?.isScanning && (
                <div className="absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 z-[9999]">
                <motion.div
                  initial={{ opacity: 0, x: -4, scale: 0.96 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -4, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="w-56 bg-popover/95 backdrop-blur-xl border border-border/50 rounded-lg shadow-xl shadow-black/15 overflow-hidden"
                >
                  {/* Top progress bar */}
                  <div className="h-[3px] w-full bg-muted/20">
                    <motion.div
                      className="h-full bg-primary rounded-r-full"
                      initial={{ width: 0 }}
                      animate={{
                        width: scanProgress.total > 0
                          ? `${Math.min((scanProgress.current / scanProgress.total) * 100, 100)}%`
                          : "0%"
                      }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                    />
                  </div>

                  <div className="px-3 py-2.5 space-y-1.5">
                    {/* Phase + percentage */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        <span className="text-xs font-medium text-popover-foreground">
                          {getPhaseLabel(scanProgress.phase)}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
                        {scanProgress.total > 0
                          ? `${Math.round((scanProgress.current / scanProgress.total) * 100)}%`
                          : "..."}
                      </span>
                    </div>

                    {/* Current file */}
                    <p className="text-[11px] text-muted-foreground truncate">
                      {scanProgress.file}
                    </p>

                    {/* Count + DAW */}
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground/60">
                      <span className="font-mono tabular-nums">
                        {scanProgress.current} / {scanProgress.total}
                      </span>
                      <span>{scanProgress.daw}</span>
                    </div>
                  </div>
                </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onPageChange("help")}
                aria-label="Help & Guide"
                className={cn(
                  "relative w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200",
                  currentPage === "help"
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                {currentPage === "help" && (
                  <motion.div
                    layoutId="activeNavIndicator"
                    className="absolute inset-0 rounded-xl bg-primary/10 border border-primary/20"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                  />
                )}
                <HelpCircle className={cn("w-5 h-5 relative z-10", currentPage === "help" && "text-primary")} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">
              {t('nav.helpGuide')}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onPageChange("settings")}
                aria-label="Settings"
                className={cn(
                  "relative w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200",
                  currentPage === "settings"
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                {currentPage === "settings" && (
                  <motion.div
                    layoutId="activeNavIndicator"
                    className="absolute inset-0 rounded-xl bg-primary/10 border border-primary/20"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                  />
                )}
                <Settings className={cn("w-5 h-5 relative z-10", currentPage === "settings" && "text-primary")} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">
              {t('nav.settings')}
            </TooltipContent>
          </Tooltip>
        </div>
      </nav>
  )
}

export default Navigation
