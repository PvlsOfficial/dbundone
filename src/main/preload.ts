import { contextBridge, ipcRenderer } from "electron"
import { IPC_CHANNELS, Project, ProjectGroup, Task, Tag, AppSettings, AudioVersion, Annotation } from "../shared/types"

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
try {
  contextBridge.exposeInMainWorld("electron", {
  // Projects
  getProjects: () => ipcRenderer.invoke(IPC_CHANNELS.DB_GET_PROJECTS),
  getProject: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.DB_GET_PROJECT, id),
  createProject: (project: Omit<Project, "id"> & { createdAt?: string; updatedAt?: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.DB_CREATE_PROJECT, project),
  updateProject: (id: string, project: Partial<Project>) =>
    ipcRenderer.invoke(IPC_CHANNELS.DB_UPDATE_PROJECT, id, project),
  deleteProject: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.DB_DELETE_PROJECT, id),

  // Groups
  getGroups: () => ipcRenderer.invoke(IPC_CHANNELS.DB_GET_GROUPS),
  getGroup: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.DB_GET_GROUP, id),
  createGroup: (group: Omit<ProjectGroup, "id" | "createdAt" | "updatedAt">) =>
    ipcRenderer.invoke(IPC_CHANNELS.DB_CREATE_GROUP, group),
  updateGroup: (id: string, group: Partial<ProjectGroup>) =>
    ipcRenderer.invoke(IPC_CHANNELS.DB_UPDATE_GROUP, id, group),
  deleteGroup: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.DB_DELETE_GROUP, id),

  // Tasks
  getTasks: () => ipcRenderer.invoke(IPC_CHANNELS.DB_GET_TASKS),
  getTasksByProject: (projectId: string) => ipcRenderer.invoke(IPC_CHANNELS.DB_GET_TASKS_BY_PROJECT, projectId),
  createTask: (task: Omit<Task, "id" | "createdAt" | "updatedAt">) =>
    ipcRenderer.invoke(IPC_CHANNELS.DB_CREATE_TASK, task),
  updateTask: (id: string, task: Partial<Task>) =>
    ipcRenderer.invoke(IPC_CHANNELS.DB_UPDATE_TASK, id, task),
  deleteTask: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.DB_DELETE_TASK, id),
  reorderTasks: (tasks: { id: string; order: number; status: Task["status"] }[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.DB_REORDER_TASKS, tasks),

  // Tags
  getTags: () => ipcRenderer.invoke(IPC_CHANNELS.DB_GET_TAGS),
  createTag: (tag: Omit<Tag, "id">) => ipcRenderer.invoke(IPC_CHANNELS.DB_CREATE_TAG, tag),
  deleteTag: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.DB_DELETE_TAG, id),

  // File operations
  selectImage: () => ipcRenderer.invoke(IPC_CHANNELS.FILE_SELECT_IMAGE),
  selectAudio: () => ipcRenderer.invoke(IPC_CHANNELS.FILE_SELECT_AUDIO),
  selectProject: () => ipcRenderer.invoke(IPC_CHANNELS.FILE_SELECT_PROJECT),
  selectFolder: () => ipcRenderer.invoke(IPC_CHANNELS.FILE_SELECT_FOLDER),
  readDir: (folderPath: string) => ipcRenderer.invoke(IPC_CHANNELS.FILE_READ_DIR, folderPath),
  detectProjects: (folderPath: string) => ipcRenderer.invoke(IPC_CHANNELS.FILE_DETECT_PROJECTS, folderPath),
  openInDaw: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.FILE_OPEN_IN_DAW, filePath),
  openFolder: (folderPath: string) => ipcRenderer.invoke(IPC_CHANNELS.FILE_OPEN_FOLDER, folderPath),

  // Audio file loading
  loadAudioFile: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.FILE_LOAD_AUDIO, filePath),

  // FL Studio scanning
  scanFLStudioFolder: (folderPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SCAN_FL_FOLDER, folderPath),
  // Ableton scanning
  scanAbletonFolder: (folderPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SCAN_ABLETON_FOLDER, folderPath),
  updateFileModDates: () =>
    ipcRenderer.invoke(IPC_CHANNELS.UPDATE_FILE_MOD_DATES),
  updateDawTypes: () =>
    ipcRenderer.invoke("update-daw-types"),

  // AI artwork generation (Ollama)
  generateArtwork: (projectId: string, projectTitle: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.GENERATE_ARTWORK, projectId, projectTitle),

  // Test metadata extraction
  testExtractMetadata: (flpPath: string) =>
    ipcRenderer.invoke('test-extract-metadata', flpPath),

  // Unsplash random photo
  fetchUnsplashPhoto: (projectId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.FETCH_UNSPLASH_PHOTO, projectId),

  // FLP metadata extraction (single file)
  extractFlpMetadata: (filePath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.EXTRACT_FLP_METADATA, filePath),
  
  // FLP metadata extraction (batch - much faster for multiple files)
  extractFlpMetadataBatch: (filePaths: string[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.EXTRACT_FLP_METADATA_BATCH, filePaths),

  // Settings
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
  setSettings: (settings: Partial<AppSettings>) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, settings),

  // Database management
  clearAllProjects: () => ipcRenderer.invoke(IPC_CHANNELS.DB_CLEAR_ALL_PROJECTS),

  // Audio Versions
  getVersionsByProject: (projectId: string) => ipcRenderer.invoke(IPC_CHANNELS.DB_GET_VERSIONS, projectId),
  getAudioVersion: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.DB_GET_VERSION, id),
  createVersion: (version: Omit<AudioVersion, 'id' | 'createdAt' | 'versionNumber'>) =>
    ipcRenderer.invoke(IPC_CHANNELS.DB_CREATE_VERSION, version),
  updateVersion: (id: string, version: Partial<AudioVersion>) =>
    ipcRenderer.invoke(IPC_CHANNELS.DB_UPDATE_VERSION, id, version),
  deleteVersion: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.DB_DELETE_VERSION, id),

  // Annotations
  getAnnotationsByVersion: (versionId: string) => ipcRenderer.invoke(IPC_CHANNELS.DB_GET_ANNOTATIONS, versionId),
  createAnnotation: (annotation: Omit<Annotation, 'id' | 'createdAt' | 'updatedAt'>) =>
    ipcRenderer.invoke(IPC_CHANNELS.DB_CREATE_ANNOTATION, annotation),
  updateAnnotation: (id: string, annotation: Partial<Annotation>) =>
    ipcRenderer.invoke(IPC_CHANNELS.DB_UPDATE_ANNOTATION, id, annotation),
  deleteAnnotation: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.DB_DELETE_ANNOTATION, id),

  // Audio waveform analysis
  getWaveformPeaks: (filePath: string, numPeaks?: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.AUDIO_GET_WAVEFORM_PEAKS, filePath, numPeaks),

  // App operations
  getAppVersion: () => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_VERSION),
  minimizeWindow: () => ipcRenderer.send(IPC_CHANNELS.APP_MINIMIZE),
  maximizeWindow: () => ipcRenderer.send(IPC_CHANNELS.APP_MAXIMIZE),
  closeWindow: () => ipcRenderer.send(IPC_CHANNELS.APP_CLOSE),

  // IPC renderer for listening to events
  ipcRenderer: {
    on: (channel: string, listener: (...args: any[]) => void) => ipcRenderer.on(channel, listener),
    removeListener: (channel: string, listener: (...args: any[]) => void) => ipcRenderer.removeListener(channel, listener),
  },

  // Generic invoke method for dynamic IPC calls
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
  })
} catch (error) {
  console.error("[DBundone] Preload script error:", error)
}
