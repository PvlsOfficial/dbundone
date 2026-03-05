import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { convertFileSrc } from "@tauri-apps/api/core";
import type {
  Project,
  ProjectGroup,
  Task,
  Tag,
  AppSettings,
  AudioVersion,
  Annotation,
  ArtworkHistoryEntry,
  PluginSession,
  PluginEvent,
  FlpAnalysis,
  UserProfile,
  ProjectShare,
  OnboardingState,
} from "@shared/types";

// ============ Projects ============
export const getProjects = (): Promise<Project[]> =>
  invoke("get_projects");

export const getProject = (id: string): Promise<Project | null> =>
  invoke("get_project", { id });

export const createProject = (
  project: Omit<Project, "id"> & { createdAt?: string; updatedAt?: string }
): Promise<Project> => invoke("create_project", { project });

export const updateProject = (
  id: string,
  project: Partial<Project>
): Promise<Project | null> => invoke("update_project", { id, project });

export const deleteProject = (id: string): Promise<boolean> =>
  invoke("delete_project", { id });

// ============ Groups ============
export const getGroups = (): Promise<ProjectGroup[]> =>
  invoke("get_groups");

export const getGroup = (id: string): Promise<ProjectGroup | null> =>
  invoke("get_group", { id });

export const createGroup = (
  group: Omit<ProjectGroup, "id" | "createdAt" | "updatedAt">
): Promise<ProjectGroup> => invoke("create_group", { group });

export const updateGroup = (
  id: string,
  group: Partial<ProjectGroup>
): Promise<ProjectGroup | null> => invoke("update_group", { id, group });

export const deleteGroup = (id: string): Promise<boolean> =>
  invoke("delete_group", { id });

// ============ Tasks ============
export const getTasks = (): Promise<Task[]> => invoke("get_tasks");

export const getTasksByProject = (projectId: string): Promise<Task[]> =>
  invoke("get_tasks_by_project", { projectId });

export const createTask = (
  task: Omit<Task, "id" | "createdAt" | "updatedAt">
): Promise<Task> => invoke("create_task", { task });

export const updateTask = (
  id: string,
  task: Partial<Task>
): Promise<Task | null> => invoke("update_task", { id, task });

export const deleteTask = (id: string): Promise<boolean> =>
  invoke("delete_task", { id });

export const reorderTasks = (
  tasks: { id: string; order: number; status: Task["status"] }[]
): Promise<boolean> => invoke("reorder_tasks", { tasks });

export const reorderProjects = (
  projects: { id: string; sortOrder: number }[]
): Promise<boolean> => invoke("reorder_projects", { projects });

// ============ Tags ============
export const getTags = (): Promise<Tag[]> => invoke("get_tags");

export const createTag = (tag: Omit<Tag, "id">): Promise<Tag> =>
  invoke("create_tag", { tag });

export const deleteTag = (id: string): Promise<boolean> =>
  invoke("delete_tag", { id });

// ============ Audio Versions ============
export const getVersionsByProject = (
  projectId: string
): Promise<AudioVersion[]> =>
  invoke("get_versions_by_project", { projectId });

export const getAudioVersion = (id: string): Promise<AudioVersion | null> =>
  invoke("get_version", { id });

export const createVersion = (
  version: Omit<AudioVersion, "id" | "createdAt" | "versionNumber">
): Promise<AudioVersion> => invoke("create_version", { version });

export const updateVersion = (
  id: string,
  version: Partial<AudioVersion>
): Promise<AudioVersion | null> =>
  invoke("update_version", { id, version });

export const deleteVersion = (id: string): Promise<boolean> =>
  invoke("delete_version", { id });

export const getProjectVersionSources = (): Promise<Record<string, string[]>> =>
  invoke("get_project_version_sources");

// ============ Annotations ============
export const getAnnotationsByVersion = (
  versionId: string
): Promise<Annotation[]> =>
  invoke("get_annotations_by_version", { versionId });

export const createAnnotation = (
  annotation: Omit<Annotation, "id" | "createdAt" | "updatedAt">
): Promise<Annotation> => invoke("create_annotation", { annotation });

export const updateAnnotation = (
  id: string,
  annotation: Partial<Annotation>
): Promise<Annotation | null> =>
  invoke("update_annotation", { id, annotation });

export const deleteAnnotation = (id: string): Promise<boolean> =>
  invoke("delete_annotation", { id });

// ============ File Operations ============
export const selectImage = async (): Promise<string | null> => {
  const result = await open({
    multiple: false,
    filters: [
      {
        name: "Images",
        extensions: ["jpg", "jpeg", "png", "gif", "webp", "svg"],
      },
    ],
  });
  return result ?? null;
};

export const selectAudio = async (defaultPath?: string): Promise<string | null> => {
  const result = await open({
    multiple: false,
    defaultPath: defaultPath || undefined,
    filters: [
      {
        name: "Audio",
        extensions: ["mp3", "wav", "flac", "ogg", "m4a", "aac"],
      },
    ],
  });
  return result ?? null;
};

export const selectProject = async (): Promise<string | null> => {
  const result = await open({
    multiple: false,
    filters: [
      {
        name: "DAW Projects",
        extensions: ["als", "flp", "logic", "ptx", "cpr", "rpp", "aup", "zip"],
      },
      { name: "All Files", extensions: ["*"] },
    ],
  });
  return result ?? null;
};

export const selectFolder = async (): Promise<string | null> => {
  const result = await open({
    directory: true,
    multiple: false,
  });
  return result ?? null;
};

export const readDir = (folderPath: string): Promise<string[]> =>
  invoke("read_dir_contents", { folderPath });

/** Scan sample root folders and return folder→children map (3 levels deep) */
export const scanSampleTree = (roots: string[]): Promise<Record<string, string[]>> =>
  invoke("scan_sample_tree", { roots });

export const detectProjects = (
  folderPath: string
): Promise<{ hasFLP: boolean; hasALS: boolean; detectedDAWs: string[] }> =>
  invoke("detect_projects", { folderPath });

export const openInDaw = (
  filePath: string
): Promise<{ success: boolean; error?: string }> =>
  invoke("open_in_daw", { filePath });

export const openFolder = (
  folderPath: string
): Promise<{ success: boolean; error?: string }> =>
  invoke("open_folder", { folderPath });

export const loadAudioFile = async (
  filePath: string
): Promise<ArrayBuffer> => {
  const data: number[] = await invoke("load_audio_file", { filePath });
  return new Uint8Array(data).buffer;
};

export const computeAudioPeaks = (
  filePath: string,
  numPeaks: number = 200
): Promise<number[]> =>
  invoke("compute_audio_peaks", { filePath, numPeaks });

export const getCachedPeaks = (
  filePath: string,
  numPeaks: number = 200
): Promise<number[] | null> =>
  invoke("get_cached_peaks", { filePath, numPeaks });

// ============ Scanning ============
export const scanFLStudioFolder = (
  folderPath: string
): Promise<{ count: number; updated?: number }> =>
  invoke("scan_fl_folder", { folderPath });

export const scanAbletonFolder = (
  folderPath: string
): Promise<{ count: number }> =>
  invoke("scan_ableton_folder", { folderPath });

/** Generic scan for any DAW (Logic Pro, Pro Tools, Cubase, Studio One, etc.) */
export const scanDAWFolder = (
  folderPath: string,
  dawName: string
): Promise<{ count: number }> =>
  invoke("scan_daw_folder", { folderPath, dawName });

export const updateFileModDates = (): Promise<{ count: number }> =>
  invoke("update_file_mod_dates");

export const updateDawTypes = (): Promise<{ count: number }> =>
  invoke("update_daw_types");

// ============ Metadata ============
export const extractFlpMetadata = (filePath: string): Promise<any> =>
  invoke("extract_flp_metadata", { filePath });

export const extractFlpMetadataBatch = (
  filePaths: string[]
): Promise<{
  success: boolean;
  metadata: Record<string, any>;
  error?: string;
}> => invoke("extract_flp_metadata_batch", { filePaths });

// ============ AI Artwork ============
export const generateArtwork = (
  projectId: string,
  projectTitle: string
): Promise<string | null> =>
  invoke("generate_artwork", { projectId, projectTitle });

export const fetchUnsplashPhoto = (
  projectId: string
): Promise<string | null> =>
  invoke("fetch_unsplash_photo", { projectId });

// ============ Batch Photo Operations ============
export const batchFetchPhotos = (): Promise<{
  success: boolean;
  added: number;
  total: number;
  cancelled: boolean;
}> => invoke("batch_fetch_photos");

export const cancelBatchPhotos = (): Promise<boolean> =>
  invoke("cancel_batch_photos");

export const removeAllArtwork = (): Promise<{
  success: boolean;
  cleared: number;
  filesDeleted: number;
}> => invoke("remove_all_artwork");

export const onPhotoProgress = (
  callback: (payload: any) => void
): Promise<UnlistenFn> => {
  return listen("photo-progress", (event) => {
    callback(event.payload);
  });
};

// ============ Artwork History ============
export const getArtworkHistory = (
  projectId: string
): Promise<ArtworkHistoryEntry[]> =>
  invoke("get_artwork_history", { projectId });

export const addArtworkHistoryEntry = (
  projectId: string,
  filePath: string,
  source: string
): Promise<ArtworkHistoryEntry> =>
  invoke("add_artwork_history_entry", { projectId, filePath, source });

export const deleteArtworkHistoryEntry = (
  id: string
): Promise<boolean> =>
  invoke("delete_artwork_history_entry", { id });

export const setArtworkFromHistory = (
  projectId: string,
  filePath: string
): Promise<Project> =>
  invoke("set_artwork_from_history", { projectId, filePath });

// ============ Plugin Sessions ============
export const getPluginSessions = (): Promise<PluginSession[]> =>
  invoke("get_plugin_sessions");

export const getPluginSessionsForProject = (
  projectId: string
): Promise<PluginSession[]> =>
  invoke("get_plugin_sessions_for_project", { projectId });

export const linkPluginToProject = (
  sessionId: string,
  projectId: string
): Promise<boolean> =>
  invoke("link_plugin_to_project", { sessionId, projectId });

export const unlinkPluginFromProject = (
  sessionId: string
): Promise<boolean> =>
  invoke("unlink_plugin_from_project", { sessionId });

export const requestPluginStartRecording = (
  sessionId: string
): Promise<boolean> =>
  invoke("request_plugin_start_recording", { sessionId });

export const requestPluginStopRecording = (
  sessionId: string
): Promise<boolean> =>
  invoke("request_plugin_stop_recording", { sessionId });

export const getPluginServerPort = (): Promise<number> =>
  invoke("get_plugin_server_port");

export const sendProjectListToPlugin = (
  sessionId: string
): Promise<boolean> =>
  invoke("send_project_list_to_plugin", { sessionId });

export const importPluginRecording = (
  sessionId: string,
  projectId: string,
  sourceFilePath: string,
  name: string,
  source?: string,
  peakDb?: number | null,
  rmsDb?: number | null
): Promise<AudioVersion> =>
  invoke("import_plugin_recording", {
    sessionId,
    projectId,
    sourceFilePath,
    name,
    source: source || "auto",
    peakDb: peakDb ?? null,
    rmsDb: rmsDb ?? null,
  });

export const onPluginEvent = (
  callback: (payload: PluginEvent) => void
): Promise<UnlistenFn> => {
  return listen("plugin-event", (event) => {
    callback(event.payload as PluginEvent);
  });
};

// ============ Recordings Management ============
export const deleteProjectRecordings = (
  projectId: string
): Promise<{ success: boolean; versionsDeleted: number; filesDeleted: number }> =>
  invoke("delete_project_recordings", { projectId });

export const deleteAllRecordings = (): Promise<{
  success: boolean;
  versionsDeleted: number;
  filesDeleted: number;
}> => invoke("delete_all_recordings");

// ============ Audio Analysis ============
export interface AudioAnalysis {
  sampleRate: number
  channels: number
  durationSecs: number
  windowSizeMs: number
  hopSizeMs: number
  frames: Array<{ time: number; rmsDb: number; peakDb: number }>
  peakDb: number
  rmsDb: number
  lufsIntegrated: number
}

export const analyzeAudioVersion = (
  versionId: string
): Promise<AudioAnalysis> =>
  invoke("analyze_audio_version", { versionId });

export const getAudioAnalysis = (
  versionId: string
): Promise<AudioAnalysis | null> =>
  invoke("get_audio_analysis", { versionId });

// ============ FLP Analysis (Extended) ============
export const analyzeFlpProject = (
  projectId: string,
  filePath: string
): Promise<FlpAnalysis> =>
  invoke("analyze_flp_project", { projectId, filePath });

export const clearFlpAnalysisCache = (
  projectId: string
): Promise<boolean> =>
  invoke("clear_flp_analysis_cache", { projectId });

// ============ User Profile ============
export const getUserProfile = (): Promise<UserProfile> =>
  invoke("get_user_profile");

export const updateUserProfile = (
  profile: Partial<UserProfile>
): Promise<UserProfile> =>
  invoke("update_user_profile", { profile });

// ============ Collaboration / Shares ============
export const createProjectShare = (
  projectId: string,
  permissions?: string,
  message?: string
): Promise<ProjectShare> =>
  invoke("create_project_share", { projectId, permissions, message });

export const getProjectShares = (
  projectId: string
): Promise<ProjectShare[]> =>
  invoke("get_project_shares", { projectId });

export const deleteProjectShare = (
  id: string
): Promise<boolean> =>
  invoke("delete_project_share", { id });

// ============ Onboarding ============
export const getOnboardingState = (): Promise<OnboardingState> =>
  invoke("get_onboarding_state");

export const updateOnboardingState = (
  state: Partial<OnboardingState>
): Promise<boolean> =>
  invoke("update_onboarding_state", { state });

// ============ Annotation-Task Conversion ============
export const convertAnnotationToTask = (
  annotationId: string
): Promise<Annotation> =>
  invoke("convert_annotation_to_task", { annotationId });

export const unconvertAnnotationFromTask = (
  annotationId: string
): Promise<Annotation> =>
  invoke("unconvert_annotation_from_task", { annotationId });

export const updateAnnotationTask = (
  annotationId: string,
  data: { taskStatus?: string; taskPriority?: string; taskDueDate?: string | null }
): Promise<Annotation> =>
  invoke("update_annotation_task", { annotationId, data });

export const getTaskAnnotationsByProject = (
  projectId: string
): Promise<Annotation[]> =>
  invoke("get_task_annotations_by_project", { projectId });

// ============ Screenshot ============
export const captureWindowScreenshot = (
  windowTitle: string
): Promise<string> =>
  invoke("capture_window_screenshot", { windowTitle });

// ============ Settings ============
export const getSettings = (): Promise<AppSettings> =>
  invoke("get_settings");

export const setSettings = (
  settings: Partial<AppSettings>
): Promise<boolean> => invoke("set_settings", { settings });

// ============ Database ============
export const clearAllProjects = (): Promise<number> =>
  invoke("clear_all_projects");

// ============ App Operations ============
export const getAppVersion = (): Promise<string> =>
  invoke("get_app_version");

export const minimizeWindow = () => {
  getCurrentWindow().minimize().catch(console.error);
};

export const maximizeWindow = () => {
  getCurrentWindow().toggleMaximize().catch(console.error);
};

export const closeWindow = () => {
  getCurrentWindow().close().catch(console.error);
};

// ============ Event Listening (replaces ipcRenderer.on) ============
export const onScanProgress = (
  callback: (payload: any) => void
): Promise<UnlistenFn> => {
  return listen("scan-progress", (event) => {
    callback(event.payload);
  });
};

// ============ File Protocol ============
// Convert local file paths to asset URLs for the webview
// This replaces the Electron appfile:// protocol
export const getAssetUrl = (filePath: string): string => {
  if (!filePath) return "";
  return convertFileSrc(filePath);
};

// ============ Compatibility Layer ============
// Expose as window.electron for backward compatibility
// This allows existing component code to work with minimal changes
export const electronCompat = {
  // Projects
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,

  // Groups
  getGroups,
  getGroup,
  createGroup,
  updateGroup,
  deleteGroup,

  // Tasks
  getTasks,
  getTasksByProject,
  createTask,
  updateTask,
  deleteTask,
  reorderTasks,
  reorderProjects,

  // Tags
  getTags,
  createTag,
  deleteTag,

  // Audio Versions
  getVersionsByProject,
  getAudioVersion,
  createVersion,
  updateVersion,
  deleteVersion,
  getProjectVersionSources,

  // Annotations
  getAnnotationsByVersion,
  createAnnotation,
  updateAnnotation,
  deleteAnnotation,

  // File operations
  selectImage,
  selectAudio,
  selectProject,
  selectFolder,
  readDir,
  scanSampleTree,
  detectProjects,
  openInDaw,
  openFolder,
  loadAudioFile,
  computeAudioPeaks,
  getCachedPeaks,

  // Scanning
  scanFLStudioFolder,
  scanAbletonFolder,
  scanDAWFolder,
  updateFileModDates,
  updateDawTypes,

  // AI
  generateArtwork,
  fetchUnsplashPhoto,

  // Metadata
  extractFlpMetadata,
  extractFlpMetadataBatch,
  testExtractMetadata: extractFlpMetadata,

  // Batch photo operations
  batchFetchPhotos,
  cancelBatchPhotos,
  removeAllArtwork,

  // Artwork history
  getArtworkHistory,
  addArtworkHistoryEntry,
  deleteArtworkHistoryEntry,
  setArtworkFromHistory,

  // Plugin sessions
  getPluginSessions,
  getPluginSessionsForProject,
  linkPluginToProject,
  unlinkPluginFromProject,
  requestPluginStartRecording,
  requestPluginStopRecording,
  getPluginServerPort,
  sendProjectListToPlugin,
  importPluginRecording,
  onPluginEvent,

  // Recordings management
  deleteProjectRecordings,
  deleteAllRecordings,

  // Audio Analysis
  analyzeAudioVersion,
  getAudioAnalysis,

  // FLP Analysis
  analyzeFlpProject,
  clearFlpAnalysisCache,

  // User Profile
  getUserProfile,
  updateUserProfile,

  // Collaboration
  createProjectShare,
  getProjectShares,
  deleteProjectShare,

  // Onboarding
  getOnboardingState,
  updateOnboardingState,

  // Annotation-Task
  convertAnnotationToTask,
  unconvertAnnotationFromTask,
  updateAnnotationTask,
  getTaskAnnotationsByProject,

  // Screenshot
  captureWindowScreenshot,

  // Settings
  getSettings,
  setSettings,

  // Database
  clearAllProjects,

  // App operations
  getAppVersion,
  minimizeWindow,
  maximizeWindow,
  closeWindow,

  // Event handling - bridge for scan progress
  ipcRenderer: {
    on: (channel: string, listener: (...args: any[]) => void) => {
      if (channel === "scan:progress") {
        listen("scan-progress", (event) => {
          listener(null, event.payload);
        });
      }
    },
    removeListener: (_channel: string, _listener: (...args: any[]) => void) => {
      // Tauri listeners are cleaned up via unlisten functions
      // For compatibility, this is a no-op - actual cleanup happens via React effects
    },
  },
};
