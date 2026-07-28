// Local, client-side organisation for the saved cover library. The covers
// themselves live on disk (listed by the backend); here we only store the
// user's grouping — group names and which cover path belongs to which group —
// in localStorage, so no schema/backend change is needed.

import { newId } from "./engine/doc"

export interface CoverGroup {
  id: string
  name: string
}

const GROUPS_KEY = "dbundone:coverLab:groups"
const ASSIGN_KEY = "dbundone:coverLab:groupAssign"

/** Sentinel used in selects to mean "no group". */
export const UNGROUPED = "__ungrouped__"

export function loadGroups(): CoverGroup[] {
  try {
    const raw = localStorage.getItem(GROUPS_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as CoverGroup[]) : []
  } catch {
    return []
  }
}

function saveGroups(groups: CoverGroup[]): CoverGroup[] {
  try {
    localStorage.setItem(GROUPS_KEY, JSON.stringify(groups))
  } catch {
    /* ignore quota */
  }
  return groups
}

export function createGroup(name: string): CoverGroup[] {
  const trimmed = name.trim()
  if (!trimmed) return loadGroups()
  const groups = loadGroups()
  groups.push({ id: newId(), name: trimmed })
  return saveGroups(groups)
}

export function renameGroup(id: string, name: string): CoverGroup[] {
  const trimmed = name.trim()
  if (!trimmed) return loadGroups()
  return saveGroups(loadGroups().map((g) => (g.id === id ? { ...g, name: trimmed } : g)))
}

export function deleteGroup(id: string): CoverGroup[] {
  // Drop the group and unassign any covers that pointed at it.
  const assign = loadAssignments()
  let changed = false
  for (const path of Object.keys(assign)) {
    if (assign[path] === id) {
      delete assign[path]
      changed = true
    }
  }
  if (changed) saveAssignments(assign)
  return saveGroups(loadGroups().filter((g) => g.id !== id))
}

export type GroupAssignments = Record<string, string>

export function loadAssignments(): GroupAssignments {
  try {
    const raw = localStorage.getItem(ASSIGN_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === "object" ? (parsed as GroupAssignments) : {}
  } catch {
    return {}
  }
}

function saveAssignments(assign: GroupAssignments): GroupAssignments {
  try {
    localStorage.setItem(ASSIGN_KEY, JSON.stringify(assign))
  } catch {
    /* ignore quota */
  }
  return assign
}

/** Assign a cover path to a group (or pass UNGROUPED/null to clear it). */
export function assignCover(path: string, groupId: string | null): GroupAssignments {
  const assign = loadAssignments()
  if (!groupId || groupId === UNGROUPED) delete assign[path]
  else assign[path] = groupId
  return saveAssignments(assign)
}
