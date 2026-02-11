use crate::database::Database;
use crate::scanner;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

pub struct DbState(pub Mutex<Database>);
pub struct SettingsState(pub Mutex<AppSettings>);
pub struct AppDataDir(pub PathBuf);
pub struct PhotoCancelFlag(pub AtomicBool);

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    #[serde(rename = "flStudioPath")]
    pub fl_studio_path: Option<String>,
    #[serde(rename = "aiApiKey")]
    pub ai_api_key: String,
    #[serde(rename = "aiApiUrl")]
    pub ai_api_url: Option<String>,
    #[serde(rename = "aiProvider")]
    pub ai_provider: String,
    pub theme: String,
    #[serde(rename = "accentColor")]
    pub accent_color: String,
    #[serde(rename = "autoGenerateArtwork")]
    pub auto_generate_artwork: bool,
    #[serde(rename = "excludeAutosaves")]
    pub exclude_autosaves: bool,
    #[serde(rename = "selectedDAWs")]
    pub selected_daws: Vec<String>,
    #[serde(rename = "dawFolders")]
    pub daw_folders: serde_json::Value,
    #[serde(rename = "viewMode")]
    pub view_mode: String,
    #[serde(rename = "gridSize")]
    pub grid_size: String,
    #[serde(rename = "unsplashEnabled")]
    pub unsplash_enabled: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        AppSettings {
            fl_studio_path: None,
            ai_api_key: String::new(),
            ai_api_url: None,
            ai_provider: "local".to_string(),
            theme: "dark".to_string(),
            accent_color: "#6366f1".to_string(),
            auto_generate_artwork: false,
            exclude_autosaves: true,
            selected_daws: vec!["FL Studio".to_string(), "Ableton Live".to_string()],
            daw_folders: serde_json::json!({}),
            view_mode: "grid".to_string(),
            grid_size: "medium".to_string(),
            unsplash_enabled: true,
        }
    }
}

fn get_settings_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("settings.json")
}

pub fn load_settings(app_data_dir: &Path) -> AppSettings {
    let settings_path = get_settings_path(app_data_dir);
    if settings_path.exists() {
        match fs::read_to_string(&settings_path) {
            Ok(data) => match serde_json::from_str::<AppSettings>(&data) {
                Ok(settings) => return settings,
                Err(e) => log::error!("Failed to parse settings: {}", e),
            },
            Err(e) => log::error!("Failed to read settings: {}", e),
        }
    }
    AppSettings::default()
}

fn save_settings_to_disk(app_data_dir: &Path, settings: &AppSettings) -> Result<(), String> {
    let settings_path = get_settings_path(app_data_dir);
    let json = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(settings_path, json).map_err(|e| e.to_string())
}

// ============ PROJECT COMMANDS ============

#[tauri::command]
pub fn get_projects(db: State<DbState>) -> Result<Vec<crate::database::Project>, String> {
    let database = db.0.lock().map_err(|e| e.to_string())?;
    database.get_projects()
}

#[tauri::command]
pub fn get_project(db: State<DbState>, id: String) -> Result<Option<crate::database::Project>, String> {
    let database = db.0.lock().map_err(|e| e.to_string())?;
    database.get_project(&id)
}

#[tauri::command]
pub fn create_project(db: State<DbState>, project: Value) -> Result<crate::database::Project, String> {
    let database = db.0.lock().map_err(|e| e.to_string())?;
    database.create_project(&project)
}

#[tauri::command]
pub fn update_project(db: State<DbState>, id: String, project: Value) -> Result<Option<crate::database::Project>, String> {
    let database = db.0.lock().map_err(|e| e.to_string())?;
    database.update_project(&id, &project)
}

#[tauri::command]
pub fn delete_project(db: State<DbState>, id: String) -> Result<bool, String> {
    let database = db.0.lock().map_err(|e| e.to_string())?;
    database.delete_project(&id)
}

#[tauri::command]
pub fn clear_all_projects(db: State<DbState>) -> Result<i64, String> {
    let database = db.0.lock().map_err(|e| e.to_string())?;
    database.clear_all_projects()
}

// ============ GROUP COMMANDS ============

#[tauri::command]
pub fn get_groups(db: State<DbState>) -> Result<Vec<crate::database::ProjectGroup>, String> {
    let database = db.0.lock().map_err(|e| e.to_string())?;
    database.get_groups()
}

#[tauri::command]
pub fn get_group(db: State<DbState>, id: String) -> Result<Option<crate::database::ProjectGroup>, String> {
    let database = db.0.lock().map_err(|e| e.to_string())?;
    database.get_group(&id)
}

#[tauri::command]
pub fn create_group(db: State<DbState>, group: Value) -> Result<crate::database::ProjectGroup, String> {
    let database = db.0.lock().map_err(|e| e.to_string())?;
    database.create_group(&group)
}

#[tauri::command]
pub fn update_group(db: State<DbState>, id: String, group: Value) -> Result<Option<crate::database::ProjectGroup>, String> {
    let database = db.0.lock().map_err(|e| e.to_string())?;
    database.update_group(&id, &group)
}

#[tauri::command]
pub fn delete_group(db: State<DbState>, id: String) -> Result<bool, String> {
    let database = db.0.lock().map_err(|e| e.to_string())?;
    database.delete_group(&id)
}

// ============ TASK COMMANDS ============

#[tauri::command]
pub fn get_tasks(db: State<DbState>) -> Result<Vec<crate::database::Task>, String> {
    let database = db.0.lock().map_err(|e| e.to_string())?;
    database.get_tasks()
}

#[tauri::command]
pub fn get_tasks_by_project(db: State<DbState>, project_id: String) -> Result<Vec<crate::database::Task>, String> {
    let database = db.0.lock().map_err(|e| e.to_string())?;
    database.get_tasks_by_project(&project_id)
}

#[tauri::command]
pub fn create_task(db: State<DbState>, task: Value) -> Result<crate::database::Task, String> {
    let database = db.0.lock().map_err(|e| e.to_string())?;
    database.create_task(&task)
}

#[tauri::command]
pub fn update_task(db: State<DbState>, id: String, task: Value) -> Result<Option<crate::database::Task>, String> {
    let database = db.0.lock().map_err(|e| e.to_string())?;
    database.update_task(&id, &task)
}

#[tauri::command]
pub fn delete_task(db: State<DbState>, id: String) -> Result<bool, String> {
    let database = db.0.lock().map_err(|e| e.to_string())?;
    database.delete_task(&id)
}

#[tauri::command]
pub fn reorder_tasks(db: State<DbState>, tasks: Vec<Value>) -> Result<bool, String> {
    let database = db.0.lock().map_err(|e| e.to_string())?;
    database.reorder_tasks(&tasks)
}

// ============ TAG COMMANDS ============

#[tauri::command]
pub fn get_tags(db: State<DbState>) -> Result<Vec<crate::database::Tag>, String> {
    let database = db.0.lock().map_err(|e| e.to_string())?;
    database.get_tags()
}

#[tauri::command]
pub fn create_tag(db: State<DbState>, tag: Value) -> Result<crate::database::Tag, String> {
    let database = db.0.lock().map_err(|e| e.to_string())?;
    database.create_tag(&tag)
}

#[tauri::command]
pub fn delete_tag(db: State<DbState>, id: String) -> Result<bool, String> {
    let database = db.0.lock().map_err(|e| e.to_string())?;
    database.delete_tag(&id)
}

// ============ VERSION COMMANDS ============

#[tauri::command]
pub fn get_versions_by_project(db: State<DbState>, project_id: String) -> Result<Vec<crate::database::AudioVersion>, String> {
    let database = db.0.lock().map_err(|e| e.to_string())?;
    database.get_versions_by_project(&project_id)
}

#[tauri::command]
pub fn get_version(db: State<DbState>, id: String) -> Result<Option<crate::database::AudioVersion>, String> {
    let database = db.0.lock().map_err(|e| e.to_string())?;
    database.get_version(&id)
}

#[tauri::command]
pub fn create_version(db: State<DbState>, version: Value) -> Result<crate::database::AudioVersion, String> {
    let database = db.0.lock().map_err(|e| e.to_string())?;
    database.create_version(&version)
}

#[tauri::command]
pub fn update_version(db: State<DbState>, id: String, version: Value) -> Result<Option<crate::database::AudioVersion>, String> {
    let database = db.0.lock().map_err(|e| e.to_string())?;
    database.update_version(&id, &version)
}

#[tauri::command]
pub fn delete_version(db: State<DbState>, id: String) -> Result<bool, String> {
    let database = db.0.lock().map_err(|e| e.to_string())?;
    database.delete_version(&id)
}

// ============ ANNOTATION COMMANDS ============

#[tauri::command]
pub fn get_annotations_by_version(db: State<DbState>, version_id: String) -> Result<Vec<crate::database::Annotation>, String> {
    let database = db.0.lock().map_err(|e| e.to_string())?;
    database.get_annotations_by_version(&version_id)
}

#[tauri::command]
pub fn create_annotation(db: State<DbState>, annotation: Value) -> Result<crate::database::Annotation, String> {
    let database = db.0.lock().map_err(|e| e.to_string())?;
    database.create_annotation(&annotation)
}

#[tauri::command]
pub fn update_annotation(db: State<DbState>, id: String, annotation: Value) -> Result<Option<crate::database::Annotation>, String> {
    let database = db.0.lock().map_err(|e| e.to_string())?;
    database.update_annotation(&id, &annotation)
}

#[tauri::command]
pub fn delete_annotation(db: State<DbState>, id: String) -> Result<bool, String> {
    let database = db.0.lock().map_err(|e| e.to_string())?;
    database.delete_annotation(&id)
}

// ============ SETTINGS COMMANDS ============

#[tauri::command]
pub fn get_settings(settings: State<SettingsState>) -> Result<AppSettings, String> {
    let s = settings.0.lock().map_err(|e| e.to_string())?;
    Ok(s.clone())
}

#[tauri::command]
pub fn set_settings(
    settings_state: State<SettingsState>,
    app_data: State<AppDataDir>,
    settings: Value,
) -> Result<bool, String> {
    let mut current = settings_state.0.lock().map_err(|e| e.to_string())?;

    // Merge incoming partial settings with existing
    let mut current_json = serde_json::to_value(&*current).map_err(|e| e.to_string())?;
    if let (Some(current_obj), Some(new_obj)) = (current_json.as_object_mut(), settings.as_object()) {
        for (k, v) in new_obj {
            current_obj.insert(k.clone(), v.clone());
        }
    }
    *current = serde_json::from_value(current_json).map_err(|e| e.to_string())?;
    save_settings_to_disk(&app_data.0, &current)?;
    Ok(true)
}

// ============ FILE OPERATION COMMANDS ============

#[tauri::command]
pub fn read_dir_contents(folder_path: String) -> Result<Vec<String>, String> {
    let entries = fs::read_dir(&folder_path).map_err(|e| e.to_string())?;
    let mut names = Vec::new();
    for entry in entries {
        if let Ok(entry) = entry {
            if let Some(name) = entry.file_name().to_str() {
                names.push(name.to_string());
            }
        }
    }
    Ok(names)
}

#[tauri::command]
pub fn detect_projects(folder_path: String) -> Result<Value, String> {
    let mut has_flp = false;
    let mut has_als = false;

    fn scan(dir: &Path, has_flp: &mut bool, has_als: &mut bool) {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    scan(&path, has_flp, has_als);
                } else if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                    match ext.to_lowercase().as_str() {
                        "flp" => *has_flp = true,
                        "als" => *has_als = true,
                        "zip" => {
                            // Check if zip contains FLP files
                            if !*has_flp && scanner::zip_contains_flp_quick(&path.to_string_lossy()) {
                                *has_flp = true;
                            }
                        }
                        _ => {}
                    }
                }
            }
        }
    }

    scan(Path::new(&folder_path), &mut has_flp, &mut has_als);
    Ok(serde_json::json!({ "hasFLP": has_flp, "hasALS": has_als }))
}

#[tauri::command]
pub fn open_in_daw(file_path: String, settings: State<SettingsState>) -> Result<Value, String> {
    // For .zip files, open with FL Studio directly instead of the OS default
    // (which would open a zip archiver). FL Studio natively supports opening .zip
    // files that contain .flp projects.
    let is_zip = Path::new(&file_path)
        .extension()
        .map(|e| e.to_ascii_lowercase() == "zip")
        .unwrap_or(false);

    if is_zip {
        let fl_path = settings
            .0
            .lock()
            .map_err(|e| e.to_string())?
            .fl_studio_path
            .clone();

        if let Some(fl_exe) = fl_path {
            if Path::new(&fl_exe).exists() {
                match std::process::Command::new(&fl_exe).arg(&file_path).spawn() {
                    Ok(_) => return Ok(serde_json::json!({ "success": true })),
                    Err(e) => {
                        return Ok(serde_json::json!({
                            "success": false,
                            "error": format!("Failed to launch FL Studio: {}", e)
                        }));
                    }
                }
            }
        }
        // Fallback: if FL Studio path is not set, try open::that and return a hint
        return match open::that(&file_path) {
            Ok(_) => Ok(serde_json::json!({ "success": true })),
            Err(_) => Ok(serde_json::json!({
                "success": false,
                "error": "Set your FL Studio path in Settings to open .zip projects directly in FL Studio"
            })),
        };
    }

    match open::that(&file_path) {
        Ok(_) => Ok(serde_json::json!({ "success": true })),
        Err(e) => Ok(serde_json::json!({ "success": false, "error": e.to_string() })),
    }
}

#[tauri::command]
pub fn open_folder(folder_path: String) -> Result<Value, String> {
    match open::that(&folder_path) {
        Ok(_) => Ok(serde_json::json!({ "success": true })),
        Err(e) => Ok(serde_json::json!({ "success": false, "error": e.to_string() })),
    }
}

#[tauri::command]
pub fn load_audio_file(file_path: String) -> Result<Vec<u8>, String> {
    fs::read(&file_path).map_err(|e| format!("Failed to load audio file: {}", e))
}

// ============ PEAKS DISK CACHE ============

/// Build a cache key from file path + file modification time.
/// If the file changes, the cache is automatically invalidated.
fn peaks_cache_key(file_path: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let mut hasher = DefaultHasher::new();
    file_path.hash(&mut hasher);

    // Include file modification time so edits invalidate cache
    if let Ok(meta) = fs::metadata(file_path) {
        if let Ok(modified) = meta.modified() {
            modified.hash(&mut hasher);
        }
        meta.len().hash(&mut hasher);
    }

    format!("{:016x}", hasher.finish())
}

fn peaks_cache_dir(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("peaks_cache")
}

fn read_cached_peaks(app_data_dir: &Path, file_path: &str, num_peaks: usize) -> Option<Vec<f32>> {
    let dir = peaks_cache_dir(app_data_dir);
    let key = peaks_cache_key(file_path);
    let cache_path = dir.join(format!("{}_{}.bin", key, num_peaks));

    let data = fs::read(&cache_path).ok()?;
    // Each f32 is 4 bytes
    if data.len() != num_peaks * 4 {
        return None;
    }

    let peaks: Vec<f32> = data
        .chunks_exact(4)
        .map(|chunk| f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]))
        .collect();

    Some(peaks)
}

fn write_cached_peaks(app_data_dir: &Path, file_path: &str, num_peaks: usize, peaks: &[f32]) {
    let dir = peaks_cache_dir(app_data_dir);
    let _ = fs::create_dir_all(&dir);
    let key = peaks_cache_key(file_path);
    let cache_path = dir.join(format!("{}_{}.bin", key, num_peaks));

    let data: Vec<u8> = peaks.iter().flat_map(|p| p.to_le_bytes()).collect();
    let _ = fs::write(&cache_path, &data);
}

// ============ WAVEFORM PEAKS ============

/// Core peak computation — streaming approach that never buffers all samples.
/// Computes peaks on-the-fly as packets are decoded, using constant memory.
fn compute_peaks_streaming(file_path: &str, num_peaks: usize) -> Result<Vec<f32>, String> {
    use symphonia::core::codecs::DecoderOptions;
    use symphonia::core::formats::FormatOptions;
    use symphonia::core::io::MediaSourceStream;
    use symphonia::core::meta::MetadataOptions;
    use symphonia::core::probe::Hint;

    let file = fs::File::open(file_path)
        .map_err(|e| format!("Failed to open audio file: {}", e))?;

    let mss = MediaSourceStream::new(Box::new(file), Default::default());

    let mut hint = Hint::new();
    if let Some(ext) = Path::new(file_path).extension().and_then(|e| e.to_str()) {
        hint.with_extension(ext);
    }

    let probed = symphonia::default::get_probe()
        .format(
            &hint,
            mss,
            &FormatOptions::default(),
            &MetadataOptions::default(),
        )
        .map_err(|e| format!("Failed to probe audio format: {}", e))?;

    let mut format_reader = probed.format;
    let track = format_reader
        .default_track()
        .ok_or("No audio track found")?
        .clone();

    // Try to get total sample count from codec params for streaming peak computation
    let total_samples_hint = track.codec_params.n_frames.map(|n| n as usize);

    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &DecoderOptions::default())
        .map_err(|e| format!("Failed to create decoder: {}", e))?;

    if let Some(total_samples) = total_samples_hint {
        // FAST PATH: We know the total sample count, so we can compute peaks in a
        // single streaming pass with constant memory — no buffering at all.
        let samples_per_peak = total_samples / num_peaks;
        if samples_per_peak == 0 {
            return Ok(vec![0.0; num_peaks]);
        }

        let mut peaks = vec![0.0f32; num_peaks];
        let mut sample_index: usize = 0;

        loop {
            let packet = match format_reader.next_packet() {
                Ok(p) => p,
                Err(symphonia::core::errors::Error::IoError(ref e))
                    if e.kind() == std::io::ErrorKind::UnexpectedEof => break,
                Err(_) => break,
            };
            if packet.track_id() != track.id { continue; }

            match decoder.decode(&packet) {
                Ok(decoded) => {
                    let spec = *decoded.spec();
                    let num_channels = spec.channels.count().max(1);
                    let num_frames = decoded.frames();

                    let mut sample_buf = symphonia::core::audio::SampleBuffer::<f32>::new(
                        num_frames as u64, *decoded.spec(),
                    );
                    sample_buf.copy_interleaved_ref(decoded);
                    let samples = sample_buf.samples();

                    // Process channel 0 samples directly into peak buckets
                    for i in (0..samples.len()).step_by(num_channels) {
                        let peak_idx = (sample_index * num_peaks / total_samples).min(num_peaks - 1);
                        let abs = samples[i].abs();
                        if abs > peaks[peak_idx] {
                            peaks[peak_idx] = abs;
                        }
                        sample_index += 1;
                    }
                }
                Err(symphonia::core::errors::Error::DecodeError(_)) => continue,
                Err(_) => break,
            }
        }

        normalize_peaks(&mut peaks);
        Ok(peaks)
    } else {
        // FALLBACK: Unknown total samples (rare). Collect all samples then downsample.
        let mut all_samples: Vec<f32> = Vec::new();

        loop {
            let packet = match format_reader.next_packet() {
                Ok(p) => p,
                Err(symphonia::core::errors::Error::IoError(ref e))
                    if e.kind() == std::io::ErrorKind::UnexpectedEof => break,
                Err(_) => break,
            };
            if packet.track_id() != track.id { continue; }

            match decoder.decode(&packet) {
                Ok(decoded) => {
                    let spec = *decoded.spec();
                    let num_channels = spec.channels.count().max(1);
                    let num_frames = decoded.frames();

                    let mut sample_buf = symphonia::core::audio::SampleBuffer::<f32>::new(
                        num_frames as u64, *decoded.spec(),
                    );
                    sample_buf.copy_interleaved_ref(decoded);
                    let samples = sample_buf.samples();

                    for i in (0..samples.len()).step_by(num_channels) {
                        all_samples.push(samples[i]);
                    }
                }
                Err(symphonia::core::errors::Error::DecodeError(_)) => continue,
                Err(_) => break,
            }
        }

        if all_samples.is_empty() {
            return Ok(vec![0.0; num_peaks]);
        }

        let samples_per_peak = all_samples.len() / num_peaks;
        if samples_per_peak == 0 {
            let mut peaks: Vec<f32> = all_samples.iter().map(|s| s.abs()).collect();
            peaks.resize(num_peaks, 0.0);
            normalize_peaks(&mut peaks);
            return Ok(peaks);
        }

        let mut peaks = Vec::with_capacity(num_peaks);
        for i in 0..num_peaks {
            let start = i * samples_per_peak;
            let end = if i == num_peaks - 1 { all_samples.len() } else { (i + 1) * samples_per_peak };
            let mut max: f32 = 0.0;
            for j in start..end {
                let abs = all_samples[j].abs();
                if abs > max { max = abs; }
            }
            peaks.push(max);
        }

        normalize_peaks(&mut peaks);
        Ok(peaks)
    }
}

fn normalize_peaks(peaks: &mut [f32]) {
    let max_peak = peaks.iter().cloned().fold(0.0f32, f32::max);
    if max_peak > 0.0 && max_peak < 0.5 {
        let boost = 0.8 / max_peak;
        for p in peaks.iter_mut() {
            *p = (*p * boost).min(1.0);
        }
    }
}

/// Get cached peaks only — returns None if not cached. Instant, no computation.
#[tauri::command]
pub fn get_cached_peaks(
    app_data_dir: State<'_, AppDataDir>,
    file_path: String,
    num_peaks: usize,
) -> Result<Option<Vec<f32>>, String> {
    let num_peaks = if num_peaks == 0 { 200 } else { num_peaks };
    Ok(read_cached_peaks(&app_data_dir.0, &file_path, num_peaks))
}

/// Compute waveform peaks with persistent disk caching and streaming decode.
/// Returns normalized peak amplitudes (0.0–1.0).
#[tauri::command]
pub async fn compute_audio_peaks(
    app_data_dir: State<'_, AppDataDir>,
    file_path: String,
    num_peaks: usize,
) -> Result<Vec<f32>, String> {
    let num_peaks = if num_peaks == 0 { 200 } else { num_peaks };
    let cache_dir = app_data_dir.0.clone();
    let file_path_clone = file_path.clone();

    // Check disk cache first (fast, no decode needed)
    if let Some(cached) = read_cached_peaks(&cache_dir, &file_path, num_peaks) {
        return Ok(cached);
    }

    // Compute on a blocking thread so we don't tie up the async runtime
    let peaks = tokio::task::spawn_blocking(move || {
        compute_peaks_streaming(&file_path_clone, num_peaks)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))??;

    // Write to disk cache for next time
    write_cached_peaks(&cache_dir, &file_path, num_peaks, &peaks);

    Ok(peaks)
}

#[tauri::command]
pub fn read_image_base64(file_path: String) -> Result<String, String> {
    let data = fs::read(&file_path).map_err(|e| format!("Failed to read image: {}", e))?;
    let ext = Path::new(&file_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png")
        .to_lowercase();
    let mime = match ext.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "bmp" => "image/bmp",
        "ico" => "image/x-icon",
        _ => "image/png",
    };
    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
    Ok(format!("data:{};base64,{}", mime, b64))
}

#[tauri::command]
pub fn get_app_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}

// ============ SCAN COMMANDS ============

#[tauri::command]
pub async fn scan_fl_folder(
    app: AppHandle,
    db: State<'_, DbState>,
    settings: State<'_, SettingsState>,
    folder_path: String,
) -> Result<Value, String> {
    let exclude_autosaves = {
        let s = settings.0.lock().map_err(|e| e.to_string())?;
        s.exclude_autosaves
    };

    // Phase 1: Scan for FLP files and zip files containing FLPs
    app.emit("scan-progress", serde_json::json!({
        "current": 0, "total": 1, "daw": "FL Studio",
        "file": "Scanning folders for FLP and ZIP files...",
        "isScanning": true, "phase": "scanning"
    })).ok();

    let flp_files = scanner::scan_for_flp_files(&folder_path, 10);
    let zip_files = scanner::scan_for_zip_files_with_flp(&folder_path, 10);

    // Phase 2: Filter autosaves
    let filtered_files = if exclude_autosaves {
        scanner::filter_autosaves(&flp_files, "flp")
    } else {
        flp_files
    };

    if filtered_files.is_empty() && zip_files.is_empty() {
        app.emit("scan-progress", serde_json::json!({
            "current": 0, "total": 0, "daw": "FL Studio",
            "file": "No new FLP or ZIP files to process",
            "isScanning": false, "phase": "complete"
        })).ok();
        return Ok(serde_json::json!({ "count": 0, "updated": 0 }));
    }

    let total = filtered_files.len();
    app.emit("scan-progress", serde_json::json!({
        "current": 0, "total": total, "daw": "FL Studio",
        "file": format!("Reading metadata from {} FLP files...", total),
        "isScanning": true, "phase": "extracting_metadata"
    })).ok();

    // Phase 3: Extract metadata using native Rust parser (no Python needed)
    // Emit per-file progress during extraction
    let metadata_map = {
        use crate::flp_parser;
        let mut map = std::collections::HashMap::new();
        for (i, path) in filtered_files.iter().enumerate() {
            if i % 5 == 0 || i == filtered_files.len() - 1 {
                let fname = Path::new(path)
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();
                app.emit("scan-progress", serde_json::json!({
                    "current": i + 1, "total": total, "daw": "FL Studio",
                    "file": fname,
                    "isScanning": true, "phase": "extracting_metadata"
                })).ok();
            }
            match flp_parser::parse_flp(path) {
                Ok(metadata) => { map.insert(path.clone(), metadata.to_json_value()); }
                Err(e) => { log::warn!("Failed to parse FLP {}: {}", path, e); }
            }
        }
        map
    };

    // Phase 4: Get existing projects
    let database = db.0.lock().map_err(|e| e.to_string())?;
    let existing_projects = database.get_projects()?;
    let mut existing_map = std::collections::HashMap::new();
    for p in &existing_projects {
        if let Some(ref path) = p.daw_project_path {
            existing_map.insert(path.clone(), p.clone());
        }
    }

    // Phase 5: Upsert
    let mut added_count = 0i64;
    let mut updated_count = 0i64;

    for (i, flp_path) in filtered_files.iter().enumerate() {
        if i % 10 == 0 {
            app.emit("scan-progress", serde_json::json!({
                "current": i + 1, "total": total, "daw": "FL Studio",
                "file": format!("Saving project {}/{}: {}", i + 1, total,
                    Path::new(flp_path).file_name().unwrap_or_default().to_string_lossy()),
                "isScanning": true, "phase": "saving_projects"
            })).ok();
        }

        let metadata = metadata_map.get(flp_path);
        let project_name = metadata
            .and_then(|m| m.get("title").and_then(|v| v.as_str()))
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| {
                Path::new(flp_path)
                    .file_stem()
                    .unwrap_or_default()
                    .to_str()
                    .unwrap_or("Untitled")
            });

        let file_stats = fs::metadata(flp_path).ok();
        let artwork_path = scanner::find_artwork_file(flp_path, project_name);

        let file_modified = file_stats.as_ref().and_then(|s| s.modified().ok()).map(|t| {
            chrono::DateTime::<chrono::Utc>::from(t).to_rfc3339()
        });
        let file_created = file_stats.as_ref().and_then(|s| s.created().ok()).map(|t| {
            chrono::DateTime::<chrono::Utc>::from(t).to_rfc3339()
        });

        if let Some(existing) = existing_map.get(flp_path) {
            let mut updates = serde_json::Map::new();
            if let Some(ref fm) = file_modified {
                updates.insert("fileModifiedAt".to_string(), serde_json::json!(fm));
                updates.insert("updatedAt".to_string(), serde_json::json!(fm));
            }
            if let Some(ref fc) = file_created {
                updates.insert("createdAt".to_string(), serde_json::json!(fc));
            }
            if let Some(m) = metadata {
                if let Some(bpm) = m.get("bpm").and_then(|v| v.as_i64().or_else(|| v.as_f64().map(|f| f as i64))) {
                    if bpm != existing.bpm {
                        updates.insert("bpm".to_string(), serde_json::json!(bpm));
                    }
                }
                if let Some(ts) = m.get("time_spent_minutes").and_then(|v| v.as_i64()) {
                    updates.insert("timeSpent".to_string(), serde_json::json!(ts));
                }
                if let Some(key) = m.get("musical_key").and_then(|v| v.as_str()) {
                    updates.insert("musicalKey".to_string(), serde_json::json!(key));
                }
                if let Some(genre) = m.get("genre").and_then(|v| v.as_str()).filter(|s| !s.is_empty()) {
                    updates.insert("genre".to_string(), serde_json::json!(genre));
                }
                if let Some(artists) = m.get("artists").and_then(|v| v.as_str()).filter(|s| !s.is_empty()) {
                    updates.insert("artists".to_string(), serde_json::json!(artists));
                }
            }
            if !updates.is_empty() {
                let _ = database.update_project(&existing.id, &Value::Object(updates));
                updated_count += 1;
            }
        } else {
            let collection_name = Path::new(flp_path)
                .parent()
                .and_then(|p| p.file_name())
                .and_then(|n| n.to_str())
                .unwrap_or("Unknown");

            let bpm = metadata.and_then(|m| m.get("bpm").and_then(|v| v.as_i64().or_else(|| v.as_f64().map(|f| f as i64)))).unwrap_or(0);
            let key = metadata
                .and_then(|m| m.get("musical_key").and_then(|v| v.as_str()))
                .unwrap_or("None");
            let time_spent = metadata.and_then(|m| m.get("time_spent_minutes").and_then(|v| v.as_i64().or_else(|| v.as_f64().map(|f| f as i64))));
            let genre = metadata.and_then(|m| m.get("genre").and_then(|v| v.as_str()).filter(|s| !s.is_empty()));
            let artists = metadata.and_then(|m| m.get("artists").and_then(|v| v.as_str()).filter(|s| !s.is_empty()));

            let project_data = serde_json::json!({
                "title": project_name,
                "artworkPath": artwork_path,
                "audioPreviewPath": null,
                "dawProjectPath": flp_path,
                "dawType": "FL Studio",
                "bpm": bpm,
                "musicalKey": key,
                "tags": [],
                "collectionName": collection_name,
                "status": "idea",
                "favoriteVersionId": null,
                "archived": false,
                "timeSpent": time_spent,
                "genre": genre,
                "artists": artists,
                "fileModifiedAt": file_modified,
                "createdAt": file_created.as_deref().unwrap_or(&chrono::Utc::now().to_rfc3339()),
                "updatedAt": file_modified.as_deref().unwrap_or(&chrono::Utc::now().to_rfc3339()),
            });

            let _ = database.create_project(&project_data);
            added_count += 1;
        }
    }

    // Phase 6: Process zip files containing FLPs
    if !zip_files.is_empty() {
        let zip_total = zip_files.len();
        app.emit("scan-progress", serde_json::json!({
            "current": 0, "total": zip_total, "daw": "FL Studio",
            "file": format!("Processing {} ZIP files...", zip_total),
            "isScanning": true, "phase": "extracting_zips"
        })).ok();

        // Resolve artwork dir for saving extracted artwork from zips
        let artwork_dir = app.path().app_data_dir()
            .map(|d| d.join("artwork"))
            .ok();
        if let Some(ref dir) = artwork_dir {
            let _ = fs::create_dir_all(dir);
        }

        for (zi, zip_path) in zip_files.iter().enumerate() {
            let zip_fname = Path::new(zip_path)
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();

            app.emit("scan-progress", serde_json::json!({
                "current": zi + 1, "total": zip_total, "daw": "FL Studio",
                "file": format!("Extracting {}", zip_fname),
                "isScanning": true, "phase": "extracting_zips"
            })).ok();

            // Skip if this zip is already a known project
            if existing_map.contains_key(zip_path) {
                // Update metadata for existing zip project
                if let Some(entries) = {
                    let entries = scanner::extract_flps_from_zip(zip_path);
                    if entries.is_empty() { None } else { Some(entries) }
                } {
                    // Use the first FLP in the zip for metadata
                    let entry = &entries[0];
                    if let Some(m) = scanner::extract_zip_flp_metadata(entry) {
                        let existing = &existing_map[zip_path];
                        let mut updates = serde_json::Map::new();
                        if let Some(bpm) = m.get("bpm").and_then(|v| v.as_i64().or_else(|| v.as_f64().map(|f| f as i64))) {
                            if bpm != existing.bpm {
                                updates.insert("bpm".to_string(), serde_json::json!(bpm));
                            }
                        }
                        if let Some(ts) = m.get("time_spent_minutes").and_then(|v| v.as_i64()) {
                            updates.insert("timeSpent".to_string(), serde_json::json!(ts));
                        }
                        if let Some(genre) = m.get("genre").and_then(|v| v.as_str()).filter(|s| !s.is_empty()) {
                            updates.insert("genre".to_string(), serde_json::json!(genre));
                        }
                        if let Some(artists) = m.get("artists").and_then(|v| v.as_str()).filter(|s| !s.is_empty()) {
                            updates.insert("artists".to_string(), serde_json::json!(artists));
                        }
                        if let Some(ref fm) = fs::metadata(zip_path).ok().and_then(|s| s.modified().ok()).map(|t| {
                            chrono::DateTime::<chrono::Utc>::from(t).to_rfc3339()
                        }) {
                            updates.insert("fileModifiedAt".to_string(), serde_json::json!(fm));
                            updates.insert("updatedAt".to_string(), serde_json::json!(fm));
                        }
                        if !updates.is_empty() {
                            let _ = database.update_project(&existing.id, &Value::Object(updates));
                            updated_count += 1;
                        }
                    }
                }
                continue;
            }

            let entries = scanner::extract_flps_from_zip(zip_path);
            if entries.is_empty() {
                continue;
            }

            // Use the first FLP in the zip for metadata (most zips contain one FLP)
            let entry = &entries[0];
            let metadata = scanner::extract_zip_flp_metadata(entry);

            let flp_stem = Path::new(&entry.flp_name)
                .file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();

            let project_name = metadata.as_ref()
                .and_then(|m| m.get("title").and_then(|v| v.as_str()))
                .filter(|s| !s.is_empty())
                .unwrap_or(&flp_stem);

            // Artwork: check inside zip first, then beside the zip on disk
            let mut artwork_path_str: Option<String> = None;

            // If artwork was found inside the zip, save it to the artwork directory
            if let (Some(ref art_dir), Some((ref art_filename, ref art_bytes))) =
                (&artwork_dir, &entry.artwork_data)
            {
                let ext = Path::new(art_filename)
                    .extension()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();
                let timestamp = chrono::Utc::now().timestamp_millis();
                let save_name = format!("zip_{}_{}.{}", flp_stem, timestamp, ext);
                let save_path = art_dir.join(&save_name);
                if fs::write(&save_path, art_bytes).is_ok() {
                    artwork_path_str = Some(save_path.to_string_lossy().to_string());
                }
            }

            // Fallback: check for artwork files beside the zip on disk
            if artwork_path_str.is_none() {
                let zip_stem = Path::new(zip_path)
                    .file_stem()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();
                artwork_path_str = scanner::find_artwork_file(zip_path, &zip_stem);
            }

            let file_stats = fs::metadata(zip_path).ok();
            let file_modified = file_stats.as_ref().and_then(|s| s.modified().ok()).map(|t| {
                chrono::DateTime::<chrono::Utc>::from(t).to_rfc3339()
            });
            let file_created = file_stats.as_ref().and_then(|s| s.created().ok()).map(|t| {
                chrono::DateTime::<chrono::Utc>::from(t).to_rfc3339()
            });

            let collection_name = Path::new(zip_path)
                .parent()
                .and_then(|p| p.file_name())
                .and_then(|n| n.to_str())
                .unwrap_or("Unknown");

            let bpm = metadata.as_ref().and_then(|m| m.get("bpm").and_then(|v| v.as_i64().or_else(|| v.as_f64().map(|f| f as i64)))).unwrap_or(0);
            let key = metadata.as_ref()
                .and_then(|m| m.get("musical_key").and_then(|v| v.as_str()))
                .unwrap_or("None");
            let time_spent = metadata.as_ref().and_then(|m| m.get("time_spent_minutes").and_then(|v| v.as_i64().or_else(|| v.as_f64().map(|f| f as i64))));
            let genre = metadata.as_ref().and_then(|m| m.get("genre").and_then(|v| v.as_str()).filter(|s| !s.is_empty()));
            let artists = metadata.as_ref().and_then(|m| m.get("artists").and_then(|v| v.as_str()).filter(|s| !s.is_empty()));

            let project_data = serde_json::json!({
                "title": project_name,
                "artworkPath": artwork_path_str,
                "audioPreviewPath": null,
                "dawProjectPath": zip_path,
                "dawType": "FL Studio",
                "bpm": bpm,
                "musicalKey": key,
                "tags": [],
                "collectionName": collection_name,
                "status": "idea",
                "favoriteVersionId": null,
                "archived": false,
                "timeSpent": time_spent,
                "genre": genre,
                "artists": artists,
                "fileModifiedAt": file_modified,
                "createdAt": file_created.as_deref().unwrap_or(&chrono::Utc::now().to_rfc3339()),
                "updatedAt": file_modified.as_deref().unwrap_or(&chrono::Utc::now().to_rfc3339()),
            });

            let _ = database.create_project(&project_data);
            added_count += 1;
        }
    }

    let msg = if added_count > 0 && updated_count > 0 {
        format!("Scan complete! Added {} new, updated {} existing", added_count, updated_count)
    } else if added_count > 0 {
        format!("Scan complete! Added {} new projects", added_count)
    } else if updated_count > 0 {
        format!("Scan complete! Updated {} projects", updated_count)
    } else {
        "Scan complete! No changes needed".to_string()
    };

    app.emit("scan-progress", serde_json::json!({
        "current": total, "total": total, "daw": "FL Studio",
        "file": msg,
        "isScanning": false, "phase": "complete"
    })).ok();

    Ok(serde_json::json!({ "count": added_count, "updated": updated_count }))
}

#[tauri::command]
pub async fn scan_ableton_folder(
    app: AppHandle,
    db: State<'_, DbState>,
    settings: State<'_, SettingsState>,
    folder_path: String,
) -> Result<Value, String> {
    let exclude_autosaves = {
        let s = settings.0.lock().map_err(|e| e.to_string())?;
        s.exclude_autosaves
    };

    let als_files_all = scanner::scan_for_als_files(&folder_path);
    let als_files = if exclude_autosaves {
        scanner::filter_autosaves(&als_files_all, "als")
    } else {
        als_files_all
    };

    let database = db.0.lock().map_err(|e| e.to_string())?;
    let existing_projects = database.get_projects()?;
    let mut existing_map = std::collections::HashMap::new();
    for p in &existing_projects {
        if let Some(ref path) = p.daw_project_path {
            existing_map.insert(path.clone(), p.clone());
        }
    }

    let mut added_count = 0i64;
    let total = als_files.len();

    for (i, als_path) in als_files.iter().enumerate() {
        app.emit("scan-progress", serde_json::json!({
            "current": i + 1, "total": total, "daw": "Ableton Live",
            "file": Path::new(als_path).file_name().unwrap_or_default().to_string_lossy(),
            "isScanning": true, "phase": "saving_projects"
        })).ok();

        let project_name = Path::new(als_path)
            .file_stem()
            .unwrap_or_default()
            .to_str()
            .unwrap_or("Untitled");

        let file_stats = fs::metadata(als_path).ok();
        let file_modified = file_stats.as_ref().and_then(|s| s.modified().ok()).map(|t| {
            chrono::DateTime::<chrono::Utc>::from(t).to_rfc3339()
        });
        let file_created = file_stats.as_ref().and_then(|s| s.created().ok()).map(|t| {
            chrono::DateTime::<chrono::Utc>::from(t).to_rfc3339()
        });

        if let Some(existing) = existing_map.get(als_path) {
            let mut updates = serde_json::Map::new();
            if let Some(ref fm) = file_modified {
                updates.insert("fileModifiedAt".to_string(), serde_json::json!(fm));
                updates.insert("updatedAt".to_string(), serde_json::json!(fm));
            }
            if let Some(ref fc) = file_created {
                updates.insert("createdAt".to_string(), serde_json::json!(fc));
            }
            if !updates.is_empty() {
                let _ = database.update_project(&existing.id, &Value::Object(updates));
            }
        } else {
            let artwork_path = scanner::find_artwork_file(als_path, project_name);
            let collection_name = Path::new(als_path)
                .parent()
                .and_then(|p| p.file_name())
                .and_then(|n| n.to_str())
                .unwrap_or("Unknown");

            let project_data = serde_json::json!({
                "title": project_name,
                "artworkPath": artwork_path,
                "audioPreviewPath": null,
                "dawProjectPath": als_path,
                "dawType": "Ableton Live",
                "bpm": 0,
                "musicalKey": "None",
                "tags": [],
                "collectionName": collection_name,
                "status": "idea",
                "favoriteVersionId": null,
                "archived": false,
                "fileModifiedAt": file_modified,
                "createdAt": file_created.as_deref().unwrap_or(&chrono::Utc::now().to_rfc3339()),
                "updatedAt": file_modified.as_deref().unwrap_or(&chrono::Utc::now().to_rfc3339()),
            });

            let _ = database.create_project(&project_data);
            added_count += 1;
        }
    }

    app.emit("scan-progress", serde_json::json!({
        "current": total, "total": total, "daw": "Ableton Live",
        "file": format!("Scan complete! Added {} projects", added_count),
        "isScanning": false, "phase": "complete"
    })).ok();

    Ok(serde_json::json!({ "count": added_count }))
}

#[tauri::command]
pub fn update_file_mod_dates(db: State<DbState>) -> Result<Value, String> {
    let database = db.0.lock().map_err(|e| e.to_string())?;
    let projects = database.get_projects()?;
    let mut updated_count = 0i64;

    for project in &projects {
        if let Some(ref daw_path) = project.daw_project_path {
            if let Ok(stats) = fs::metadata(daw_path) {
                let mut updates = serde_json::Map::new();
                if let Ok(modified) = stats.modified() {
                    let dt = chrono::DateTime::<chrono::Utc>::from(modified).to_rfc3339();
                    updates.insert("fileModifiedAt".to_string(), serde_json::json!(dt));
                    updates.insert("updatedAt".to_string(), serde_json::json!(dt));
                }
                if let Ok(created) = stats.created() {
                    let dt = chrono::DateTime::<chrono::Utc>::from(created).to_rfc3339();
                    updates.insert("createdAt".to_string(), serde_json::json!(dt));
                }
                if !updates.is_empty() {
                    let _ = database.update_project(&project.id, &Value::Object(updates));
                    updated_count += 1;
                }
            }
        }
    }

    Ok(serde_json::json!({ "count": updated_count }))
}

#[tauri::command]
pub fn update_daw_types(db: State<DbState>) -> Result<Value, String> {
    let database = db.0.lock().map_err(|e| e.to_string())?;
    let projects = database.get_projects()?;
    let mut updated_count = 0i64;

    for project in &projects {
        let mut updates = serde_json::Map::new();

        if project.daw_type.as_deref() == Some("Ableton") {
            updates.insert("dawType".to_string(), serde_json::json!("Ableton Live"));
        }

        // Fix empty titles by deriving from file path
        if project.title.is_empty() {
            if let Some(ref daw_path) = project.daw_project_path {
                let name = Path::new(daw_path)
                    .file_stem()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();
                if !name.is_empty() {
                    updates.insert("title".to_string(), serde_json::json!(name));
                }
            }
        }

        if !updates.is_empty() {
            let _ = database.update_project(&project.id, &Value::Object(updates));
            updated_count += 1;
        }
    }

    Ok(serde_json::json!({ "count": updated_count }))
}

// ============ METADATA EXTRACTION ============

#[tauri::command]
pub fn extract_flp_metadata(file_path: String) -> Result<Value, String> {
    match scanner::extract_single_flp_metadata_native(&file_path) {
        Some(v) => Ok(v),
        None => Ok(Value::Null),
    }
}

#[tauri::command]
pub fn extract_flp_metadata_batch(file_paths: Vec<String>) -> Result<Value, String> {
    let metadata = scanner::extract_flp_metadata_batch_native(&file_paths);
    Ok(serde_json::json!({ "success": true, "metadata": metadata }))
}

// ============ AI ARTWORK GENERATION ============

#[tauri::command]
pub async fn generate_artwork(
    app: AppHandle,
    db: State<'_, DbState>,
    settings: State<'_, SettingsState>,
    project_id: String,
    project_title: String,
) -> Result<Option<String>, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let artwork_dir = app_data_dir.join("artwork");
    fs::create_dir_all(&artwork_dir).map_err(|e| e.to_string())?;
    let timestamp = chrono::Utc::now().timestamp_millis();
    let output_path = artwork_dir.join(format!("{}_{}_ai.png", project_id, timestamp));

    let (api_key, provider, api_url) = {
        let s = settings.0.lock().map_err(|e| e.to_string())?;
        (s.ai_api_key.clone(), s.ai_provider.clone(), s.ai_api_url.clone())
    };

    if provider != "local" && api_key.is_empty() {
        return Err("AI API key not configured".to_string());
    }

    let prompt = format!(
        "Create abstract digital album artwork for a music track titled: \"{}\". Style: dark, moody, electronic music aesthetic, neon accents, minimalist, professional album cover. High quality, detailed.",
        project_title
    );

    let image_data = match provider.as_str() {
        "openai" => generate_with_openai(&prompt, &api_key).await,
        "stability" => generate_with_stability(&prompt, &api_key).await,
        "local" => generate_with_local_sd(&prompt).await,
        "custom" => {
            if let Some(ref url) = api_url {
                generate_with_custom_api(&prompt, &api_key, url).await
            } else {
                Err("Custom API URL not configured".to_string())
            }
        }
        _ => generate_with_openai(&prompt, &api_key).await,
    };

    match image_data {
        Ok(data) => {
            fs::write(&output_path, &data).map_err(|e| e.to_string())?;
            let path_str = output_path.to_string_lossy().to_string();
            let database = db.0.lock().map_err(|e| e.to_string())?;
            let _ = database.update_project(
                &project_id,
                &serde_json::json!({ "artworkPath": path_str }),
            );
            let _ = database.add_artwork_history(&project_id, &path_str, "ai");
            Ok(Some(path_str))
        }
        Err(e) => {
            log::error!("AI generation failed: {}", e);
            Ok(None)
        }
    }
}

async fn generate_with_openai(prompt: &str, api_key: &str) -> Result<Vec<u8>, String> {
    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.openai.com/v1/images/generations")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&serde_json::json!({
            "prompt": prompt,
            "n": 1,
            "size": "512x512",
            "response_format": "url"
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("OpenAI API error: {}", resp.status()));
    }

    let data: Value = resp.json().await.map_err(|e| e.to_string())?;
    let image_url = data["data"][0]["url"]
        .as_str()
        .ok_or("Invalid OpenAI response")?;

    download_image(image_url).await
}

async fn generate_with_stability(prompt: &str, api_key: &str) -> Result<Vec<u8>, String> {
    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Accept", "application/json")
        .json(&serde_json::json!({
            "text_prompts": [{ "text": prompt, "weight": 1 }],
            "cfg_scale": 7, "height": 512, "width": 512, "samples": 1, "steps": 30
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("Stability AI error: {}", resp.status()));
    }

    let data: Value = resp.json().await.map_err(|e| e.to_string())?;
    let b64 = data["artifacts"][0]["base64"]
        .as_str()
        .ok_or("Invalid Stability response")?;
    use base64::Engine;
    base64::engine::general_purpose::STANDARD
        .decode(b64)
        .map_err(|e| e.to_string())
}

async fn generate_with_local_sd(prompt: &str) -> Result<Vec<u8>, String> {
    let client = reqwest::Client::new();
    let resp = client
        .post("http://127.0.0.1:7860/sdapi/v1/txt2img")
        .json(&serde_json::json!({
            "prompt": prompt,
            "negative_prompt": "text, watermark, signature, blurry, low quality",
            "steps": 20, "width": 512, "height": 512, "cfg_scale": 7,
            "sampler_name": "Euler a", "batch_size": 1
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("Local SD error: {}", resp.status()));
    }

    let data: Value = resp.json().await.map_err(|e| e.to_string())?;
    let b64 = data["images"][0]
        .as_str()
        .ok_or("Invalid local SD response")?;
    use base64::Engine;
    base64::engine::general_purpose::STANDARD
        .decode(b64)
        .map_err(|e| e.to_string())
}

async fn generate_with_custom_api(prompt: &str, api_key: &str, api_url: &str) -> Result<Vec<u8>, String> {
    let client = reqwest::Client::new();
    let resp = client
        .post(api_url)
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&serde_json::json!({
            "model": "dall-e-3",
            "prompt": prompt,
            "n": 1, "size": "1024x1024", "response_format": "url"
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("Custom API error: {}", resp.status()));
    }

    let data: Value = resp.json().await.map_err(|e| e.to_string())?;
    if let Some(url) = data["data"][0]["url"].as_str() {
        download_image(url).await
    } else if let Some(b64) = data["data"][0]["b64_json"].as_str() {
        use base64::Engine;
        base64::engine::general_purpose::STANDARD
            .decode(b64)
            .map_err(|e| e.to_string())
    } else {
        Err("Invalid custom API response".to_string())
    }
}

async fn download_image(url: &str) -> Result<Vec<u8>, String> {
    let client = reqwest::Client::new();
    let resp = client
        .get(url)
        .header("User-Agent", "DBundone/1.0")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("Download error: {}", resp.status()));
    }

    resp.bytes().await.map(|b| b.to_vec()).map_err(|e| e.to_string())
}

// ============ UNSPLASH / RANDOM PHOTO ============

#[tauri::command]
pub async fn fetch_unsplash_photo(
    app: AppHandle,
    db: State<'_, DbState>,
    project_id: String,
) -> Result<Option<String>, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let artwork_dir = app_data_dir.join("artwork");
    fs::create_dir_all(&artwork_dir).map_err(|e| e.to_string())?;
    let timestamp = chrono::Utc::now().timestamp_millis();
    let output_path = artwork_dir.join(format!("{}_{}_unsplash.jpg", project_id, timestamp));

    let sources = vec![
        format!("https://picsum.photos/800/600?random={}", chrono::Utc::now().timestamp_millis()),
    ];

    for source in &sources {
        match download_image(source).await {
            Ok(data) if data.len() > 100 => {
                fs::write(&output_path, &data).map_err(|e| e.to_string())?;
                let path_str = output_path.to_string_lossy().to_string();
                let database = db.0.lock().map_err(|e| e.to_string())?;
                let _ = database.update_project(
                    &project_id,
                    &serde_json::json!({ "artworkPath": path_str }),
                );
                let _ = database.add_artwork_history(&project_id, &path_str, "unsplash");
                return Ok(Some(path_str));
            }
            _ => continue,
        }
    }

    Err("Failed to fetch artwork from all sources".to_string())
}

// ============ BATCH PHOTO OPERATIONS ============

#[tauri::command]
pub async fn batch_fetch_photos(
    app: AppHandle,
    db: State<'_, DbState>,
    cancel_flag: State<'_, PhotoCancelFlag>,
) -> Result<Value, String> {
    // Reset cancel flag at the start
    cancel_flag.0.store(false, Ordering::SeqCst);

    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let artwork_dir = app_data_dir.join("artwork");
    fs::create_dir_all(&artwork_dir).map_err(|e| e.to_string())?;

    // Get projects without artwork
    let projects_without_artwork: Vec<(String, String)> = {
        let database = db.0.lock().map_err(|e| e.to_string())?;
        let all_projects = database.get_projects()?;
        all_projects
            .into_iter()
            .filter(|p| p.artwork_path.is_none())
            .map(|p| (p.id.clone(), p.title.clone()))
            .collect()
    };

    if projects_without_artwork.is_empty() {
        return Ok(serde_json::json!({
            "success": true, "added": 0, "total": 0, "cancelled": false
        }));
    }

    let total = projects_without_artwork.len();
    let mut success_count = 0usize;
    let client = reqwest::Client::new();

    for (i, (project_id, project_title)) in projects_without_artwork.iter().enumerate() {
        // Check cancellation before each download
        if cancel_flag.0.load(Ordering::SeqCst) {
            app.emit("photo-progress", serde_json::json!({
                "current": i, "total": total, "added": success_count,
                "file": "Stopped", "isRunning": false, "cancelled": true
            })).ok();
            return Ok(serde_json::json!({
                "success": true, "added": success_count, "total": total, "cancelled": true
            }));
        }

        app.emit("photo-progress", serde_json::json!({
            "current": i + 1, "total": total, "added": success_count,
            "file": project_title, "isRunning": true, "cancelled": false
        })).ok();

        let timestamp = chrono::Utc::now().timestamp_millis();
        let output_path = artwork_dir.join(format!("{}_{}_unsplash.jpg", project_id, timestamp));
        let url = format!(
            "https://picsum.photos/800/600?random={}",
            chrono::Utc::now().timestamp_millis() as u64 + i as u64
        );

        // Try up to 3 times per image
        let mut downloaded = false;
        for _attempt in 0..3 {
            if cancel_flag.0.load(Ordering::SeqCst) {
                break;
            }

            match client
                .get(&url)
                .header("User-Agent", "DBundone/1.0")
                .send()
                .await
            {
                Ok(resp) if resp.status().is_success() => {
                    if let Ok(bytes) = resp.bytes().await {
                        if bytes.len() > 100 {
                            if fs::write(&output_path, &bytes).is_ok() {
                                let path_str = output_path.to_string_lossy().to_string();
                                let database = db.0.lock().map_err(|e| e.to_string())?;
                                let _ = database.update_project(
                                    project_id,
                                    &serde_json::json!({ "artworkPath": path_str }),
                                );
                                let _ = database.add_artwork_history(project_id, &path_str, "unsplash");
                                success_count += 1;
                                downloaded = true;
                                break;
                            }
                        }
                    }
                }
                _ => {}
            }

            // Short delay before retry
            tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;
        }

        if !downloaded {
            log::warn!("Failed to fetch photo for project: {}", project_title);
        }

        // Small delay between requests to be polite to the API
        tokio::time::sleep(tokio::time::Duration::from_millis(150)).await;
    }

    app.emit("photo-progress", serde_json::json!({
        "current": total, "total": total, "added": success_count,
        "file": "Complete", "isRunning": false, "cancelled": false
    })).ok();

    Ok(serde_json::json!({
        "success": true, "added": success_count, "total": total, "cancelled": false
    }))
}

#[tauri::command]
pub fn cancel_batch_photos(
    cancel_flag: State<'_, PhotoCancelFlag>,
) -> Result<bool, String> {
    cancel_flag.0.store(true, Ordering::SeqCst);
    Ok(true)
}

#[tauri::command]
pub async fn remove_all_artwork(
    app: AppHandle,
    db: State<'_, DbState>,
) -> Result<Value, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let artwork_dir = app_data_dir.join("artwork");

    // Clear artworkPath from all projects in DB
    let cleared_count = {
        let database = db.0.lock().map_err(|e| e.to_string())?;
        let all_projects = database.get_projects()?;
        let mut count = 0;
        for project in &all_projects {
            if project.artwork_path.is_some() {
                let _ = database.update_project(
                    &project.id,
                    &serde_json::json!({ "artworkPath": null }),
                );
                count += 1;
            }
        }
        count
    };

    // Delete artwork files from disk
    let mut files_deleted = 0;
    if artwork_dir.exists() {
        if let Ok(entries) = fs::read_dir(&artwork_dir) {
            for entry in entries.flatten() {
                if entry.path().is_file() {
                    if fs::remove_file(entry.path()).is_ok() {
                        files_deleted += 1;
                    }
                }
            }
        }
    }

    log::info!(
        "Removed artwork: {} DB records cleared, {} files deleted",
        cleared_count,
        files_deleted
    );

    Ok(serde_json::json!({
        "success": true, "cleared": cleared_count, "filesDeleted": files_deleted
    }))
}

// ============ ARTWORK HISTORY ============

#[tauri::command]
pub fn get_artwork_history(
    db: State<'_, DbState>,
    project_id: String,
) -> Result<Vec<crate::database::ArtworkHistoryEntry>, String> {
    let database = db.0.lock().map_err(|e| e.to_string())?;
    database.get_artwork_history(&project_id)
}

#[tauri::command]
pub fn add_artwork_history_entry(
    db: State<'_, DbState>,
    project_id: String,
    file_path: String,
    source: String,
) -> Result<crate::database::ArtworkHistoryEntry, String> {
    let database = db.0.lock().map_err(|e| e.to_string())?;
    database.add_artwork_history(&project_id, &file_path, &source)
}

#[tauri::command]
pub fn delete_artwork_history_entry(
    db: State<'_, DbState>,
    id: String,
) -> Result<bool, String> {
    let database = db.0.lock().map_err(|e| e.to_string())?;
    database.delete_artwork_history_entry(&id)
}

#[tauri::command]
pub fn set_artwork_from_history(
    db: State<'_, DbState>,
    project_id: String,
    file_path: String,
) -> Result<Option<crate::database::Project>, String> {
    let database = db.0.lock().map_err(|e| e.to_string())?;
    database.update_project(
        &project_id,
        &serde_json::json!({ "artworkPath": file_path }),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::Database;

    fn default_settings() -> AppSettings {
        AppSettings::default()
    }

    // ---- AppSettings Default (3 tests) ----

    #[test]
    fn test_settings_default_values() {
        let s = default_settings();
        assert_eq!(s.theme, "dark");
        assert_eq!(s.accent_color, "#6366f1");
        assert_eq!(s.ai_provider, "local");
        assert!(s.ai_api_key.is_empty());
        assert!(s.exclude_autosaves);
        assert!(!s.auto_generate_artwork);
        assert_eq!(s.view_mode, "grid");
        assert_eq!(s.grid_size, "medium");
    }

    #[test]
    fn test_settings_default_daws() {
        let s = default_settings();
        assert_eq!(s.selected_daws, vec!["FL Studio", "Ableton Live"]);
    }

    #[test]
    fn test_settings_default_fl_path_none() {
        let s = default_settings();
        assert!(s.fl_studio_path.is_none());
        assert!(s.ai_api_url.is_none());
    }

    // ---- AppSettings Serialization (4 tests) ----

    #[test]
    fn test_settings_serialize_camel_case() {
        let s = default_settings();
        let json = serde_json::to_value(&s).unwrap();
        assert!(json.get("flStudioPath").is_some());
        assert!(json.get("aiApiKey").is_some());
        assert!(json.get("aiProvider").is_some());
        assert!(json.get("accentColor").is_some());
        assert!(json.get("autoGenerateArtwork").is_some());
        assert!(json.get("excludeAutosaves").is_some());
        assert!(json.get("selectedDAWs").is_some());
        assert!(json.get("dawFolders").is_some());
        assert!(json.get("viewMode").is_some());
        assert!(json.get("gridSize").is_some());
    }

    #[test]
    fn test_settings_roundtrip() {
        let s = default_settings();
        let json_str = serde_json::to_string(&s).unwrap();
        let deserialized: AppSettings = serde_json::from_str(&json_str).unwrap();
        assert_eq!(deserialized.theme, s.theme);
        assert_eq!(deserialized.accent_color, s.accent_color);
        assert_eq!(deserialized.selected_daws, s.selected_daws);
    }

    #[test]
    fn test_settings_deserialize_from_partial() {
        let json_val = serde_json::json!({
            "flStudioPath": null,
            "aiApiKey": "key123",
            "aiApiUrl": null,
            "aiProvider": "openai",
            "theme": "light",
            "accentColor": "#ff0000",
            "autoGenerateArtwork": true,
            "excludeAutosaves": false,
            "selectedDAWs": ["FL Studio"],
            "dawFolders": {},
            "viewMode": "list",
            "gridSize": "small"
        });
        let s: AppSettings = serde_json::from_value(json_val).unwrap();
        assert_eq!(s.ai_api_key, "key123");
        assert_eq!(s.ai_provider, "openai");
        assert_eq!(s.theme, "light");
        assert_eq!(s.view_mode, "list");
        assert!(s.auto_generate_artwork);
        assert!(!s.exclude_autosaves);
    }

    #[test]
    fn test_settings_merge_partial() {
        let s = default_settings();
        let mut json = serde_json::to_value(&s).unwrap();
        let partial = serde_json::json!({"theme": "light", "accentColor": "#ff0000"});
        if let (Some(obj), Some(new_obj)) = (json.as_object_mut(), partial.as_object()) {
            for (k, v) in new_obj {
                obj.insert(k.clone(), v.clone());
            }
        }
        let merged: AppSettings = serde_json::from_value(json).unwrap();
        assert_eq!(merged.theme, "light");
        assert_eq!(merged.accent_color, "#ff0000");
        // Unchanged fields preserved
        assert_eq!(merged.ai_provider, "local");
    }

    // ---- Settings File I/O (2 tests) ----

    #[test]
    fn test_load_settings_missing_file() {
        let dir = std::env::temp_dir().join(format!("dbundone_settings_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let s = load_settings(&dir);
        assert_eq!(s.theme, "dark"); // Falls back to default
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_save_and_load_settings() {
        let dir = std::env::temp_dir().join(format!("dbundone_settings_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let mut s = default_settings();
        s.theme = "light".to_string();
        s.accent_color = "#00ff00".to_string();
        save_settings_to_disk(&dir, &s).unwrap();
        let loaded = load_settings(&dir);
        assert_eq!(loaded.theme, "light");
        assert_eq!(loaded.accent_color, "#00ff00");
        let _ = std::fs::remove_dir_all(&dir);
    }

    // ---- Model Serialization (3 tests) ----

    #[test]
    fn test_project_serialization_camel_case() {
        let db = Database::new(":memory:").unwrap();
        let p = db.create_project(&serde_json::json!({"title": "Test"})).unwrap();
        let json = serde_json::to_value(&p).unwrap();
        assert!(json.get("artworkPath").is_some());
        assert!(json.get("audioPreviewPath").is_some());
        assert!(json.get("dawProjectPath").is_some());
        assert!(json.get("dawType").is_some());
        assert!(json.get("musicalKey").is_some());
        assert!(json.get("collectionName").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("updatedAt").is_some());
        assert!(json.get("fileModifiedAt").is_some());
        assert!(json.get("timeSpent").is_some());
    }

    #[test]
    fn test_tag_serialization() {
        let db = Database::new(":memory:").unwrap();
        let tag = db.create_tag(&serde_json::json!({"name": "electronic", "color": "#ff00ff"})).unwrap();
        let json = serde_json::to_value(&tag).unwrap();
        assert_eq!(json["name"], "electronic");
        assert_eq!(json["color"], "#ff00ff");
    }

    #[test]
    fn test_annotation_serialization_camel_case() {
        let db = Database::new(":memory:").unwrap();
        let p = db.create_project(&serde_json::json!({"title": "P"})).unwrap();
        let v = db.create_version(&serde_json::json!({
            "projectId": p.id, "name": "V1", "filePath": "/a.wav"
        })).unwrap();
        let a = db.create_annotation(&serde_json::json!({
            "versionId": v.id, "timestamp": 5.0, "text": "Note"
        })).unwrap();
        let json = serde_json::to_value(&a).unwrap();
        assert!(json.get("versionId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("updatedAt").is_some());
    }

    // ---- Integration: read_image_base64 + detect_projects (3 tests) ----

    #[test]
    fn test_read_image_base64_png() {
        let dir = std::env::temp_dir().join(format!("dbundone_img_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let img_path = dir.join("test.png");
        // Write minimal valid PNG
        let png_bytes: Vec<u8> = vec![
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
        ];
        std::fs::write(&img_path, &png_bytes).unwrap();
        let result = read_image_base64(img_path.to_string_lossy().to_string()).unwrap();
        assert!(result.starts_with("data:image/png;base64,"));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_read_image_base64_jpg() {
        let dir = std::env::temp_dir().join(format!("dbundone_img_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let img_path = dir.join("test.jpg");
        std::fs::write(&img_path, &[0xFF, 0xD8, 0xFF]).unwrap();
        let result = read_image_base64(img_path.to_string_lossy().to_string()).unwrap();
        assert!(result.starts_with("data:image/jpeg;base64,"));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_detect_projects_finds_types() {
        let dir = std::env::temp_dir().join(format!("dbundone_detect_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("track.flp"), b"").unwrap();
        std::fs::write(dir.join("song.als"), b"").unwrap();
        let result = detect_projects(dir.to_string_lossy().to_string()).unwrap();
        assert_eq!(result["hasFLP"], true);
        assert_eq!(result["hasALS"], true);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
