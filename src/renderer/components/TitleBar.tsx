import React from "react"
import { Minus, Square, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Logo } from "./Logo"

// Check if running in Electron - must be a function to check at runtime
const isElectron = () => typeof window !== 'undefined' && typeof window.electron !== 'undefined'

interface TitleBarProps {
  className?: string
}

export const TitleBar: React.FC<TitleBarProps> = ({ className }) => {
  const handleMinimize = () => {
    window.electron?.minimizeWindow()
  }

  const handleMaximize = () => {
    window.electron?.maximizeWindow()
  }

  const handleClose = () => {
    window.electron?.closeWindow()
  }

  return (
    <div
      className={cn(
        "h-12 flex items-center justify-between px-4 bg-background/80 backdrop-blur-xl border-b border-border/30 drag-region",
        className
      )}
    >
      {/* App Title */}
      <div className="flex items-center gap-3 no-drag">
        <div className="relative">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary via-primary/80 to-primary/60 flex items-center justify-center shadow-lg shadow-primary/20">
            <Logo size="sm" className="text-primary-foreground" />
          </div>
          <div className="absolute -inset-0.5 rounded-lg bg-gradient-to-br from-primary/30 to-transparent blur-sm -z-10" />
        </div>
        <span className="text-sm font-semibold tracking-tight text-foreground/90">
          DBundone
        </span>
      </div>

      {/* Window Controls */}
      <div className="flex items-center gap-1 no-drag">
        <button
          onClick={handleMinimize}
          className="group p-2 rounded-lg transition-all duration-200 hover:bg-muted/60"
          aria-label="Minimize"
        >
          <Minus className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </button>
        <button
          onClick={handleMaximize}
          className="group p-2 rounded-lg transition-all duration-200 hover:bg-muted/60"
          aria-label="Maximize"
        >
          <Square className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
        </button>
        <button
          onClick={handleClose}
          className="group p-2 rounded-lg transition-all duration-200 hover:bg-red-500/20"
          aria-label="Close"
        >
          <X className="w-4 h-4 text-muted-foreground group-hover:text-red-400 transition-colors" />
        </button>
      </div>
    </div>
  )
}

export default TitleBar
