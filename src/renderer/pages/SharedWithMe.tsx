import React, { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Inbox,
  Send,
  Clock,
  Check,
  XCircle,
  Loader2,
  Music,
  MessageSquare,
  User,
  AlertCircle,
  ArrowLeft,
  Mail,
  Share2,
  Eye,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { useI18n } from '@/i18n'
import { useAuth } from "@/contexts/AuthContext"
import { AuthCard } from "@/components/AuthCard"
import { SharedProjectDetail } from "@/components/SharedProjectDetail"
import {
  getReceivedShares,
  getSentShares,
  updateShareStatus,
  deleteShare,
  type CloudShare,
} from "@/lib/sharingService"

export const SharedWithMe: React.FC = () => {
  const { isAuthenticated, user, profile } = useAuth()
  const [received, setReceived] = useState<CloudShare[]>([])
  const [sent, setSent] = useState<CloudShare[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("received")
  const [selectedShare, setSelectedShare] = useState<CloudShare | null>(null)
  const { t } = useI18n()

  const loadShares = useCallback(async () => {
    if (!isAuthenticated || !user) return
    setIsLoading(true)
    setError(null)
    try {
      const [r, s] = await Promise.all([
        getReceivedShares(user.id),
        getSentShares(user.id),
      ])
      setReceived(r)
      setSent(s)
    } catch (e: any) {
      setError(e?.message || "Failed to load shares")
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated, user])

  useEffect(() => {
    loadShares()
  }, [loadShares])

  const handleAccept = async (shareId: string) => {
    try {
      await updateShareStatus(shareId, 'accepted')
      await loadShares()
      // Update selected share if viewing it
      if (selectedShare?.id === shareId) {
        setSelectedShare(prev => prev ? { ...prev, status: 'accepted' } : null)
      }
    } catch (e: any) {
      setError(e?.message || "Failed to accept")
    }
  }

  const handleDecline = async (shareId: string) => {
    try {
      await updateShareStatus(shareId, 'declined')
      await loadShares()
      if (selectedShare?.id === shareId) {
        setSelectedShare(prev => prev ? { ...prev, status: 'declined' } : null)
      }
    } catch (e: any) {
      setError(e?.message || "Failed to decline")
    }
  }

  const handleRemoveSent = async (shareId: string) => {
    try {
      await deleteShare(shareId)
      await loadShares()
    } catch (e: any) {
      setError(e?.message || "Failed to remove")
    }
  }

  // Not logged in
  if (!isAuthenticated) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="px-6 py-5 border-b border-border/30">
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-xl bg-primary/10">
              <Share2 className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">{t("shared.title")}</h1>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <AuthCard />
        </div>
      </div>
    )
  }

  const pendingCount = received.filter(s => s.status === 'pending').length

  // If a share is selected, show full detail view
  if (selectedShare) {
    return (
      <SharedProjectDetail
        share={selectedShare}
        onBack={() => setSelectedShare(null)}
        onAccept={selectedShare.status === 'pending' ? () => handleAccept(selectedShare.id) : undefined}
        onDecline={selectedShare.status === 'pending' ? () => handleDecline(selectedShare.id) : undefined}
        onRefresh={async () => {
          // Reload shares from server and update selectedShare with fresh data
          if (!user) return
          try {
            const [r, s] = await Promise.all([
              getReceivedShares(user.id),
              getSentShares(user.id),
            ])
            setReceived(r)
            setSent(s)
            const updated = r.find(sh => sh.id === selectedShare.id)
            if (updated) setSelectedShare(updated)
          } catch (e) {
            console.warn('[SharedWithMe] Refresh failed:', e)
          }
        }}
      />
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="px-6 py-5 border-b border-border/30"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-xl bg-primary/10">
              <Share2 className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">{t("shared.title")}</h1>
            {pendingCount > 0 && (
              <Badge variant="secondary" className="text-sm">
                {t("shared.new", { count: pendingCount })}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Mail className="w-3.5 h-3.5" />
            <span>{profile?.displayName || user?.email}</span>
          </div>
        </div>
      </motion.div>

      {/* Error */}
      {error && (
        <div className="mx-6 mt-4 p-2.5 rounded-lg bg-destructive/10 text-destructive text-xs flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => setError(null)}>
            <XCircle className="w-3 h-3" />
          </Button>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="px-6 pt-4">
          <TabsList className="w-full max-w-xs">
            <TabsTrigger value="received" className="flex-1 gap-1.5">
              <Inbox className="w-3.5 h-3.5" />
              {t("shared.received")}
              {pendingCount > 0 && (
                <Badge variant="secondary" className="text-[9px] px-1 py-0 ml-1 bg-primary/20 text-primary">
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="sent" className="flex-1 gap-1.5">
              <Send className="w-3.5 h-3.5" />
              {t("shared.sent")}
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1">
          <TabsContent value="received" className="p-6 pt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">{t("common.loading")}</span>
              </div>
            ) : received.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title={t("shared.noReceived")}
                description={t("shared.noReceivedHint")}
              />
            ) : (
              <div className="space-y-3">
                {received.map(share => (
                  <ShareCard
                    key={share.id}
                    share={share}
                    direction="received"
                    onAccept={() => handleAccept(share.id)}
                    onDecline={() => handleDecline(share.id)}
                    onView={() => setSelectedShare(share)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="sent" className="p-6 pt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">{t("common.loading")}</span>
              </div>
            ) : sent.length === 0 ? (
              <EmptyState
                icon={Send}
                title={t("shared.noSent")}
                description={t("shared.noSentHint")}
              />
            ) : (
              <div className="space-y-3">
                {sent.map(share => (
                  <ShareCard
                    key={share.id}
                    share={share}
                    direction="sent"
                    onRemove={() => handleRemoveSent(share.id)}
                    onView={() => setSelectedShare(share)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  )
}

// ── Share Card ──────────────────────────────────────────────────────────────

interface ShareCardProps {
  share: CloudShare
  direction: 'received' | 'sent'
  onAccept?: () => void
  onDecline?: () => void
  onRemove?: () => void
  onView?: () => void
}

function ShareCard({ share, direction, onAccept, onDecline, onRemove, onView }: ShareCardProps) {
  const { t } = useI18n()
  const otherUser = direction === 'received' ? share.fromUser : share.toUser
  const name = otherUser?.displayName || otherUser?.email || t("common.unknown")
  const initial = name[0].toUpperCase()

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-xl border border-border/30 bg-card/50 hover:bg-card/80 transition-all cursor-pointer"
      onClick={onView}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-bold text-primary">{initial}</span>
        </div>

        <div className="flex-1 min-w-0">
          {/* User & status */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">{name}</span>
            <span className="text-xs text-muted-foreground">{otherUser?.email}</span>
            <StatusBadge status={share.status} />
          </div>

          {/* Project info */}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Music className="w-3.5 h-3.5 text-primary" />
              {share.projectTitle}
            </div>
            {share.projectBpm && (
              <Badge variant="secondary" className="text-[10px]">{share.projectBpm} BPM</Badge>
            )}
            {share.projectKey && (
              <Badge variant="secondary" className="text-[10px]">{share.projectKey}</Badge>
            )}
            {share.projectDaw && (
              <Badge variant="secondary" className="text-[10px]">{share.projectDaw}</Badge>
            )}
            {share.projectGenre && (
              <Badge variant="secondary" className="text-[10px]">{share.projectGenre}</Badge>
            )}
          </div>

          {/* Message */}
          {share.message && (
            <div className="flex items-start gap-1.5 mt-2 text-xs text-muted-foreground bg-muted/30 rounded-lg p-2">
              <MessageSquare className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>{share.message}</span>
            </div>
          )}

          {/* Timestamp & actions */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Clock className="w-2.5 h-2.5" />
              <span>{new Date(share.createdAt).toLocaleDateString()} at {new Date(share.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onView?.() }} className="h-7 gap-1 text-xs">
                <Eye className="w-3 h-3" />
                {t("shared.view")}
              </Button>
              {direction === 'received' && share.status === 'pending' && (
                <>
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onDecline?.() }} className="h-7 gap-1 text-xs">
                    <XCircle className="w-3 h-3" />
                    {t("shared.decline")}
                  </Button>
                  <Button size="sm" onClick={(e) => { e.stopPropagation(); onAccept?.() }} className="h-7 gap-1 text-xs">
                    <Check className="w-3 h-3" />
                    {t("shared.accept")}
                  </Button>
                </>
              )}
              {direction === 'sent' && (
                <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); onRemove?.() }} className="h-7 gap-1 text-xs text-destructive hover:text-destructive">
                  <XCircle className="w-3 h-3" />
                  {t("common.remove")}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ── Status Badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "text-[10px] border-0",
        status === 'accepted' && "bg-green-500/10 text-green-500",
        status === 'pending' && "bg-yellow-500/10 text-yellow-500",
        status === 'declined' && "bg-red-500/10 text-red-500",
      )}
    >
      {status === 'accepted' && <Check className="w-2.5 h-2.5 mr-0.5" />}
      {status === 'pending' && <Clock className="w-2.5 h-2.5 mr-0.5" />}
      {status === 'declined' && <XCircle className="w-2.5 h-2.5 mr-0.5" />}
      {status}
    </Badge>
  )
}

// ── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, title, description }: { icon: React.ComponentType<{ className?: string }>; title: string; description: string }) {
  return (
    <div className="text-center py-16 text-muted-foreground">
      <Icon className="w-12 h-12 mx-auto mb-3 opacity-20" />
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs mt-1 max-w-xs mx-auto">{description}</p>
    </div>
  )
}

export default SharedWithMe
