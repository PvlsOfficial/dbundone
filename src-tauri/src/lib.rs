mod audio_analysis;
mod commands;
mod database;
mod flp_parser;
mod scanner;
mod websocket;

use commands::{AppDataDir, DbState, PhotoCancelFlag, PluginServerHandle, SettingsState};
use std::sync::atomic::AtomicBool;
use std::sync::Mutex;
use tauri::{Emitter, Manager};

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
struct WindowState {
    width: f64,
    height: f64,
    x: f64,
    y: f64,
    maximized: bool,
}

fn load_window_state(app_data_dir: &std::path::Path) -> Option<WindowState> {
    let path = app_data_dir.join("window-state.json");
    let data = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&data).ok()
}

fn save_window_state(app_data_dir: &std::path::Path, state: &WindowState) {
    let path = app_data_dir.join("window-state.json");
    if let Ok(data) = serde_json::to_string(state) {
        let _ = std::fs::write(path, data);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir");
            std::fs::create_dir_all(&app_data_dir).ok();

            let db_path = app_data_dir.join("dbundone.db");
            let db = database::Database::new(db_path.to_str().unwrap())
                .expect("Failed to initialize database");

            let settings = commands::load_settings(&app_data_dir);

            // Restore saved window size/position
            if let Some(state) = load_window_state(&app_data_dir) {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize {
                        width: state.width,
                        height: state.height,
                    }));
                    let _ = window.set_position(tauri::Position::Logical(tauri::LogicalPosition {
                        x: state.x,
                        y: state.y,
                    }));
                    if state.maximized {
                        let _ = window.maximize();
                    }
                }
            }

            app.manage(DbState(Mutex::new(db)));
            app.manage(SettingsState(Mutex::new(settings)));
            app.manage(AppDataDir(app_data_dir.clone()));
            app.manage(PhotoCancelFlag(AtomicBool::new(false)));

            // Start the WebSocket server for VST3 plugin communication
            let plugin_state = websocket::PluginServerState::new();
            let plugin_state_clone = plugin_state.clone();
            app.manage(PluginServerHandle(plugin_state.clone()));

            // Create recordings directory
            let recordings_dir = app_data_dir.join("recordings");
            std::fs::create_dir_all(&recordings_dir).ok();

            // Start WebSocket server on a background thread
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let port = 9847; // Default port for DBundone plugin server
                match websocket::start_server(plugin_state_clone.clone(), port).await {
                    Ok(bound_port) => {
                        log::info!("Plugin server started on port {}", bound_port);
                    }
                    Err(e) => {
                        log::error!("Failed to start plugin server: {}", e);
                    }
                }

                // Forward plugin events to Tauri event system, and handle
                // task CRUD / BPM / project-link requests server-side
                let mut rx = plugin_state_clone.event_tx.subscribe();
                loop {
                    match rx.recv().await {
                        Ok(ref event) => {
                            // Handle events that need server-side DB access
                            match event {
                                websocket::PluginEvent::PluginRequestedProjects { session_id } => {
                                    let projects = {
                                        let db = app_handle.state::<commands::DbState>();
                                        let database = db.0.lock().unwrap();
                                        database.get_projects().unwrap_or_default()
                                    };
                                    let infos: Vec<websocket::ProjectInfo> = projects.into_iter().map(|p| {
                                        websocket::ProjectInfo {
                                            id: p.id, title: p.title, status: p.status,
                                            bpm: p.bpm, musical_key: p.musical_key,
                                            artwork_path: p.artwork_path, daw_type: p.daw_type,
                                            collection_name: p.collection_name,
                                        }
                                    }).collect();
                                    let _ = plugin_state_clone.send_to_session(
                                        session_id,
                                        websocket::ServerMessage::ProjectList { projects: infos },
                                    ).await;
                                }
                                websocket::PluginEvent::PluginRequestedLink { session_id, project_id } => {
                                    let project = {
                                        let db = app_handle.state::<commands::DbState>();
                                        let database = db.0.lock().unwrap();
                                        database.get_project(project_id).ok().flatten()
                                    };
                                    if let Some(p) = project {
                                        // Persistently mark this project as plugin-linked
                                        if !p.plugin_linked {
                                            let db = app_handle.state::<commands::DbState>();
                                            let database = db.0.lock().unwrap();
                                            let _ = database.update_project(project_id, &serde_json::json!({ "pluginLinked": true }));
                                        }
                                        let info = websocket::ProjectInfo {
                                            id: p.id.clone(), title: p.title, status: p.status,
                                            bpm: p.bpm, musical_key: p.musical_key,
                                            artwork_path: p.artwork_path, daw_type: p.daw_type,
                                            collection_name: p.collection_name,
                                        };
                                        let _ = plugin_state_clone.link_session_to_project(
                                            session_id, project_id, info,
                                        ).await;
                                    }
                                }
                                websocket::PluginEvent::PluginRequestedTasks { session_id: _, project_id } => {
                                    let tasks = {
                                        let db = app_handle.state::<commands::DbState>();
                                        let database = db.0.lock().unwrap();
                                        database.get_tasks_by_project(project_id).unwrap_or_default()
                                    };
                                    let task_infos: Vec<websocket::TaskInfo> = tasks.into_iter().map(|t| {
                                        websocket::TaskInfo {
                                            id: t.id, title: t.title, description: t.description,
                                            status: t.status, order: t.order,
                                        }
                                    }).collect();
                                    plugin_state_clone.send_tasks_to_project_sessions(
                                        project_id, task_infos,
                                    ).await;
                                }
                                websocket::PluginEvent::PluginCreateTask { session_id: _, project_id, title, description } => {
                                    let _task = {
                                        let db = app_handle.state::<commands::DbState>();
                                        let database = db.0.lock().unwrap();
                                        database.create_task(&serde_json::json!({
                                            "title": title,
                                            "description": description,
                                            "projectId": project_id,
                                            "status": "todo",
                                        }))
                                    };
                                    // Refresh task list for all sessions linked to this project
                                    let tasks = {
                                        let db = app_handle.state::<commands::DbState>();
                                        let database = db.0.lock().unwrap();
                                        database.get_tasks_by_project(project_id).unwrap_or_default()
                                    };
                                    let task_infos: Vec<websocket::TaskInfo> = tasks.into_iter().map(|t| {
                                        websocket::TaskInfo {
                                            id: t.id, title: t.title, description: t.description,
                                            status: t.status, order: t.order,
                                        }
                                    }).collect();
                                    plugin_state_clone.send_task_update_to_project_sessions(
                                        project_id, task_infos,
                                    ).await;
                                    // Also emit to frontend so it can refresh
                                    let _ = app_handle.emit("tasks-changed", project_id);
                                }
                                websocket::PluginEvent::PluginUpdateTask { session_id: _, task_id, title, description, status } => {
                                    let project_id = {
                                        let db = app_handle.state::<commands::DbState>();
                                        let database = db.0.lock().unwrap();
                                        database.get_task(task_id).ok().flatten()
                                            .and_then(|t| t.project_id)
                                    };
                                    {
                                        let db = app_handle.state::<commands::DbState>();
                                        let database = db.0.lock().unwrap();
                                        let mut updates = serde_json::Map::new();
                                        if let Some(t) = title { updates.insert("title".into(), serde_json::json!(t)); }
                                        if let Some(d) = description { updates.insert("description".into(), serde_json::json!(d)); }
                                        if let Some(s) = status { updates.insert("status".into(), serde_json::json!(s)); }
                                        let _ = database.update_task(task_id, &serde_json::Value::Object(updates));
                                    }
                                    if let Some(ref pid) = project_id {
                                        let tasks = {
                                            let db = app_handle.state::<commands::DbState>();
                                            let database = db.0.lock().unwrap();
                                            database.get_tasks_by_project(pid).unwrap_or_default()
                                        };
                                        let task_infos: Vec<websocket::TaskInfo> = tasks.into_iter().map(|t| {
                                            websocket::TaskInfo {
                                                id: t.id, title: t.title, description: t.description,
                                                status: t.status, order: t.order,
                                            }
                                        }).collect();
                                        plugin_state_clone.send_task_update_to_project_sessions(
                                            pid, task_infos,
                                        ).await;
                                        let _ = app_handle.emit("tasks-changed", pid);
                                    }
                                }
                                websocket::PluginEvent::PluginDeleteTask { session_id: _, task_id } => {
                                    let project_id = {
                                        let db = app_handle.state::<commands::DbState>();
                                        let database = db.0.lock().unwrap();
                                        let pid = database.get_task(task_id).ok().flatten()
                                            .and_then(|t| t.project_id);
                                        let _ = database.delete_task(task_id);
                                        pid
                                    };
                                    if let Some(ref pid) = project_id {
                                        let tasks = {
                                            let db = app_handle.state::<commands::DbState>();
                                            let database = db.0.lock().unwrap();
                                            database.get_tasks_by_project(pid).unwrap_or_default()
                                        };
                                        let task_infos: Vec<websocket::TaskInfo> = tasks.into_iter().map(|t| {
                                            websocket::TaskInfo {
                                                id: t.id, title: t.title, description: t.description,
                                                status: t.status, order: t.order,
                                            }
                                        }).collect();
                                        plugin_state_clone.send_task_update_to_project_sessions(
                                            pid, task_infos,
                                        ).await;
                                        let _ = app_handle.emit("tasks-changed", pid);
                                    }
                                }
                                websocket::PluginEvent::PluginTransportBpm { session_id: _, project_id, bpm } => {
                                    // Update the project BPM in the database from DAW transport
                                    let bpm_i = *bpm as i64;
                                    {
                                        let db = app_handle.state::<commands::DbState>();
                                        let database = db.0.lock().unwrap();
                                        if let Ok(Some(p)) = database.get_project(project_id) {
                                            if p.bpm != bpm_i {
                                                let _ = database.update_project(project_id, &serde_json::json!({ "bpm": bpm_i }));
                                            }
                                        }
                                    }
                                }
                                _ => {}
                            }
                            // Always forward events to the frontend
                            let _ = app_handle.emit("plugin-event", event);
                        }
                        Err(tokio::sync::broadcast::error::RecvError::Lagged(n)) => {
                            log::warn!("Plugin event listener lagged by {} messages", n);
                        }
                        Err(_) => break,
                    }
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                if let Ok(scale) = window.scale_factor() {
                    if let (Ok(size), Ok(position), Ok(maximized)) =
                        (window.outer_size(), window.outer_position(), window.is_maximized())
                    {
                        let state = WindowState {
                            width: size.width as f64 / scale,
                            height: size.height as f64 / scale,
                            x: position.x as f64 / scale,
                            y: position.y as f64 / scale,
                            maximized,
                        };
                        if let Ok(app_data_dir) = window.app_handle().path().app_data_dir() {
                            save_window_state(&app_data_dir, &state);
                        }
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            // Projects
            commands::get_projects,
            commands::get_project,
            commands::create_project,
            commands::update_project,
            commands::delete_project,
            commands::clear_all_projects,
            // Groups
            commands::get_groups,
            commands::get_group,
            commands::create_group,
            commands::update_group,
            commands::delete_group,
            // Tasks
            commands::get_tasks,
            commands::get_tasks_by_project,
            commands::create_task,
            commands::update_task,
            commands::delete_task,
            commands::reorder_tasks,
            commands::reorder_projects,
            // Tags
            commands::get_tags,
            commands::create_tag,
            commands::delete_tag,
            // Versions
            commands::get_versions_by_project,
            commands::get_version,
            commands::create_version,
            commands::update_version,
            commands::delete_version,
            commands::get_project_version_sources,
            // Annotations
            commands::get_annotations_by_version,
            commands::create_annotation,
            commands::update_annotation,
            commands::delete_annotation,
            // Settings
            commands::get_settings,
            commands::set_settings,
            // Files
            commands::scan_sample_tree,
            commands::read_dir_contents,
            commands::detect_projects,
            commands::open_in_daw,
            commands::open_folder,
            commands::load_audio_file,
            commands::compute_audio_peaks,
            commands::get_cached_peaks,
            commands::read_image_base64,
            commands::get_app_version,
            // Scanning
            commands::scan_fl_folder,
            commands::scan_ableton_folder,
            commands::scan_daw_folder,
            commands::update_file_mod_dates,
            commands::update_daw_types,
            // Metadata
            commands::extract_flp_metadata,
            commands::extract_flp_metadata_batch,
            // AI
            commands::generate_artwork,
            commands::fetch_unsplash_photo,
            // Batch photo operations
            commands::batch_fetch_photos,
            commands::cancel_batch_photos,
            commands::remove_all_artwork,
            // Artwork history
            commands::get_artwork_history,
            commands::add_artwork_history_entry,
            commands::delete_artwork_history_entry,
            commands::set_artwork_from_history,
            // Plugin session management
            commands::get_plugin_sessions,
            commands::get_plugin_sessions_for_project,
            commands::link_plugin_to_project,
            commands::unlink_plugin_from_project,
            commands::request_plugin_start_recording,
            commands::request_plugin_stop_recording,
            commands::get_plugin_server_port,
            commands::send_project_list_to_plugin,
            commands::import_plugin_recording,
            commands::delete_project_recordings,
            commands::delete_all_recordings,
            // Audio Analysis
            commands::analyze_audio_version,
            commands::get_audio_analysis,
            // FLP Analysis (extended)
            commands::analyze_flp_project,
            commands::clear_flp_analysis_cache,
            // User Profile
            commands::get_user_profile,
            commands::update_user_profile,
            // Collaboration
            commands::create_project_share,
            commands::get_project_shares,
            commands::delete_project_share,
            // Onboarding
            commands::get_onboarding_state,
            commands::update_onboarding_state,
            // Annotation-Task conversion
            commands::convert_annotation_to_task,
            commands::unconvert_annotation_from_task,
            commands::update_annotation_task,
            commands::get_task_annotations_by_project,
            // Screenshot
            commands::capture_window_screenshot,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
