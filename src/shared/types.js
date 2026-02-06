"use strict";
// Shared type definitions for the application
Object.defineProperty(exports, "__esModule", { value: true });
exports.IPC_CHANNELS = void 0;
// IPC Channel names
exports.IPC_CHANNELS = {
    // Database operations
    DB_GET_PROJECTS: "db:get-projects",
    DB_GET_PROJECTS_PAGINATED: "db:get-projects-paginated",
    DB_GET_PROJECT: "db:get-project",
    DB_CREATE_PROJECT: "db:create-project",
    DB_UPDATE_PROJECT: "db:update-project",
    DB_DELETE_PROJECT: "db:delete-project",
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
    // Database management
    DB_CLEAR_ALL_PROJECTS: "db:clear-all-projects",
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
    // File operations
    FILE_SELECT_IMAGE: "file:select-image",
    FILE_SELECT_AUDIO: "file:select-audio",
    FILE_SELECT_PROJECT: "file:select-project",
    FILE_SELECT_FOLDER: "file:select-folder",
    FILE_OPEN_IN_DAW: "file:open-in-daw",
    FILE_OPEN_FOLDER: "file:open-folder",
    // Load audio file
    FILE_LOAD_AUDIO: "file:load-audio",
    // FL Studio scanning
    SCAN_FL_FOLDER: "scan:fl-folder",
    // Ableton scanning
    SCAN_ABLETON_FOLDER: "scan:ableton-folder",
    // AI artwork generation
    GENERATE_ARTWORK: "ai:generate-artwork",
    // Settings
    SETTINGS_GET: "settings:get",
    SETTINGS_SET: "settings:set",
    // App operations
    APP_GET_VERSION: "app:get-version",
    APP_MINIMIZE: "app:minimize",
    APP_MAXIMIZE: "app:maximize",
    APP_CLOSE: "app:close",
};
//# sourceMappingURL=types.js.map