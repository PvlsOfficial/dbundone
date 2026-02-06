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
}

// Audio Version for version control
export interface AudioVersion {
  id: string
  projectId: string
  name: string
  filePath: string
  notes: string | null
  versionNumber: number
  createdAt: string
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

export interface FilterOptions {
  searchQuery: string
  sortBy: "name-asc" | "name-desc" | "date-newest" | "date-oldest" | "bpm-asc" | "bpm-desc" | "time-spent-asc" | "time-spent-desc" | "key" | "tags-asc" | "tags-desc"
  selectedTags: string[]
  collectionFilter: string | null
  statusFilter: ProjectStatus[] | null
  dawFilter: string[] | null
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
  dawFolders: Record<string, string | null>
  viewMode: "grid" | "list"
  gridSize: "small" | "medium" | "large"
}

// Supported DAWs - only these are implemented
export const SUPPORTED_DAWS = ["FL Studio", "Ableton Live"] as const

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

  // Audio analysis
  AUDIO_GET_WAVEFORM_PEAKS: "audio:get-waveform-peaks",
} as const
