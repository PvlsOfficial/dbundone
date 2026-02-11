use crate::flp_parser;
use regex::Regex;
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};

pub fn scan_for_flp_files(folder_path: &str, max_depth: usize) -> Vec<String> {
    let mut flp_files = Vec::new();
    let mut queue: Vec<(PathBuf, usize)> = vec![(PathBuf::from(folder_path), 0)];
    let mut scanned = std::collections::HashSet::new();

    while let Some((dir, depth)) = queue.pop() {
        if depth > max_depth || !scanned.insert(dir.clone()) {
            continue;
        }

        if let Ok(entries) = fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() && depth < max_depth {
                    queue.push((path, depth + 1));
                } else if path.is_file() {
                    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                        if ext.eq_ignore_ascii_case("flp") {
                            flp_files.push(path.to_string_lossy().to_string());
                        }
                    }
                }
            }
        }
    }

    flp_files
}

/// Scan a folder recursively for .zip files that contain at least one .flp file.
/// Returns a list of zip file paths (as strings).
pub fn scan_for_zip_files_with_flp(folder_path: &str, max_depth: usize) -> Vec<String> {
    let mut zip_files = Vec::new();
    let mut queue: Vec<(PathBuf, usize)> = vec![(PathBuf::from(folder_path), 0)];
    let mut scanned = std::collections::HashSet::new();

    while let Some((dir, depth)) = queue.pop() {
        if depth > max_depth || !scanned.insert(dir.clone()) {
            continue;
        }

        if let Ok(entries) = fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() && depth < max_depth {
                    queue.push((path, depth + 1));
                } else if path.is_file() {
                    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                        if ext.eq_ignore_ascii_case("zip") {
                            // Quick check: does this zip contain at least one .flp?
                            if zip_contains_flp(path.to_string_lossy().as_ref()) {
                                zip_files.push(path.to_string_lossy().to_string());
                            }
                        }
                    }
                }
            }
        }
    }

    zip_files
}

/// Quick check if a zip file contains at least one .flp file (public API for detect_projects).
pub fn zip_contains_flp_quick(zip_path: &str) -> bool {
    zip_contains_flp(zip_path)
}

/// Check if a zip file contains at least one .flp file (without fully extracting).
fn zip_contains_flp(zip_path: &str) -> bool {
    let file = match fs::File::open(zip_path) {
        Ok(f) => f,
        Err(_) => return false,
    };
    let mut archive = match zip::ZipArchive::new(file) {
        Ok(a) => a,
        Err(_) => return false,
    };
    for i in 0..archive.len() {
        if let Ok(entry) = archive.by_index_raw(i) {
            let name = entry.name();
            if name.to_lowercase().ends_with(".flp") {
                return true;
            }
        }
    }
    false
}

/// Information about an FLP file found inside a zip archive.
pub struct ZipFlpEntry {
    /// The path to the zip file on disk.
    pub zip_path: String,
    /// The name of the FLP file inside the zip (e.g., "My Song.flp").
    pub flp_name: String,
    /// The raw FLP file bytes.
    pub flp_data: Vec<u8>,
    /// Artwork image bytes if found inside the zip (artwork.png, cover.jpg, etc.).
    pub artwork_data: Option<(String, Vec<u8>)>, // (filename, bytes)
}

/// Extract FLP file(s) and any artwork from a zip archive.
/// Returns one ZipFlpEntry per .flp file found in the zip.
pub fn extract_flps_from_zip(zip_path: &str) -> Vec<ZipFlpEntry> {
    let file = match fs::File::open(zip_path) {
        Ok(f) => f,
        Err(e) => {
            log::warn!("Failed to open zip {}: {}", zip_path, e);
            return Vec::new();
        }
    };
    let mut archive = match zip::ZipArchive::new(file) {
        Ok(a) => a,
        Err(e) => {
            log::warn!("Failed to read zip archive {}: {}", zip_path, e);
            return Vec::new();
        }
    };

    // First pass: collect FLP names and artwork names
    let mut flp_names: Vec<String> = Vec::new();
    let mut artwork_name: Option<String> = None;

    for i in 0..archive.len() {
        if let Ok(entry) = archive.by_index_raw(i) {
            let name = entry.name().to_string();
            let lower = name.to_lowercase();

            // Skip directories and files in subdirectories (only top-level)
            if entry.is_dir() {
                continue;
            }

            if lower.ends_with(".flp") {
                flp_names.push(name);
            } else if artwork_name.is_none() {
                // Check for artwork files
                let fname = Path::new(&lower)
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();
                if fname == "artwork.png"
                    || fname == "artwork.jpg"
                    || fname == "artwork.jpeg"
                    || fname == "cover.png"
                    || fname == "cover.jpg"
                    || fname == "cover.jpeg"
                {
                    artwork_name = Some(name);
                }
            }
        }
    }

    // Second pass: read the actual file data
    let mut artwork_data: Option<(String, Vec<u8>)> = None;
    if let Some(ref art_name) = artwork_name {
        if let Ok(mut entry) = archive.by_name(art_name) {
            let mut buf = Vec::new();
            if entry.read_to_end(&mut buf).is_ok() {
                artwork_data = Some((art_name.clone(), buf));
            }
        }
    }

    let mut results = Vec::new();
    for flp_name in &flp_names {
        if let Ok(mut entry) = archive.by_name(flp_name) {
            let mut buf = Vec::new();
            if entry.read_to_end(&mut buf).is_ok() {
                results.push(ZipFlpEntry {
                    zip_path: zip_path.to_string(),
                    flp_name: flp_name.clone(),
                    flp_data: buf,
                    artwork_data: artwork_data.clone(),
                });
            }
        }
    }

    results
}

/// Extract metadata from an FLP inside a zip using the native parser.
pub fn extract_zip_flp_metadata(entry: &ZipFlpEntry) -> Option<Value> {
    let label = format!("{}#{}", entry.zip_path, entry.flp_name);
    match flp_parser::parse_flp_from_bytes(&entry.flp_data, &label) {
        Ok(metadata) => Some(metadata.to_json_value()),
        Err(e) => {
            log::warn!("Failed to parse FLP from zip {}: {}", label, e);
            None
        }
    }
}

pub fn scan_for_als_files(folder_path: &str) -> Vec<String> {
    let mut als_files = Vec::new();

    fn scan_recursive(dir: &Path, results: &mut Vec<String>) {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    scan_recursive(&path, results);
                } else if path.is_file() {
                    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                        if ext.eq_ignore_ascii_case("als") {
                            results.push(path.to_string_lossy().to_string());
                        }
                    }
                }
            }
        }
    }

    scan_recursive(Path::new(folder_path), &mut als_files);
    als_files
}

pub fn filter_autosaves(files: &[String], extension: &str) -> Vec<String> {
    // Filename-level patterns
    let filename_patterns = vec![
        Regex::new(r"(?i)overwritten").unwrap(),
        Regex::new(r"(?i)autosave").unwrap(),
        Regex::new(r"(?i)\.bak$").unwrap(),
        Regex::new(r"(?i)_backup\d*").unwrap(),
        Regex::new(&format!(r"(?i)\(\d+\)\.{}$", regex::escape(extension))).unwrap(),
        // Ableton backup format: "projectname [2025-02-25 195013].als"
        Regex::new(r"\[\d{4}-\d{2}-\d{2} \d{6}\]").unwrap(),
    ];

    // Path-level patterns (match against full path to catch backup directories)
    let path_patterns = vec![
        // Files inside a "Backup" directory (Ableton stores backups in ProjectName/Backup/)
        Regex::new(r"(?i)[/\\]Backup[/\\]").unwrap(),
        // General backup directory patterns
        Regex::new(r"(?i)[/\\]Backups?[/\\]").unwrap(),
    ];

    files
        .iter()
        .filter(|f| {
            let filename = Path::new(f)
                .file_name()
                .unwrap_or_default()
                .to_string_lossy();

            // Check filename patterns
            if filename_patterns.iter().any(|p| p.is_match(&filename)) {
                return false;
            }

            // Check full path patterns
            if path_patterns.iter().any(|p| p.is_match(f)) {
                return false;
            }

            // Check if filename contains "backup" (case-insensitive) - kept from original
            if filename.to_lowercase().contains("backup") {
                return false;
            }

            true
        })
        .cloned()
        .collect()
}

pub fn find_artwork_file(project_path: &str, project_name: &str) -> Option<String> {
    let dir = Path::new(project_path).parent()?;
    let possible = vec![
        dir.join("artwork.png"),
        dir.join("artwork.jpg"),
        dir.join("cover.png"),
        dir.join("cover.jpg"),
        dir.join(format!("{}.png", project_name)),
        dir.join(format!("{}.jpg", project_name)),
    ];

    for p in possible {
        if p.exists() {
            return Some(p.to_string_lossy().to_string());
        }
    }
    None
}

/// Extract metadata for a batch of FLP files using native Rust parser.
/// Supports both regular .flp paths and .zip paths.
pub fn extract_flp_metadata_batch_native(flp_paths: &[String]) -> HashMap<String, Value> {
    if flp_paths.is_empty() {
        return HashMap::new();
    }

    log::info!(
        "Extracting metadata from {} FLP files using native Rust parser",
        flp_paths.len()
    );

    // Separate regular FLPs from zip files
    let mut regular_paths: Vec<String> = Vec::new();
    let mut zip_paths: Vec<String> = Vec::new();

    for path in flp_paths {
        if Path::new(path)
            .extension()
            .map(|e| e.to_ascii_lowercase() == "zip")
            .unwrap_or(false)
        {
            zip_paths.push(path.clone());
        } else {
            regular_paths.push(path.clone());
        }
    }

    let mut results = flp_parser::parse_flp_batch_parallel(&regular_paths);

    // Process zip files
    for zip_path in &zip_paths {
        let entries = extract_flps_from_zip(zip_path);
        if let Some(entry) = entries.first() {
            if let Some(metadata) = extract_zip_flp_metadata(entry) {
                results.insert(zip_path.clone(), metadata);
            }
        }
    }

    results
}

/// Extract metadata for a single FLP file using native Rust parser.
/// Supports both regular .flp paths and .zip paths (extracts the first FLP from the zip).
pub fn extract_single_flp_metadata_native(flp_path: &str) -> Option<Value> {
    // Check if this is a zip file
    if Path::new(flp_path)
        .extension()
        .map(|e| e.to_ascii_lowercase() == "zip")
        .unwrap_or(false)
    {
        let entries = extract_flps_from_zip(flp_path);
        if let Some(entry) = entries.first() {
            return extract_zip_flp_metadata(entry);
        }
        return None;
    }

    match flp_parser::parse_flp(flp_path) {
        Ok(metadata) => Some(metadata.to_json_value()),
        Err(e) => {
            log::warn!("Failed to parse FLP {}: {}", flp_path, e);
            None
        }
    }
}

// Python helper functions removed - using native Rust FLP parser instead

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::{self, File};

    fn make_temp_dir() -> PathBuf {
        let dir = std::env::temp_dir().join(format!("dbundone_test_{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn cleanup(dir: &Path) {
        let _ = fs::remove_dir_all(dir);
    }

    // ---- scan_for_flp_files (5 tests) ----

    #[test]
    fn test_scan_flp_empty_dir() {
        let dir = make_temp_dir();
        let result = scan_for_flp_files(dir.to_str().unwrap(), 10);
        assert!(result.is_empty());
        cleanup(&dir);
    }

    #[test]
    fn test_scan_flp_finds_files() {
        let dir = make_temp_dir();
        File::create(dir.join("beat.flp")).unwrap();
        File::create(dir.join("readme.txt")).unwrap();
        let result = scan_for_flp_files(dir.to_str().unwrap(), 10);
        assert_eq!(result.len(), 1);
        assert!(result[0].contains("beat.flp"));
        cleanup(&dir);
    }

    #[test]
    fn test_scan_flp_nested_dirs() {
        let dir = make_temp_dir();
        let sub = dir.join("sub");
        fs::create_dir_all(&sub).unwrap();
        File::create(sub.join("nested.flp")).unwrap();
        let result = scan_for_flp_files(dir.to_str().unwrap(), 10);
        assert_eq!(result.len(), 1);
        assert!(result[0].contains("nested.flp"));
        cleanup(&dir);
    }

    #[test]
    fn test_scan_flp_respects_max_depth() {
        let dir = make_temp_dir();
        let deep = dir.join("a").join("b").join("c");
        fs::create_dir_all(&deep).unwrap();
        File::create(deep.join("deep.flp")).unwrap();
        // max_depth=1 should not reach 3 levels deep
        let result = scan_for_flp_files(dir.to_str().unwrap(), 1);
        assert!(result.is_empty());
        cleanup(&dir);
    }

    #[test]
    fn test_scan_flp_case_insensitive() {
        let dir = make_temp_dir();
        File::create(dir.join("beat.FLP")).unwrap();
        let result = scan_for_flp_files(dir.to_str().unwrap(), 10);
        assert_eq!(result.len(), 1);
        cleanup(&dir);
    }

    // ---- scan_for_als_files (3 tests) ----

    #[test]
    fn test_scan_als_empty_dir() {
        let dir = make_temp_dir();
        let result = scan_for_als_files(dir.to_str().unwrap());
        assert!(result.is_empty());
        cleanup(&dir);
    }

    #[test]
    fn test_scan_als_finds_files() {
        let dir = make_temp_dir();
        File::create(dir.join("track.als")).unwrap();
        File::create(dir.join("readme.md")).unwrap();
        let result = scan_for_als_files(dir.to_str().unwrap());
        assert_eq!(result.len(), 1);
        assert!(result[0].contains("track.als"));
        cleanup(&dir);
    }

    #[test]
    fn test_scan_als_recursive() {
        let dir = make_temp_dir();
        let sub = dir.join("project");
        fs::create_dir_all(&sub).unwrap();
        File::create(sub.join("deep.als")).unwrap();
        File::create(dir.join("top.als")).unwrap();
        let result = scan_for_als_files(dir.to_str().unwrap());
        assert_eq!(result.len(), 2);
        cleanup(&dir);
    }

    // ---- filter_autosaves (6 tests) ----

    #[test]
    fn test_filter_autosaves_no_autosaves() {
        let files = vec!["beat.flp".to_string(), "track.flp".to_string()];
        let result = filter_autosaves(&files, "flp");
        assert_eq!(result.len(), 2);
    }

    #[test]
    fn test_filter_autosaves_removes_backup() {
        let files = vec![
            "beat.flp".to_string(),
            "beat_backup.flp".to_string(),
            "beat backup.flp".to_string(),
        ];
        let result = filter_autosaves(&files, "flp");
        assert_eq!(result.len(), 1);
        assert_eq!(result[0], "beat.flp");
    }

    #[test]
    fn test_filter_autosaves_removes_numbered() {
        let files = vec![
            "beat.flp".to_string(),
            "beat(2).flp".to_string(),
            "beat(10).flp".to_string(),
        ];
        let result = filter_autosaves(&files, "flp");
        assert_eq!(result.len(), 1);
        assert_eq!(result[0], "beat.flp");
    }

    #[test]
    fn test_filter_autosaves_removes_overwritten() {
        let files = vec!["beat.flp".to_string(), "beat overwritten.flp".to_string()];
        let result = filter_autosaves(&files, "flp");
        assert_eq!(result.len(), 1);
    }

    #[test]
    fn test_filter_autosaves_removes_bak() {
        let files = vec!["beat.flp".to_string(), "beat.bak".to_string()];
        let result = filter_autosaves(&files, "flp");
        assert_eq!(result.len(), 1);
    }

    #[test]
    fn test_filter_autosaves_removes_autosave_keyword() {
        let files = vec!["beat.flp".to_string(), "beat autosave.flp".to_string()];
        let result = filter_autosaves(&files, "flp");
        assert_eq!(result.len(), 1);
    }

    #[test]
    fn test_filter_autosaves_removes_ableton_timestamp_backup() {
        let files = vec![
            "my song.als".to_string(),
            "my song [2025-02-25 195013].als".to_string(),
            "my song [2024-11-03 102345].als".to_string(),
        ];
        let result = filter_autosaves(&files, "als");
        assert_eq!(result.len(), 1);
        assert_eq!(result[0], "my song.als");
    }

    #[test]
    fn test_filter_autosaves_removes_backup_dir() {
        let files = vec![
            "/music/MyProject/MyProject.als".to_string(),
            "/music/MyProject/Backup/MyProject [2025-02-25 195013].als".to_string(),
            "/music/MyProject/Backup/MyProject [2024-11-03 102345].als".to_string(),
        ];
        let result = filter_autosaves(&files, "als");
        assert_eq!(result.len(), 1);
        assert_eq!(result[0], "/music/MyProject/MyProject.als");
    }

    #[test]
    fn test_filter_autosaves_removes_backup_dir_windows() {
        let files = vec![
            r"C:\Music\MyProject\MyProject.als".to_string(),
            r"C:\Music\MyProject\Backup\MyProject [2025-02-25 195013].als".to_string(),
        ];
        let result = filter_autosaves(&files, "als");
        assert_eq!(result.len(), 1);
        assert!(result[0].contains("MyProject.als"));
    }

    // ---- find_artwork_file (4 tests) ----

    #[test]
    fn test_find_artwork_none() {
        let dir = make_temp_dir();
        let flp = dir.join("beat.flp");
        File::create(&flp).unwrap();
        let result = find_artwork_file(flp.to_str().unwrap(), "beat");
        assert!(result.is_none());
        cleanup(&dir);
    }

    #[test]
    fn test_find_artwork_artwork_png() {
        let dir = make_temp_dir();
        let flp = dir.join("beat.flp");
        File::create(&flp).unwrap();
        File::create(dir.join("artwork.png")).unwrap();
        let result = find_artwork_file(flp.to_str().unwrap(), "beat");
        assert!(result.is_some());
        assert!(result.unwrap().contains("artwork.png"));
        cleanup(&dir);
    }

    #[test]
    fn test_find_artwork_cover_jpg() {
        let dir = make_temp_dir();
        let flp = dir.join("beat.flp");
        File::create(&flp).unwrap();
        File::create(dir.join("cover.jpg")).unwrap();
        let result = find_artwork_file(flp.to_str().unwrap(), "beat");
        assert!(result.is_some());
        assert!(result.unwrap().contains("cover.jpg"));
        cleanup(&dir);
    }

    #[test]
    fn test_find_artwork_project_name_match() {
        let dir = make_temp_dir();
        let flp = dir.join("mybanger.flp");
        File::create(&flp).unwrap();
        File::create(dir.join("mybanger.png")).unwrap();
        let result = find_artwork_file(flp.to_str().unwrap(), "mybanger");
        assert!(result.is_some());
        assert!(result.unwrap().contains("mybanger.png"));
        cleanup(&dir);
    }

    // ---- zip scanning tests ----

    /// Helper: build a minimal valid FLP binary in memory
    fn build_minimal_flp(title: &str, bpm: u32) -> Vec<u8> {
        let mut flp = Vec::new();
        // Header
        flp.extend_from_slice(b"FLhd");
        flp.extend_from_slice(&6u32.to_le_bytes());
        flp.extend_from_slice(&0i16.to_le_bytes());
        flp.extend_from_slice(&2u16.to_le_bytes());
        flp.extend_from_slice(&96u16.to_le_bytes());
        flp.extend_from_slice(b"FLdt");

        let mut events = Vec::new();

        // FL Version
        let version_bytes = b"20.8.4\0";
        events.push(199u8); // EVENT_FL_VERSION
        encode_varint_helper(version_bytes.len(), &mut events);
        events.extend_from_slice(version_bytes);

        // Title in UTF-16LE
        if !title.is_empty() {
            let mut title_bytes: Vec<u8> = Vec::new();
            for ch in title.encode_utf16() {
                title_bytes.extend_from_slice(&ch.to_le_bytes());
            }
            title_bytes.extend_from_slice(&[0x00, 0x00]);
            events.push(194u8); // EVENT_TITLE
            encode_varint_helper(title_bytes.len(), &mut events);
            events.extend_from_slice(&title_bytes);
        }

        // Tempo
        events.push(156u8); // EVENT_TEMPO
        events.extend_from_slice(&(bpm * 1000).to_le_bytes());

        let events_size = events.len() as u32;
        flp.extend_from_slice(&events_size.to_le_bytes());
        flp.extend_from_slice(&events);
        flp
    }

    fn encode_varint_helper(mut value: usize, buf: &mut Vec<u8>) {
        loop {
            let mut byte = (value & 0x7F) as u8;
            value >>= 7;
            if value > 0 {
                byte |= 0x80;
            }
            buf.push(byte);
            if value == 0 {
                break;
            }
        }
    }

    /// Helper: create a zip file containing the given files
    fn create_test_zip(zip_path: &std::path::Path, files: &[(&str, &[u8])]) {
        let file = File::create(zip_path).unwrap();
        let mut zip_writer = zip::ZipWriter::new(file);
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Stored);
        for (name, data) in files {
            zip_writer.start_file(*name, options).unwrap();
            std::io::Write::write_all(&mut zip_writer, data).unwrap();
        }
        zip_writer.finish().unwrap();
    }

    #[test]
    fn test_scan_zip_with_flp() {
        let dir = make_temp_dir();
        let flp_data = build_minimal_flp("Zip Song", 140);
        let zip_path = dir.join("project.zip");
        create_test_zip(&zip_path, &[("Zip Song.flp", &flp_data)]);

        let result = scan_for_zip_files_with_flp(dir.to_str().unwrap(), 10);
        assert_eq!(result.len(), 1);
        assert!(result[0].contains("project.zip"));
        cleanup(&dir);
    }

    #[test]
    fn test_scan_zip_without_flp() {
        let dir = make_temp_dir();
        let zip_path = dir.join("samples.zip");
        create_test_zip(&zip_path, &[("kick.wav", b"fake wav data")]);

        let result = scan_for_zip_files_with_flp(dir.to_str().unwrap(), 10);
        assert!(result.is_empty(), "Zip without FLP should not be found");
        cleanup(&dir);
    }

    #[test]
    fn test_extract_flps_from_zip() {
        let dir = make_temp_dir();
        let flp_data = build_minimal_flp("My Beat", 150);
        let zip_path = dir.join("beat.zip");
        create_test_zip(
            &zip_path,
            &[
                ("My Beat.flp", &flp_data),
                ("artwork.png", b"fake png data"),
            ],
        );

        let entries = extract_flps_from_zip(zip_path.to_str().unwrap());
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].flp_name, "My Beat.flp");
        assert_eq!(entries[0].flp_data, flp_data);
        assert!(entries[0].artwork_data.is_some());
        let (art_name, art_bytes) = entries[0].artwork_data.as_ref().unwrap();
        assert_eq!(art_name, "artwork.png");
        assert_eq!(art_bytes, b"fake png data");
        cleanup(&dir);
    }

    #[test]
    fn test_extract_flp_metadata_from_zip() {
        let dir = make_temp_dir();
        let flp_data = build_minimal_flp("Zip Track", 128);
        let zip_path = dir.join("track.zip");
        create_test_zip(&zip_path, &[("Zip Track.flp", &flp_data)]);

        let entries = extract_flps_from_zip(zip_path.to_str().unwrap());
        assert_eq!(entries.len(), 1);

        let metadata = extract_zip_flp_metadata(&entries[0]);
        assert!(metadata.is_some(), "Should extract metadata from zip FLP");
        let m = metadata.unwrap();
        assert_eq!(m.get("title").and_then(|v| v.as_str()), Some("Zip Track"));
        assert_eq!(m.get("bpm").and_then(|v| v.as_f64()), Some(128.0));
        cleanup(&dir);
    }

    #[test]
    fn test_extract_multiple_flps_from_zip() {
        let dir = make_temp_dir();
        let flp1 = build_minimal_flp("Song A", 120);
        let flp2 = build_minimal_flp("Song B", 140);
        let zip_path = dir.join("multi.zip");
        create_test_zip(&zip_path, &[("Song A.flp", &flp1), ("Song B.flp", &flp2)]);

        let entries = extract_flps_from_zip(zip_path.to_str().unwrap());
        assert_eq!(entries.len(), 2);
        cleanup(&dir);
    }

    #[test]
    fn test_zip_contains_flp_true() {
        let dir = make_temp_dir();
        let flp_data = build_minimal_flp("Test", 100);
        let zip_path = dir.join("has_flp.zip");
        create_test_zip(&zip_path, &[("Test.flp", &flp_data)]);

        assert!(zip_contains_flp(zip_path.to_str().unwrap()));
        cleanup(&dir);
    }

    #[test]
    fn test_zip_contains_flp_false() {
        let dir = make_temp_dir();
        let zip_path = dir.join("no_flp.zip");
        create_test_zip(&zip_path, &[("readme.txt", b"hello")]);

        assert!(!zip_contains_flp(zip_path.to_str().unwrap()));
        cleanup(&dir);
    }

    #[test]
    fn test_find_artwork_beside_zip() {
        let dir = make_temp_dir();
        let zip = dir.join("myproject.zip");
        File::create(&zip).unwrap();
        File::create(dir.join("artwork.png")).unwrap();
        let result = find_artwork_file(zip.to_str().unwrap(), "myproject");
        assert!(result.is_some());
        assert!(result.unwrap().contains("artwork.png"));
        cleanup(&dir);
    }
}
