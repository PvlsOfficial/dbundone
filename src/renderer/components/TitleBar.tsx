import React from "react"
import { Minus, Square, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Logo } from "./Logo"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { useI18n } from "@/i18n"

interface TitleBarProps {
  className?: string
}

export const TitleBar: React.FC<TitleBarProps> = ({ className }) => {
  const { t } = useI18n()
  const handleMinimize = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    getCurrentWindow().minimize().catch(console.error)
  }

  const handleMaximize = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    getCurrentWindow().toggleMaximize().catch(console.error)
  }

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    getCurrentWindow().close().catch(console.error)
  }

  return (
    <div
      className={cn(
        "h-12 flex items-center justify-between bg-background border-b border-border/30 relative",
        className
      )}
    >
      {/* Drag region covers the whole bar */}
      <div
        data-tauri-drag-region
        className="absolute inset-0 z-0"
      />

      {/* App Title */}
      <div className="flex items-center gap-3 px-4 relative z-10">
        <div className="relative pointer-events-none">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary via-primary/80 to-primary/60 flex items-center justify-center shadow-lg shadow-primary/20">
            <Logo size="sm" className="text-primary-foreground" />
          </div>
          <div className="absolute -inset-0.5 rounded-lg bg-gradient-to-br from-primary/30 to-transparent blur-sm -z-10" />
        </div>
        <span className="font-brand text-sm tracking-tight text-foreground/90 pointer-events-none select-none">
          DBundone
        </span>
      </div>

      {/* Window Controls - above drag region */}
      <div className="flex items-center gap-1 px-4 relative z-20">
        <button
          onMouseDown={handleMinimize}
          className="group p-2 rounded-lg transition-all duration-200 hover:bg-muted/60"
          aria-label={t('titleBar.minimize')}
        >
          <Minus className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors pointer-events-none" />
        </button>
        <button
          onMouseDown={handleMaximize}
          className="group p-2 rounded-lg transition-all duration-200 hover:bg-muted/60"
          aria-label={t('titleBar.maximize')}
        >
          <Square className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors pointer-events-none" />
        </button>
        <button
          onMouseDown={handleClose}
          className="group p-2 rounded-lg transition-all duration-200 hover:bg-red-500/20"
          aria-label={t('titleBar.close')}
        >
          <X className="w-4 h-4 text-muted-foreground group-hover:text-red-400 transition-colors pointer-events-none" />
        </button>
      </div>
    </div>
  )
}

export default TitleBar
