import React, { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Loader2 } from "lucide-react"
import { TitleBar } from "./components/TitleBar"
import { Navigation } from "./components/Navigation"
import { Dashboard } from "./pages/Dashboard"
import { Groups } from "./pages/Groups"
import { GroupDetail } from "./pages/GroupDetail"
import { Scheduler } from "./pages/Scheduler"
import { Settings } from "./pages/Settings"
import { Statistics } from "./pages/Statistics"
import { ProjectDetail } from "./pages/ProjectDetail"
import { HelpGuide } from "./pages/HelpGuide"
import { SharedWithMe } from "./pages/SharedWithMe"
import { AppTour } from "./components/AppTour"
import { ArtworkManager } from "./components/ArtworkManager"
import { AudioPlayer } from "./components/AudioPlayer"
import { ToastProvider, useToast } from "./components/ui/toast"
import { ThemeProvider } from "./components/ThemeProvider"
import { TooltipProvider } from "./components/ui/tooltip"
import { I18nProvider } from "./i18n"
import { Project, ProjectGroup, Task, Tag, AudioPlayerState, AppSettings, PluginSession, PluginEvent } from "@shared/types"
import { DEFAULT_SETTINGS } from "@/lib/constants"
import { invalidateImageCache } from "@/lib/utils"
import { PluginStatusBadge } from "./components/PluginStatus"
import { useAuth } from "./contexts/AuthContext"
import { syncVersionToShares } from "./lib/sharingService"

// Check if running in Electron - must be a function to check at runtime after preload
const isElectron = () => typeof window !== 'undefined' && typeof window.electron !== 'undefined'

type Page = "dashboard" | "groups" | "group-detail" | "scheduler" | "settings" | "statistics" | "project-detail" | "help" | "shared"

function AppContent({ settings, onSettingsChange }: { settings: AppSettings, onSettingsChange: (settings: Partial<AppSettings>) => void }) {
  const [currentPage, setCurrentPage] = useState<Page>("dashboard")
  const [previousPage, setPreviousPage] = useState<Page>("dashboard")
  const [projects, setProjects] = useState<Project[]>([])
  const [groups, setGroups] = useState<ProjectGroup[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedGroup, setSelectedGroup] = useState<ProjectGroup | null>(null)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [playerState, setPlayerState] = useState<AudioPlayerState>({
    isPlaying: false,
    currentTrack: null,
    currentTime: 0,
    duration: 0,
    volume: 0.8,
  })
  const savedPlayerStateRef = useRef<AudioPlayerState | null>(null)
  const [scanProgress, setScanProgress] = useState<{
    current: number;
    total: number;
    daw: string;
    file: string;
    isScanning: boolean;
    phase?: string;
  } | null>(null)
  const [photoProgress, setPhotoProgress] = useState<{
    current: number;
    total: number;
    added: number;
    file: string;
    isRunning: boolean;
    cancelled: boolean;
  } | null>(null)

  const [artworkManagerProject, setArtworkManagerProject] = useState<Project | null>(null)
  const [showTour, setShowTour] = useState(false)

  // Show tour on first launch
  useEffect(() => {
    if (!settings.hasSeenTour && !isLoading) {
      // Small delay to let the app render first
      const timer = setTimeout(() => setShowTour(true), 800)
      return () => clearTimeout(timer)
    }
  }, [settings.hasSeenTour, isLoading])

  const handleStartTour = useCallback(() => {
    setCurrentPage("dashboard")
    setTimeout(() => setShowTour(true), 200)
  }, [])

  const handleCompleteTour = useCallback(() => {
    setShowTour(false)
    onSettingsChange({ hasSeenTour: true })
  }, [onSettingsChange])

  const handleCloseTour = useCallback(() => {
    setShowTour(false)
    onSettingsChange({ hasSeenTour: true })
  }, [onSettingsChange])

  // Plugin session state
  const [pluginSessions, setPluginSessions] = useState<PluginSession[]>([])

  // Refs for stable callbacks - avoid re-creating callbacks when these change frequently
  const projectsRef = useRef(projects)
  projectsRef.current = projects
  const playerStateRef = useRef(playerState)
  playerStateRef.current = playerState

  const { addToast } = useToast()
  const { isAuthenticated, user, profile } = useAuth()

  const refreshData = useCallback(async () => {
    if (!isElectron()) {
      // In browser mode, use mock data for development
      setProjects([])
      setGroups([])
      setTasks([])
      setTags([])
      return
    }

    try {
      const [projectsData, groupsData, tasksData, tagsData] = await Promise.all([
        window.electron?.getProjects() || [],
        window.electron?.getGroups() || [],
        window.electron?.getTasks() || [],
        window.electron?.getTags() || [],
      ])

      console.log('Loaded projects with tags:', projectsData.map(p => ({ id: p.id, title: p.title, tags: p.tags })))

      setProjects(projectsData)
      setGroups(groupsData)
      setTasks(tasksData)
      setTags(tagsData)

      // Update selectedProject if it exists in the refreshed data
      if (selectedProject) {
        const updatedProject = projectsData.find(p => p.id === selectedProject.id)
        if (updatedProject) {
          setSelectedProject(updatedProject)
        }
      }
    } catch (error) {
      console.error("Failed to load data:", error)
      addToast({
        title: "Failed to load data",
        description: "Please try restarting the application",
        variant: "destructive",
      })
    }
  }, [addToast])

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      await refreshData()
      
      // Update DAW types for existing projects (one-time migration)
      if (isElectron()) {
        try {
          const result = await window.electron?.updateDawTypes()
          if (result && result.count > 0) {
            console.log(`Updated DAW types for ${result.count} existing projects`)
            // Refresh data again to get the updated DAW types
            await refreshData()
          }
        } catch (error) {
          console.error("Failed to update DAW types:", error)
        }
      }
      
      setIsLoading(false)
    }
    loadData()

    // Set up IPC listeners for scan progress and photo progress
    if (isElectron() && window.electron) {
      const handleScanProgress = (_: any, progress: any) => {
        setScanProgress({
          current: progress.current,
          total: progress.total,
          daw: progress.daw,
          file: progress.file,
          isScanning: progress.isScanning !== undefined ? progress.isScanning : true,
          phase: progress.phase,
        })
      }

      // Listen for scan progress updates
      window.electron.ipcRenderer.on('scan:progress', handleScanProgress)

      // Listen for photo progress updates (Tauri event)
      let unlistenPhoto: (() => void) | null = null
      let cancelled = false
      {
        import("@tauri-apps/api/event").then(({ listen }) => {
          if (cancelled) return
          listen("photo-progress", (event: any) => {
            const p = event.payload
            setPhotoProgress({
              current: p.current,
              total: p.total,
              added: p.added,
              file: p.file,
              isRunning: p.isRunning,
              cancelled: p.cancelled,
            })
          }).then((unlisten) => {
            if (cancelled) { unlisten(); return }
            unlistenPhoto = unlisten
          })
        })
      }

      // Listen for plugin events (Tauri event)
      let unlistenPlugin: (() => void) | null = null
      {
        import("@tauri-apps/api/event").then(({ listen }) => {
          if (cancelled) return
          listen("plugin-event", (event: any) => {
            const pluginEvent = event.payload as PluginEvent
            console.log("[Plugin Event]", pluginEvent.type, pluginEvent)
            if (pluginEvent.type === "sessionsChanged" && pluginEvent.sessions) {
              setPluginSessions(pluginEvent.sessions)

              // Auto-link: if any unlinked session has a lastProjectId, relink it
              for (const session of pluginEvent.sessions) {
                if (!session.linkedProjectId && session.lastProjectId) {
                  console.log("[Plugin] Auto-relinking session", session.sessionId, "to project", session.lastProjectId)
                  window.electron?.linkPluginToProject(session.sessionId, session.lastProjectId).catch((err: any) => {
                    console.warn("[Plugin] Auto-relink failed:", err)
                  })
                }
              }
            } else if (pluginEvent.type === "pluginLinkedProject") {
              // A project was just linked — refresh so pluginLinked flag shows on cards
              refreshData()
            } else if (pluginEvent.type === "pluginRecordingComplete") {
              // Auto-import the recording as an audio version
              console.log("[Plugin] Recording complete, importing:", pluginEvent)
              if (pluginEvent.sessionId && pluginEvent.projectId && pluginEvent.filePath && pluginEvent.name) {
                const recordingSource = pluginEvent.source || "auto"
                const peakDb = pluginEvent.peakDb ?? null
                const rmsDb = pluginEvent.rmsDb ?? null
                console.log(`[Plugin] Calling importPluginRecording with source: ${recordingSource}, peakDb: ${peakDb}, rmsDb: ${rmsDb}`)
                window.electron?.importPluginRecording(
                  pluginEvent.sessionId,
                  pluginEvent.projectId,
                  pluginEvent.filePath,
                  pluginEvent.name,
                  recordingSource,
                  peakDb,
                  rmsDb,
                ).then((version) => {
                  console.log("[Plugin] Recording imported as version:", version)
                  addToast({
                    title: "Recording imported",
                    description: `"${pluginEvent.name}" added as new audio version`,
                  })
                  refreshData()

                  // Auto-analyze the recording for dB/LUFS data
                  if (version?.id) {
                    window.electron?.analyzeAudioVersion(version.id).then(() => {
                      console.log("[Plugin] Audio analysis complete for version:", version.id)
                      refreshData()
                    }).catch((err: any) => {
                      console.warn("[Plugin] Audio analysis failed (non-critical):", err)
                    })
                  }

                  // Auto-sync to shared projects
                  if (isAuthenticated && user && version) {
                    syncVersionToShares(
                      user.id,
                      profile?.display_name || user.email || "Unknown",
                      pluginEvent.projectId,
                      {
                        name: version.name || pluginEvent.name,
                        filePath: version.file_path || pluginEvent.filePath,
                        versionNumber: version.version_number ?? 1,
                        isFavorite: false,
                      }
                    ).then((count) => {
                      if (count > 0) {
                        console.log(`[Plugin] Auto-synced recording to ${count} share(s)`)
                      }
                    }).catch((err) => {
                      console.warn("[Plugin] Auto-sync failed (non-critical):", err)
                    })
                  }
                }).catch((err: any) => {
                  console.error("[Plugin] Failed to import recording:", err)
                  addToast({
                    title: "Failed to import recording",
                    description: String(err),
                    variant: "destructive",
                  })
                })
              } else {
                console.warn("[Plugin] Recording complete event missing fields:", pluginEvent)
                console.warn("[Plugin] Event payload keys:", Object.keys(pluginEvent))
              }
            }
          }).then((unlisten) => {
            if (cancelled) { unlisten(); return }
            unlistenPlugin = unlisten
          })
        })
      }

      // Load initial plugin sessions
      window.electron?.getPluginSessions?.().then((sessions: PluginSession[]) => {
        if (!cancelled) setPluginSessions(sessions)
      }).catch(() => {})

      // Cleanup listeners on unmount
      return () => {
        cancelled = true
        window.electron?.ipcRenderer.removeListener('scan:progress', handleScanProgress)
        unlistenPhoto?.()
        unlistenPlugin?.()
      }
    }
  }, [refreshData])

  const playProject = useCallback(async (project: Project) => {
    let audioPath = project.audioPreviewPath
    
    // If project has a favorite version, use that audio file instead
    if (project.favoriteVersionId && isElectron()) {
      try {
        if (project.favoriteVersionId === "main") {
          // Use the main preview path
          audioPath = project.audioPreviewPath
        } else {
          // Fetch the favorite version details
          const favoriteVersion = await window.electron?.getAudioVersion(project.favoriteVersionId)
          if (favoriteVersion && favoriteVersion.filePath) {
            audioPath = favoriteVersion.filePath
          }
        }
      } catch (error) {
        console.error("Failed to load favorite version:", error)
        // Fall back to main preview path
        audioPath = project.audioPreviewPath
      }
    }
    
    if (audioPath && audioPath.trim() !== '') {
      setPlayerState((prev) => ({
        ...prev,
        currentTrack: { ...project, audioPreviewPath: audioPath },
        isPlaying: true,
        currentTime: 0,
      }))
    }
  }, [])

  const handleOpenDaw = useCallback(async (project: Project) => {
    if (!isElectron()) {
      console.log("DAW launch only available in desktop app")
      return
    }
    if (project.dawProjectPath) {
      try {
        await window.electron?.openInDaw(project.dawProjectPath)
      } catch (error) {
        addToast({
          title: "Failed to open project",
          description: "Could not launch the DAW application",
          variant: "destructive",
        })
      }
    }
  }, [addToast])

  const handleScanFolder = useCallback(async () => {
    if (!isElectron()) {
      addToast({
        title: "Not available",
        description: "Folder scanning only available in desktop app",
        variant: "destructive",
      })
      return
    }

    try {
      // Reset scan progress
      setScanProgress(null)
      let totalScanned = 0
      const scannedDAWs: string[] = []
      const skippedDAWs: string[] = []

      // Scan all selected DAW folders (only those with configured paths)
      for (const daw of settings.selectedDAWs) {
        const folders = settings.dawFolders[daw] || []

        // Skip DAWs without configured folders (don't show error)
        if (folders.length === 0) {
          skippedDAWs.push(daw)
          continue
        }

        for (const folderPath of folders) {
          let result
          if (daw === "FL Studio") {
            result = await window.electron?.scanFLStudioFolder(folderPath)
          } else if (daw === "Ableton Live") {
            result = await window.electron?.scanAbletonFolder(folderPath)
          } else {
            result = await window.electron?.scanDAWFolder(folderPath, daw)
          }

          if (result && result.count > 0) {
            totalScanned += result.count
            if (!scannedDAWs.includes(daw)) scannedDAWs.push(daw)
          }
        }
      }

      // If ALL DAWs were skipped (none configured), show a helpful message
      if (skippedDAWs.length === settings.selectedDAWs.length && settings.selectedDAWs.length > 0) {
        addToast({
          title: "No folders configured",
          description: "Please set project folders in Settings to scan",
        })
        return
      }

      if (totalScanned > 0) {
        await refreshData()
        addToast({
          title: "Scan complete",
          description: `Added ${totalScanned} projects from ${scannedDAWs.join(", ")}`,
          variant: "success",
        })
      } else {
        addToast({
          title: "Project lists are up to date",
          description: scannedDAWs.length > 0 
            ? "No new projects found in the configured folders"
            : "Configure project folders in Settings to scan",
        })
      }
    } catch (error) {
      addToast({
        title: "Scan failed",
        description: "Could not scan the folders for projects",
        variant: "destructive",
      })
    } finally {
      // Reset scan progress
      setScanProgress(null)
    }
  }, [addToast, refreshData, settings.selectedDAWs, settings.dawFolders, settings.flStudioPath])

  // Auto-scan on startup if enabled
  useEffect(() => {
    if (settings.autoScanOnStartup && !isLoading) {
      // Only auto-scan if at least one DAW folder is configured
      const hasConfiguredFolder = settings.selectedDAWs.some(
        daw => (settings.dawFolders[daw] || []).length > 0
      )
      if (hasConfiguredFolder) {
        handleScanFolder()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]) // Only run once after initial load

  const handleScanFolderWithSelection = useCallback(async () => {
    if (!isElectron()) {
      addToast({
        title: "Not available",
        description: "Folder scanning only available in desktop app",
        variant: "destructive",
      })
      return
    }

    try {
      // Reset scan progress
      setScanProgress(null)
      // Ask user to select a folder
      const folderPath = await window.electron?.selectFolder() || null
      if (!folderPath) return

      // Determine which DAW(s) this folder is for by checking file extensions
      let detectedDAWs: string[] = []
      try {
        const detection = await window.electron?.detectProjects(folderPath) || { hasFLP: false, hasALS: false, detectedDAWs: [] }
        detectedDAWs = detection.detectedDAWs || []
        // Backward compatibility: if detectedDAWs is empty, fall back to hasFLP/hasALS
        if (detectedDAWs.length === 0) {
          if (detection.hasFLP) detectedDAWs.push("FL Studio")
          if (detection.hasALS) detectedDAWs.push("Ableton Live")
        }
      } catch (error) {
        // If we can't read the folder, default to FL Studio for backward compatibility
        detectedDAWs = ["FL Studio"]
      }

      if (detectedDAWs.length === 0) {
        addToast({
          title: "No project files detected",
          description: "The selected folder doesn't contain any recognized DAW project files",
          variant: "destructive",
        })
        return
      }

      // Update settings with the selected folder for detected DAW(s)
      const updatedDawFolders = { ...settings.dawFolders }
      for (const daw of detectedDAWs) {
        const existing = updatedDawFolders[daw] || []
        if (!existing.includes(folderPath)) updatedDawFolders[daw] = [...existing, folderPath]
      }
      await onSettingsChange({ dawFolders: updatedDawFolders })

      addToast({
        title: "Scanning folder...",
        description: `Looking for ${detectedDAWs.join(" & ")} projects`,
      })

      let totalCount = 0
      for (const daw of detectedDAWs) {
        let result
        if (daw === "FL Studio") {
          result = await window.electron?.scanFLStudioFolder(folderPath)
        } else if (daw === "Ableton Live") {
          result = await window.electron?.scanAbletonFolder(folderPath)
        } else {
          result = await window.electron?.scanDAWFolder(folderPath, daw)
        }
        if (result?.count) totalCount += result.count
      }

      if (totalCount > 0) {
        await refreshData()
        addToast({
          title: "Scan complete",
          description: `Added ${totalCount} projects from ${detectedDAWs.join(" & ")}`,
          variant: "success",
        })
      } else {
        addToast({
          title: "Project list is up to date",
          description: `No new projects found in this folder`,
        })
      }
    } catch (error) {
      addToast({
        title: "Scan failed",
        description: "Could not scan the folder for projects",
        variant: "destructive",
      })
    } finally {
      // Reset scan progress
      setScanProgress(null)
    }
  }, [addToast, refreshData, onSettingsChange, settings.dawFolders])

  const handleGenerateArtwork = useCallback(async (project: Project) => {
    try {
      addToast({
        title: "Generating artwork...",
        description: `Creating AI artwork for "${project.title}"`,
      })

      const artworkPath = await window.electron?.generateArtwork(project.id, project.title)
      if (artworkPath) {
        invalidateImageCache(artworkPath)
        await refreshData()
        addToast({
          title: "Artwork generated",
          description: "AI artwork has been created and saved",
          variant: "success",
        })
      }
    } catch (error) {
      addToast({
        title: "Generation failed",
        description: "Could not generate artwork. Please check your AI API key and internet connection.",
        variant: "destructive",
      })
    }
  }, [addToast, refreshData])

  const handleFetchUnsplashPhoto = useCallback(async (project: Project) => {
    const maxRetries = 5 // Increased to 5 attempts for individual projects too

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        addToast({
          title: attempt === 1 ? "Fetching photo..." : `Retrying... (${attempt}/${maxRetries})`,
          description: `Getting a random Unsplash photo for "${project.title}"`,
        })

        const artworkPath = await window.electron?.fetchUnsplashPhoto(project.id)
        if (artworkPath) {
          invalidateImageCache(artworkPath)
          await refreshData()
          addToast({
            title: "Photo fetched!",
            description: attempt === 1 ? `"${project.title}" now has artwork` : `"${project.title}" got artwork after ${attempt} attempts`,
            variant: "success",
          })
          return // Success, exit the retry loop
        } else if (attempt < maxRetries) {
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      } catch (error) {
        if (attempt < maxRetries) {
          console.error(`Attempt ${attempt} failed for project ${project.title}:`, error)
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 800))
        } else {
          addToast({
            title: "Fetch failed",
            description: `Could not fetch Unsplash photo for "${project.title}" after ${maxRetries} attempts. Please check your internet connection.`,
            variant: "destructive",
          })
        }
      }
    }
  }, [addToast, refreshData])

  const handleFetchUnsplashPhotosForAll = useCallback(async () => {
    if (!isElectron()) {
      addToast({
        title: "Not available",
        description: "Bulk photo fetching only available in desktop app",
        variant: "destructive",
      })
      return
    }

    try {
      const projectsWithoutArtwork = projects.filter(project => !project.artworkPath)

      if (projectsWithoutArtwork.length === 0) {
        addToast({
          title: "No projects need artwork",
          description: "All projects already have artwork assigned",
        })
        return
      }

      setPhotoProgress({ current: 0, total: projectsWithoutArtwork.length, added: 0, file: "Starting...", isRunning: true, cancelled: false })

      const result = await window.electron?.batchFetchPhotos()

      invalidateImageCache()
      await refreshData()
      setPhotoProgress(null)

      if (result) {
        if (result.cancelled) {
          addToast({
            title: "Photo fetch stopped",
            description: `Added ${result.added} of ${result.total} photos before stopping`,
            variant: "success",
          })
        } else if (result.added > 0) {
          addToast({
            title: "Photos added",
            description: `Added artwork to ${result.added} of ${result.total} projects`,
            variant: "success",
          })
        } else {
          addToast({
            title: "No photos added",
            description: "Could not fetch photos. Check your internet connection.",
            variant: "destructive",
          })
        }
      }
    } catch (error) {
      setPhotoProgress(null)
      addToast({
        title: "Bulk fetch failed",
        description: "Could not complete the photo fetching operation",
        variant: "destructive",
      })
    }
  }, [addToast, refreshData, projects])

  const handleCancelBatchPhotos = useCallback(async () => {
    try {
      await window.electron?.cancelBatchPhotos()
    } catch (error) {
      console.error("Failed to cancel batch photos:", error)
    }
  }, [])

  const handleRemoveAllArtwork = useCallback(async () => {
    if (!isElectron()) return
    try {
      const result = await window.electron?.removeAllArtwork()
      invalidateImageCache()
      await refreshData()
      if (result) {
        addToast({
          title: "All artwork removed",
          description: `Cleared ${result.cleared} projects, deleted ${result.filesDeleted} files`,
          variant: "success",
        })
      }
    } catch (error) {
      addToast({
        title: "Failed to remove artwork",
        description: "Could not remove all artwork",
        variant: "destructive",
      })
    }
  }, [addToast, refreshData])

  const handleChangeArtwork = useCallback(async (project: Project) => {
    try {
      const imagePath = await window.electron?.selectImage()
      if (imagePath) {
        await window.electron?.updateProject(project.id, { artworkPath: imagePath })
        await window.electron?.addArtworkHistoryEntry(project.id, imagePath, "file")
        invalidateImageCache()
        await refreshData()
        addToast({
          title: "Artwork changed",
          description: "Project artwork has been updated",
          variant: "success",
        })
      }
    } catch (error) {
      addToast({
        title: "Failed to change artwork",
        description: "Could not update the project artwork",
        variant: "destructive",
      })
    }
  }, [addToast, refreshData])

  const handleRemoveArtwork = useCallback(async (project: Project) => {
    try {
      await window.electron?.updateProject(project.id, { artworkPath: null })
      if (project.artworkPath) invalidateImageCache(project.artworkPath)
      await refreshData()
      addToast({
        title: "Artwork removed",
        description: "Project artwork has been removed",
        variant: "success",
      })
    } catch (error) {
      addToast({
        title: "Failed to remove artwork",
        description: "Could not remove the project artwork",
        variant: "destructive",
      })
    }
  }, [addToast, refreshData])

  const handleOpenArtworkManager = useCallback((project: Project) => {
    // Get the latest version of the project from state
    const latest = projectsRef.current.find(p => p.id === project.id) || project
    setArtworkManagerProject(latest)
  }, [])

  const handleDeleteProject = useCallback(async (project: Project) => {
    try {
      await window.electron?.deleteProject(project.id)
      await refreshData()
      addToast({
        title: "Project deleted",
        variant: "success",
      })
    } catch (error) {
      addToast({
        title: "Failed to delete",
        variant: "destructive",
      })
    }
  }, [addToast, refreshData])

  const handleOpenProject = useCallback((project: Project) => {
    // Find the project in the projects array to ensure object reference stability
    const existingProject = projectsRef.current.find(p => p.id === project.id)
    if (existingProject) {
      setSelectedProject(existingProject)
    } else {
      setSelectedProject(project)
    }

    // Save and hide the audio player when entering project detail
    const ps = playerStateRef.current
    if (ps.currentTrack) {
      savedPlayerStateRef.current = { ...ps }
      setPlayerState({
        isPlaying: false,
        currentTrack: null,
        currentTime: ps.currentTime,
        duration: ps.duration,
        volume: ps.volume,
      })
    }

    // Remember where we came from
    setPreviousPage(currentPage as Page)
    setCurrentPage("project-detail")
  }, [currentPage])

  const handleBackFromProject = useCallback(() => {
    setSelectedProject(null)

    // Restore the audio player if it was playing before
    if (savedPlayerStateRef.current) {
      setPlayerState(savedPlayerStateRef.current)
      savedPlayerStateRef.current = null
    }

    // Go back to where we came from (dashboard, groups, or group-detail)
    setCurrentPage(previousPage === "project-detail" ? "dashboard" : previousPage)
  }, [previousPage])

  const handleDatabaseCleared = useCallback(async () => {
    await refreshData()
    addToast({
      title: "Database cleared",
      description: "All projects have been removed",
      variant: "success",
    })
  }, [addToast, refreshData])

  const handleRescan = useCallback(async () => {
    await handleScanFolder()
  }, [handleScanFolder])

  const handleRefreshMetadata = useCallback(async () => {
    try {
      // Re-scan triggers a full metadata re-extract for all known projects
      let totalScanned = 0
      const scannedDAWs: string[] = []

      for (const daw of settings.selectedDAWs) {
        const folders = settings.dawFolders[daw] || []
        if (folders.length === 0) continue

        for (const folderPath of folders) {
          let result
          if (daw === "FL Studio") {
            result = await window.electron?.scanFLStudioFolder(folderPath)
          } else if (daw === "Ableton Live") {
            result = await window.electron?.scanAbletonFolder(folderPath)
          }

          if (result && result.count > 0) {
            totalScanned += result.count
            if (!scannedDAWs.includes(daw)) scannedDAWs.push(daw)
          }
        }
      }

      await refreshData()
      addToast({
        title: "Metadata refreshed",
        description: totalScanned > 0
          ? `Updated ${totalScanned} projects`
          : "All project metadata is up to date",
        variant: "success",
      })
    } catch (error) {
      addToast({
        title: "Refresh failed",
        description: "Could not refresh project metadata",
        variant: "destructive",
      })
    }
  }, [addToast, refreshData, settings.selectedDAWs, settings.dawFolders])

  const handleSyncFileDates = useCallback(async () => {
    try {
      const result = await window.electron?.updateFileModDates()
      const count = result?.count ?? 0
      await refreshData()
      addToast({
        title: "File dates synced",
        description: count > 0
          ? `Updated dates for ${count} projects`
          : "All file dates are already up to date",
        variant: "success",
      })
    } catch (error) {
      addToast({
        title: "Sync failed",
        description: "Could not update file modification dates",
        variant: "destructive",
      })
    }
  }, [addToast, refreshData])

  const handleSettingsChange = useCallback(async (newSettings: Partial<AppSettings>) => {
    await onSettingsChange(newSettings)
  }, [onSettingsChange])

  const handleUpdateGroup = useCallback(async (groupId: string, updates: Partial<ProjectGroup>) => {
    try {
      await window.electron?.updateGroup(groupId, updates)
      await refreshData()
    } catch (error) {
      console.error('Failed to update group:', error)
    }
  }, [refreshData])

  const handleCreateGroup = useCallback(async (name: string, description?: string, projectIds?: string[]) => {
    try {
      await window.electron?.createGroup({ name, description: description || null, artworkPath: null, projectIds: projectIds || [] })
      await refreshData()
    } catch (error) {
      console.error('Failed to create group:', error)
    }
  }, [refreshData])

  const handleDeleteGroup = useCallback(async (groupId: string) => {
    try {
      await window.electron?.deleteGroup(groupId)
      await refreshData()
      setCurrentPage("groups")
    } catch (error) {
      console.error('Failed to delete group:', error)
    }
  }, [refreshData])

  const handleCreateTag = useCallback(async (name: string, color?: string): Promise<Tag | null> => {
    try {
      const tagColor = color || '#8b5cf6';
      const newTag = await window.electron?.createTag({ name, color: tagColor });
      // Immediately add the new tag to state for instant UI update
      if (newTag) {
        setTags(prev => [...prev, newTag]);
      }
      return newTag || null;
    } catch (error) {
      console.error('Failed to create tag:', error);
      return null;
    }
  }, []);

  const handleDeleteTag = useCallback(async (id: string) => {
    try {
      await window.electron?.deleteTag(id);
      setTags(prev => prev.filter(t => t.id !== id));
    } catch (error) {
      console.error('Failed to delete tag:', error);
    }
  }, []);

  // Plugin handlers
  const handleLinkPlugin = useCallback(async (sessionId: string, projectId: string) => {
    if (!isElectron()) return
    try {
      await window.electron?.linkPluginToProject(sessionId, projectId)
      addToast({ title: "Plugin linked", description: "VST3 plugin linked to project" })
    } catch (error) {
      console.error("Failed to link plugin:", error)
      addToast({ title: "Failed to link plugin", description: String(error), variant: "destructive" })
    }
  }, [addToast])

  const handleUnlinkPlugin = useCallback(async (sessionId: string) => {
    if (!isElectron()) return
    try {
      await window.electron?.unlinkPluginFromProject(sessionId)
      addToast({ title: "Plugin unlinked", description: "VST3 plugin unlinked from project" })
    } catch (error) {
      console.error("Failed to unlink plugin:", error)
    }
  }, [addToast])

  const handleStartPluginRecording = useCallback(async (sessionId: string) => {
    if (!isElectron()) return
    try {
      await window.electron?.requestPluginStartRecording(sessionId)
    } catch (error) {
      console.error("Failed to start plugin recording:", error)
      addToast({ title: "Failed to start recording", description: String(error), variant: "destructive" })
    }
  }, [addToast])

  const handleStopPluginRecording = useCallback(async (sessionId: string) => {
    if (!isElectron()) return
    try {
      await window.electron?.requestPluginStopRecording(sessionId)
    } catch (error) {
      console.error("Failed to stop plugin recording:", error)
    }
  }, [addToast])

  const handleToggleOfflineCapture = useCallback((sessionId: string, enabled: boolean) => {
    // Update local state optimistically — the plugin will also receive the update
    setPluginSessions(prev => prev.map(s =>
      s.sessionId === sessionId ? { ...s, captureOfflineRenders: enabled } : s
    ))
    // TODO: send the preference to the plugin via WebSocket when backend supports it
    console.log("[Plugin] Toggle offline capture for session", sessionId, ":", enabled)
  }, [])

  const handleOpenGroup = useCallback((group: ProjectGroup) => {
    setSelectedGroup(group)
    setCurrentPage("group-detail")
  }, [])

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return (
          <Dashboard
            projects={projects}
            groups={groups}
            tags={tags}
            playerState={playerState}
            settings={settings}
            onPlay={playProject}
            onStop={() => setPlayerState(prev => ({ ...prev, isPlaying: false }))}
            onOpenDaw={handleOpenDaw}
            onGenerateArtwork={handleGenerateArtwork}
            onChangeArtwork={handleChangeArtwork}
            onRemoveArtwork={handleRemoveArtwork}
            onFetchUnsplashPhoto={handleFetchUnsplashPhoto}
            onFetchUnsplashPhotosForAll={handleFetchUnsplashPhotosForAll}
            onCancelBatchPhotos={handleCancelBatchPhotos}
            photoProgress={photoProgress}
            onDelete={handleDeleteProject}
            onRefresh={refreshData}
            onOpenProject={handleOpenProject}
            onCreateGroup={handleCreateGroup}
            onUpdateGroup={handleUpdateGroup}
            onSettingsChange={onSettingsChange}
            onOpenArtworkManager={handleOpenArtworkManager}
            pluginSessions={pluginSessions}
            onScanFolder={handleScanFolderWithSelection}
          />
        )
      case "project-detail":
        if (!selectedProject) {
          // If no project selected, go back to dashboard
          setCurrentPage("dashboard")
          return null
        }
        return (
          <ProjectDetail
            project={selectedProject}
            onBack={handleBackFromProject}
            onPlay={playProject}
            onOpenDaw={handleOpenDaw}
            onRefresh={refreshData}
            playerState={playerState}
            setPlayerState={setPlayerState}
            tags={tags}
            onCreateTag={handleCreateTag}
            onOpenArtworkManager={handleOpenArtworkManager}
            pluginSessions={pluginSessions}
            projects={projects}
            onLinkPlugin={handleLinkPlugin}
            onUnlinkPlugin={handleUnlinkPlugin}
            onStartPluginRecording={handleStartPluginRecording}
            onStopPluginRecording={handleStopPluginRecording}
            onToggleOfflineCapture={handleToggleOfflineCapture}
          />
        )
      case "groups":
        return <Groups
          groups={groups}
          projects={projects}
          settings={settings}
          onRefresh={refreshData}
          onOpenGroup={handleOpenGroup}
          onUpdateGroup={handleUpdateGroup}
          onDeleteGroup={handleDeleteGroup}
          onSettingsChange={onSettingsChange}
        />
      case "group-detail":
        if (!selectedGroup) {
          setCurrentPage("groups")
          return null
        }
        return (
          <GroupDetail
            group={groups.find(g => g.id === selectedGroup?.id) || selectedGroup!}
            projects={projects}
            tags={tags}
            settings={settings}
            onBack={() => setCurrentPage("groups")}
            onUpdateGroup={handleUpdateGroup}
            onDeleteGroup={handleDeleteGroup}
            onRefresh={refreshData}
            playerState={playerState}
            onPlayProject={playProject}
            onStopProject={() => setPlayerState(prev => ({ ...prev, isPlaying: false }))}
            onPlayerStateChange={setPlayerState}
            onOpenProject={handleOpenProject}
            onOpenDaw={handleOpenDaw}
            onGenerateArtwork={handleGenerateArtwork}
            onChangeArtwork={handleChangeArtwork}
            onRemoveArtwork={handleRemoveArtwork}
            onFetchUnsplashPhoto={handleFetchUnsplashPhoto}
            onDeleteProject={handleDeleteProject}
            onSettingsChange={onSettingsChange}
            onOpenArtworkManager={handleOpenArtworkManager}
            pluginSessions={pluginSessions}
          />
        )
      case "scheduler":
        return <Scheduler projects={projects} onRefresh={refreshData} settings={settings} tags={tags} onCreateTag={handleCreateTag} onOpenProject={handleOpenProject} />
      case "statistics":
        return <Statistics projects={projects} settings={settings} />
      case "settings":
        return <Settings
          onDatabaseCleared={handleDatabaseCleared}
          onRescan={handleRescan}
          onRefreshMetadata={handleRefreshMetadata}
          onSyncFileDates={handleSyncFileDates}
          settings={settings}
          onSettingsChange={handleSettingsChange}
          onRemoveAllArtwork={handleRemoveAllArtwork}
          tags={tags}
          onDeleteTag={handleDeleteTag}
          onCreateTag={handleCreateTag}
        />
      case "shared":
        return <SharedWithMe />
      case "help":
        return <HelpGuide
          onBack={() => setCurrentPage(previousPage === "help" ? "dashboard" : previousPage)}
          onStartTour={handleStartTour}
          settings={settings}
          onSettingsChange={onSettingsChange}
        />
      default:
        return null
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="relative">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-2xl"
              style={{
                background: `linear-gradient(135deg, ${settings.accentColor}, ${settings.accentColor}cc, ${settings.accentColor}99)`,
                boxShadow: `0 25px 50px -12px ${settings.accentColor}4d`
              }}
            >
              <span className="text-primary-foreground font-bold text-2xl">D</span>
            </div>
            <div
              className="absolute -inset-1 rounded-2xl blur-xl -z-10 animate-pulse"
              style={{
                background: `linear-gradient(135deg, ${settings.accentColor}4d, transparent)`
              }}
            />
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading your projects...</span>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <TitleBar className="flex-shrink-0" />
      <div className="flex-1 flex overflow-hidden min-h-0">
        <Navigation
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          onScanFolder={handleScanFolder}
          onScanFolderWithSelection={handleScanFolderWithSelection}
          scanProgress={scanProgress}
        />
        <main className="flex-1 flex flex-col overflow-hidden min-h-0">
          <div className="flex-1 flex flex-col overflow-auto">
            {renderPage()}
          </div>
        </main>
      </div>
      <AnimatePresence>
        {playerState.currentTrack && currentPage !== "project-detail" && (
          <AudioPlayer
            playerState={playerState}
            setPlayerState={setPlayerState}
            projects={projects}
            onOpenProject={handleOpenProject}
            onPlayProject={playProject}
          />
        )}
      </AnimatePresence>
      {artworkManagerProject && (
        <ArtworkManager
          project={artworkManagerProject}
          isOpen={!!artworkManagerProject}
          onClose={() => setArtworkManagerProject(null)}
          settings={settings}
          onChangeArtwork={handleChangeArtwork}
          onRemoveArtwork={handleRemoveArtwork}
          onGenerateArtwork={handleGenerateArtwork}
          onFetchUnsplashPhoto={handleFetchUnsplashPhoto}
          onRefresh={async () => {
            await refreshData()
            // Fetch the latest project data to update the dialog
            try {
              const updated = await window.electron?.getProject(artworkManagerProject.id)
              if (updated) setArtworkManagerProject(updated)
            } catch {}
          }}
        />
      )}
      <AppTour
        isOpen={showTour}
        onClose={handleCloseTour}
        onComplete={handleCompleteTour}
        currentPage={currentPage}
        onNavigate={setCurrentPage}
      />
    </div>
  )
}

function App() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)

  useEffect(() => {
    const loadSettings = async () => {
      if (isElectron()) {
        try {
          const rawSettings = await window.electron?.getSettings()
          if (rawSettings) {
            // Always merge with DEFAULT_SETTINGS so new fields (e.g. hasSeenTour) have their default
            const loadedSettings: AppSettings = { ...DEFAULT_SETTINGS, ...rawSettings }
            // Migrate legacy formats into dawFolders arrays
            if (loadedSettings.dawFolders) {
              const migrated = { ...loadedSettings.dawFolders }
              let needsMigration = false
              for (const [daw, val] of Object.entries(migrated)) {
                if (typeof val === 'string') {
                  (migrated as Record<string, string[]>)[daw] = [val]
                  needsMigration = true
                }
              }
              if (needsMigration) {
                loadedSettings.dawFolders = migrated as Record<string, string[]>
              }
            }
            // Migrate legacy flStudioPath into dawFolders if needed
            if (loadedSettings.flStudioPath && (!loadedSettings.dawFolders?.["FL Studio"] || loadedSettings.dawFolders["FL Studio"].length === 0)) {
              loadedSettings.dawFolders = {
                ...loadedSettings.dawFolders,
                "FL Studio": [loadedSettings.flStudioPath]
              }
            }
            if (loadedSettings.flStudioPath || Object.values(loadedSettings.dawFolders || {}).some(v => typeof v === 'string')) {
              // Persist the migration so it only happens once
              await window.electron?.setSettings(loadedSettings)
            }
            setSettings(loadedSettings)
          }
        } catch (error) {
          console.error("Failed to load settings:", error)
        }
      }
    }
    loadSettings()
  }, [])

  const handleSettingsChange = useCallback(async (newSettings: Partial<AppSettings>) => {
    let updatedSettings: AppSettings | null = null
    setSettings(prev => {
      updatedSettings = { ...prev, ...newSettings }
      return updatedSettings
    })

    if (isElectron() && updatedSettings) {
      try {
        await window.electron?.setSettings(updatedSettings)
      } catch (error) {
        console.error("Failed to save settings:", error)
      }
    }
  }, [])

  return (
    <ErrorBoundary>
      <ToastProvider>
        <I18nProvider language={settings.language || 'en'}>
          <ThemeProvider settings={settings} onSettingsChange={handleSettingsChange}>
            <TooltipProvider delayDuration={100}>
              <AppContent settings={settings} onSettingsChange={handleSettingsChange} />
            </TooltipProvider>
          </ThemeProvider>
        </I18nProvider>
      </ToastProvider>
    </ErrorBoundary>
  )
}

// Error boundary component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('React Error Boundary caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: 'white', background: '#1a1a1a', minHeight: '100vh' }}>
          <h1 style={{ color: 'red' }}>Something went wrong</h1>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#ff6b6b' }}>
            {this.state.error?.message}
          </pre>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#888', fontSize: 12 }}>
            {this.state.error?.stack}
          </pre>
        </div>
      )
    }

    return this.props.children
  }
}

export default App
