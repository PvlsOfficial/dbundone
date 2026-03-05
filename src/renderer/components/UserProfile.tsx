import React, { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  User,
  Save,
  Camera,
  Edit3,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { UserProfile as UserProfileType } from "@shared/types"

const isElectron = () => typeof window !== "undefined" && typeof window.electron !== "undefined"

interface UserProfileWidgetProps {
  className?: string
}

export const UserProfileWidget: React.FC<UserProfileWidgetProps> = ({ className }) => {
  const [profile, setProfile] = useState<UserProfileType | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState("")
  const [editBio, setEditBio] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  React.useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    if (!isElectron()) {
      setIsLoading(false)
      return
    }
    try {
      const data = await window.electron?.getUserProfile()
      if (data) {
        setProfile(data)
        setEditName(data.displayName)
        setEditBio(data.bio || "")
      }
    } catch (e) {
      console.error("Failed to load profile:", e)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!isElectron()) return
    try {
      await window.electron?.updateUserProfile({
        displayName: editName.trim() || "Producer",
        bio: editBio.trim() || null,
        avatarPath: profile?.avatarPath || null,
      })
      await loadProfile()
      setIsEditing(false)
    } catch (e) {
      console.error("Failed to save profile:", e)
    }
  }

  if (isLoading) return null

  const displayName = profile?.displayName || "Producer"
  const initials = displayName.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {isEditing ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-2"
        >
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Your name"
            className="h-7 w-32 text-xs"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave()
              if (e.key === "Escape") setIsEditing(false)
            }}
          />
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleSave}>
            <Save className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setIsEditing(false)}>
            <X className="w-3 h-3" />
          </Button>
        </motion.div>
      ) : (
        <button
          className="flex items-center gap-2 hover:bg-accent/30 rounded-lg px-2 py-1 transition-colors"
          onClick={() => setIsEditing(true)}
          title="Click to edit profile"
        >
          <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-medium text-primary">
            {initials}
          </div>
          <span className="text-xs font-medium truncate max-w-[100px]">{displayName}</span>
        </button>
      )}
    </div>
  )
}

export default UserProfileWidget
