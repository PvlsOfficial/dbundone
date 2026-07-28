import React, { useCallback, useEffect, useMemo, useState } from "react"
import { Trash2, ImagePlus, Check, RefreshCw, FolderPlus, Pencil, X, ChevronRight } from "lucide-react"
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui"
import { cn } from "@/lib/utils"
import { useImageUrl } from "@/hooks/useImageUrl"
import {
  assignCover,
  createGroup,
  deleteGroup,
  loadAssignments,
  loadGroups,
  renameGroup,
  CoverGroup,
  GroupAssignments,
  UNGROUPED,
} from "../coverGroups"

const isElectron = () => typeof window !== "undefined" && typeof window.electron !== "undefined"

interface CoverLibraryProps {
  /** Bump to force a reload (e.g. after exporting a new cover). */
  refreshSignal: number
  /** Load a saved cover back into the editor as an image layer. */
  onLoadAsLayer: (path: string) => void
  /** Assign a saved cover to the bound project, if any. */
  onSetCover?: (path: string) => void
}

export const CoverLibrary: React.FC<CoverLibraryProps> = ({ refreshSignal, onLoadAsLayer, onSetCover }) => {
  const [paths, setPaths] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [groups, setGroups] = useState<CoverGroup[]>(() => loadGroups())
  const [assign, setAssign] = useState<GroupAssignments>(() => loadAssignments())
  const [newGroupName, setNewGroupName] = useState("")
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const reload = useCallback(async () => {
    if (!isElectron()) return
    setLoading(true)
    try {
      const list = await window.electron?.listCoverLibrary?.()
      setPaths(list || [])
    } catch (e) {
      console.warn("Failed to list cover library:", e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload, refreshSignal])

  const handleDelete = async (path: string) => {
    if (!isElectron()) return
    try {
      await window.electron?.deleteCoverImage?.(path)
      setPaths((prev) => prev.filter((p) => p !== path))
      setAssign(assignCover(path, null))
    } catch (e) {
      console.warn("Failed to delete cover:", e)
    }
  }

  const handleMove = (path: string, groupId: string) => {
    setAssign(assignCover(path, groupId))
  }

  const addGroup = () => {
    if (!newGroupName.trim()) return
    setGroups(createGroup(newGroupName))
    setNewGroupName("")
  }

  const commitRename = (id: string) => {
    setGroups(renameGroup(id, renameValue))
    setRenamingId(null)
    setRenameValue("")
  }

  const removeGroup = (id: string) => {
    setGroups(deleteGroup(id))
    setAssign(loadAssignments())
  }

  const toggleCollapse = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  // Group the paths: each named group, then the ungrouped remainder. A path whose
  // assigned group no longer exists falls back to ungrouped.
  const sections = useMemo(() => {
    const validIds = new Set(groups.map((g) => g.id))
    const byGroup = new Map<string, string[]>()
    const ungrouped: string[] = []
    for (const p of paths) {
      const gid = assign[p]
      if (gid && validIds.has(gid)) {
        if (!byGroup.has(gid)) byGroup.set(gid, [])
        byGroup.get(gid)!.push(p)
      } else {
        ungrouped.push(p)
      }
    }
    return { byGroup, ungrouped }
  }, [paths, groups, assign])

  const groupOptions = [{ id: UNGROUPED, name: "Ungrouped" }, ...groups]

  return (
    <div className="p-3 space-y-3 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Saved covers</span>
        <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={reload} title="Refresh">
          <RefreshCw className={loading ? "w-3 h-3 animate-spin" : "w-3 h-3"} />
        </Button>
      </div>

      {/* New group */}
      <div className="flex items-center gap-1.5">
        <Input
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addGroup()
          }}
          placeholder="New group…"
          className="h-7 text-xs"
          aria-label="New group name"
        />
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={addGroup} title="Create group">
          <FolderPlus className="w-3.5 h-3.5" />
        </Button>
      </div>

      {paths.length === 0 && (
        <p className="text-xs text-muted-foreground">No saved covers yet.</p>
      )}

      {/* Named groups first, then ungrouped */}
      {groups.map((g) => {
        const items = sections.byGroup.get(g.id) || []
        const isCollapsed = collapsed.has(g.id)
        return (
          <section key={g.id} className="space-y-2">
            <div className="flex items-center gap-1 group/header">
              <button type="button" className="p-0.5 text-muted-foreground hover:text-foreground" onClick={() => toggleCollapse(g.id)} title="Collapse">
                <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", !isCollapsed && "rotate-90")} />
              </button>
              {renamingId === g.id ? (
                <Input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => commitRename(g.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename(g.id)
                    if (e.key === "Escape") {
                      setRenamingId(null)
                      setRenameValue("")
                    }
                  }}
                  className="h-6 text-xs flex-1"
                  aria-label="Group name"
                />
              ) : (
                <span className="text-xs font-medium flex-1 truncate">
                  {g.name} <span className="text-muted-foreground">({items.length})</span>
                </span>
              )}
              <button
                type="button"
                className="p-0.5 text-muted-foreground hover:text-foreground opacity-0 group-hover/header:opacity-100"
                title="Rename group"
                onClick={() => {
                  setRenamingId(g.id)
                  setRenameValue(g.name)
                }}
              >
                <Pencil className="w-3 h-3" />
              </button>
              <button
                type="button"
                className="p-0.5 text-muted-foreground hover:text-destructive opacity-0 group-hover/header:opacity-100"
                title="Delete group (covers move to Ungrouped)"
                onClick={() => removeGroup(g.id)}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {!isCollapsed && (
              <div className="grid grid-cols-2 gap-2">
                {items.length === 0 && <p className="text-[10px] text-muted-foreground col-span-2">Empty.</p>}
                {items.map((path) => (
                  <LibraryItem
                    key={path}
                    path={path}
                    groupId={g.id}
                    groupOptions={groupOptions}
                    onLoadAsLayer={onLoadAsLayer}
                    onSetCover={onSetCover}
                    onDelete={handleDelete}
                    onMove={handleMove}
                  />
                ))}
              </div>
            )}
          </section>
        )
      })}

      {/* Ungrouped */}
      <section className="space-y-2">
        {groups.length > 0 && (
          <span className="text-xs font-medium text-muted-foreground">
            Ungrouped <span>({sections.ungrouped.length})</span>
          </span>
        )}
        <div className="grid grid-cols-2 gap-2">
          {sections.ungrouped.map((path) => (
            <LibraryItem
              key={path}
              path={path}
              groupId={UNGROUPED}
              groupOptions={groupOptions}
              onLoadAsLayer={onLoadAsLayer}
              onSetCover={onSetCover}
              onDelete={handleDelete}
              onMove={handleMove}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

const LibraryItem: React.FC<{
  path: string
  groupId: string
  groupOptions: { id: string; name: string }[]
  onLoadAsLayer: (path: string) => void
  onSetCover?: (path: string) => void
  onDelete: (path: string) => void
  onMove: (path: string, groupId: string) => void
}> = ({ path, groupId, groupOptions, onLoadAsLayer, onSetCover, onDelete, onMove }) => {
  const url = useImageUrl(path)
  return (
    <div className="relative group rounded-md overflow-hidden border border-border/40">
      {url ? (
        <img src={url} alt="cover" className="w-full aspect-square object-cover" />
      ) : (
        <div className="w-full aspect-square bg-muted/40" />
      )}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity p-1.5">
        <Button type="button" size="sm" variant="secondary" className="h-7 text-[11px] gap-1 w-full" onClick={() => onLoadAsLayer(path)}>
          <ImagePlus className="w-3 h-3" /> Edit
        </Button>
        {onSetCover && (
          <Button type="button" size="sm" className="h-7 text-[11px] gap-1 w-full" onClick={() => onSetCover(path)}>
            <Check className="w-3 h-3" /> Set cover
          </Button>
        )}
        {groupOptions.length > 1 && (
          <Select value={groupId} onValueChange={(v) => onMove(path, v)}>
            <SelectTrigger className="h-6 w-full text-[10px]" title="Move to group">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {groupOptions.map((g) => (
                <SelectItem key={g.id} value={g.id} className="text-xs">
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <button
        type="button"
        className="absolute top-1 right-1 p-1 rounded bg-black/50 text-white/80 hover:text-destructive opacity-0 group-hover:opacity-100"
        title="Delete"
        onClick={() => onDelete(path)}
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  )
}
