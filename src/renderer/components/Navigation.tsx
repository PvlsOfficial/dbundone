import React from "react"
import { motion } from "framer-motion"
import { Music, FolderOpen, Layers, Settings, Sparkles, FolderSync, BarChart3 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui"
import { Separator } from "@/components/ui"

type NavPage = "dashboard" | "groups" | "scheduler" | "settings" | "statistics"
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
  } | null
}

const navItems: { id: NavPage; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  {
    id: "dashboard",
    label: "Projects",
    icon: Music,
  },
  {
    id: "groups",
    label: "Groups",
    icon: FolderOpen,
  },
  {
    id: "scheduler",
    label: "Project Board",
    icon: Layers,
  },
  {
    id: "statistics",
    label: "Statistics",
    icon: BarChart3,
  },
]

export const Navigation: React.FC<NavigationProps> = ({
  currentPage,
  onPageChange,
  onScanFolder,
  onScanFolderWithSelection,
  scanProgress,
}) => {
  return (
    <nav className="w-[72px] h-full flex flex-col items-center py-4 bg-card/30 backdrop-blur-xl border-r border-border/30">
        {/* Main Navigation */}
        <div className="flex flex-col items-center gap-1 flex-1">
          {navItems.map((item) => {
            const isActive = currentPage === item.id || (item.id === "groups" && currentPage === "group-detail")
            const Icon = item.icon
            return (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onPageChange(item.id)}
                    aria-label={item.label}
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
                  {item.label}
                </TooltipContent>
              </Tooltip>
            )
          })}
          
          <Separator className="my-2 w-8" />
          
          {/* Scan FL Projects Button */}
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
            <TooltipContent side="right" className="font-medium">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  Scan Project Folders
                </div>
                <div className="text-xs text-muted-foreground">
                  Left click: Scan configured folders<br />
                  Right click: Choose new folder
                </div>
              </div>
            </TooltipContent>
          </Tooltip>

          {/* Progress Indicator */}
          {scanProgress?.isScanning && (
            <div className="w-11 flex flex-col items-center gap-1">
              <div className="w-full bg-muted/30 rounded-full h-1 overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${(scanProgress.current / scanProgress.total) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <div className="text-xs text-center text-muted-foreground leading-tight">
                <div className="font-medium text-primary">{scanProgress.current}/{scanProgress.total}</div>
                <div className="truncate w-10 text-[10px]">{scanProgress.daw}</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col items-center gap-1">
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
              Settings
            </TooltipContent>
          </Tooltip>
        </div>
      </nav>
  )
}

export default Navigation
