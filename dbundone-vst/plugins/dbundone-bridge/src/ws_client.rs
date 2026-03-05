use crate::protocol::{PluginMessage, ProjectInfo, ServerMessage, TaskInfo};
use crate::recorder::AudioRecorder;
use crossbeam_channel::{Receiver, Sender, TrySendError};
use parking_lot::Mutex;
use std::sync::atomic::{AtomicBool, AtomicU8, Ordering};
use std::sync::Arc;
use tungstenite::{connect, Message};

const DEFAULT_PORT: u16 = 9847;
const RECONNECT_DELAY_MS: u64 = 3000;

/// WebSocket client that communicates with the DBundone app.
/// Runs on a background thread; methods called from the audio/UI
/// thread enqueue messages via a crossbeam channel.
pub struct WsClient {
    /// Sender half of the outgoing message channel
    outgoing_tx: Sender<String>,
    /// Receiver half (consumed by the ws loop)
    outgoing_rx: Receiver<String>,
    /// Session ID assigned by the server
    pub session_id: Option<String>,
}

impl WsClient {
    pub fn new() -> Self {
        // Bounded channel -- drop messages if the ws loop can't keep up
        let (tx, rx) = crossbeam_channel::bounded(256);
        Self {
            outgoing_tx: tx,
            outgoing_rx: rx,
            session_id: None,
        }
    }

    /// Queue a message to be sent to the server. Non-blocking, safe to call
    /// from the audio thread (though we avoid it there).
    fn queue_message(&self, msg: &PluginMessage) {
        if let Ok(json) = serde_json::to_string(msg) {
            // Best-effort send; drop if channel is full
            let _ = self.outgoing_tx.try_send(json);
        }
    }

    /// Queue a recording complete notification
    pub fn send_recording_complete(
        &self,
        file_path: &str,
        name: &str,
        duration_secs: f64,
        sample_rate: u32,
        channels: u16,
        source: Option<String>,
        peak_db: Option<f64>,
        rms_db: Option<f64>,
    ) {
        self.queue_message(&PluginMessage::RecordingComplete {
            file_path: file_path.to_string(),
            name: name.to_string(),
            duration_secs,
            sample_rate,
            channels,
            source,
            peak_db,
            rms_db,
        });
    }

    /// Queue a state update notification
    pub fn send_state_update(
        &self,
        is_recording: bool,
        is_armed: bool,
        gain_db: f64,
        auto_record: bool,
        capture_offline_renders: Option<bool>,
    ) {
        self.queue_message(&PluginMessage::StateUpdate {
            is_recording,
            is_armed,
            gain_db,
            auto_record,
            capture_offline_renders,
        });
    }

    /// Request the project list for manual linking
    pub fn send_get_projects(&self) {
        self.queue_message(&PluginMessage::GetProjects);
    }

    /// Link to a specific project
    pub fn send_link_project(&self, project_id: &str) {
        self.queue_message(&PluginMessage::LinkProject {
            project_id: project_id.to_string(),
        });
    }

    /// Unlink from current project
    pub fn send_unlink_project(&self) {
        self.queue_message(&PluginMessage::UnlinkProject);
    }

    /// Request tasks for the linked project
    pub fn send_get_tasks(&self) {
        self.queue_message(&PluginMessage::GetTasks);
    }

    /// Create a new task
    pub fn send_create_task(&self, title: &str, description: Option<&str>) {
        self.queue_message(&PluginMessage::CreateTask {
            title: title.to_string(),
            description: description.map(|s| s.to_string()),
        });
    }

    /// Update a task
    pub fn send_update_task(
        &self,
        task_id: &str,
        title: Option<&str>,
        description: Option<&str>,
        status: Option<&str>,
    ) {
        self.queue_message(&PluginMessage::UpdateTask {
            task_id: task_id.to_string(),
            title: title.map(|s| s.to_string()),
            description: description.map(|s| s.to_string()),
            status: status.map(|s| s.to_string()),
        });
    }

    /// Delete a task
    pub fn send_delete_task(&self, task_id: &str) {
        self.queue_message(&PluginMessage::DeleteTask {
            task_id: task_id.to_string(),
        });
    }

    /// Send DAW transport BPM info
    pub fn send_transport_info(&self, bpm: Option<f64>) {
        self.queue_message(&PluginMessage::TransportInfo {
            bpm,
            time_sig_num: None,
            time_sig_denom: None,
        });
    }

    /// Drain all queued outgoing messages (called by the ws loop)
    fn drain_outgoing(
        &self,
        socket: &mut tungstenite::WebSocket<
            tungstenite::stream::MaybeTlsStream<std::net::TcpStream>,
        >,
    ) {
        while let Ok(json) = self.outgoing_rx.try_recv() {
            if socket.send(Message::Text(json)).is_err() {
                break;
            }
        }
    }
}

/// Run the WebSocket client loop on a background thread.
/// Continuously tries to connect to the DBundone app and handles messages.
/// Exits when `shutdown` is set to true.
pub fn run_ws_loop(
    ws_client: Arc<Mutex<WsClient>>,
    is_connected: Arc<AtomicBool>,
    linked_project: Arc<Mutex<Option<ProjectInfo>>>,
    is_recording: Arc<AtomicBool>,
    recorder: Arc<Mutex<AudioRecorder>>,
    sample_rate: Arc<atomic_float::AtomicF32>,
    num_channels: Arc<AtomicU8>,
    plugin_id: String,
    last_project_id: Arc<Mutex<Option<String>>>,
    project_list: Arc<Mutex<Vec<ProjectInfo>>>,
    tasks: Arc<Mutex<Vec<TaskInfo>>>,
    shutdown: Arc<AtomicBool>,
) {
    loop {
        // Check shutdown before each connection attempt
        if shutdown.load(Ordering::Relaxed) {
            return;
        }

        // Try to connect
        let url = format!("ws://127.0.0.1:{}", DEFAULT_PORT);
        match connect(url::Url::parse(&url).unwrap()) {
            Ok((mut socket, _response)) => {
                is_connected.store(true, Ordering::Relaxed);

                // Set the socket to non-blocking with a short read timeout
                // so we can also check for outgoing messages
                if let tungstenite::stream::MaybeTlsStream::Plain(ref s) = socket.get_ref() {
                    let _ = s.set_read_timeout(Some(std::time::Duration::from_millis(50)));
                    let _ = s.set_nonblocking(false);
                }

                // Send hello with host info + last linked project for auto-relink
                let daw_name = detect_daw_name();
                let last_proj = last_project_id.lock().clone();
                let hello = PluginMessage::Hello {
                    plugin_id: plugin_id.clone(),
                    plugin_name: "DBundone Bridge".to_string(),
                    daw_name,
                    track_name: None,
                    last_project_id: last_proj,
                };
                if let Ok(json) = serde_json::to_string(&hello) {
                    let _ = socket.send(Message::Text(json));
                }

                // Message loop -- poll for incoming and flush outgoing
                'msg_loop: loop {
                    // Check shutdown flag every iteration
                    if shutdown.load(Ordering::Relaxed) {
                        let _ = socket.close(None);
                        is_connected.store(false, Ordering::Relaxed);
                        return;
                    }

                    // Flush any queued outgoing messages
                    {
                        let ws = ws_client.lock();
                        ws.drain_outgoing(&mut socket);
                    }

                    // Try to read an incoming message (with timeout)
                    match socket.read() {
                        Ok(Message::Text(text)) => {
                            match serde_json::from_str::<ServerMessage>(&text) {
                                Ok(msg) => {
                                    handle_server_message(
                                        &msg,
                                        &ws_client,
                                        &linked_project,
                                        &last_project_id,
                                        &is_recording,
                                        &recorder,
                                        &sample_rate,
                                        &num_channels,
                                        &mut socket,
                                        &project_list,
                                        &tasks,
                                    );
                                }
                                Err(e) => {
                                    eprintln!("Failed to parse server message: {}", e);
                                }
                            }
                        }
                        Ok(Message::Close(_)) => {
                            break 'msg_loop;
                        }
                        Ok(Message::Ping(data)) => {
                            let _ = socket.send(Message::Pong(data));
                        }
                        Err(tungstenite::Error::Io(ref e))
                            if e.kind() == std::io::ErrorKind::WouldBlock
                                || e.kind() == std::io::ErrorKind::TimedOut =>
                        {
                            // Timeout on read -- this is normal, just loop back
                            // to check outgoing queue
                            continue 'msg_loop;
                        }
                        Err(_) => {
                            break 'msg_loop;
                        }
                        _ => {}
                    }
                }

                // Disconnected -- keep linked_project info for display (stale but useful).
                // It will be refreshed on reconnect via auto-relink.
                is_connected.store(false, Ordering::Relaxed);
            }
            Err(_) => {
                // Connection failed, will retry
            }
        }

        // Check shutdown before sleeping
        if shutdown.load(Ordering::Relaxed) {
            return;
        }

        // Wait before reconnecting — use short sleeps so we can check shutdown promptly
        for _ in 0..(RECONNECT_DELAY_MS / 100) {
            if shutdown.load(Ordering::Relaxed) {
                return;
            }
            std::thread::sleep(std::time::Duration::from_millis(100));
        }
    }
}

/// Try to detect which DAW is hosting us by checking the parent process name.
fn detect_daw_name() -> String {
    // Check common environment hints
    #[cfg(target_os = "windows")]
    {
        // Try to get the parent process name on Windows
        if let Some(name) = get_parent_process_name() {
            let lower = name.to_lowercase();
            if lower.contains("fl64") || lower.contains("fl ") || lower.contains("flstudio") {
                return "FL Studio".to_string();
            }
            if lower.contains("ableton") || lower.contains("live") {
                return "Ableton Live".to_string();
            }
            if lower.contains("reaper") {
                return "REAPER".to_string();
            }
            if lower.contains("bitwig") {
                return "Bitwig Studio".to_string();
            }
            if lower.contains("cubase") || lower.contains("nuendo") {
                return "Cubase".to_string();
            }
            if lower.contains("studio one") || lower.contains("studioone") {
                return "Studio One".to_string();
            }
            if lower.contains("logic") {
                return "Logic Pro".to_string();
            }
            if lower.contains("protools") || lower.contains("pro tools") {
                return "Pro Tools".to_string();
            }
            // Filter out known non-DAW processes (Windows shell, services, etc.)
            let non_daw = [
                "explorer.exe", "explorer", "svchost.exe", "svchost",
                "services.exe", "csrss.exe", "wininit.exe", "winlogon.exe",
                "lsass.exe", "dwm.exe", "taskhostw.exe", "sihost.exe",
                "runtimebroker.exe", "shellexperiencehost.exe",
                "searchhost.exe", "startmenuexperiencehost.exe",
                "applicationframehost.exe", "cmd.exe", "powershell.exe",
                "conhost.exe", "wsl.exe",
            ];
            if non_daw.iter().any(|p| lower == *p || lower.ends_with(&format!("\\{}", p))) {
                return "Unknown DAW".to_string();
            }
            // Return the raw process name (minus .exe) if no known DAW matched
            return name.trim_end_matches(".exe").trim_end_matches(".EXE").to_string();
        }
    }
    "Unknown DAW".to_string()
}

/// Get the parent process executable name (Windows)
#[cfg(target_os = "windows")]
fn get_parent_process_name() -> Option<String> {
    use std::ffi::OsString;
    use std::mem;
    use std::os::windows::ffi::OsStringExt;

    // Use Windows API to get parent PID and then its name
    unsafe {
        // Get our own PID
        let our_pid = std::process::id();

        // Take a snapshot of all processes
        let snapshot = windows_snapshot()?;

        // Find our process entry to get the parent PID
        let mut parent_pid = 0u32;
        let mut entry: PROCESSENTRY32W = mem::zeroed();
        entry.dwSize = mem::size_of::<PROCESSENTRY32W>() as u32;

        if Process32FirstW(snapshot, &mut entry) != 0 {
            loop {
                if entry.th32ProcessID == our_pid {
                    parent_pid = entry.th32ParentProcessID;
                    break;
                }
                if Process32NextW(snapshot, &mut entry) == 0 {
                    break;
                }
            }
        }

        if parent_pid == 0 {
            CloseHandle(snapshot);
            return None;
        }

        // Now find the parent process entry
        let mut entry2: PROCESSENTRY32W = mem::zeroed();
        entry2.dwSize = mem::size_of::<PROCESSENTRY32W>() as u32;

        if Process32FirstW(snapshot, &mut entry2) != 0 {
            loop {
                if entry2.th32ProcessID == parent_pid {
                    CloseHandle(snapshot);
                    let len = entry2
                        .szExeFile
                        .iter()
                        .position(|&c| c == 0)
                        .unwrap_or(entry2.szExeFile.len());
                    let name = OsString::from_wide(&entry2.szExeFile[..len]);
                    return name.into_string().ok();
                }
                if Process32NextW(snapshot, &mut entry2) == 0 {
                    break;
                }
            }
        }

        CloseHandle(snapshot);
        None
    }
}

#[cfg(target_os = "windows")]
#[repr(C)]
#[allow(non_snake_case, non_camel_case_types)]
struct PROCESSENTRY32W {
    dwSize: u32,
    cntUsage: u32,
    th32ProcessID: u32,
    th32DefaultHeapID: usize,
    th32ModuleID: u32,
    cntThreads: u32,
    th32ParentProcessID: u32,
    pcPriClassBase: i32,
    dwFlags: u32,
    szExeFile: [u16; 260],
}

#[cfg(target_os = "windows")]
type HANDLE = *mut std::ffi::c_void;

#[cfg(target_os = "windows")]
const TH32CS_SNAPPROCESS: u32 = 0x00000002;
#[cfg(target_os = "windows")]
const INVALID_HANDLE_VALUE: HANDLE = -1_isize as HANDLE;

#[cfg(target_os = "windows")]
extern "system" {
    fn CreateToolhelp32Snapshot(dwFlags: u32, th32ProcessID: u32) -> HANDLE;
    fn Process32FirstW(hSnapshot: HANDLE, lppe: *mut PROCESSENTRY32W) -> i32;
    fn Process32NextW(hSnapshot: HANDLE, lppe: *mut PROCESSENTRY32W) -> i32;
    fn CloseHandle(hObject: HANDLE) -> i32;
}

#[cfg(target_os = "windows")]
unsafe fn windows_snapshot() -> Option<HANDLE> {
    let h = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if h == INVALID_HANDLE_VALUE || h.is_null() {
        None
    } else {
        Some(h)
    }
}

#[cfg(not(target_os = "windows"))]
fn get_parent_process_name() -> Option<String> {
    None
}

fn handle_server_message(
    msg: &ServerMessage,
    ws_client: &Mutex<WsClient>,
    linked_project: &Mutex<Option<ProjectInfo>>,
    last_project_id: &Mutex<Option<String>>,
    is_recording: &AtomicBool,
    recorder: &Mutex<AudioRecorder>,
    sample_rate: &atomic_float::AtomicF32,
    num_channels: &AtomicU8,
    socket: &mut tungstenite::WebSocket<tungstenite::stream::MaybeTlsStream<std::net::TcpStream>>,
    project_list: &Mutex<Vec<ProjectInfo>>,
    tasks: &Mutex<Vec<TaskInfo>>,
) {
    match msg {
        ServerMessage::Welcome {
            session_id,
            server_version: _,
        } => {
            let mut ws = ws_client.lock();
            ws.session_id = Some(session_id.clone());
        }

        ServerMessage::ProjectLinked { project } => {
            // Persist the linked project ID so we can auto-relink on reconnect
            *last_project_id.lock() = Some(project.id.clone());
            *linked_project.lock() = Some(project.clone());
        }

        ServerMessage::ProjectUnlinked => {
            *last_project_id.lock() = None;
            *linked_project.lock() = None;
            // Clear tasks when unlinked
            tasks.lock().clear();
        }

        ServerMessage::ProjectUpdated { project } => {
            let mut current = linked_project.lock();
            if current.as_ref().map(|p| &p.id) == Some(&project.id) {
                *current = Some(project.clone());
            }
        }

        ServerMessage::ProjectList { projects } => {
            *project_list.lock() = projects.clone();
        }

        ServerMessage::TaskList { tasks: task_list } => {
            *tasks.lock() = task_list.clone();
        }

        ServerMessage::TaskUpdated { tasks: task_list } => {
            *tasks.lock() = task_list.clone();
        }

        ServerMessage::StartRecording => {
            if !is_recording.load(Ordering::Relaxed) {
                let sr = sample_rate.load(Ordering::Relaxed) as u32;
                let ch = num_channels.load(Ordering::Relaxed) as u16;
                let mut rec = recorder.lock();
                rec.start(sr, ch);
                is_recording.store(true, Ordering::Relaxed);

                // Ack state update
                let state_msg = PluginMessage::StateUpdate {
                    is_recording: true,
                    is_armed: false,
                    gain_db: 0.0,
                    auto_record: false,
                    capture_offline_renders: None,
                };
                if let Ok(json) = serde_json::to_string(&state_msg) {
                    let _ = socket.send(Message::Text(json));
                }
            }
        }

        ServerMessage::StopRecording => {
            if is_recording.load(Ordering::Relaxed) {
                let mut rec = recorder.lock();
                let tail = crate::recorder::TailSettings::default();
                if let Some(file_path) = rec.stop(&tail) {
                    is_recording.store(false, Ordering::Relaxed);

                    // Capture analysis data before clearing
                    let peak_db_val = rec.peak_db();
                    let rms_db_val = rec.rms_db();

                    // Notify the server
                    let complete_msg = PluginMessage::RecordingComplete {
                        file_path,
                        name: format!(
                            "Recording {}",
                            chrono::Local::now().format("%Y-%m-%d %H:%M:%S")
                        ),
                        duration_secs: rec.duration_secs(),
                        sample_rate: rec.sample_rate(),
                        channels: rec.channels(),
                        source: Some("manual".to_string()),
                        peak_db: Some(peak_db_val),
                        rms_db: Some(rms_db_val),
                    };
                    if let Ok(json) = serde_json::to_string(&complete_msg) {
                        let _ = socket.send(Message::Text(json));
                    }
                }
            }
        }

        ServerMessage::RecordingImported {
            version_id: _,
            version_number: _,
        } => {
            // Recording was imported successfully
        }

        ServerMessage::Error { message } => {
            eprintln!("Server error: {}", message);
        }

        ServerMessage::Pong => {}
    }
}
