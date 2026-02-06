import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-xl border p-4 pr-8 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full backdrop-blur-xl",
  {
    variants: {
      variant: {
        default: "border-border/50 bg-background/95 text-foreground",
        destructive:
          "destructive group border-destructive/50 bg-destructive/95 text-destructive-foreground",
        success:
          "border-green-500/50 bg-green-500/10 text-green-500",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

interface ToastProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof toastVariants> {
  onClose?: () => void
}

const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  ({ className, variant, onClose, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(toastVariants({ variant }), className)}
        {...props}
      >
        {children}
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Dismiss notification"
            className="absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    )
  }
)
Toast.displayName = "Toast"

const ToastTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm font-semibold", className)}
    {...props}
  />
))
ToastTitle.displayName = "ToastTitle"

const ToastDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm opacity-90", className)}
    {...props}
  />
))
ToastDescription.displayName = "ToastDescription"

// Simple toast context for the app
interface ToastItem {
  id: string
  title: string
  description?: string
  variant?: "default" | "destructive" | "success"
  createdAt: number
  fadingOut?: boolean
}

interface ToastContextType {
  toasts: ToastItem[]
  addToast: (toast: { title: string; description?: string; variant?: "default" | "destructive" | "success" }) => void
  removeToast: (id: string) => void
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined)

const MAX_VISIBLE_TOASTS = 3
const TOAST_DURATION = 5000
const FADE_OUT_DURATION = 300

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = React.useState<ToastItem[]>([])
  const fadeOutTimersRef = React.useRef<Map<string, NodeJS.Timeout>>(new Map())

  const removeToast = React.useCallback((id: string) => {
    // Clear any existing timer for this toast
    const timer = fadeOutTimersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      fadeOutTimersRef.current.delete(id)
    }
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const startFadeOut = React.useCallback((id: string) => {
    // Mark the toast as fading out
    setToasts((prev) => prev.map((t) => 
      t.id === id ? { ...t, fadingOut: true } : t
    ))
    
    // Remove after fade animation completes
    const timer = setTimeout(() => {
      removeToast(id)
    }, FADE_OUT_DURATION)
    
    fadeOutTimersRef.current.set(id, timer)
  }, [removeToast])

  const addToast = React.useCallback((toast: { title: string; description?: string; variant?: "default" | "destructive" | "success" }) => {
    const id = Math.random().toString(36).substr(2, 9)
    const newToast: ToastItem = { ...toast, id, createdAt: Date.now() }
    
    setToasts((prev) => {
      const updated = [...prev, newToast]
      
      // If we exceed max, schedule the oldest non-fading toast to fade out
      if (updated.filter(t => !t.fadingOut).length > MAX_VISIBLE_TOASTS) {
        const oldestNonFading = updated.find(t => !t.fadingOut)
        if (oldestNonFading) {
          // Schedule immediate fade out for the oldest
          setTimeout(() => startFadeOut(oldestNonFading.id), 0)
        }
      }
      
      return updated
    })
    
    // Auto remove after duration
    setTimeout(() => {
      startFadeOut(id)
    }, TOAST_DURATION)
  }, [startFadeOut])

  // Cleanup timers on unmount
  React.useEffect(() => {
    return () => {
      fadeOutTimersRef.current.forEach(timer => clearTimeout(timer))
    }
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastViewport toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  )
}

const ToastViewport: React.FC<{
  toasts: ToastContextType["toasts"]
  removeToast: (id: string) => void
}> = ({ toasts, removeToast }) => {
  // Show all toasts that aren't fading, plus fading ones (for animation)
  const visibleToasts = toasts.slice(-MAX_VISIBLE_TOASTS - 2) // Keep a few extra for smooth transitions

  return (
    <div className="fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:bottom-0 sm:right-0 sm:flex-col sm:max-w-[420px]">
      {visibleToasts.map((toast, index) => {
        // Older toasts get progressively more transparent (oldest first in array)
        const position = visibleToasts.length - 1 - index
        const opacity = toast.fadingOut ? 0 : Math.max(0.4, 1 - (position * 0.15))
        const scale = toast.fadingOut ? 0.95 : Math.max(0.95, 1 - (position * 0.02))

        return (
          <div
            key={toast.id}
            className="transition-all duration-300 ease-in-out origin-bottom-right"
            style={{ 
              opacity,
              transform: `scale(${scale})`,
            }}
          >
            <Toast
              variant={toast.variant}
              onClose={() => removeToast(toast.id)}
            >
              <div className="grid gap-1">
                <ToastTitle>{toast.title}</ToastTitle>
                {toast.description && (
                  <ToastDescription>{toast.description}</ToastDescription>
                )}
              </div>
            </Toast>
          </div>
        )
      })}
    </div>
  )
}

export const useToast = () => {
  const context = React.useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider")
  }
  return context
}

export { Toast, ToastTitle, ToastDescription, toastVariants }
