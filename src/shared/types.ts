// Shared type definitions for the application

export type ProjectStatus = "idea" | "in-progress" | "mixing" | "mastering" | "completed" | "released" | "archived"

export interface Project {
  id: string
  title: string
  artworkPath: string | null
  audioPreviewPath: string | null
  dawProjectPath: string | null
  dawType: string | null
  bpm: number
  musicalKey: string
  tags: string[]
  collectionName: string | null
  status: ProjectStatus
  favoriteVersionId: string | null
  createdAt: string
  updatedAt: string
  fileModifiedAt: string | null
  archived: boolean
  timeSpent?: number | null // in minutes, for time tracking
  genre?: string | null
  artists?: string | null
  sortOrder: number
  shareCount?: number
  pluginLinked?: boolean
}

// Audio version source types
export type AudioVersionSource = "manual" | "auto" | "offline" | "export"

// Audio Version for version control
export interface AudioVersion {
  id: string
  projectId: string
  name: string
  filePath: string
  notes: string | null
  source: AudioVersionSource
  versionNumber: number
  createdAt: string
  peakDb?: number | null
  rmsDb?: number | null
  lufsIntegrated?: number | null
  analysisPath?: string | null
}

// Annotation for audio timestamps
export interface Annotation {
  id: string
  versionId: string
  timestamp: number // in seconds
  text: string
  color: string
  createdAt: string
  updatedAt: string
  // Task extension
  isTask?: boolean
  taskStatus?: "todo" | "in-progress" | "done" | null
  taskPriority?: "low" | "medium" | "high" | "urgent" | null
  taskDueDate?: string | null
}

export interface ProjectGroup {
  id: string
  name: string
  artworkPath: string | null
  description: string | null
  projectIds: string[]
  createdAt: string
  updatedAt: string
}

export interface Task {
  id: string
  title: string
  description: string | null
  status: "todo" | "in-progress" | "done"
  dueDate: string | null
  order: number
  projectId?: string | null
  createdAt: string
  updatedAt: string
  // Pro features for individual productivity
  priority?: "low" | "medium" | "high" | "urgent"
  tags?: string[]
  estimatedHours?: number | null
  actualHours?: number | null
  timeSpent?: number | null // in minutes, for time tracking
  subtasks?: Subtask[]
  comments?: TaskComment[]
  attachments?: TaskAttachment[]
  dependencies?: string[] // Task IDs this task depends on
  blocked?: boolean
  blockedReason?: string | null
  templateId?: string | null // For task templates
  recurring?: RecurringTask | null
  archived?: boolean
  progress?: number // 0-100 percentage
  customFields?: Record<string, any>
  groupBy?: string | null // For custom grouping
}

export interface Subtask {
  id: string
  title: string
  completed: boolean
  createdAt: string
}

export interface TaskComment {
  id: string
  author: string
  content: string
  createdAt: string
  updatedAt?: string
}

export interface TaskAttachment {
  id: string
  filename: string
  filePath: string
  fileType: string // 'audio', 'image', 'document', etc.
  uploadedAt: string
}

export interface RecurringTask {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
  interval: number // every X days/weeks/months
  endDate?: string | null
  lastCreated?: string | null
}

export interface TaskTemplate {
  id: string
  name: string
  description: string | null
  priority: "low" | "medium" | "high" | "urgent"
  estimatedHours?: number | null
  tags: string[]
  subtasks: Omit<Subtask, 'id' | 'createdAt'>[]
  customFields?: Record<string, any>
  createdAt: string
}

export interface Tag {
  id: string
  name: string
  color: string
}

export interface ArtworkHistoryEntry {
  id: string
  projectId: string
  filePath: string
  source: "file" | "ai" | "unsplash"
  createdAt: string
}

// VST3 Plugin Session
export interface PluginSession {
  sessionId: string
  pluginId: string
  pluginName: string
  dawName: string
  trackName: string | null
  linkedProjectId: string | null
  /** The project the plugin was previously linked to (for auto-relink) */
  lastProjectId: string | null
  isRecording: boolean
  isArmed: boolean
  gainDb: number
  autoRecord: boolean
  captureOfflineRenders: boolean
  connectedAt: string
}

// Plugin events emitted from the WebSocket server
export interface PluginEvent {
  type:
    | "pluginConnected"
    | "pluginDisconnected"
    | "pluginLinkedProject"
    | "pluginUnlinkedProject"
    | "pluginRecordingComplete"
    | "pluginRecordingProgress"
    | "pluginStateUpdate"
    | "sessionsChanged"
  session?: PluginSession
  sessionId?: string
  projectId?: string
  filePath?: string
  name?: string
  durationSecs?: number
  sampleRate?: number
  channels?: number
  peakLevel?: number
  sessions?: PluginSession[]
  /** Source of the recording: "auto" or "offline" */
  source?: string
  /** Peak level in dBFS measured during recording */
  peakDb?: number
  /** RMS level in dBFS measured during recording */
  rmsDb?: number
}

export interface FilterOptions {
  searchQuery: string
  sortBy: "name-asc" | "name-desc" | "date-newest" | "date-oldest" | "bpm-asc" | "bpm-desc" | "time-spent-asc" | "time-spent-desc" | "key" | "tags-asc" | "tags-desc"
  selectedTags: string[]
  collectionFilter: string | null
  statusFilter: ProjectStatus[] | null
  dawFilter: string[] | null
  genreFilter: string[] | null
  artistFilter: string[] | null
  /** Filter by recording/version source type: "has-recordings", "has-renders", "has-manual" */
  recordingFilter: string[] | null
}

export interface AudioPlayerState {
  isPlaying: boolean
  currentTrack: Project | null
  currentTime: number
  duration: number
  volume: number
}

export interface AppSettings {
  flStudioPath: string | null
  aiApiKey: string
  aiApiUrl: string | null
  aiProvider: "openai" | "stability" | "replicate" | "local" | "custom"
  theme: "dark" | "light" | "system"
  accentColor: string
  autoGenerateArtwork: boolean
  excludeAutosaves: boolean
  selectedDAWs: string[]
  dawFolders: Record<string, string[]>
  viewMode: "grid" | "list" | "gallery"
  gridSize: "small" | "medium" | "large"
  unsplashEnabled: boolean
  sampleFolders: string[]
  autoScanOnStartup: boolean
  defaultSort: "date-newest" | "date-oldest" | "name-asc" | "name-desc" | "bpm-asc" | "bpm-desc" | "time-spent-asc" | "time-spent-desc" | "key" | "tags-asc" | "tags-desc"
  notificationsEnabled: boolean
  notifyOnShare: boolean
  notifyOnAnnotation: boolean
  notifyOnStatusChange: boolean
  confirmDestructiveActions: boolean
  language: "en" | "de" | "es" | "fr" | "ja" | "pt" | "ro"
  hasSeenTour: boolean
  featureRequests: { id: string; text: string; votes: number; createdAt: string }[]
}

// Supported DAWs
export const SUPPORTED_DAWS = [
  "FL Studio",
  "Ableton Live",
  "Logic Pro",
  "Pro Tools",
  "Cubase",
  "Fender Studio Pro",
  "Bitwig Studio",
  "Reaper",
  "Reason",
  "GarageBand",
  "LMMS",
  "Cakewalk",
] as const

/** File extensions for each DAW (used for display & detection) */
export const DAW_EXTENSIONS: Record<string, string[]> = {
  "FL Studio": [".flp"],
  "Ableton Live": [".als"],
  "Logic Pro": [".logicx"],
  "Pro Tools": [".ptx", ".pts"],
  "Cubase": [".cpr"],
  "Fender Studio Pro": [".song"],
  "Bitwig Studio": [".bwproject"],
  "Reaper": [".rpp"],
  "Reason": [".reason"],
  "GarageBand": [".band"],
  "LMMS": [".mmp", ".mmpz"],
  "Cakewalk": [".cwp"],
}

export const DEFAULT_SETTINGS: AppSettings = {
  flStudioPath: null,
  aiApiKey: "",
  aiApiUrl: null,
  aiProvider: "local",
  theme: "dark",
  accentColor: "#6366f1",
  autoGenerateArtwork: false,
  excludeAutosaves: true,
  selectedDAWs: [...SUPPORTED_DAWS],
  dawFolders: {},
  viewMode: "grid",
  gridSize: "medium",
  unsplashEnabled: true,
  sampleFolders: [],
  autoScanOnStartup: true,
  defaultSort: "date-newest",
  notificationsEnabled: true,
  notifyOnShare: true,
  notifyOnAnnotation: true,
  notifyOnStatusChange: true,
  confirmDestructiveActions: true,
  language: "en",
  hasSeenTour: false,
  featureRequests: [],
}

// ── FLP Analysis Types ──────────────────────────────────────────────────────

export interface FlpChannel {
  index: number
  name: string | null
  channelType: string // "sampler" | "generator" | "layer" | "audio_clip" | "unknown"
  pluginName: string | null
  samplePath: string | null
  color: string | null
  mixerTrack: number | null
}

export interface FlpMixerTrack {
  index: number
  name: string | null
  color: string | null
  plugins: string[]
}

export interface FlpPattern {
  index: number
  name: string | null
}

export interface FlpPlugin {
  name: string
  dllName: string | null
  channelName: string | null
  channelIndex: number | null
  isInstrument: boolean
  presetName: string | null
}

export interface FlpAnalysis {
  plugins: FlpPlugin[]
  samples: string[]
  channels: FlpChannel[]
  mixerTracks: FlpMixerTrack[]
  patterns: FlpPattern[]
  flVersion: string | null
}

// ── Distribution Links ───────────────────────────────────────────────────────

export interface DistributionLink {
  id: string
  projectId: string
  platform: string
  url: string
  label: string | null
  createdAt: string
}

// ── User Profile ────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string
  displayName: string
  avatarPath: string | null
  bio: string | null
  createdAt: string
}

// ── Collaboration ───────────────────────────────────────────────────────────

export interface ProjectShare {
  id: string
  projectId: string
  shareToken: string
  sharedWith: string | null
  permissions: "view" | "edit" | "admin"
  message: string | null
  createdBy: string | null
  createdAt: string
  expiresAt: string | null
}

// ── Onboarding ──────────────────────────────────────────────────────────────

export interface OnboardingState {
  completedSteps: string[]
  dismissed: boolean
  currentStep: number
}

export interface OnboardingStep {
  id: string
  title: string
  description: string
  targetSelector?: string // CSS selector for highlighting
  position?: "top" | "bottom" | "left" | "right"
  icon?: string
}

// IPC Channel names
export const IPC_CHANNELS = {
  // Database operations
  DB_GET_PROJECTS: "db:get-projects",
  DB_GET_PROJECT: "db:get-project",
  DB_CREATE_PROJECT: "db:create-project",
  DB_UPDATE_PROJECT: "db:update-project",
  DB_DELETE_PROJECT: "db:delete-project",
  DB_CLEAR_ALL_PROJECTS: "db:clear-all-projects",

  // Groups
  DB_GET_GROUPS: "db:get-groups",
  DB_GET_GROUP: "db:get-group",
  DB_CREATE_GROUP: "db:create-group",
  DB_UPDATE_GROUP: "db:update-group",
  DB_DELETE_GROUP: "db:delete-group",

  // Tasks
  DB_GET_TASKS: "db:get-tasks",
  DB_GET_TASKS_BY_PROJECT: "db:get-tasks-by-project",
  DB_CREATE_TASK: "db:create-task",
  DB_UPDATE_TASK: "db:update-task",
  DB_DELETE_TASK: "db:delete-task",
  DB_REORDER_TASKS: "db:reorder-tasks",

  // Tags
  DB_GET_TAGS: "db:get-tags",
  DB_CREATE_TAG: "db:create-tag",
  DB_DELETE_TAG: "db:delete-tag",

  // File operations
  FILE_SELECT_IMAGE: "file:select-image",
  FILE_SELECT_AUDIO: "file:select-audio",
  FILE_SELECT_PROJECT: "file:select-project",
  FILE_SELECT_FOLDER: "file:select-folder",
  FILE_OPEN_IN_DAW: "file:open-in-daw",
  FILE_OPEN_FOLDER: "file:open-folder",
  FILE_LOAD_AUDIO: "file:load-audio",
  FILE_READ_DIR: "file:read-dir",
  FILE_DETECT_PROJECTS: "file:detect-projects",

  // FL Studio scanning
  SCAN_FL_FOLDER: "scan:fl-folder",
  SCAN_ABLETON_FOLDER: "scan:ableton-folder",
  SCAN_PROGRESS: "scan:progress",
  UPDATE_FILE_MOD_DATES: "update:file-mod-dates",
  EXTRACT_FLP_METADATA: "flp:extract-metadata",
  EXTRACT_FLP_METADATA_BATCH: "flp:extract-metadata-batch",

  // AI artwork generation
  GENERATE_ARTWORK: "ai:generate-artwork",

  // Unsplash random photo
  FETCH_UNSPLASH_PHOTO: "unsplash:fetch-random",

  // App operations
  APP_GET_VERSION: "app:get-version",
  APP_MINIMIZE: "app:minimize",
  APP_MAXIMIZE: "app:maximize",
  APP_CLOSE: "app:close",

  // Settings
  SETTINGS_GET: "settings:get",
  SETTINGS_SET: "settings:set",

  // Audio Versions
  DB_GET_VERSIONS: "db:get-versions",
  DB_GET_VERSION: "db:get-version",
  DB_CREATE_VERSION: "db:create-version",
  DB_UPDATE_VERSION: "db:update-version",
  DB_DELETE_VERSION: "db:delete-version",

  // Annotations
  DB_GET_ANNOTATIONS: "db:get-annotations",
  DB_CREATE_ANNOTATION: "db:create-annotation",
  DB_UPDATE_ANNOTATION: "db:update-annotation",
  DB_DELETE_ANNOTATION: "db:delete-annotation",

  // Plugin session management
  PLUGIN_GET_SESSIONS: "plugin:get-sessions",
  PLUGIN_GET_SESSIONS_FOR_PROJECT: "plugin:get-sessions-for-project",
  PLUGIN_LINK: "plugin:link",
  PLUGIN_UNLINK: "plugin:unlink",
  PLUGIN_START_RECORDING: "plugin:start-recording",
  PLUGIN_STOP_RECORDING: "plugin:stop-recording",
  PLUGIN_GET_PORT: "plugin:get-port",
  PLUGIN_SEND_PROJECTS: "plugin:send-projects",
  PLUGIN_IMPORT_RECORDING: "plugin:import-recording",
  PLUGIN_EVENT: "plugin-event",

  // FLP Analysis
  ANALYZE_FLP_PROJECT: "flp:analyze",
  CLEAR_FLP_ANALYSIS_CACHE: "flp:clear-cache",

  // User Profile
  GET_USER_PROFILE: "user:get-profile",
  UPDATE_USER_PROFILE: "user:update-profile",

  // Collaboration
  CREATE_PROJECT_SHARE: "share:create",
  GET_PROJECT_SHARES: "share:get",
  DELETE_PROJECT_SHARE: "share:delete",

  // Onboarding
  GET_ONBOARDING_STATE: "onboarding:get",
  UPDATE_ONBOARDING_STATE: "onboarding:update",

  // Annotation-Task conversion
  CONVERT_ANNOTATION_TO_TASK: "annotation:to-task",
  UNCONVERT_ANNOTATION_FROM_TASK: "annotation:from-task",
  UPDATE_ANNOTATION_TASK: "annotation:update-task",
  GET_TASK_ANNOTATIONS: "annotation:get-tasks",

  // Screenshot
  CAPTURE_WINDOW_SCREENSHOT: "screenshot:capture",

} as const
