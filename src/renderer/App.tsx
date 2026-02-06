import React, { useState, useEffect, useCallback } from "react"
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
import { AudioPlayer } from "./components/AudioPlayer"
import { ToastProvider, useToast } from "./components/ui/toast"
import { ThemeProvider } from "./components/ThemeProvider"
import { TooltipProvider } from "./components/ui/tooltip"
import { Project, ProjectGroup, Task, Tag, AudioPlayerState, AppSettings } from "@shared/types"
import { DEFAULT_SETTINGS } from "@/lib/constants"

// Check if running in Electron - must be a function to check at runtime after preload
const isElectron = () => typeof window !== 'undefined' && typeof window.electron !== 'undefined'

type Page = "dashboard" | "groups" | "group-detail" | "scheduler" | "settings" | "statistics" | "project-detail"

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
  const [scanProgress, setScanProgress] = useState<{
    current: number;
    total: number;
    daw: string;
    file: string;
    isScanning: boolean;
  } | null>(null)

  const { addToast } = useToast()

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

    // Set up IPC listener for scan progress
    if (isElectron() && window.electron) {
      const handleScanProgress = (_: any, progress: any) => {
        setScanProgress({
          current: progress.current,
          total: progress.total,
          daw: progress.daw,
          file: progress.file,
          isScanning: progress.isScanning !== undefined ? progress.isScanning : true
        })
      }

      // Listen for scan progress updates
      window.electron.ipcRenderer.on('scan:progress', handleScanProgress)

      // Cleanup listener on unmount
      return () => {
        window.electron?.ipcRenderer.removeListener('scan:progress', handleScanProgress)
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
        // Get folder path - check both new dawFolders and legacy flStudioPath
        let folderPath = settings.dawFolders[daw]
        if (!folderPath && daw === "FL Studio") {
          folderPath = settings.flStudioPath
        }

        // Skip DAWs without configured folders (don't show error)
        if (!folderPath) {
          skippedDAWs.push(daw)
          continue
        }

        let result
        if (daw === "FL Studio") {
          result = await window.electron?.scanFLStudioFolder(folderPath)
        } else if (daw === "Ableton Live") {
          result = await window.electron?.scanAbletonFolder(folderPath)
        }

        if (result && result.count > 0) {
          totalScanned += result.count
          scannedDAWs.push(daw)
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
  }, [addToast, refreshData, settings.selectedDAWs, settings.dawFolders])

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

      // Determine which DAW this folder is for by checking file extensions
      let detectedDAW: string | null = null
      try {
        const detection = await window.electron?.detectProjects(folderPath) || { hasFLP: false, hasALS: false }
        const { hasFLP, hasALS } = detection

        if (hasFLP) detectedDAW = "FL Studio"
        else if (hasALS) detectedDAW = "Ableton Live"
      } catch (error) {
        // If we can't read the folder, default to FL Studio for backward compatibility
        detectedDAW = "FL Studio"
      }

      if (!detectedDAW) {
        addToast({
          title: "No project files detected",
          description: "The selected folder doesn't contain FL Studio (.flp) or Ableton (.als) files",
          variant: "destructive",
        })
        return
      }

      // Update settings with the selected folder for the detected DAW
      if (detectedDAW === "FL Studio") {
        await onSettingsChange({ flStudioPath: folderPath })
      } else {
        await onSettingsChange({
          dawFolders: {
            ...settings.dawFolders,
            [detectedDAW]: folderPath
          }
        })
      }

      addToast({
        title: "Scanning folder...",
        description: `Looking for ${detectedDAW} projects`,
      })

      let result
      if (detectedDAW === "FL Studio") {
        result = await window.electron?.scanFLStudioFolder(folderPath)
      } else if (detectedDAW === "Ableton Live") {
        result = await window.electron?.scanAbletonFolder(folderPath)
      }

      if (result && result.count > 0) {
        await refreshData()
        addToast({
          title: "Scan complete",
          description: `Added ${result.count} ${detectedDAW} projects`,
          variant: "success",
        })
      } else {
        addToast({
          title: "Project list is up to date",
          description: `No new ${detectedDAW} projects found in this folder`,
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
        // Wait a bit for the image to be fully loaded
        await new Promise(resolve => setTimeout(resolve, 500))
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
          // Wait a bit for the image to be fully loaded
          await new Promise(resolve => setTimeout(resolve, 300))
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
      // Find projects that don't have artwork
      const projectsWithoutArtwork = projects.filter(project => !project.artworkPath)

      if (projectsWithoutArtwork.length === 0) {
        addToast({
          title: "No projects need artwork",
          description: "All projects already have artwork assigned",
        })
        return
      }

      let successCount = 0
      let totalRetries = 0
      const maxRetriesPerProject = 8 // Increased to 8 attempts per project
      const totalProjects = projectsWithoutArtwork.length

      // Initial progress toast
      addToast({
        title: "Fetching photos...",
        description: `Starting to get random Unsplash photos for ${totalProjects} projects (0/${totalProjects})`,
      })

      // Process projects one by one with retry logic and live updates
      for (let i = 0; i < projectsWithoutArtwork.length; i++) {
        const project = projectsWithoutArtwork[i]
        let projectSuccess = false
        let projectRetries = 0

        while (!projectSuccess && projectRetries < maxRetriesPerProject) {
          try {
            const artworkPath = await window.electron?.fetchUnsplashPhoto(project.id)
            if (artworkPath) {
              projectSuccess = true
              successCount++

              // Immediately refresh data so the photo appears in real-time
              await refreshData()

              // Update progress toast
              addToast({
                title: "Fetching photos...",
                description: `Successfully added artwork to "${project.title}" (${successCount}/${totalProjects})${totalRetries > 0 ? ` • ${totalRetries} retries used` : ''}`,
                variant: "success",
              })
            } else {
              projectRetries++
              totalRetries++
            }
            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 300))
          } catch (error) {
            projectRetries++
            totalRetries++
            console.error(`Failed to fetch photo for project ${project.title} (attempt ${projectRetries}):`, error)

            // Show retry progress for failed attempts (less frequent)
            if (projectRetries < maxRetriesPerProject && projectRetries % 3 === 0) {
              addToast({
                title: "Retrying...",
                description: `Attempt ${projectRetries + 1}/${maxRetriesPerProject} for "${project.title}" (${successCount}/${totalProjects})`,
              })
            }

            // Small delay before retry
            await new Promise(resolve => setTimeout(resolve, 800))
          }
        }

        if (!projectSuccess) {
          console.error(`Failed to fetch photo for project ${project.title} after ${maxRetriesPerProject} attempts`)
          // Show failure for this specific project
          addToast({
            title: "Photo fetch failed",
            description: `Could not find suitable artwork for "${project.title}" after ${maxRetriesPerProject} attempts`,
            variant: "destructive",
          })
        }
      }

      // Final summary toast
      if (successCount > 0) {
        addToast({
          title: "Bulk photo fetch complete!",
          description: `Successfully added artwork to ${successCount}/${totalProjects} projects${totalRetries > 0 ? ` (${totalRetries} total retries used)` : ''}`,
          variant: "success",
        })
      } else {
        addToast({
          title: "Bulk fetch failed",
          description: "Could not fetch photos for any projects. Please check your internet connection.",
          variant: "destructive",
        })
      }
    } catch (error) {
      addToast({
        title: "Bulk fetch failed",
        description: "Could not complete the bulk photo fetching operation",
        variant: "destructive",
      })
    }
  }, [addToast, refreshData, projects])

  const handleChangeArtwork = useCallback(async (project: Project) => {
    try {
      const imagePath = await window.electron?.selectImage()
      if (imagePath) {
        await window.electron?.updateProject(project.id, { artworkPath: imagePath })
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
    const existingProject = projects.find(p => p.id === project.id)
    if (existingProject) {
      setSelectedProject(existingProject)
    } else {
      setSelectedProject(project)
    }
    // Remember where we came from
    setPreviousPage(currentPage as Page)
    setCurrentPage("project-detail")
  }, [projects, currentPage])

  const handleBackFromProject = useCallback(() => {
    setSelectedProject(null)
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

  const handleCreateTag = useCallback(async (name: string): Promise<Tag | null> => {
    try {
      // Generate a random color for the tag
      const colors = ['#8b5cf6', '#3b82f6', '#06b6d4', '#22c55e', '#eab308', '#f97316', '#ef4444', '#ec4899'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      const newTag = await window.electron?.createTag({ name, color });
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
            onOpenDaw={handleOpenDaw}
            onGenerateArtwork={handleGenerateArtwork}
            onChangeArtwork={handleChangeArtwork}
            onRemoveArtwork={handleRemoveArtwork}
            onFetchUnsplashPhoto={handleFetchUnsplashPhoto}
            onFetchUnsplashPhotosForAll={handleFetchUnsplashPhotosForAll}
            onDelete={handleDeleteProject}
            onRefresh={refreshData}
            onOpenProject={handleOpenProject}
            onCreateGroup={handleCreateGroup}
            onUpdateGroup={handleUpdateGroup}
            onSettingsChange={onSettingsChange}
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
          />
        )
      case "scheduler":
        return <Scheduler projects={projects} onRefresh={refreshData} settings={settings} tags={tags} onCreateTag={handleCreateTag} onOpenProject={handleOpenProject} />
      case "statistics":
        return <Statistics projects={projects} settings={settings} />
      case "settings":
        return <Settings
          onDatabaseCleared={handleDatabaseCleared}
          settings={settings}
          onSettingsChange={handleSettingsChange}
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
        {playerState.currentTrack && (
          <AudioPlayer
            playerState={playerState}
            setPlayerState={setPlayerState}
            projects={projects}
            onOpenProject={handleOpenProject}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function App() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)

  useEffect(() => {
    const loadSettings = async () => {
      if (isElectron()) {
        try {
          const loadedSettings = await window.electron?.getSettings()
          if (loadedSettings) {
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
    const updatedSettings = { ...settings, ...newSettings }
    setSettings(updatedSettings)

    if (isElectron()) {
      try {
        await window.electron?.setSettings(updatedSettings)
      } catch (error) {
        console.error("Failed to save settings:", error)
      }
    }
  }, [settings])

  return (
    <ErrorBoundary>
      <ToastProvider>
        <ThemeProvider settings={settings} onSettingsChange={handleSettingsChange}>
          <TooltipProvider delayDuration={100}>
            <AppContent settings={settings} onSettingsChange={handleSettingsChange} />
          </TooltipProvider>
        </ThemeProvider>
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
