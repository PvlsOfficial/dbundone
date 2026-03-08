import React, { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Share2,
  Trash2,
  Search,
  Clock,
  AlertCircle,
  X,
  Users,
  Send,
  Check,
  XCircle,
  Loader2,
  Mail,
  MessageSquare,
  Eye,
  Edit2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { Project } from "@shared/types"
import { useAuth } from "@/contexts/AuthContext"
import { AuthCard } from "./AuthCard"
import {
  searchUsers,
  shareProject,
  getProjectShares,
  deleteShare,
  updateSharePermission,
  type CloudProfile,
  type CloudShare,
  type VersionToShare,
  type SharedTask,
  type SharedPluginInfo,
} from "@/lib/sharingService"

interface CollaborationPanelProps {
  project: Project
  onRefresh?: () => void
}

export const CollaborationPanel: React.FC<CollaborationPanelProps> = ({ project, onRefresh }) => {
  const { isAuthenticated, user, profile } = useAuth()
  const [shares, setShares] = useState<CloudShare[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Share dialog state
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<CloudProfile[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedUser, setSelectedUser] = useState<CloudProfile | null>(null)
  const [shareMessage, setShareMessage] = useState("")
  const [sharePermission, setSharePermission] = useState<'view' | 'edit'>('view')
  const [isSharing, setIsSharing] = useState(false)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>()

  // Load existing shares for this project
  const loadShares = useCallback(async () => {
    if (!isAuthenticated || !user) return
    setIsLoading(true)
    try {
      const data = await getProjectShares(project.id, user.id)
      setShares(data)
    } catch (e: any) {
      setError(e?.message || "Failed to load shares")
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated, user, project.id])

  useEffect(() => {
    loadShares()
  }, [loadShares])

  // Debounced user search
  useEffect(() => {
    if (!searchQuery.trim() || !user) {
      setSearchResults([])
      return
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const results = await searchUsers(searchQuery.trim(), user.id)
        setSearchResults(results)
      } catch {
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    }
  }, [searchQuery, user])

  const handleShare = async () => {
    if (!selectedUser || !user) return
    setIsSharing(true)
    setError(null)
    try {
      // Fetch ALL versions + their annotations from the local DB
      const versions: VersionToShare[] = []
      try {
        const localVersions = await window.electron?.getVersionsByProject(project.id)
        if (localVersions && localVersions.length > 0) {
          for (const v of localVersions) {
            const anns = await window.electron?.getAnnotationsByVersion(v.id) || []
            versions.push({
              name: v.name || `Version ${v.versionNumber || 1}`,
              filePath: v.filePath,
              versionNumber: v.versionNumber || 1,
              isFavorite: v.id === project.favoriteVersionId,
              annotations: anns.map((a: any) => ({
                id: a.id,
                timestamp: a.timestamp || 0,
                text: a.text || '',
                color: a.color || '#8b5cf6',
                isTask: a.isTask || false,
                taskStatus: a.taskStatus || null,
                createdAt: a.createdAt || new Date().toISOString(),
              })),
            })
          }
        }
      } catch (e) {
        console.warn('[Share] Could not get audio versions:', e)
      }

      // Fetch project tasks
      const sharedTasks: SharedTask[] = []
      try {
        const localTasks = await window.electron?.getTasks() || []
        const projTasks = localTasks.filter((t: any) => t.projectId === project.id)
        projTasks.forEach((t: any, i: number) => {
          sharedTasks.push({
            id: t.id,
            title: t.title,
            description: t.description || null,
            status: t.status || 'todo',
            priority: t.priority || null,
            dueDate: t.dueDate || null,
            order: t.order ?? i,
            createdAt: t.createdAt || new Date().toISOString(),
            updatedAt: t.updatedAt || new Date().toISOString(),
          })
        })
      } catch (e) {
        console.warn('[Share] Could not fetch tasks:', e)
      }

      // Fetch FLP analysis if available
      const sharedPlugins: SharedPluginInfo[] = []
      let flpAnalysis = null
      if (project.dawType?.toLowerCase().includes('fl studio') && project.dawProjectPath) {
        try {
          flpAnalysis = await window.electron?.analyzeFlpProject?.(project.id, project.dawProjectPath)
          if (flpAnalysis?.plugins) {
            for (const p of flpAnalysis.plugins) {
              sharedPlugins.push({
                name: p.name || p.pluginName || '',
                isInstrument: p.isInstrument ?? false,
                isSampler: p.isSampler ?? false,
                presetName: p.presetName || null,
                dllName: p.dllName || null,
              })
            }
          }
        } catch (e) {
          console.warn('[Share] Could not fetch FLP analysis:', e)
        }
      }

      await shareProject(user.id, profile?.displayName || user.email || 'Unknown', {
        toUserId: selectedUser.id,
        projectLocalId: project.id,
        projectTitle: project.title,
        projectDaw: project.dawType,
        projectBpm: project.bpm,
        projectKey: project.musicalKey,
        projectGenre: project.genre,
        projectArtists: project.artists,
        projectStatus: project.status,
        projectTags: project.tags,
        projectCollection: project.collectionName,
        projectTimeSpent: project.timeSpent,
        projectCreatedAt: project.createdAt,
        projectUpdatedAt: project.updatedAt,
        permission: sharePermission,
        imagePath: project.artworkPath,
        versions,
        tasks: sharedTasks.length ? sharedTasks : undefined,
        plugins: sharedPlugins.length ? sharedPlugins : undefined,
        analysis: flpAnalysis || undefined,
        message: shareMessage.trim() || undefined,
      })
      setShowShareDialog(false)
      setSelectedUser(null)
      setSearchQuery("")
      setShareMessage("")
      setSharePermission('view')
      await loadShares()
      onRefresh?.()
    } catch (e: any) {
      setError(e?.message || "Failed to share project")
    } finally {
      setIsSharing(false)
    }
  }

  const handlePermissionChange = async (shareId: string, newPermission: 'view' | 'edit') => {
    try {
      await updateSharePermission(shareId, newPermission)
      await loadShares()
    } catch (e: any) {
      setError(e?.message || 'Failed to update permission')
    }
  }

  const handleRemoveShare = async (shareId: string) => {
    try {
      await deleteShare(shareId)
      await loadShares()
      onRefresh?.()
    } catch (e: any) {
      setError(e?.message || "Failed to remove share")
    }
  }

  // Not signed in — show auth card
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col gap-5">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          Sharing & Collaboration
        </h2>
        <AuthCard />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      {/* Header */}
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Users className="w-5 h-5 text-primary" />
        Sharing & Collaboration
      </h2>

      {/* Signed in as */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
        <Mail className="w-3.5 h-3.5" />
        <span>Signed in as <strong className="text-foreground">{profile?.displayName || user?.email}</strong></span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={() => setShowShareDialog(true)}
          className="gap-1.5"
        >
          <Send className="w-3.5 h-3.5" />
          Share Project
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-2.5 rounded-lg bg-destructive/10 text-destructive text-xs flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => setError(null)}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}

      {/* Shared with list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading shares...</span>
        </div>
      ) : shares.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground rounded-xl border border-dashed border-border/50 bg-muted/5">
          <Share2 className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium">Not shared yet</p>
          <p className="text-xs mt-1 max-w-xs mx-auto">
            Click "Share Project" to find other users by email and share your project with them.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Shared with ({shares.length})
          </span>
          <AnimatePresence mode="popLayout">
            {shares.map(share => (
              <motion.div
                key={share.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="p-3 rounded-lg border border-border/30 bg-card/50 hover:bg-card/80 transition-all group"
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-sm font-semibold text-primary">
                      {(share.toUser?.displayName || share.toUser?.email || "?")[0].toUpperCase()}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {share.toUser?.displayName || share.toUser?.email || "Unknown user"}
                      </span>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-[10px] border-0",
                          share.status === 'accepted' && "bg-green-500/10 text-green-500",
                          share.status === 'pending' && "bg-yellow-500/10 text-yellow-500",
                          share.status === 'declined' && "bg-red-500/10 text-red-500",
                        )}
                      >
                        {share.status === 'accepted' && <Check className="w-2.5 h-2.5 mr-0.5" />}
                        {share.status === 'pending' && <Clock className="w-2.5 h-2.5 mr-0.5" />}
                        {share.status === 'declined' && <XCircle className="w-2.5 h-2.5 mr-0.5" />}
                        {share.status}
                      </Badge>
                    </div>

                    <span className="text-xs text-muted-foreground block mt-0.5">
                      {share.toUser?.email}
                    </span>

                    {share.message && (
                      <div className="flex items-start gap-1.5 mt-1.5 text-xs text-muted-foreground">
                        <MessageSquare className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-2">{share.message}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1">
                      <Clock className="w-2.5 h-2.5" />
                      <span>Shared {new Date(share.createdAt).toLocaleDateString()}</span>
                      <span>•</span>
                      <button
                        onClick={() => handlePermissionChange(share.id, share.permission === 'edit' ? 'view' : 'edit')}
                        className={cn(
                          "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all hover:opacity-80",
                          share.permission === 'edit'
                            ? "bg-green-500/10 text-green-500"
                            : "bg-muted/50 text-muted-foreground"
                        )}
                        title={`Click to change to ${share.permission === 'edit' ? 'view only' : 'can edit'}`}
                      >
                        {share.permission === 'edit' ? <Edit2 className="w-2 h-2" /> : <Eye className="w-2 h-2" />}
                        {share.permission === 'edit' ? 'Can Edit' : 'View Only'}
                      </button>
                    </div>
                  </div>

                  {/* Remove button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleRemoveShare(share.id)}
                    title="Remove share"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Share Project Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-4 h-4" />
              Share &ldquo;{project.title}&rdquo;
            </DialogTitle>
            <DialogDescription>
              Search for a user by email to share this project with them.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 pt-2">
            {/* User search */}
            {!selectedUser ? (
              <div>
                <label className="text-sm font-medium mb-1.5 block">Find User</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search by email..."
                    className="pl-9"
                    autoFocus
                  />
                  {isSearching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />
                  )}
                </div>

                {/* Search results */}
                {searchResults.length > 0 && (
                  <div className="mt-2 border border-border/40 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                    {searchResults.map(userProfile => {
                      const alreadyShared = shares.some(s => s.toUserId === userProfile.id)
                      return (
                        <button
                          key={userProfile.id}
                          disabled={alreadyShared}
                          onClick={() => {
                            setSelectedUser(userProfile)
                            setSearchQuery("")
                            setSearchResults([])
                          }}
                          className={cn(
                            "w-full flex items-center gap-3 p-2.5 text-left hover:bg-muted/50 transition-colors border-b border-border/20 last:border-0",
                            alreadyShared && "opacity-50 cursor-not-allowed"
                          )}
                          title={alreadyShared ? "Already shared with this user" : `Share with ${userProfile.email}`}
                        >
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-semibold text-primary">
                              {(userProfile.displayName || userProfile.email)[0].toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium block truncate">
                              {userProfile.displayName || userProfile.email.split('@')[0]}
                            </span>
                            <span className="text-xs text-muted-foreground block truncate">
                              {userProfile.email}
                            </span>
                          </div>
                          {alreadyShared && (
                            <Badge variant="secondary" className="text-[10px]">shared</Badge>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}

                {searchQuery.trim().length > 0 && !isSearching && searchResults.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-2 text-center py-3">
                    No users found matching &ldquo;{searchQuery}&rdquo;
                  </p>
                )}
              </div>
            ) : (
              /* Selected user */
              <div>
                <label className="text-sm font-medium mb-1.5 block">Sharing with</label>
                <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/20 bg-primary/5">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-primary">
                      {(selectedUser.displayName || selectedUser.email)[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium block truncate">
                      {selectedUser.displayName || selectedUser.email.split('@')[0]}
                    </span>
                    <span className="text-xs text-muted-foreground block truncate">
                      {selectedUser.email}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => setSelectedUser(null)}
                    title="Change user"
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}

            {/* Permission toggle */}
            {selectedUser && (
              <div>
                <label className="text-sm font-medium mb-1.5 block">Permission</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSharePermission('view')}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 p-2.5 rounded-lg border text-sm font-medium transition-all",
                      sharePermission === 'view'
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/40 text-muted-foreground hover:bg-muted/30"
                    )}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    View Only
                  </button>
                  <button
                    onClick={() => setSharePermission('edit')}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 p-2.5 rounded-lg border text-sm font-medium transition-all",
                      sharePermission === 'edit'
                        ? "border-green-500 bg-green-500/10 text-green-500"
                        : "border-border/40 text-muted-foreground hover:bg-muted/30"
                    )}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Can Edit
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {sharePermission === 'edit' ? 'User can add annotations and change project status' : 'User can only view the project'}
                </p>
              </div>
            )}

            {/* Message (optional) */}
            {selectedUser && (
              <div>
                <label className="text-sm font-medium mb-1.5 block">Message (optional)</label>
                <Textarea
                  value={shareMessage}
                  onChange={e => setShareMessage(e.target.value)}
                  placeholder="Hey, check out this beat..."
                  className="min-h-[70px] resize-none"
                />
              </div>
            )}

            {/* Project preview */}
            {selectedUser && (
              <div className="p-3 rounded-lg bg-muted/30 border border-border/20">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Project Details
                </span>
                <div className="flex items-center gap-3 text-xs flex-wrap">
                  <span className="font-semibold text-foreground">{project.title}</span>
                  {project.bpm && <Badge variant="secondary" className="text-[10px]">{project.bpm} BPM</Badge>}
                  {project.musicalKey && <Badge variant="secondary" className="text-[10px]">{project.musicalKey}</Badge>}
                  {project.dawType && <Badge variant="secondary" className="text-[10px]">{project.dawType}</Badge>}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => {
                setShowShareDialog(false)
                setSelectedUser(null)
                setSearchQuery("")
                setShareMessage("")
              }}>
                Cancel
              </Button>
              <Button
                onClick={handleShare}
                disabled={!selectedUser || isSharing}
                className="gap-1.5"
              >
                {isSharing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                Share
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default CollaborationPanel
