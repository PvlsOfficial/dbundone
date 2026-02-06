export interface Project {
    id: string;
    title: string;
    artworkPath: string | null;
    audioPreviewPath: string | null;
    dawProjectPath: string | null;
    dawType: string | null;
    bpm: number;
    musicalKey: string;
    tags: string[];
    collectionName: string | null;
    createdAt: string;
    updatedAt: string;
}
export interface ProjectGroup {
    id: string;
    name: string;
    artworkPath: string | null;
    description: string | null;
    projectIds: string[];
    createdAt: string;
    updatedAt: string;
}
export interface Task {
    id: string;
    title: string;
    description: string | null;
    status: "todo" | "in-progress" | "done";
    dueDate: string | null;
    order: number;
    projectId?: string | null;
    createdAt: string;
    updatedAt: string;
}
export interface Tag {
    id: string;
    name: string;
    color: string;
}
export interface FilterOptions {
    searchQuery: string;
    sortBy: "name-asc" | "name-desc" | "date-newest" | "date-oldest" | "bpm-asc" | "bpm-desc" | "time-spent-asc" | "time-spent-desc" | "key" | "tags-asc" | "tags-desc";
    selectedTags: string[];
    collectionFilter: string | null;
}
export interface AudioPlayerState {
    isPlaying: boolean;
    currentTrack: Project | null;
    currentTime: number;
    duration: number;
    volume: number;
}
export declare const IPC_CHANNELS: {
    readonly DB_GET_PROJECTS: "db:get-projects";
    readonly DB_GET_PROJECTS_PAGINATED: "db:get-projects-paginated";
    readonly DB_GET_PROJECT: "db:get-project";
    readonly DB_CREATE_PROJECT: "db:create-project";
    readonly DB_UPDATE_PROJECT: "db:update-project";
    readonly DB_DELETE_PROJECT: "db:delete-project";
    readonly DB_GET_GROUPS: "db:get-groups";
    readonly DB_GET_GROUP: "db:get-group";
    readonly DB_CREATE_GROUP: "db:create-group";
    readonly DB_UPDATE_GROUP: "db:update-group";
    readonly DB_DELETE_GROUP: "db:delete-group";
    readonly DB_GET_TASKS: "db:get-tasks";
    readonly DB_GET_TASKS_BY_PROJECT: "db:get-tasks-by-project";
    readonly DB_CREATE_TASK: "db:create-task";
    readonly DB_UPDATE_TASK: "db:update-task";
    readonly DB_DELETE_TASK: "db:delete-task";
    readonly DB_REORDER_TASKS: "db:reorder-tasks";
    readonly DB_GET_TAGS: "db:get-tags";
    readonly DB_CREATE_TAG: "db:create-tag";
    readonly DB_DELETE_TAG: "db:delete-tag";
    readonly DB_CLEAR_ALL_PROJECTS: "db:clear-all-projects";
    readonly DB_GET_VERSIONS: "db:get-versions";
    readonly DB_GET_VERSION: "db:get-version";
    readonly DB_CREATE_VERSION: "db:create-version";
    readonly DB_UPDATE_VERSION: "db:update-version";
    readonly DB_DELETE_VERSION: "db:delete-version";
    readonly DB_GET_ANNOTATIONS: "db:get-annotations";
    readonly DB_CREATE_ANNOTATION: "db:create-annotation";
    readonly DB_UPDATE_ANNOTATION: "db:update-annotation";
    readonly DB_DELETE_ANNOTATION: "db:delete-annotation";
    readonly FILE_SELECT_IMAGE: "file:select-image";
    readonly FILE_SELECT_AUDIO: "file:select-audio";
    readonly FILE_SELECT_PROJECT: "file:select-project";
    readonly FILE_SELECT_FOLDER: "file:select-folder";
    readonly FILE_OPEN_IN_DAW: "file:open-in-daw";
    readonly FILE_OPEN_FOLDER: "file:open-folder";
    readonly FILE_LOAD_AUDIO: "file:load-audio";
    readonly SCAN_FL_FOLDER: "scan:fl-folder";
    readonly SCAN_ABLETON_FOLDER: "scan:ableton-folder";
    readonly SCAN_PROGRESS: "scan:progress";
    readonly GENERATE_ARTWORK: "ai:generate-artwork";
    readonly SETTINGS_GET: "settings:get";
    readonly SETTINGS_SET: "settings:set";
    readonly APP_GET_VERSION: "app:get-version";
    readonly APP_MINIMIZE: "app:minimize";
    readonly APP_MAXIMIZE: "app:maximize";
    readonly APP_CLOSE: "app:close";
};
//# sourceMappingURL=types.d.ts.map