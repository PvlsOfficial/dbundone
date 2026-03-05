use serde::{Deserialize, Serialize};

/// Messages sent FROM the VST3 plugin TO the server
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum PluginMessage {
    #[serde(rename = "hello")]
    Hello {
        plugin_id: String,
        plugin_name: String,
        daw_name: String,
        track_name: Option<String>,
        /// If set, the server should auto-relink this plugin to the given project
        last_project_id: Option<String>,
    },
    #[serde(rename = "getProjects")]
    GetProjects,
    #[serde(rename = "linkProject")]
    LinkProject { project_id: String },
    #[serde(rename = "unlinkProject")]
    UnlinkProject,
    #[serde(rename = "recordingComplete")]
    RecordingComplete {
        file_path: String,
        name: String,
        duration_secs: f64,
        sample_rate: u32,
        channels: u16,
        /// Source type: "manual", "auto", or "offline"
        #[serde(default)]
        source: Option<String>,
        /// Peak level in dBFS
        #[serde(default)]
        peak_db: Option<f64>,
        /// RMS level in dBFS
        #[serde(default)]
        rms_db: Option<f64>,
    },
    #[serde(rename = "recordingProgress")]
    RecordingProgress { duration_secs: f64, peak_level: f64 },
    #[serde(rename = "stateUpdate")]
    StateUpdate {
        is_recording: bool,
        is_armed: bool,
        gain_db: f64,
        auto_record: bool,
        #[serde(default)]
        capture_offline_renders: Option<bool>,
    },
    #[serde(rename = "ping")]
    Ping,
    /// Request tasks for the linked project
    #[serde(rename = "getTasks")]
    GetTasks,
    /// Create a new task on the linked project
    #[serde(rename = "createTask")]
    CreateTask {
        title: String,
        description: Option<String>,
    },
    /// Update a task
    #[serde(rename = "updateTask")]
    UpdateTask {
        task_id: String,
        title: Option<String>,
        description: Option<String>,
        status: Option<String>,
    },
    /// Delete a task
    #[serde(rename = "deleteTask")]
    DeleteTask { task_id: String },
    /// DAW transport info (BPM, time signature, etc.)
    #[serde(rename = "transportInfo")]
    TransportInfo {
        bpm: Option<f64>,
        time_sig_num: Option<i32>,
        time_sig_denom: Option<i32>,
    },
}

/// Messages sent FROM the server TO the VST3 plugin
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ServerMessage {
    #[serde(rename = "welcome")]
    Welcome {
        session_id: String,
        server_version: String,
    },
    #[serde(rename = "projectList")]
    ProjectList { projects: Vec<ProjectInfo> },
    #[serde(rename = "projectLinked")]
    ProjectLinked { project: ProjectInfo },
    #[serde(rename = "projectUnlinked")]
    ProjectUnlinked,
    #[serde(rename = "recordingImported")]
    RecordingImported {
        version_id: String,
        version_number: i64,
    },
    #[serde(rename = "error")]
    Error { message: String },
    #[serde(rename = "pong")]
    Pong,
    #[serde(rename = "projectUpdated")]
    ProjectUpdated { project: ProjectInfo },
    #[serde(rename = "startRecording")]
    StartRecording,
    #[serde(rename = "stopRecording")]
    StopRecording,
    /// Task list for the linked project
    #[serde(rename = "taskList")]
    TaskList { tasks: Vec<TaskInfo> },
    /// Task list updated (after create/update/delete)
    #[serde(rename = "taskUpdated")]
    TaskUpdated { tasks: Vec<TaskInfo> },
}

/// Lightweight project info
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInfo {
    pub id: String,
    pub title: String,
    pub status: String,
    pub bpm: i64,
    pub musical_key: String,
    pub artwork_path: Option<String>,
    pub daw_type: Option<String>,
    pub collection_name: Option<String>,
}

/// Lightweight task info
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TaskInfo {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub order: i64,
}
