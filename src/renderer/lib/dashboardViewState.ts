import { FilterOptions } from "@shared/types"

/**
 * Persisted Projects (Dashboard) view state.
 *
 * Stored in localStorage (synchronous, survives in-session navigation AND app
 * restarts) so the Projects page restores its search/filters/sort/scroll instead
 * of resetting to defaults every time it remounts. viewMode/gridSize are NOT here
 * — those live in AppSettings.
 */
export interface DashboardViewState {
  filters: FilterOptions
  searchInput: string
  showFilters: boolean
  scrollTop: number
}

const STORAGE_KEY = "dbundone:dashboardViewState"

export function loadDashboardViewState(): Partial<DashboardViewState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === "object") return parsed as Partial<DashboardViewState>
    return {}
  } catch {
    return {}
  }
}

export function saveDashboardViewState(patch: Partial<DashboardViewState>): void {
  try {
    const current = loadDashboardViewState()
    const merged = { ...current, ...patch }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
  } catch {
    // Storage unavailable / quota — non-fatal, just skip persistence.
  }
}
