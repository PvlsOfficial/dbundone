import React, { createContext, useContext } from "react"
import type { Project, Task, AudioVersion, Annotation, DistributionLink } from "@shared/types"

// ============ Global Canvas Context ============

export interface GlobalCanvasContextValue {
  projects: Project[]
  tasks: Task[]
  onOpenProject?: (projectId: string) => void
}

export const GlobalCanvasContext = createContext<GlobalCanvasContextValue>({
  projects: [],
  tasks: [],
})

export function useGlobalCanvasCtx() {
  return useContext(GlobalCanvasContext)
}

// ============ Project Canvas Context ============

export interface ProjectCanvasContextValue {
  project: Project | null
  tasks: Task[]
  versions: AudioVersion[]
  annotations: Annotation[]
  distributionLinks: DistributionLink[]
  onOpenProject?: (projectId: string) => void
}

export const ProjectCanvasContext = createContext<ProjectCanvasContextValue>({
  project: null,
  tasks: [],
  versions: [],
  annotations: [],
  distributionLinks: [],
})

export function useProjectCanvasCtx() {
  return useContext(ProjectCanvasContext)
}
