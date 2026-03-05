import React, { useState } from "react"
import { motion } from "framer-motion"
import {
  Mail,
  Lock,
  User,
  LogIn,
  UserPlus,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/AuthContext"

type AuthMode = "sign-in" | "sign-up"

/**
 * Compact auth card that handles sign-in and sign-up.
 * Shown inside the Sharing tab of ProjectDetail or in Settings.
 */
export const AuthCard: React.FC<{ className?: string }> = ({ className }) => {
  const { signIn, signUp, error, clearError } = useAuth()
  const [mode, setMode] = useState<AuthMode>("sign-in")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) return
    setIsSubmitting(true)
    setSuccessMessage(null)
    clearError()

    try {
      if (mode === "sign-up") {
        await signUp(email.trim(), password.trim(), displayName.trim() || undefined)
        setSuccessMessage("Account created! Check your email to verify if confirmation is enabled.")
      } else {
        await signIn(email.trim(), password.trim())
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const switchMode = () => {
    setMode(m => m === "sign-in" ? "sign-up" : "sign-in")
    clearError()
    setSuccessMessage(null)
  }

  return (
    <div className={cn("max-w-sm mx-auto", className)}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-border/40 bg-card/60 backdrop-blur-sm p-6"
      >
        {/* Header */}
        <div className="text-center mb-5">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            {mode === "sign-in" ? (
              <LogIn className="w-5 h-5 text-primary" />
            ) : (
              <UserPlus className="w-5 h-5 text-primary" />
            )}
          </div>
          <h3 className="text-lg font-semibold">
            {mode === "sign-in" ? "Sign In" : "Create Account"}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {mode === "sign-in"
              ? "Sign in to share projects with other producers"
              : "Create an account to start collaborating"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          {/* Display Name (sign-up only) */}
          {mode === "sign-up" && (
            <div>
              <Label htmlFor="auth-name" className="text-xs font-medium mb-1.5 block">
                Display Name
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  id="auth-name"
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Your producer name"
                  className="pl-9 h-9 text-sm"
                />
              </div>
            </div>
          )}

          {/* Email */}
          <div>
            <Label htmlFor="auth-email" className="text-xs font-medium mb-1.5 block">
              Email
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                id="auth-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="pl-9 h-9 text-sm"
                required
                autoComplete="email"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <Label htmlFor="auth-password" className="text-xs font-medium mb-1.5 block">
              Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                id="auth-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pl-9 pr-9 h-9 text-sm"
                required
                minLength={6}
                autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-2.5 rounded-lg bg-destructive/10 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Success */}
          {successMessage && (
            <div className="p-2.5 rounded-lg bg-green-500/10 text-green-500 text-xs flex items-center gap-2">
              <span>{successMessage}</span>
            </div>
          )}

          {/* Submit */}
          <Button type="submit" disabled={isSubmitting} className="w-full h-9 gap-2">
            {isSubmitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : mode === "sign-in" ? (
              <LogIn className="w-3.5 h-3.5" />
            ) : (
              <UserPlus className="w-3.5 h-3.5" />
            )}
            {mode === "sign-in" ? "Sign In" : "Create Account"}
          </Button>
        </form>

        {/* Toggle mode */}
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={switchMode}
            className="text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            {mode === "sign-in"
              ? "Don't have an account? Sign up"
              : "Already have an account? Sign in"}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export default AuthCard
