use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{broadcast, RwLock};
use tokio_tungstenite::tungstenite::Message;

// ============ Protocol Types ============

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
        /// Source type: "auto", "offline", or absent (defaults to "auto")
        #[serde(default)]
        source: Option<String>,
        /// Peak level in dBFS measured during recording
        #[serde(default)]
        peak_db: Option<f64>,
        /// RMS level in dBFS measured during recording
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
    CreateTask { title: String, description: Option<String> },
    /// Update a task
    #[serde(rename = "updateTask")]
    UpdateTask { task_id: String, title: Option<String>, description: Option<String>, status: Option<String> },
    /// Delete a task
    #[serde(rename = "deleteTask")]
    DeleteTask { task_id: String },
    /// DAW transport info (BPM, time signature, etc.)
    #[serde(rename = "transportInfo")]
    TransportInfo { bpm: Option<f64>, time_sig_num: Option<i32>, time_sig_denom: Option<i32> },
}

/// Messages sent FROM the server TO the VST3 plugin
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ServerMessage {
    #[serde(rename = "welcome")]
    Welcome { session_id: String, server_version: String },
    #[serde(rename = "projectList")]
    ProjectList { projects: Vec<ProjectInfo> },
    #[serde(rename = "projectLinked")]
    ProjectLinked { project: ProjectInfo },
    #[serde(rename = "projectUnlinked")]
    ProjectUnlinked,
    #[serde(rename = "recordingImported")]
    RecordingImported { version_id: String, version_number: i64 },
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
    /// A task was created/updated/deleted
    #[serde(rename = "taskUpdated")]
    TaskUpdated { tasks: Vec<TaskInfo> },
}

/// Lightweight task info sent over the wire
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TaskInfo {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub order: i64,
}

/// Lightweight project info sent over the wire
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

// ============ Session Management ============

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PluginSession {
    pub session_id: String,
    pub plugin_id: String,
    pub plugin_name: String,
    pub daw_name: String,
    pub track_name: Option<String>,
    pub linked_project_id: Option<String>,
    /// The project the plugin was previously linked to (for auto-relink)
    pub last_project_id: Option<String>,
    pub is_recording: bool,
    pub is_armed: bool,
    pub gain_db: f64,
    pub auto_record: bool,
    pub capture_offline_renders: bool,
    pub connected_at: String,
}

pub struct PluginServerState {
    pub sessions: RwLock<HashMap<String, PluginSession>>,
    senders: RwLock<HashMap<String, tokio::sync::mpsc::UnboundedSender<ServerMessage>>>,
    pub event_tx: broadcast::Sender<PluginEvent>,
    pub port: RwLock<u16>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type")]
pub enum PluginEvent {
    #[serde(rename = "pluginConnected")]
    PluginConnected { session: PluginSession },
    #[serde(rename = "pluginDisconnected")]
    PluginDisconnected {
        #[serde(rename = "sessionId")]
        session_id: String,
    },
    #[serde(rename = "pluginLinkedProject")]
    PluginLinkedProject {
        #[serde(rename = "sessionId")]
        session_id: String,
        #[serde(rename = "projectId")]
        project_id: String,
    },
    #[serde(rename = "pluginUnlinkedProject")]
    PluginUnlinkedProject {
        #[serde(rename = "sessionId")]
        session_id: String,
    },
    #[serde(rename = "pluginRecordingComplete")]
    PluginRecordingComplete {
        #[serde(rename = "sessionId")]
        session_id: String,
        #[serde(rename = "projectId")]
        project_id: String,
        #[serde(rename = "filePath")]
        file_path: String,
        name: String,
        #[serde(rename = "durationSecs")]
        duration_secs: f64,
        #[serde(rename = "sampleRate")]
        sample_rate: u32,
        channels: u16,
        /// "auto" or "offline"
        source: String,
        /// Peak level in dBFS measured during recording
        #[serde(rename = "peakDb")]
        peak_db: Option<f64>,
        /// RMS level in dBFS measured during recording
        #[serde(rename = "rmsDb")]
        rms_db: Option<f64>,
    },
    #[serde(rename = "pluginRecordingProgress")]
    PluginRecordingProgress {
        #[serde(rename = "sessionId")]
        session_id: String,
        #[serde(rename = "durationSecs")]
        duration_secs: f64,
        #[serde(rename = "peakLevel")]
        peak_level: f64,
    },
    #[serde(rename = "pluginStateUpdate")]
    PluginStateUpdate { session: PluginSession },
    #[serde(rename = "sessionsChanged")]
    SessionsChanged { sessions: Vec<PluginSession> },
    /// Plugin requested the full project list (for manual linking from plugin UI)
    #[serde(rename = "pluginRequestedProjects")]
    PluginRequestedProjects {
        #[serde(rename = "sessionId")]
        session_id: String,
    },
    /// Plugin requested to link to a project (manual link from plugin UI)
    #[serde(rename = "pluginRequestedLink")]
    PluginRequestedLink {
        #[serde(rename = "sessionId")]
        session_id: String,
        #[serde(rename = "projectId")]
        project_id: String,
    },
    /// Plugin requested tasks for its linked project
    #[serde(rename = "pluginRequestedTasks")]
    PluginRequestedTasks {
        #[serde(rename = "sessionId")]
        session_id: String,
        #[serde(rename = "projectId")]
        project_id: String,
    },
    /// Plugin wants to create a task
    #[serde(rename = "pluginCreateTask")]
    PluginCreateTask {
        #[serde(rename = "sessionId")]
        session_id: String,
        #[serde(rename = "projectId")]
        project_id: String,
        title: String,
        description: Option<String>,
    },
    /// Plugin wants to update a task
    #[serde(rename = "pluginUpdateTask")]
    PluginUpdateTask {
        #[serde(rename = "sessionId")]
        session_id: String,
        #[serde(rename = "taskId")]
        task_id: String,
        title: Option<String>,
        description: Option<String>,
        status: Option<String>,
    },
    /// Plugin wants to delete a task
    #[serde(rename = "pluginDeleteTask")]
    PluginDeleteTask {
        #[serde(rename = "sessionId")]
        session_id: String,
        #[serde(rename = "taskId")]
        task_id: String,
    },
    /// Plugin reported DAW transport BPM
    #[serde(rename = "pluginTransportBpm")]
    PluginTransportBpm {
        #[serde(rename = "sessionId")]
        session_id: String,
        #[serde(rename = "projectId")]
        project_id: String,
        bpm: f64,
    },
}

impl PluginServerState {
    pub fn new() -> Arc<Self> {
        let (event_tx, _) = broadcast::channel(256);
        Arc::new(Self {
            sessions: RwLock::new(HashMap::new()),
            senders: RwLock::new(HashMap::new()),
            port: RwLock::new(0),
            event_tx,
        })
    }

    pub async fn send_to_session(&self, session_id: &str, msg: ServerMessage) -> Result<(), String> {
        let senders = self.senders.read().await;
        if let Some(sender) = senders.get(session_id) {
            sender.send(msg).map_err(|e| e.to_string())
        } else {
            Err(format!("Session {} not found", session_id))
        }
    }

    pub async fn get_sessions(&self) -> Vec<PluginSession> {
        // Prune dead sessions first
        let dead_ids: Vec<String> = {
            let senders = self.senders.read().await;
            let sessions = self.sessions.read().await;
            sessions
                .keys()
                .filter(|id| senders.get(*id).map_or(true, |s| s.is_closed()))
                .cloned()
                .collect()
        };
        if !dead_ids.is_empty() {
            let mut sessions = self.sessions.write().await;
            let mut senders = self.senders.write().await;
            for id in &dead_ids {
                sessions.remove(id);
                senders.remove(id);
            }
        }

        let sessions = self.sessions.read().await;
        sessions.values().cloned().collect()
    }

    pub async fn get_sessions_for_project(&self, project_id: &str) -> Vec<PluginSession> {
        self.get_sessions()
            .await
            .into_iter()
            .filter(|s| s.linked_project_id.as_deref() == Some(project_id))
            .collect()
    }

    pub async fn link_session_to_project(
        &self,
        session_id: &str,
        project_id: &str,
        project_info: ProjectInfo,
    ) -> Result<(), String> {
        {
            let mut sessions = self.sessions.write().await;
            if let Some(session) = sessions.get_mut(session_id) {
                session.linked_project_id = Some(project_id.to_string());
            } else {
                return Err(format!("Session {} not found", session_id));
            }
        }
        self.send_to_session(session_id, ServerMessage::ProjectLinked { project: project_info }).await?;
        let _ = self.event_tx.send(PluginEvent::PluginLinkedProject {
            session_id: session_id.to_string(),
            project_id: project_id.to_string(),
        });
        self.emit_sessions_changed().await;
        Ok(())
    }

    pub async fn unlink_session(&self, session_id: &str) -> Result<(), String> {
        {
            let mut sessions = self.sessions.write().await;
            if let Some(session) = sessions.get_mut(session_id) {
                session.linked_project_id = None;
            } else {
                return Err(format!("Session {} not found", session_id));
            }
        }
        self.send_to_session(session_id, ServerMessage::ProjectUnlinked).await?;
        let _ = self.event_tx.send(PluginEvent::PluginUnlinkedProject {
            session_id: session_id.to_string(),
        });
        self.emit_sessions_changed().await;
        Ok(())
    }

    pub async fn request_start_recording(&self, session_id: &str) -> Result<(), String> {
        self.send_to_session(session_id, ServerMessage::StartRecording).await
    }

    pub async fn request_stop_recording(&self, session_id: &str) -> Result<(), String> {
        self.send_to_session(session_id, ServerMessage::StopRecording).await
    }

    /// Push updated project info to all sessions linked to this project.
    pub async fn notify_project_updated(&self, project_info: ProjectInfo) {
        let sessions = self.get_sessions_for_project(&project_info.id).await;
        for session in sessions {
            let _ = self
                .send_to_session(
                    &session.session_id,
                    ServerMessage::ProjectUpdated {
                        project: project_info.clone(),
                    },
                )
                .await;
        }
    }

    /// Send the task list to all sessions linked to a project
    pub async fn send_tasks_to_project_sessions(&self, project_id: &str, tasks: Vec<TaskInfo>) {
        let sessions = self.get_sessions_for_project(project_id).await;
        for session in sessions {
            let _ = self.send_to_session(
                &session.session_id,
                ServerMessage::TaskList { tasks: tasks.clone() },
            ).await;
        }
    }

    /// Send a task update to all sessions linked to a project
    pub async fn send_task_update_to_project_sessions(&self, project_id: &str, tasks: Vec<TaskInfo>) {
        let sessions = self.get_sessions_for_project(project_id).await;
        for session in sessions {
            let _ = self.send_to_session(
                &session.session_id,
                ServerMessage::TaskUpdated { tasks: tasks.clone() },
            ).await;
        }
    }

    async fn emit_sessions_changed(&self) {
        let sessions = self.get_sessions().await;
        let _ = self.event_tx.send(PluginEvent::SessionsChanged { sessions });
    }

    async fn register_session(
        &self,
        session: PluginSession,
        sender: tokio::sync::mpsc::UnboundedSender<ServerMessage>,
    ) {
        let session_id = session.session_id.clone();
        self.sessions.write().await.insert(session_id.clone(), session.clone());
        self.senders.write().await.insert(session_id, sender);
        let _ = self.event_tx.send(PluginEvent::PluginConnected { session });
        self.emit_sessions_changed().await;
    }

    async fn remove_session(&self, session_id: &str) {
        self.sessions.write().await.remove(session_id);
        self.senders.write().await.remove(session_id);
        let _ = self.event_tx.send(PluginEvent::PluginDisconnected {
            session_id: session_id.to_string(),
        });
        self.emit_sessions_changed().await;
    }

    /// Remove all sessions with a given plugin_id except the one with except_session_id
    async fn remove_stale_sessions_for_plugin(&self, plugin_id: &str, except_session_id: &str) {
        let stale: Vec<String> = {
            let sessions = self.sessions.read().await;
            sessions
                .iter()
                .filter(|(sid, s)| s.plugin_id == plugin_id && *sid != except_session_id)
                .map(|(sid, _)| sid.clone())
                .collect()
        };
        for id in stale {
            self.remove_session(&id).await;
        }
    }
}

// ============ Server ============

pub async fn start_server(
    state: Arc<PluginServerState>,
    preferred_port: u16,
) -> Result<u16, String> {
    let mut listener = None;
    let mut bound_port = preferred_port;

    for offset in 0..10 {
        let addr = SocketAddr::from(([127, 0, 0, 1], preferred_port + offset));
        match TcpListener::bind(addr).await {
            Ok(l) => {
                bound_port = preferred_port + offset;
                listener = Some(l);
                break;
            }
            Err(_) => continue,
        }
    }

    let listener = listener.ok_or_else(|| {
        format!("Could not bind to any port in range {}-{}", preferred_port, preferred_port + 9)
    })?;

    log::info!("Plugin WebSocket server listening on ws://127.0.0.1:{}", bound_port);
    *state.port.write().await = bound_port;

    let server_state = state.clone();
    tokio::spawn(async move {
        loop {
            match listener.accept().await {
                Ok((stream, addr)) => {
                    let conn_state = server_state.clone();
                    tokio::spawn(handle_connection(conn_state, stream, addr));
                }
                Err(e) => {
                    log::error!("Failed to accept connection: {}", e);
                }
            }
        }
    });

    Ok(bound_port)
}

/// Handle a single WebSocket connection.
/// KEY CHANGE: We do NOT register a session until we receive a valid Hello message.
/// Any connection that doesn't send a Hello within 5 seconds gets dropped.
async fn handle_connection(state: Arc<PluginServerState>, stream: TcpStream, addr: SocketAddr) {
    let ws_stream = match tokio_tungstenite::accept_async(stream).await {
        Ok(ws) => ws,
        Err(_) => return, // Not a valid WebSocket connection -- silently drop
    };

    let (mut ws_sender, mut ws_receiver) = ws_stream.split();

    // Generate session ID and send welcome
    let session_id = uuid::Uuid::new_v4().to_string();

    let welcome = ServerMessage::Welcome {
        session_id: session_id.clone(),
        server_version: "1.0.0".to_string(),
    };
    if let Ok(json) = serde_json::to_string(&welcome) {
        if ws_sender.send(Message::Text(json)).await.is_err() {
            return;
        }
    }

    // Wait for a Hello message. If we don't get one within 5 seconds, drop the connection.
    // This prevents random TCP connections (explorer.exe, port scanners, etc.) from
    // creating ghost sessions.
    let hello_timeout = tokio::time::Duration::from_secs(5);
    let hello_result = tokio::time::timeout(hello_timeout, async {
        while let Some(msg_result) = ws_receiver.next().await {
            match msg_result {
                Ok(Message::Text(text)) => {
                    if let Ok(PluginMessage::Hello { plugin_id, plugin_name, daw_name, track_name, last_project_id }) =
                        serde_json::from_str::<PluginMessage>(&text)
                    {
                        return Some((plugin_id, plugin_name, daw_name, track_name, last_project_id));
                    }
                    // Got a message but it wasn't Hello -- not our plugin
                    return None;
                }
                Ok(Message::Close(_)) => return None,
                Err(_) => return None,
                _ => continue, // skip pings etc, keep waiting
            }
        }
        None
    })
    .await;

    // Unwrap the timeout result
    let (plugin_id, plugin_name, daw_name, track_name, last_project_id) = match hello_result {
        Ok(Some(info)) => info,
        _ => {
            // No valid Hello received -- close the connection silently
            log::debug!("Connection from {} did not send valid Hello, dropping", addr);
            return;
        }
    };

    log::info!("Plugin connected: {} ({}) from {} [{}]", plugin_name, plugin_id, daw_name, addr);

    // Remove stale sessions from the same plugin (reconnect case)
    state.remove_stale_sessions_for_plugin(&plugin_id, &session_id).await;

    // NOW create the channel and register the session
    let (msg_tx, mut msg_rx) = tokio::sync::mpsc::unbounded_channel::<ServerMessage>();
    let session_id_clone = session_id.clone();

    // Spawn sender task
    let send_task = tokio::spawn(async move {
        while let Some(msg) = msg_rx.recv().await {
            if let Ok(json) = serde_json::to_string(&msg) {
                if ws_sender.send(Message::Text(json)).await.is_err() {
                    break;
                }
            }
        }
    });

    let session = PluginSession {
        session_id: session_id.clone(),
        plugin_id,
        plugin_name,
        daw_name,
        track_name,
        linked_project_id: None,
        last_project_id,
        is_recording: false,
        is_armed: false,
        gain_db: 0.0,
        auto_record: false,
        capture_offline_renders: false,
        connected_at: chrono::Utc::now().to_rfc3339(),
    };
    state.register_session(session, msg_tx.clone()).await;

    // Process remaining messages
    while let Some(msg_result) = ws_receiver.next().await {
        match msg_result {
            Ok(Message::Text(text)) => {
                match serde_json::from_str::<PluginMessage>(&text) {
                    Ok(plugin_msg) => {
                        handle_plugin_message(&state, &session_id, &msg_tx, plugin_msg).await;
                    }
                    Err(e) => {
                        log::warn!("Invalid message from {}: {}", session_id, e);
                    }
                }
            }
            Ok(Message::Close(_)) => break,
            Err(_) => break,
            _ => {}
        }
    }

    // Cleanup
    state.remove_session(&session_id_clone).await;
    send_task.abort();
    log::info!("Plugin session {} disconnected", session_id_clone);
}

async fn handle_plugin_message(
    state: &Arc<PluginServerState>,
    session_id: &str,
    msg_tx: &tokio::sync::mpsc::UnboundedSender<ServerMessage>,
    msg: PluginMessage,
) {
    match msg {
        PluginMessage::Hello { .. } => {
            // Already handled during connection handshake; ignore duplicates
        }

        PluginMessage::GetProjects => {
            // Forward to frontend to get the project list sent back
            let _ = state.event_tx.send(PluginEvent::PluginRequestedProjects {
                session_id: session_id.to_string(),
            });
        }

        PluginMessage::LinkProject { project_id } => {
            // Request the frontend/backend to do the actual linking with DB lookup
            let _ = state.event_tx.send(PluginEvent::PluginRequestedLink {
                session_id: session_id.to_string(),
                project_id,
            });
        }

        PluginMessage::UnlinkProject => {
            {
                let mut sessions = state.sessions.write().await;
                if let Some(session) = sessions.get_mut(session_id) {
                    session.linked_project_id = None;
                }
            }
            let _ = msg_tx.send(ServerMessage::ProjectUnlinked);
            let _ = state.event_tx.send(PluginEvent::PluginUnlinkedProject {
                session_id: session_id.to_string(),
            });
            state.emit_sessions_changed().await;
        }

        PluginMessage::RecordingComplete {
            file_path,
            name,
            duration_secs,
            sample_rate,
            channels,
            source,
            peak_db,
            rms_db,
        } => {
            let project_id = {
                let sessions = state.sessions.read().await;
                sessions.get(session_id).and_then(|s| s.linked_project_id.clone())
            };

            if let Some(project_id) = project_id {
                {
                    let mut sessions = state.sessions.write().await;
                    if let Some(session) = sessions.get_mut(session_id) {
                        session.is_recording = false;
                    }
                }

                // Determine the source type — default to "auto" for plugin recordings
                let recording_source = source.unwrap_or_else(|| "auto".to_string());

                log::info!(
                    "Recording complete from session {}: {} ({:.1}s, file={}, source={}) -> project {}",
                    session_id, name, duration_secs, file_path, recording_source, project_id
                );

                let send_result = state.event_tx.send(PluginEvent::PluginRecordingComplete {
                    session_id: session_id.to_string(),
                    project_id: project_id.clone(),
                    file_path: file_path.clone(),
                    name,
                    duration_secs,
                    sample_rate,
                    channels,
                    source: recording_source,
                    peak_db,
                    rms_db,
                });
                match &send_result {
                    Ok(receivers) => {
                        log::info!("PluginRecordingComplete event sent to {} receivers (project={}, file={})", receivers, project_id, file_path);
                    }
                    Err(e) => {
                        log::error!("Failed to send PluginRecordingComplete event: {}", e);
                    }
                }
                state.emit_sessions_changed().await;
            } else {
                log::warn!("Recording complete from session {} but no project linked", session_id);
                let _ = msg_tx.send(ServerMessage::Error {
                    message: "No project linked -- cannot import recording".to_string(),
                });
            }
        }

        PluginMessage::RecordingProgress { duration_secs, peak_level } => {
            let _ = state.event_tx.send(PluginEvent::PluginRecordingProgress {
                session_id: session_id.to_string(),
                duration_secs,
                peak_level,
            });
        }

        PluginMessage::StateUpdate { is_recording, is_armed, gain_db, auto_record, capture_offline_renders } => {
            let session_clone;
            {
                let mut sessions = state.sessions.write().await;
                if let Some(session) = sessions.get_mut(session_id) {
                    session.is_recording = is_recording;
                    session.is_armed = is_armed;
                    session.gain_db = gain_db;
                    session.auto_record = auto_record;
                    if let Some(offline) = capture_offline_renders {
                        session.capture_offline_renders = offline;
                    }
                    session_clone = session.clone();
                } else {
                    return;
                }
            }
            let _ = state.event_tx.send(PluginEvent::PluginStateUpdate { session: session_clone });
        }

        PluginMessage::Ping => {
            let _ = msg_tx.send(ServerMessage::Pong);
        }

        PluginMessage::GetTasks => {
            // Forward to frontend/backend to fetch tasks for linked project
            let project_id = {
                let sessions = state.sessions.read().await;
                sessions.get(session_id).and_then(|s| s.linked_project_id.clone())
            };
            if let Some(pid) = project_id {
                let _ = state.event_tx.send(PluginEvent::PluginRequestedTasks {
                    session_id: session_id.to_string(),
                    project_id: pid,
                });
            }
        }

        PluginMessage::CreateTask { title, description } => {
            let project_id = {
                let sessions = state.sessions.read().await;
                sessions.get(session_id).and_then(|s| s.linked_project_id.clone())
            };
            if let Some(pid) = project_id {
                let _ = state.event_tx.send(PluginEvent::PluginCreateTask {
                    session_id: session_id.to_string(),
                    project_id: pid,
                    title,
                    description,
                });
            }
        }

        PluginMessage::UpdateTask { task_id, title, description, status } => {
            let _ = state.event_tx.send(PluginEvent::PluginUpdateTask {
                session_id: session_id.to_string(),
                task_id,
                title,
                description,
                status,
            });
        }

        PluginMessage::DeleteTask { task_id } => {
            let _ = state.event_tx.send(PluginEvent::PluginDeleteTask {
                session_id: session_id.to_string(),
                task_id,
            });
        }

        PluginMessage::TransportInfo { bpm, time_sig_num: _, time_sig_denom: _ } => {
            // Update the project BPM from DAW transport if it's a reasonable value
            if let Some(daw_bpm) = bpm {
                if daw_bpm > 20.0 && daw_bpm < 999.0 {
                    let project_id = {
                        let sessions = state.sessions.read().await;
                        sessions.get(session_id).and_then(|s| s.linked_project_id.clone())
                    };
                    if let Some(pid) = project_id {
                        let _ = state.event_tx.send(PluginEvent::PluginTransportBpm {
                            session_id: session_id.to_string(),
                            project_id: pid,
                            bpm: daw_bpm,
                        });
                    }
                }
            }
        }
    }
}
