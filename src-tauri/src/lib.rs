mod commands;
mod database;
mod flp_parser;
mod scanner;

use commands::{AppDataDir, DbState, PhotoCancelFlag, SettingsState};
use std::sync::atomic::AtomicBool;
use std::sync::Mutex;
use tauri::Manager;

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
            app.manage(AppDataDir(app_data_dir));
            app.manage(PhotoCancelFlag(AtomicBool::new(false)));

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
            // Annotations
            commands::get_annotations_by_version,
            commands::create_annotation,
            commands::update_annotation,
            commands::delete_annotation,
            // Settings
            commands::get_settings,
            commands::set_settings,
            // Files
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
