import { Project, ProjectGroup, Task, Tag, AppSettings, AudioVersion, Annotation } from '@shared/types';

declare global {
  interface Window {
    electron: {
      getProjects: () => Promise<Project[]>;
      getProjectsPaginated: (options: {
        page: number;
        pageSize: number;
        search?: string;
        tags?: string[];
        status?: string[];
        dawTypes?: string[];
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
      }) => Promise<{ projects: Project[]; total: number; totalPages: number; currentPage: number }>;
      getProject: (id: string) => Promise<Project | null>;
      createProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'> & { createdAt?: string; updatedAt?: string }) => Promise<Project>;
      updateProject: (id: string, project: Partial<Project>) => Promise<Project | null>;
      deleteProject: (id: string) => Promise<boolean>;

      // Groups
      getGroups: () => Promise<ProjectGroup[]>;
      getGroup: (id: string) => Promise<ProjectGroup | null>;
      createGroup: (group: Omit<ProjectGroup, 'id' | 'createdAt' | 'updatedAt'>) => Promise<ProjectGroup>;
      updateGroup: (id: string, group: Partial<ProjectGroup>) => Promise<ProjectGroup | null>;
      deleteGroup: (id: string) => Promise<boolean>;

      // Tasks
      getTasks: () => Promise<Task[]>;
      createTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Task>;
      updateTask: (id: string, task: Partial<Task>) => Promise<Task | null>;
      deleteTask: (id: string) => Promise<boolean>;
      reorderTasks: (tasks: { id: string; order: number; status: Task['status'] }[]) => Promise<boolean>;

      // Tags
      getTags: () => Promise<Tag[]>;
      createTag: (tag: Omit<Tag, 'id'>) => Promise<Tag>;
      updateTag: (id: string, updates: Partial<Omit<Tag, 'id'>>) => Promise<Tag | null>;
      deleteTag: (id: string) => Promise<boolean>;

      // Audio Versions
      getVersionsByProject: (projectId: string) => Promise<AudioVersion[]>;
      getAudioVersion: (id: string) => Promise<AudioVersion | null>;
      createVersion: (version: Omit<AudioVersion, 'id' | 'createdAt' | 'versionNumber'>) => Promise<AudioVersion>;
      updateVersion: (id: string, version: Partial<AudioVersion>) => Promise<AudioVersion>;
      deleteVersion: (id: string) => Promise<void>;

      // Annotations
      getAnnotationsByVersion: (versionId: string) => Promise<Annotation[]>;
      createAnnotation: (annotation: Omit<Annotation, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Annotation>;
      updateAnnotation: (id: string, annotation: Partial<Annotation>) => Promise<Annotation>;
      deleteAnnotation: (id: string) => Promise<void>;

      // File operations
      selectImage: () => Promise<string | null>;
      selectAudio: (defaultPath?: string) => Promise<string | null>;
      selectProject: () => Promise<string | null>;
      selectFolder: () => Promise<string | null>;
      readDir: (folderPath: string) => Promise<string[]>;
      detectProjects: (folderPath: string) => Promise<{ hasFLP: boolean; hasALS: boolean }>;
      loadAudioFile: (filePath: string) => Promise<ArrayBuffer>;
      openInDaw: (filePath: string) => Promise<{ success: boolean; error?: string }>;
      openFolder: (folderPath: string) => Promise<{ success: boolean; error?: string }>;

      // Audio waveform analysis
      getWaveformPeaks: (filePath: string, numPeaks?: number) => Promise<number[]>;

      // FL Studio scanning
      scanFLStudioFolder: (folderPath: string) => Promise<{ count: number }>;
      // Ableton scanning
      scanAbletonFolder: (folderPath: string) => Promise<{ count: number }>;
      updateFileModDates: () => Promise<{ count: number }>;
      updateDawTypes: () => Promise<{ count: number }>;

      // AI artwork generation
      generateArtwork: (projectId: string, projectTitle: string) => Promise<string | null>;

      // Unsplash random photo
      fetchUnsplashPhoto: (projectId: string) => Promise<string | null>;

      // FLP metadata extraction
      extractFlpMetadata: (filePath: string) => Promise<any>;

      // Settings
      getSettings: () => Promise<AppSettings>;
      setSettings: (settings: Partial<AppSettings>) => Promise<void>;

      // Database management
      clearAllProjects: () => Promise<number>;

      // App operations
      getAppVersion: () => Promise<string>;
      minimizeWindow: () => void;
      maximizeWindow: () => void;
      closeWindow: () => void;

      // Test metadata extraction
      testExtractMetadata: (flpPath: string) => Promise<any>;
    };
  }
}

export {};
