//! Native Rust FLP (FL Studio project) parser.
//!
//! Extracts metadata from .flp files without requiring Python/pyflp.
//! Parses: title, tempo, channel count, pattern count, time spent, created date,
//! plugins (VSTs), sample file paths, channel/mixer structure.

use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::io::{self, Cursor, Read};

// ── Event ID ranges ──────────────────────────────────────────────────────────
const WORD: u8 = 64;
const DWORD: u8 = 128;
const TEXT: u8 = 192;
const DATA: u8 = 208;

// ── Project-level event IDs we care about ────────────────────────────────────
const EVENT_FL_VERSION: u8 = TEXT + 7; // 199 - Always ASCII
const EVENT_TITLE: u8 = TEXT + 2; // 194
const EVENT_GENRE: u8 = TEXT + 14; // 206
const EVENT_ARTISTS: u8 = TEXT + 15; // 207
const EVENT_COMMENTS: u8 = TEXT + 3; // 195
const EVENT_URL: u8 = TEXT + 5; // 197
const EVENT_TEMPO: u8 = DWORD + 28; // 156 - tempo * 1000
const EVENT_TEMPO_COARSE: u8 = WORD + 2; // 66 - legacy coarse tempo
const EVENT_TEMPO_FINE: u8 = WORD + 29; // 93 - fine tempo (3.4.0+)
const EVENT_TIMESTAMP: u8 = DATA + 29; // 237 - created_on (f64) + time_spent (f64)

// Pattern event ID used for counting patterns
const EVENT_PATTERN_NEW: u8 = WORD + 1; // 65 - PatternID.New (signals a new pattern)
                                        // EVENT_PATTERN_NAME (TEXT + 1 = 193) could be used for pattern name extraction if needed

// ── Channel/Plugin event IDs (extended analysis) ─────────────────────────────
// Channel type: BYTE+21 in FL 2025.3+, DWORD+21 in older versions
const EVENT_CHANNEL_TYPE_BYTE: u8 = 21; // BYTE range - 0=sampler, 2=generator/VST, 3=layer, 4=audio_clip, 5=automation
const EVENT_CHANNEL_TYPE_DWORD: u8 = DWORD + 21; // 149 - legacy (pre-2025.3)
const EVENT_SAMPLE_FILE_NAME: u8 = TEXT + 4; // 196 - Sample file path
const EVENT_PLUGIN_NAME: u8 = TEXT + 9; // 201 - Plugin DLL name (e.g. "Serum_x64.dll")
const EVENT_CHANNEL_NAME: u8 = TEXT + 11; // 203 - Channel display name
const EVENT_PATTERN_NAME: u8 = TEXT + 1; // 193 - Pattern name
const EVENT_MIXER_TRACK_NAME: u8 = TEXT + 12; // 204 - Mixer insert track name
const EVENT_PLUGIN_COLOR: u8 = DWORD + 0; // 128 - Color (used for channels/mixer)
const EVENT_NEW_CHANNEL: u8 = WORD + 0; // 64 - new channel marker / channel enabled

// Plugin data event (binary blob containing wrapped VST info for Fruity Wrapper)
const EVENT_PLUGIN_DATA: u8 = DATA + 5; // 213 - plugin parameters / binary data
// Mixer target insert: WORD+40 in FL 2025.3+ (the insert number a channel routes to)
const EVENT_TARGET_INSERT: u8 = WORD + 40; // 104 - which mixer insert this channel routes to
// Mixer insert params/separator: DATA+28 = 236 – appears once per mixer insert
const EVENT_MIXER_PARAMS: u8 = DATA + 28; // 236 - mixer insert data block separator

/// Delphi epoch: December 30, 1899
const DELPHI_EPOCH_OFFSET_DAYS: f64 = 25569.0; // Days between Delphi epoch and Unix epoch

/// Information about a single channel in the FL Studio project
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FlpChannel {
    pub index: usize,
    pub name: Option<String>,
    pub channel_type: String, // "sampler", "generator", "layer", "audio_clip", "unknown"
    pub plugin_name: Option<String>,
    pub sample_path: Option<String>,
    pub color: Option<String>, // hex color
    pub mixer_track: Option<i32>,
}

/// Information about a mixer track
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FlpMixerTrack {
    pub index: usize,
    pub name: Option<String>,
    pub color: Option<String>,
    pub plugins: Vec<String>,
}

/// Information about a pattern
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FlpPattern {
    pub index: usize,
    pub name: Option<String>,
}

/// Plugin information extracted from the project
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FlpPlugin {
    pub name: String,
    pub dll_name: Option<String>,
    pub channel_name: Option<String>,
    pub channel_index: Option<usize>,
    pub is_instrument: bool,
    pub preset_name: Option<String>,
}

/// Extended analysis result from deep FLP parsing
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FlpAnalysis {
    pub plugins: Vec<FlpPlugin>,
    pub samples: Vec<String>,
    pub channels: Vec<FlpChannel>,
    pub mixer_tracks: Vec<FlpMixerTrack>,
    pub patterns: Vec<FlpPattern>,
    pub fl_version: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FlpMetadata {
    pub file_path: String,
    pub title: Option<String>,
    pub bpm: Option<f64>,
    pub channels: Option<u16>,
    pub patterns: Option<usize>,
    pub time_spent_minutes: Option<i64>,
    pub total_time_seconds: Option<i64>,
    pub genre: Option<String>,
    pub artists: Option<String>,
    pub comments: Option<String>,
    pub url: Option<String>,
    pub created_on: Option<String>,
}

impl FlpMetadata {
    /// Convert to a serde_json::Value matching the format the Python script produced
    pub fn to_json_value(&self) -> serde_json::Value {
        serde_json::json!({
            "file_path": self.file_path,
            "title": self.title,
            "bpm": self.bpm,
            "channels": self.channels,
            "patterns": self.patterns,
            "time_spent_minutes": self.time_spent_minutes,
            "total_time_seconds": self.total_time_seconds,
            "length": self.total_time_seconds,
            "genre": self.genre,
            "artists": self.artists,
            "comments": self.comments,
            "url": self.url,
            "created_on": self.created_on,
        })
    }
}

/// Read a VarInt from the cursor (protobuf-style: 7 bits per byte, MSB = continuation)
fn read_varint(cursor: &mut Cursor<&[u8]>) -> io::Result<usize> {
    let mut result: usize = 0;
    let mut shift: u32 = 0;
    loop {
        let mut byte = [0u8; 1];
        cursor.read_exact(&mut byte)?;
        let b = byte[0];
        result |= ((b & 0x7F) as usize) << shift;
        if b & 0x80 == 0 {
            break;
        }
        shift += 7;
        if shift > 63 {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                "VarInt too large",
            ));
        }
    }
    Ok(result)
}

/// Decode a string from event data based on FL version.
/// FL >= 11.5 uses UTF-16LE, older uses ASCII/Latin-1.
fn decode_string(data: &[u8], use_unicode: bool) -> String {
    if use_unicode {
        // UTF-16LE: pairs of bytes, strip null terminators
        let u16s: Vec<u16> = data
            .chunks_exact(2)
            .map(|chunk| u16::from_le_bytes([chunk[0], chunk[1]]))
            .collect();
        String::from_utf16_lossy(&u16s)
            .trim_end_matches('\0')
            .to_string()
    } else {
        // ASCII / Latin-1
        String::from_utf8_lossy(data)
            .trim_end_matches('\0')
            .to_string()
    }
}

/// Parse an FLP file from disk and extract metadata.
pub fn parse_flp(file_path: &str) -> Result<FlpMetadata, String> {
    let data = fs::read(file_path).map_err(|e| format!("Failed to read {}: {}", file_path, e))?;
    parse_flp_from_bytes(&data, file_path)
}

/// Parse FLP metadata from raw bytes (e.g., extracted from a zip file).
/// `label` is used for error messages and stored as `file_path` in the result.
pub fn parse_flp_from_bytes(data: &[u8], label: &str) -> Result<FlpMetadata, String> {
    if data.len() < 22 {
        return Err(format!("File too small to be an FLP: {}", label));
    }

    // ── Parse header (14 bytes) ──────────────────────────────────────────────
    // 4 bytes: magic "FLhd"
    if &data[0..4] != b"FLhd" {
        return Err(format!("Invalid FLP header magic in {}", label));
    }

    // 4 bytes: header size (should be 6)
    let header_size = u32::from_le_bytes([data[4], data[5], data[6], data[7]]);
    if header_size != 6 {
        return Err(format!(
            "Unexpected header size {} in {}",
            header_size, label
        ));
    }

    // 2 bytes: format (signed i16)
    // let _format = i16::from_le_bytes([data[8], data[9]]);

    // 2 bytes: channel count
    let channel_count = u16::from_le_bytes([data[10], data[11]]);

    // 2 bytes: PPQ
    // let _ppq = u16::from_le_bytes([data[12], data[13]]);

    // ── Parse data chunk header (8 bytes) ────────────────────────────────────
    if &data[14..18] != b"FLdt" {
        return Err(format!("Invalid data chunk magic in {}", label));
    }

    let _events_size = u32::from_le_bytes([data[18], data[19], data[20], data[21]]);

    // ── Parse events ─────────────────────────────────────────────────────────
    let events_data = &data[22..];
    let mut cursor = Cursor::new(events_data);
    let events_len = events_data.len() as u64;

    let mut title: Option<String> = None;
    let mut genre: Option<String> = None;
    let mut artists: Option<String> = None;
    let mut comments: Option<String> = None;
    let mut url: Option<String> = None;
    let mut tempo_main: Option<u32> = None; // tempo * 1000
    let mut tempo_coarse: Option<u16> = None;
    let mut tempo_fine: Option<u16> = None;
    let mut time_spent_days: Option<f64> = None;
    let mut created_on_days: Option<f64> = None;
    let mut pattern_count: usize = 0;
    let mut use_unicode = false; // Default to ASCII until we detect FL version
    let mut fl_version_detected = false;
    let mut fl_major_version: u32 = 0; // Track major version for fallback scan gating

    while cursor.position() < events_len {
        // Read event ID (1 byte)
        let mut id_byte = [0u8; 1];
        if cursor.read_exact(&mut id_byte).is_err() {
            break;
        }
        let id = id_byte[0];

        // Determine data size based on ID range
        let event_data: Vec<u8> = if id < WORD {
            // BYTE range: 1 byte
            let mut buf = [0u8; 1];
            if cursor.read_exact(&mut buf).is_err() {
                break;
            }
            buf.to_vec()
        } else if id < DWORD {
            // WORD range: 2 bytes
            let mut buf = [0u8; 2];
            if cursor.read_exact(&mut buf).is_err() {
                break;
            }
            buf.to_vec()
        } else if id < TEXT {
            // DWORD range: 4 bytes
            let mut buf = [0u8; 4];
            if cursor.read_exact(&mut buf).is_err() {
                break;
            }
            buf.to_vec()
        } else {
            // TEXT or DATA range: VarInt length prefix, then data
            let size = match read_varint(&mut cursor) {
                Ok(s) => s,
                Err(_) => break,
            };
            let mut buf = vec![0u8; size];
            if cursor.read_exact(&mut buf).is_err() {
                break;
            }
            buf
        };

        // ── Process events we care about ─────────────────────────────────────
        match id {
            EVENT_FL_VERSION => {
                // Always ASCII - parse version to determine string encoding
                let version_str = String::from_utf8_lossy(&event_data)
                    .trim_end_matches('\0')
                    .to_string();
                if let Some((major, minor)) = parse_fl_version(&version_str) {
                    use_unicode = major > 11 || (major == 11 && minor >= 5);
                    fl_version_detected = true;
                    fl_major_version = major;
                }
            }
            EVENT_TITLE => {
                if fl_version_detected {
                    let t = decode_string(&event_data, use_unicode);
                    if !t.is_empty() {
                        title = Some(t);
                    }
                }
            }
            EVENT_GENRE => {
                if fl_version_detected {
                    let g = decode_string(&event_data, use_unicode);
                    if !g.is_empty() {
                        genre = Some(g);
                    }
                }
            }
            EVENT_ARTISTS => {
                if fl_version_detected {
                    let a = decode_string(&event_data, use_unicode);
                    if !a.is_empty() {
                        artists = Some(a);
                    }
                }
            }
            EVENT_COMMENTS => {
                if fl_version_detected {
                    let c = decode_string(&event_data, use_unicode);
                    if !c.is_empty() {
                        comments = Some(c);
                    }
                }
            }
            EVENT_URL => {
                if fl_version_detected {
                    let u = decode_string(&event_data, use_unicode);
                    if !u.is_empty() {
                        url = Some(u);
                    }
                }
            }
            EVENT_TEMPO => {
                if event_data.len() >= 4 {
                    tempo_main = Some(u32::from_le_bytes([
                        event_data[0],
                        event_data[1],
                        event_data[2],
                        event_data[3],
                    ]));
                }
            }
            EVENT_TEMPO_COARSE => {
                if event_data.len() >= 2 {
                    tempo_coarse = Some(u16::from_le_bytes([event_data[0], event_data[1]]));
                }
            }
            EVENT_TEMPO_FINE => {
                if event_data.len() >= 2 {
                    tempo_fine = Some(u16::from_le_bytes([event_data[0], event_data[1]]));
                }
            }
            EVENT_TIMESTAMP => {
                // 16 bytes: f64 created_on (days since Delphi epoch) + f64 time_spent (days)
                if event_data.len() >= 16 {
                    let created_bytes: [u8; 8] = event_data[0..8].try_into().unwrap();
                    let spent_bytes: [u8; 8] = event_data[8..16].try_into().unwrap();
                    created_on_days = Some(f64::from_le_bytes(created_bytes));
                    time_spent_days = Some(f64::from_le_bytes(spent_bytes));
                }
            }
            EVENT_PATTERN_NEW => {
                // Each occurrence of PatternID.New signals a new pattern
                pattern_count += 1;
            }
            _ => {
                // Skip events we don't care about
            }
        }
    }

    // ── Compute final values ─────────────────────────────────────────────────

    // Validate tempo_coarse: FL Studio max BPM is 522, so reject bogus values
    // that arise from misaligned event parsing in FL 2025.3+ files.
    if let Some(coarse) = tempo_coarse {
        if coarse > 522 {
            tempo_coarse = None;
        }
    }

    let bpm = if let Some(t) = tempo_main {
        let candidate = t as f64 / 1000.0;
        // FL Studio BPM range is 10–999. Reject bogus values that come from
        // misaligned event parsing (e.g. Detective_.flp-style files where the
        // 0x9c byte appears in a wrong context and the 4 payload bytes encode
        // something that is not tempo).
        if candidate >= 10.0 && candidate <= 999.0 {
            Some(candidate)
        } else {
            None // fall through to coarse/fine or raw-scan fallback
        }
    } else {
        // Fallback to legacy coarse + fine
        let mut bpm_val: Option<f64> = None;
        if let Some(coarse) = tempo_coarse {
            bpm_val = Some(coarse as f64);
        }
        if let Some(fine) = tempo_fine {
            bpm_val = Some(bpm_val.unwrap_or(0.0) + fine as f64 / 1000.0);
        }
        bpm_val
    };

    // ── Fallback: raw byte scan for tempo ─────────────────────────────────
    // FL Studio 2025.3+ may not emit EVENT_TEMPO (0x9c) as a standalone event
    // due to extra padding bytes in the string data area that cause the 0x9c
    // byte to be consumed as a BYTE event value instead of an event ID.
    // Only run this fallback for FL 2025+ (major version >= 25) where misalignment occurs.
    // Scan the events data for the pattern:
    //   0x9c (EVENT_TEMPO ID) followed by 4 LE bytes = tempo * 1000
    let bpm = if bpm.is_none() && fl_major_version >= 25 {
        let scan_limit = events_data.len().min(4000);
        let mut found_bpm: Option<f64> = None;
        for i in 0..scan_limit.saturating_sub(4) {
            if events_data[i] == EVENT_TEMPO && i + 5 <= events_data.len() {
                let candidate = u32::from_le_bytes([
                    events_data[i + 1],
                    events_data[i + 2],
                    events_data[i + 3],
                    events_data[i + 4],
                ]);
                let candidate_bpm = candidate as f64 / 1000.0;
                if candidate_bpm >= 10.0 && candidate_bpm <= 522.0 {
                    found_bpm = Some(candidate_bpm);
                    break;
                }
            }
        }
        found_bpm
    } else {
        bpm
    };

    // ── Fallback: raw byte scan for text metadata ───────────────────────
    // FL Studio 2025.3+ misaligned event parsing may consume text event IDs
    // as BYTE event values. Scan for them directly in the raw data.
    // Only run this fallback for FL 2025+ (major version >= 25) where misalignment occurs.
    // For older versions (FL 12, 20, etc.), if a field is None it's genuinely empty.
    if use_unicode && fl_major_version >= 25 {
        let text_events: &[(u8, &str)] = &[
            (EVENT_TITLE, "title"),
            (EVENT_GENRE, "genre"),
            (EVENT_ARTISTS, "artists"),
            (EVENT_COMMENTS, "comments"),
            (EVENT_URL, "url"),
        ];
        for &(event_id, field_name) in text_events {
            let field_is_none = match field_name {
                "title" => title.is_none(),
                "genre" => genre.is_none(),
                "artists" => artists.is_none(),
                "comments" => comments.is_none(),
                "url" => url.is_none(),
                _ => false,
            };
            if !field_is_none {
                continue;
            }
            let scan_limit = events_data.len().min(4000);
            for i in 0..scan_limit {
                if events_data[i] == event_id {
                    // Read varint length
                    let mut j = i + 1;
                    let mut size: usize = 0;
                    let mut shift: u32 = 0;
                    let mut valid = true;
                    while j < events_data.len() {
                        let b = events_data[j];
                        j += 1;
                        size |= ((b & 0x7F) as usize) << shift;
                        if b & 0x80 == 0 {
                            break;
                        }
                        shift += 7;
                        if shift > 28 {
                            valid = false;
                            break;
                        }
                    }
                    // Validate: size must be even (UTF-16LE), reasonable, and data must look like UTF-16
                    if valid
                        && size >= 2
                        && size <= 2000
                        && size % 2 == 0
                        && j + size <= events_data.len()
                    {
                        let text_data = &events_data[j..j + size];
                        let decoded = decode_string(text_data, true);
                        // Validate: must be printable, non-empty, and look like real text
                        // (not random binary data decoded as UTF-16LE, which produces
                        // mostly CJK/symbol chars that pass is_control checks)
                        let is_plausible_text = !decoded.is_empty()
                            && decoded
                                .chars()
                                .all(|c| !c.is_control() || c == '\n' || c == '\r')
                            && {
                                // At least 50% of chars should be ASCII/Latin to be plausible
                                let ascii_count = decoded
                                    .chars()
                                    .filter(|c| c.is_ascii() || (*c as u32) < 0x0250)
                                    .count();
                                let total = decoded.chars().count();
                                total > 0 && ascii_count * 2 >= total
                            };
                        if is_plausible_text {
                            match field_name {
                                "title" => title = Some(decoded),
                                "genre" => genre = Some(decoded),
                                "artists" => artists = Some(decoded),
                                "comments" => comments = Some(decoded),
                                "url" => url = Some(decoded),
                                _ => {}
                            }
                            break;
                        }
                    }
                }
            }
        }
    }

    // ── Fallback: raw byte scan for timestamp ─────────────────────────────
    // FL Studio 2025.3+ misaligned event parsing may cause the parser to break
    // before reaching EVENT_TIMESTAMP (0xed). Scan for it directly in the raw data.
    // Only run this fallback for FL 2025+ (major version >= 25) where misalignment occurs.
    if (time_spent_days.is_none() || created_on_days.is_none()) && fl_major_version >= 25 {
        let scan_limit = events_data.len().min(4000);
        for i in 0..scan_limit {
            if events_data[i] == EVENT_TIMESTAMP {
                // Next byte(s) should be a varint encoding the size (should be 16)
                let mut j = i + 1;
                let mut size: usize = 0;
                let mut shift: u32 = 0;
                while j < events_data.len() {
                    let b = events_data[j];
                    j += 1;
                    size |= ((b & 0x7F) as usize) << shift;
                    if b & 0x80 == 0 {
                        break;
                    }
                    shift += 7;
                    if shift > 28 {
                        break;
                    }
                }
                if size == 16 && j + 16 <= events_data.len() {
                    let created_bytes: [u8; 8] = events_data[j..j + 8].try_into().unwrap();
                    let spent_bytes: [u8; 8] = events_data[j + 8..j + 16].try_into().unwrap();
                    let created = f64::from_le_bytes(created_bytes);
                    let spent = f64::from_le_bytes(spent_bytes);
                    // Validate: created_on should be > Delphi epoch offset (i.e., after year 1970)
                    // and time_spent should be non-negative and reasonable (< 365 days)
                    if created > DELPHI_EPOCH_OFFSET_DAYS && spent >= 0.0 && spent < 365.0 {
                        if created_on_days.is_none() {
                            created_on_days = Some(created);
                        }
                        if time_spent_days.is_none() {
                            time_spent_days = Some(spent);
                        }
                        break;
                    }
                }
            }
        }
    }

    let time_spent_minutes = time_spent_days.map(|days| {
        let seconds = days * 24.0 * 60.0 * 60.0;
        (seconds / 60.0) as i64
    });

    let total_time_seconds = time_spent_days.map(|days| (days * 24.0 * 60.0 * 60.0) as i64);

    // Convert created_on from Delphi days to ISO 8601 string
    let created_on = created_on_days.and_then(|days| {
        // Convert Delphi epoch days to Unix timestamp
        let unix_days = days - DELPHI_EPOCH_OFFSET_DAYS;
        let unix_seconds = unix_days * 24.0 * 60.0 * 60.0;
        let timestamp = unix_seconds as i64;
        chrono::DateTime::from_timestamp(timestamp, 0).map(|dt| dt.to_rfc3339())
    });

    Ok(FlpMetadata {
        file_path: label.to_string(),
        title,
        bpm,
        channels: Some(channel_count),
        patterns: if pattern_count > 0 {
            Some(pattern_count)
        } else {
            None
        },
        time_spent_minutes,
        total_time_seconds,
        genre,
        artists,
        comments,
        url,
        created_on,
    })
}

/// Deep analysis of an FLP file extracting plugins, samples, channels, mixer tracks.
/// This is a separate pass from parse_flp_from_bytes for extended project analysis.
pub fn analyze_flp(file_path: &str) -> Result<FlpAnalysis, String> {
    let data = fs::read(file_path).map_err(|e| format!("Failed to read {}: {}", file_path, e))?;
    analyze_flp_from_bytes(&data, file_path)
}

/// Deep analysis from raw bytes
pub fn analyze_flp_from_bytes(data: &[u8], label: &str) -> Result<FlpAnalysis, String> {
    if data.len() < 22 {
        return Err(format!("File too small to be an FLP: {}", label));
    }

    if &data[0..4] != b"FLhd" {
        return Err(format!("Invalid FLP header magic in {}", label));
    }

    let header_size = u32::from_le_bytes([data[4], data[5], data[6], data[7]]);
    if header_size != 6 {
        return Err(format!("Unexpected header size {} in {}", header_size, label));
    }

    if &data[14..18] != b"FLdt" {
        return Err(format!("Invalid data chunk magic in {}", label));
    }

    let events_data = &data[22..];
    let mut cursor = Cursor::new(events_data);
    let events_len = events_data.len() as u64;

    let mut use_unicode = false;
    let mut fl_version_str: Option<String> = None;

    // Channel tracking
    let mut channels: Vec<FlpChannel> = Vec::new();
    let mut current_channel_index: usize = 0;
    let mut current_channel_name: Option<String> = None;
    let mut current_channel_type: u32 = 0; // 0=sampler
    let mut current_plugin_name: Option<String> = None;
    let mut current_vst_name: Option<String> = None; // Extracted from plugin data blob
    let mut current_sample_path: Option<String> = None;
    let mut current_color: Option<String> = None;
    let mut current_mixer_target: Option<i32> = None;
    let mut in_channel_section = false;

    // Mixer tracking
    let mut mixer_tracks: Vec<FlpMixerTrack> = Vec::new();
    let mut mixer_track_index: usize = 0;
    let mut in_mixer_section = false;
    let mut mixer_insert_started = false;
    let mut pending_mixer_name: Option<String> = None;
    let mut current_mixer_name: Option<String> = None;
    let mut current_mixer_color: Option<String> = None;
    let mut current_mixer_plugins: Vec<String> = Vec::new();
    let mut current_mixer_plugin_name: Option<String> = None;

    // Pattern tracking
    let mut patterns: Vec<FlpPattern> = Vec::new();
    let mut current_pattern_id: Option<usize> = None;

    // Plugin list (deduplicated)
    let mut plugin_set: HashMap<String, FlpPlugin> = HashMap::new();

    // Sample paths (deduplicated)
    let mut sample_set: Vec<String> = Vec::new();
    let mut sample_seen: std::collections::HashSet<String> = std::collections::HashSet::new();

    while cursor.position() < events_len {
        let mut id_byte = [0u8; 1];
        if cursor.read_exact(&mut id_byte).is_err() {
            break;
        }
        let id = id_byte[0];

        let event_data: Vec<u8> = if id < WORD {
            let mut buf = [0u8; 1];
            if cursor.read_exact(&mut buf).is_err() { break; }
            buf.to_vec()
        } else if id < DWORD {
            let mut buf = [0u8; 2];
            if cursor.read_exact(&mut buf).is_err() { break; }
            buf.to_vec()
        } else if id < TEXT {
            let mut buf = [0u8; 4];
            if cursor.read_exact(&mut buf).is_err() { break; }
            buf.to_vec()
        } else {
            let size = match read_varint(&mut cursor) {
                Ok(s) => s,
                Err(_) => break,
            };
            let mut buf = vec![0u8; size];
            if cursor.read_exact(&mut buf).is_err() { break; }
            buf
        };

        match id {
            EVENT_FL_VERSION => {
                let version_str = String::from_utf8_lossy(&event_data)
                    .trim_end_matches('\0')
                    .to_string();
                if let Some((major, minor)) = parse_fl_version(&version_str) {
                    use_unicode = major > 11 || (major == 11 && minor >= 5);
                }
                fl_version_str = Some(version_str);
            }
            EVENT_NEW_CHANNEL => {
                // Finalize previous channel if we were tracking one
                if in_channel_section {
                    let ch_type_str = channel_type_str(current_channel_type);

                    // Resolve "Fruity Wrapper" → actual VST name from plugin data, then channel name
                    let resolved_plugin = resolve_plugin_display_name(
                        current_plugin_name.as_deref(),
                        current_channel_name.as_deref(),
                        current_vst_name.as_deref(),
                    );

                    let is_automation = ch_type_str == "automation"
                        || current_channel_name.as_deref().map_or(false, |n| is_automation_clip_name(n));

                    channels.push(FlpChannel {
                        index: current_channel_index,
                        name: current_channel_name.take(),
                        channel_type: ch_type_str.to_string(),
                        plugin_name: if is_automation { None } else { resolved_plugin.clone() },
                        sample_path: current_sample_path.clone(),
                        color: current_color.take(),
                        mixer_track: current_mixer_target,
                    });

                    // Track plugin (skip automation clips and empty names)
                    if !is_automation {
                        if let Some(ref display_name) = resolved_plugin {
                            if !display_name.is_empty() && !plugin_set.contains_key(display_name) {
                                plugin_set.insert(display_name.clone(), FlpPlugin {
                                    name: display_name.clone(),
                                    dll_name: current_plugin_name.clone(),
                                    channel_name: channels.last().and_then(|c| c.name.clone()),
                                    channel_index: Some(current_channel_index),
                                    is_instrument: current_channel_type == 2,
                                    preset_name: None,
                                });
                            }
                        } else if current_channel_type == 0 {
                            // Sampler channel — add using channel name as plugin name
                            if let Some(ref ch_name) = channels.last().and_then(|c| c.name.clone()) {
                                if !ch_name.is_empty() && !plugin_set.contains_key(ch_name) {
                                    plugin_set.insert(ch_name.clone(), FlpPlugin {
                                        name: ch_name.clone(),
                                        dll_name: Some("Sampler".to_string()),
                                        channel_name: Some(ch_name.clone()),
                                        channel_index: Some(current_channel_index),
                                        is_instrument: true,
                                        preset_name: None,
                                    });
                                }
                            }
                        }
                    }

                    // Track sample
                    if let Some(ref spath) = current_sample_path {
                        if !spath.is_empty() && !sample_seen.contains(spath) {
                            sample_seen.insert(spath.clone());
                            sample_set.push(spath.clone());
                        }
                    }

                    current_channel_index += 1;
                }
                in_channel_section = true;
                current_channel_type = 0;
                current_plugin_name = None;
                current_vst_name = None;
                current_sample_path = None;
                current_color = None;
                current_channel_name = None;
                current_mixer_target = None;
            }
            EVENT_CHANNEL_TYPE_BYTE => {
                // FL 2025.3+: channel type in BYTE range (id=21)
                // 0=sampler, 2=generator/VST, 3=layer, 4=audio_clip, 5=automation
                if in_channel_section && event_data.len() >= 1 {
                    current_channel_type = event_data[0] as u32;
                }
            }
            EVENT_CHANNEL_TYPE_DWORD => {
                // Legacy (pre-2025.3): channel type in DWORD range (id=149)
                if event_data.len() >= 4 {
                    current_channel_type = u32::from_le_bytes([
                        event_data[0], event_data[1], event_data[2], event_data[3],
                    ]);
                }
            }
            EVENT_CHANNEL_NAME => {
                let name = decode_string(&event_data, use_unicode);
                if !name.is_empty() {
                    current_channel_name = Some(name);
                }
            }
            EVENT_PLUGIN_NAME => {
                let name = decode_string(&event_data, use_unicode);
                if !name.is_empty() {
                    if in_mixer_section {
                        current_mixer_plugin_name = Some(name);
                    } else {
                        current_plugin_name = Some(name);
                    }
                }
            }
            EVENT_SAMPLE_FILE_NAME => {
                let path = decode_string(&event_data, use_unicode);
                if !path.is_empty() {
                    current_sample_path = Some(path);
                }
            }
            EVENT_PLUGIN_COLOR => {
                if event_data.len() >= 4 {
                    let r = event_data[0];
                    let g = event_data[1];
                    let b = event_data[2];
                    if in_mixer_section {
                        current_mixer_color = Some(format!("#{:02x}{:02x}{:02x}", r, g, b));
                    } else {
                        current_color = Some(format!("#{:02x}{:02x}{:02x}", r, g, b));
                    }
                }
            }
            EVENT_PLUGIN_DATA => {
                if in_mixer_section {
                    // Extract VST name from mixer effect plugin data
                    let vst_name = if event_data.len() > 20 {
                        extract_vst_name_from_plugin_data(&event_data)
                    } else {
                        None
                    };

                    let plugin_display = if let Some(ref vst) = vst_name {
                        clean_plugin_name(vst)
                    } else if let Some(ref pname) = current_mixer_plugin_name {
                        if !is_fruity_wrapper(pname) {
                            // FL native plugin (e.g. "Fruity Balance") — use the name directly
                            pname.clone()
                        } else {
                            String::new() // Extraction failed for wrapped plugin
                        }
                    } else {
                        String::new()
                    };

                    if !plugin_display.is_empty() {
                        current_mixer_plugins.push(plugin_display);
                    }
                    current_mixer_plugin_name = None;
                } else if in_channel_section && event_data.len() > 20 {
                    // Extract VST DLL name from the plugin data blob (for Fruity Wrapper channels)
                    if let Some(vst) = extract_vst_name_from_plugin_data(&event_data) {
                        current_vst_name = Some(vst);
                    }
                }
            }
            EVENT_TARGET_INSERT => {
                // FL 2025.3+: mixer insert target in WORD range (id=104)
                if in_channel_section && event_data.len() >= 2 {
                    let target = u16::from_le_bytes([event_data[0], event_data[1]]) as i32;
                    if target > 0 {
                        current_mixer_target = Some(target);
                    }
                }
            }
            EVENT_PATTERN_NEW => {
                // PATTERN_NEW carries a u16 pattern ID — may appear twice per pattern
                if event_data.len() >= 2 {
                    let pat_id = u16::from_le_bytes([event_data[0], event_data[1]]) as usize;
                    // Only create if this pattern ID doesn't already exist
                    if !patterns.iter().any(|p| p.index == pat_id) {
                        patterns.push(FlpPattern {
                            index: pat_id,
                            name: None,
                        });
                    }
                    // Track current pattern ID for PATTERN_NAME association
                    current_pattern_id = Some(pat_id);
                }
            }
            EVENT_PATTERN_NAME => {
                // PATTERN_NAME applies to the most recent PATTERN_NEW by its ID
                let name = decode_string(&event_data, use_unicode);
                if !name.is_empty() {
                    if let Some(pat_id) = current_pattern_id {
                        if let Some(p) = patterns.iter_mut().find(|p| p.index == pat_id) {
                            p.name = Some(name);
                        }
                    }
                }
            }
            EVENT_MIXER_TRACK_NAME => {
                let name = decode_string(&event_data, use_unicode);
                if !in_mixer_section {
                    in_mixer_section = true;
                    // End channel section when mixer starts
                    in_channel_section = false;
                }
                pending_mixer_name = if name.is_empty() { None } else { Some(name) };
            }
            EVENT_MIXER_PARAMS => {
                // id=236 (DATA+28): mixer insert data block separator
                // Each mixer insert starts with this event
                if !in_mixer_section {
                    // First id=236 might appear before MIXER_TRACK_NAME if first insert is unnamed
                    // But typically MIXER_TRACK_NAME triggers mixer section entry first
                    in_mixer_section = true;
                    in_channel_section = false;
                }

                // Finalize previous mixer insert
                if mixer_insert_started {
                    // Dedup plugins (same plugin in multiple slots)
                    current_mixer_plugins.dedup();
                    let has_content = current_mixer_name.is_some() || !current_mixer_plugins.is_empty();
                    if has_content {
                        mixer_tracks.push(FlpMixerTrack {
                            index: mixer_track_index,
                            name: current_mixer_name.take(),
                            color: current_mixer_color.take(),
                            plugins: current_mixer_plugins.drain(..).collect(),
                        });
                    } else {
                        current_mixer_name = None;
                        current_mixer_color = None;
                        current_mixer_plugins.clear();
                    }
                }

                // Start new mixer insert
                mixer_insert_started = true;
                mixer_track_index += 1;
                current_mixer_name = pending_mixer_name.take();
                current_mixer_color = None;
                current_mixer_plugins.clear();
                current_mixer_plugin_name = None;
            }
            _ => {}
        }
    }

    // Finalize last channel
    if in_channel_section {
        let ch_type_str = channel_type_str(current_channel_type);

        // Resolve "Fruity Wrapper" → actual VST name from plugin data, then channel name
        let resolved_plugin = resolve_plugin_display_name(
            current_plugin_name.as_deref(),
            current_channel_name.as_deref(),
            current_vst_name.as_deref(),
        );

        let is_automation = ch_type_str == "automation"
            || current_channel_name.as_deref().map_or(false, |n| is_automation_clip_name(n));

        channels.push(FlpChannel {
            index: current_channel_index,
            name: current_channel_name.take(),
            channel_type: ch_type_str.to_string(),
            plugin_name: if is_automation { None } else { resolved_plugin.clone() },
            sample_path: current_sample_path.clone(),
            color: current_color.take(),
            mixer_track: current_mixer_target,
        });

        if !is_automation {
            if let Some(ref display_name) = resolved_plugin {
                if !display_name.is_empty() && !plugin_set.contains_key(display_name) {
                    plugin_set.insert(display_name.clone(), FlpPlugin {
                        name: display_name.clone(),
                        dll_name: current_plugin_name.clone(),
                        channel_name: channels.last().and_then(|c| c.name.clone()),
                        channel_index: Some(current_channel_index),
                        is_instrument: current_channel_type == 2,
                        preset_name: None,
                    });
                }
            } else if current_channel_type == 0 {
                // Sampler channel — add using channel name as plugin name
                if let Some(ref ch_name) = channels.last().and_then(|c| c.name.clone()) {
                    if !ch_name.is_empty() && !plugin_set.contains_key(ch_name) {
                        plugin_set.insert(ch_name.clone(), FlpPlugin {
                            name: ch_name.clone(),
                            dll_name: Some("Sampler".to_string()),
                            channel_name: Some(ch_name.clone()),
                            channel_index: Some(current_channel_index),
                            is_instrument: true,
                            preset_name: None,
                        });
                    }
                }
            }
        }

        if let Some(ref spath) = current_sample_path {
            if !spath.is_empty() && !sample_seen.contains(spath) {
                sample_set.push(spath.clone());
            }
        }
    }

    // Finalize last mixer insert
    if mixer_insert_started {
        current_mixer_plugins.dedup();
        let has_content = current_mixer_name.is_some() || !current_mixer_plugins.is_empty();
        if has_content {
            mixer_tracks.push(FlpMixerTrack {
                index: mixer_track_index,
                name: current_mixer_name.take(),
                color: current_mixer_color.take(),
                plugins: current_mixer_plugins.drain(..).collect(),
            });
        }
    }

    // Add mixer effect plugins to the global plugin set
    for mt in &mixer_tracks {
        for plugin_name in &mt.plugins {
            if !plugin_name.is_empty() && !plugin_set.contains_key(plugin_name) {
                plugin_set.insert(plugin_name.clone(), FlpPlugin {
                    name: plugin_name.clone(),
                    dll_name: Some("Fruity Wrapper".to_string()),
                    channel_name: mt.name.clone(),
                    channel_index: None,
                    is_instrument: false,
                    preset_name: None,
                });
            }
        }
    }

    // Filter out FLRPC internal patterns and sort by index
    patterns.retain(|p| {
        !p.name.as_deref().map_or(false, |n| n.starts_with("FLRPC:"))
    });
    patterns.sort_by_key(|p| p.index);

    // Also capture samples from generator channels' sample paths
    // (some channels use built-in FL plugins like Sampler with sample paths)

    Ok(FlpAnalysis {
        plugins: plugin_set.into_values().collect(),
        samples: sample_set,
        channels,
        mixer_tracks,
        patterns,
        fl_version: fl_version_str,
    })
}

/// Map channel type integer to string label
fn channel_type_str(channel_type: u32) -> &'static str {
    match channel_type {
        0 => "sampler",
        2 => "generator",
        3 => "layer",
        4 => "audio_clip",
        5 => "automation",
        _ => "unknown",
    }
}

/// Detect automation clips by name pattern (for FL versions where type isn't set)
fn is_automation_clip_name(name: &str) -> bool {
    // FL Studio automation clips typically have names like:
    // "Balance - PluginName - ParamName", "Fruity Parametric EQ 2 - Band 1 - Frequency"
    // They always contain " - " separators with parameter descriptions
    let has_param_pattern = name.contains(" - ") && (
        name.contains("Volume") || name.contains("Pan") || name.contains("Balance") ||
        name.contains("Frequency") || name.contains("Gain") || name.contains("Level") ||
        name.contains("Cutoff") || name.contains("Resonance") || name.contains("Attack") ||
        name.contains("Release") || name.contains("Threshold") || name.contains("Ratio") ||
        name.contains("Mix") || name.contains("Amount") || name.contains("Rate") ||
        name.contains("Time") || name.contains("Depth") || name.contains("Width") ||
        name.contains("Feedback") || name.contains("Modulation")
    );
    has_param_pattern
}

/// Clean a plugin DLL/VST name to a readable display name
fn clean_plugin_name(dll_name: &str) -> String {
    let name = dll_name
        .trim_end_matches(".dll")
        .trim_end_matches(".DLL")
        .trim_end_matches(".vst3")
        .trim_end_matches(".VST3")
        .trim_end_matches(".clap")
        .trim_end_matches(".CLAP")
        .trim_end_matches("_x64")
        .trim_end_matches("_X64")
        .trim_end_matches(" x64")
        .replace('_', " ");

    // Extract just the filename if it's a full path
    if let Some(pos) = name.rfind('\\') {
        name[pos + 1..].to_string()
    } else if let Some(pos) = name.rfind('/') {
        name[pos + 1..].to_string()
    } else {
        name
    }
}

/// Check if a plugin name is the FL Studio VST wrapper (not the actual plugin)
fn is_fruity_wrapper(name: &str) -> bool {
    let lower = name.to_lowercase();
    lower == "fruity wrapper"
        || lower.starts_with("fruity wrapper ")
        || lower.starts_with("fruity wrapper(")
}

/// Extract the actual VST plugin name from a Fruity Wrapper plugin data blob.
/// The plugin data contains binary data with embedded strings. We scan for:
/// 1. DLL paths (VST2) — strings containing ".dll"
/// 2. VST3 bundle paths — strings containing ".vst3"
/// 3. CLAP identifiers — strings containing ".clap"
/// Both ASCII and UTF-16LE encodings are checked.
/// Extensions may NOT be at the very end of the ASCII run (FL appends length bytes),
/// so we use `contains()` and truncate after the extension.
fn extract_vst_name_from_plugin_data(data: &[u8]) -> Option<String> {
    let mut best_match: Option<String> = None;
    let extensions = [".dll", ".vst3", ".clap"];

    // Strategy 1: Scan for ASCII strings containing plugin file extensions
    let mut i = 0;
    while i < data.len() {
        if data[i].is_ascii_graphic() || data[i] == b' ' {
            let start = i;
            while i < data.len() && (data[i].is_ascii_graphic() || data[i] == b' ') {
                i += 1;
            }
            let s = String::from_utf8_lossy(&data[start..i]).to_string();
            let lower = s.to_lowercase();
            for ext in &extensions {
                if let Some(pos) = lower.find(ext) {
                    // Truncate at end of extension
                    let end_pos = pos + ext.len();
                    let path_str = &s[..end_pos];
                    if path_str.len() >= 5 {
                        let filename = path_str.rsplit(|c| c == '\\' || c == '/').next().unwrap_or(path_str);
                        best_match = Some(filename.to_string());
                        // Don't break — last match is usually the actual plugin
                    }
                }
            }
        } else {
            i += 1;
        }
    }

    // Strategy 2: Scan UTF-16LE strings for the same extensions
    if best_match.is_none() && data.len() >= 10 {
        let mut j = 0;
        while j + 1 < data.len() {
            if data[j].is_ascii_graphic() && data[j + 1] == 0 {
                let start = j;
                while j + 1 < data.len() && (data[j].is_ascii_graphic() || data[j] == b' ') && data[j + 1] == 0 {
                    j += 2;
                }
                let u16s: Vec<u16> = data[start..j]
                    .chunks_exact(2)
                    .map(|c| u16::from_le_bytes([c[0], c[1]]))
                    .collect();
                let s = String::from_utf16_lossy(&u16s);
                let lower = s.to_lowercase();
                for ext in &extensions {
                    if let Some(pos) = lower.find(ext) {
                        let end_pos = pos + ext.len();
                        let path_str = &s[..end_pos];
                        if path_str.len() >= 5 {
                            let filename = path_str.rsplit(|c| c == '\\' || c == '/').next().unwrap_or(path_str);
                            best_match = Some(filename.to_string());
                        }
                    }
                }
            } else {
                j += 1;
            }
        }
    }

    best_match.map(|name| clean_plugin_name(&name))
}

/// Resolve the display name for a plugin, using the best available source:
/// 1. If "Fruity Wrapper", prefer VST name extracted from plugin data blob
/// 2. Then fall back to channel name (which defaults to plugin name in FL Studio)
/// 3. Otherwise use the cleaned plugin name
fn resolve_plugin_display_name(
    plugin_name: Option<&str>,
    channel_name: Option<&str>,
    vst_name_from_data: Option<&str>,
) -> Option<String> {
    match plugin_name {
        Some(pname) if is_fruity_wrapper(pname) => {
            // Priority: VST name from plugin data > channel name > "Fruity Wrapper"
            if let Some(vst) = vst_name_from_data {
                if !vst.is_empty() {
                    return Some(vst.to_string());
                }
            }
            channel_name.map(|n| n.to_string())
                .or_else(|| Some(pname.to_string()))
        }
        Some(pname) => Some(clean_plugin_name(pname)),
        None => None,
    }
}

/// Parse FL version string like "20.8.4" into (major, minor)
fn parse_fl_version(version: &str) -> Option<(u32, u32)> {
    let parts: Vec<&str> = version.split('.').collect();
    if parts.len() >= 2 {
        let major = parts[0].parse::<u32>().ok()?;
        let minor = parts[1].parse::<u32>().ok()?;
        Some((major, minor))
    } else {
        None
    }
}

/// Parse multiple FLP files in parallel using native threads
pub fn parse_flp_batch_parallel(file_paths: &[String]) -> HashMap<String, serde_json::Value> {
    use std::sync::{Arc, Mutex};
    use std::thread;

    let results = Arc::new(Mutex::new(HashMap::new()));
    let num_threads = thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(4)
        .min(file_paths.len())
        .max(1);

    let chunk_size = (file_paths.len() + num_threads - 1) / num_threads;
    let mut handles = Vec::new();

    for chunk in file_paths.chunks(chunk_size) {
        let chunk_owned: Vec<String> = chunk.to_vec();
        let results = Arc::clone(&results);

        let handle = thread::spawn(move || {
            let mut local_results = HashMap::new();
            for path in &chunk_owned {
                match parse_flp(path) {
                    Ok(metadata) => {
                        local_results.insert(path.clone(), metadata.to_json_value());
                    }
                    Err(e) => {
                        log::warn!("Failed to parse FLP {}: {}", path, e);
                        local_results.insert(
                            path.clone(),
                            serde_json::json!({
                                "file_path": path,
                                "title": null,
                                "bpm": null,
                                "channels": null,
                                "patterns": null,
                                "time_spent_minutes": null,
                                "total_time_seconds": null,
                                "length": null,
                            }),
                        );
                    }
                }
            }

            let mut global = results.lock().unwrap();
            global.extend(local_results);
        });

        handles.push(handle);
    }

    for handle in handles {
        handle.join().ok();
    }

    match Arc::try_unwrap(results) {
        Ok(mutex) => mutex.into_inner().unwrap(),
        Err(arc) => arc.lock().unwrap().clone(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Validate FL 2025.3 parsing with real project (skipped if file not found)
    #[test]
    fn test_fl2025_project_33() {
        let flp_path = r"C:\Users\paulw\Documents\Image-Line\FL Studio\Projects\Project_33\Project_33.flp";
        if !std::path::Path::new(flp_path).exists() {
            eprintln!("Skipping: {} not found", flp_path);
            return;
        }

        let result = analyze_flp(flp_path);
        assert!(result.is_ok(), "Failed to analyze: {:?}", result.err());
        let analysis = result.unwrap();

        // FL Version
        assert!(analysis.fl_version.as_ref().unwrap().starts_with("25."));

        // Channels
        assert_eq!(analysis.channels.len(), 5);
        assert_eq!(analysis.channels[0].name.as_deref(), Some("Analog Lab V"));
        assert_eq!(analysis.channels[0].channel_type, "generator");

        // Plugins: 1 instrument (Analog Lab V) + samplers + multiple mixer effects
        assert!(analysis.plugins.len() >= 19, "should have many plugins, got {}", analysis.plugins.len());
        let plugin_names: Vec<&str> = analysis.plugins.iter().map(|p| p.name.as_str()).collect();
        assert!(plugin_names.contains(&"Analog Lab V"), "missing Analog Lab V");
        assert!(plugin_names.contains(&"OTT"), "missing OTT");
        assert!(plugin_names.contains(&"soothe2"), "missing soothe2");
        assert!(plugin_names.contains(&"Ozone 11 Dynamics"), "missing Ozone 11 Dynamics");
        assert!(plugin_names.contains(&"SSL Native Bus Compressor 2"), "missing SSL Native Bus Compressor 2");

        // Samplers should appear as plugins
        assert!(plugin_names.contains(&"Oversampled_VOLCANO_kick_burning"), "missing sampler: kick");
        assert!(plugin_names.contains(&"Oversampled_VOLCANO_808_whomp_C#"), "missing sampler: 808");

        // Analog Lab V must be instrument, samplers must be instrument, mixer effects must not
        let analog_lab = analysis.plugins.iter().find(|p| p.name == "Analog Lab V").unwrap();
        assert!(analog_lab.is_instrument, "Analog Lab V should be an instrument");
        let kick = analysis.plugins.iter().find(|p| p.name == "Oversampled_VOLCANO_kick_burning").unwrap();
        assert!(kick.is_instrument, "Sampler should be marked as instrument");
        assert_eq!(kick.dll_name.as_deref(), Some("Sampler"));
        let ott = analysis.plugins.iter().find(|p| p.name == "OTT").unwrap();
        assert!(!ott.is_instrument, "OTT should be an effect, not instrument");

        // JSON serialization should use camelCase
        let json = serde_json::to_value(&analysis).unwrap();
        assert!(json.get("flVersion").is_some(), "should serialize as flVersion (camelCase)");
        assert!(json.get("mixerTracks").is_some(), "should serialize as mixerTracks (camelCase)");
        let first_plugin = &json["plugins"][0];
        assert!(first_plugin.get("isInstrument").is_some(), "should serialize as isInstrument (camelCase)");
        assert!(first_plugin.get("channelName").is_some(), "should serialize as channelName (camelCase)");

        // Mixer tracks: at least 7 inserts with content
        assert!(analysis.mixer_tracks.len() >= 7, "should have mixer inserts, got {}", analysis.mixer_tracks.len());
        // Insert 1 (master bus) should have many effects
        let insert1 = analysis.mixer_tracks.iter().find(|t| t.index == 1);
        assert!(insert1.is_some(), "insert 1 should exist");
        assert!(insert1.unwrap().plugins.len() >= 8, "insert 1 should have many effects");

        // Patterns: should have 6 (after FLRPC filtering)
        assert_eq!(analysis.patterns.len(), 6, "expected 6 patterns, got {}", analysis.patterns.len());
        // All patterns should have names
        assert!(analysis.patterns.iter().all(|p| p.name.is_some()),
            "all patterns should have names: {:?}", analysis.patterns.iter().map(|p| &p.name).collect::<Vec<_>>());
        // No FLRPC patterns
        assert!(!analysis.patterns.iter().any(|p| p.name.as_deref().map_or(false, |n| n.starts_with("FLRPC:"))),
            "FLRPC pattern should be filtered");
    }

    #[test]
    fn test_read_varint_single_byte() {
        let data: &[u8] = &[0x05];
        let mut cursor = Cursor::new(data);
        assert_eq!(read_varint(&mut cursor).unwrap(), 5);
    }

    #[test]
    fn test_read_varint_multi_byte() {
        // 300 = 0b100101100 → varint bytes: 0xAC 0x02
        let data: &[u8] = &[0xAC, 0x02];
        let mut cursor = Cursor::new(data);
        assert_eq!(read_varint(&mut cursor).unwrap(), 300);
    }

    #[test]
    fn test_read_varint_large() {
        // 16384 = 0x4000 → varint: 0x80 0x80 0x01
        let data: &[u8] = &[0x80, 0x80, 0x01];
        let mut cursor = Cursor::new(data);
        assert_eq!(read_varint(&mut cursor).unwrap(), 16384);
    }

    #[test]
    fn test_decode_string_ascii() {
        let data = b"Hello\0";
        let result = decode_string(data, false);
        assert_eq!(result, "Hello");
    }

    #[test]
    fn test_decode_string_unicode() {
        // "Hi" in UTF-16LE: H=0x48,0x00 i=0x69,0x00 null=0x00,0x00
        let data: &[u8] = &[0x48, 0x00, 0x69, 0x00, 0x00, 0x00];
        let result = decode_string(data, true);
        assert_eq!(result, "Hi");
    }

    #[test]
    fn test_parse_fl_version() {
        assert_eq!(parse_fl_version("20.8.4"), Some((20, 8)));
        assert_eq!(parse_fl_version("11.5.0"), Some((11, 5)));
        assert_eq!(parse_fl_version("11.4.0"), Some((11, 4)));
        assert_eq!(parse_fl_version("bad"), None);
    }

    #[test]
    fn test_unicode_detection() {
        // FL 20.8 should use unicode
        let (major, minor) = parse_fl_version("20.8.4").unwrap();
        assert!(major > 11 || (major == 11 && minor >= 5));

        // FL 11.4 should use ASCII
        let (major, minor) = parse_fl_version("11.4.0").unwrap();
        assert!(!(major > 11 || (major == 11 && minor >= 5)));

        // FL 11.5 should use unicode
        let (major, minor) = parse_fl_version("11.5.0").unwrap();
        assert!(major > 11 || (major == 11 && minor >= 5));
    }

    /// Test that we handle a minimal valid FLP structure
    #[test]
    fn test_parse_minimal_flp() {
        // Build a minimal FLP binary:
        // Header: FLhd (4) + size=6 (4) + format=0 (2) + channels=2 (2) + ppq=96 (2) = 14 bytes
        // Data: FLdt (4) + events_size (4) + events...
        let mut flp = Vec::new();

        // Header
        flp.extend_from_slice(b"FLhd");
        flp.extend_from_slice(&6u32.to_le_bytes());
        flp.extend_from_slice(&0i16.to_le_bytes()); // format = Project
        flp.extend_from_slice(&2u16.to_le_bytes()); // channel_count = 2
        flp.extend_from_slice(&96u16.to_le_bytes()); // ppq = 96

        // Data chunk header
        flp.extend_from_slice(b"FLdt");

        // Events:
        let mut events = Vec::new();

        // FL Version event (TEXT+7 = 199): "20.8.4"
        let version_bytes = b"20.8.4\0";
        events.push(EVENT_FL_VERSION);
        // VarInt encode length
        encode_varint(version_bytes.len(), &mut events);
        events.extend_from_slice(version_bytes);

        // Title event (TEXT+2 = 194): "Test Song" in UTF-16LE
        let title_str = "Test Song";
        let mut title_bytes: Vec<u8> = Vec::new();
        for ch in title_str.encode_utf16() {
            title_bytes.extend_from_slice(&ch.to_le_bytes());
        }
        title_bytes.extend_from_slice(&[0x00, 0x00]); // null terminator
        events.push(EVENT_TITLE);
        encode_varint(title_bytes.len(), &mut events);
        events.extend_from_slice(&title_bytes);

        // Tempo event (DWORD+28 = 156): 140000 = 140.0 BPM
        events.push(EVENT_TEMPO);
        events.extend_from_slice(&140000u32.to_le_bytes());

        // Timestamp event (DATA+29 = 237): 16 bytes
        events.push(EVENT_TIMESTAMP);
        encode_varint(16, &mut events);
        let created_days: f64 = DELPHI_EPOCH_OFFSET_DAYS + 19000.0; // some date
        let spent_days: f64 = 1.5 / 24.0; // 1.5 hours
        events.extend_from_slice(&created_days.to_le_bytes());
        events.extend_from_slice(&spent_days.to_le_bytes());

        // Pattern events
        events.push(EVENT_PATTERN_NEW);
        events.extend_from_slice(&1u16.to_le_bytes());
        events.push(EVENT_PATTERN_NEW);
        events.extend_from_slice(&2u16.to_le_bytes());

        // Write events size
        let events_size = events.len() as u32;
        flp.extend_from_slice(&events_size.to_le_bytes());
        flp.extend_from_slice(&events);

        // Write to temp file
        let temp_dir = std::env::temp_dir();
        let temp_file = temp_dir.join(format!("test_{}.flp", uuid::Uuid::new_v4()));
        fs::write(&temp_file, &flp).unwrap();

        let result = parse_flp(temp_file.to_str().unwrap());
        let _ = fs::remove_file(&temp_file);

        let metadata = result.unwrap();
        assert_eq!(metadata.title.as_deref(), Some("Test Song"));
        assert_eq!(metadata.bpm, Some(140.0));
        assert_eq!(metadata.channels, Some(2));
        assert_eq!(metadata.patterns, Some(2));
        assert!(metadata.time_spent_minutes.is_some());
        assert_eq!(metadata.time_spent_minutes.unwrap(), 90); // 1.5 hours = 90 minutes
        assert!(metadata.created_on.is_some());
    }

    fn encode_varint(mut value: usize, buf: &mut Vec<u8>) {
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

    #[test]
    fn test_parse_invalid_file() {
        let result = parse_flp("nonexistent_file.flp");
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_invalid_header() {
        let temp_dir = std::env::temp_dir();
        let temp_file = temp_dir.join(format!("test_bad_{}.flp", uuid::Uuid::new_v4()));
        fs::write(&temp_file, b"NOT_FLP_DATA_AT_ALL_NOPE").unwrap();
        let result = parse_flp(temp_file.to_str().unwrap());
        let _ = fs::remove_file(&temp_file);
        assert!(result.is_err());
    }

    /// Test parsing a real FL Studio 2025.3 project file where EVENT_TEMPO
    /// is consumed by BYTE id=0 string data and requires the raw byte scan fallback.
    #[test]
    fn test_parse_fl_2025_3_project() {
        // The test FLP file is at assets/flps/Project_1.flp relative to the workspace root
        let flp_path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .join("assets")
            .join("flps")
            .join("Project_1.flp");

        if !flp_path.exists() {
            eprintln!("Skipping test: {} not found", flp_path.display());
            return;
        }

        let result = parse_flp(flp_path.to_str().unwrap());
        assert!(
            result.is_ok(),
            "Failed to parse FL 2025.3 FLP: {:?}",
            result.err()
        );

        let metadata = result.unwrap();
        // BPM should be 144.0 (found via raw byte scan fallback)
        assert_eq!(
            metadata.bpm,
            Some(144.0),
            "BPM not correctly extracted from FL 2025.3 project"
        );
        // Channels should be 9
        assert_eq!(metadata.channels, Some(9));
        // Artists should be "GRXWL"
        assert_eq!(metadata.artists.as_deref(), Some("GRXWL"));
        // Time spent should be about 1-2 minutes
        assert!(
            metadata.time_spent_minutes.is_some(),
            "Time spent not extracted"
        );
        let minutes = metadata.time_spent_minutes.unwrap();
        assert!(
            minutes >= 1 && minutes <= 5,
            "Time spent {} minutes out of expected range",
            minutes
        );
        // Total time seconds should be 60-120
        assert!(
            metadata.total_time_seconds.is_some(),
            "Total time seconds not extracted"
        );
        let seconds = metadata.total_time_seconds.unwrap();
        assert!(
            seconds >= 60 && seconds <= 200,
            "Total time {} seconds out of expected range",
            seconds
        );
        // Created on should be present
        assert!(metadata.created_on.is_some(), "Created date not extracted");
    }

    /// Test parsing Project_4.flp - BPM should be 150, time_spent should be ~25 minutes
    #[test]
    fn test_parse_project_4() {
        let flp_path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .join("assets")
            .join("flps")
            .join("Project_4.flp");

        if !flp_path.exists() {
            eprintln!("Skipping test: {} not found", flp_path.display());
            return;
        }

        let result = parse_flp(flp_path.to_str().unwrap());
        assert!(
            result.is_ok(),
            "Failed to parse Project_4: {:?}",
            result.err()
        );

        let metadata = result.unwrap();
        assert_eq!(
            metadata.bpm,
            Some(150.0),
            "BPM not correctly extracted from Project_4"
        );
        assert!(
            metadata.time_spent_minutes.is_some(),
            "Time spent not extracted from Project_4"
        );
        let minutes = metadata.time_spent_minutes.unwrap();
        assert!(
            minutes >= 20 && minutes <= 30,
            "Time spent {} minutes out of expected range 20-30 for Project_4",
            minutes
        );
    }

    /// Test parsing Project_31.flp - BPM should be 140, time_spent should be ~3-4 minutes
    #[test]
    fn test_parse_project_31() {
        let flp_path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .join("assets")
            .join("flps")
            .join("Project_31.flp");

        if !flp_path.exists() {
            eprintln!("Skipping test: {} not found", flp_path.display());
            return;
        }

        let result = parse_flp(flp_path.to_str().unwrap());
        assert!(
            result.is_ok(),
            "Failed to parse Project_31: {:?}",
            result.err()
        );

        let metadata = result.unwrap();
        assert_eq!(
            metadata.bpm,
            Some(140.0),
            "BPM not correctly extracted from Project_31 (got {:?})",
            metadata.bpm
        );
        assert!(
            metadata.time_spent_minutes.is_some(),
            "Time spent not extracted from Project_31"
        );
        let minutes = metadata.time_spent_minutes.unwrap();
        assert!(
            minutes >= 2 && minutes <= 10,
            "Time spent {} minutes out of expected range 2-10 for Project_31",
            minutes
        );
        // Project_31 has title, genre, artists, comments set
        assert_eq!(metadata.title.as_deref(), Some("NewBeatProject"));
        assert_eq!(metadata.genre.as_deref(), Some("Boom Bap"));
        assert_eq!(metadata.artists.as_deref(), Some("Pvls"));
        assert!(
            metadata.comments.is_some(),
            "Comments not extracted from Project_31"
        );
    }

    /// Test parsing BASS.flp - an FL Studio 12 project where the title/genre/artists
    /// fields are empty. The raw byte scan fallback must NOT produce garbled text
    /// by misinterpreting binary plugin data as UTF-16LE text events.
    #[test]
    fn test_parse_fl12_bass() {
        let flp_path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .join("assets")
            .join("flps")
            .join("BASS.flp");

        if !flp_path.exists() {
            eprintln!("Skipping test: {} not found", flp_path.display());
            return;
        }

        let result = parse_flp(flp_path.to_str().unwrap());
        assert!(
            result.is_ok(),
            "Failed to parse FL12 BASS.flp: {:?}",
            result.err()
        );

        let metadata = result.unwrap();
        // BPM should be 130.0 (EVENT_TEMPO = 130000 / 1000)
        assert_eq!(
            metadata.bpm,
            Some(130.0),
            "BPM not correctly extracted from FL12 project"
        );
        // Channels should be 2
        assert_eq!(metadata.channels, Some(2));
        // Title should be None (empty in the FLP file), NOT garbled Unicode text
        assert_eq!(
            metadata.title, None,
            "Title should be None for FL12 project with empty title, got: {:?}",
            metadata.title
        );
        // Genre should be None (empty in the FLP file)
        assert_eq!(
            metadata.genre, None,
            "Genre should be None for FL12 project with empty genre"
        );
        // Artists should be None (empty in the FLP file)
        assert_eq!(
            metadata.artists, None,
            "Artists should be None for FL12 project with empty artists"
        );
        // Time spent and created_on should still be extracted from normal event parsing
        assert!(
            metadata.time_spent_minutes.is_some(),
            "Time spent not extracted from FL12 project"
        );
        assert!(
            metadata.created_on.is_some(),
            "Created date not extracted from FL12 project"
        );
    }

    /// Test that the raw byte scan fallback correctly extracts tempo from
    /// a file where EVENT_TEMPO is preceded by a stray 0x00 byte (FL 2025.3+ format).
    #[test]
    fn test_tempo_fallback_scan() {
        // Build an FLP where EVENT_TEMPO is hidden inside BYTE id=0 event stream
        // (simulating the FL 2025.3 format issue)
        let mut flp = Vec::new();

        // Header
        flp.extend_from_slice(b"FLhd");
        flp.extend_from_slice(&6u32.to_le_bytes());
        flp.extend_from_slice(&0i16.to_le_bytes());
        flp.extend_from_slice(&2u16.to_le_bytes());
        flp.extend_from_slice(&96u16.to_le_bytes());

        // Data chunk header
        flp.extend_from_slice(b"FLdt");

        let mut events = Vec::new();

        // FL Version event
        let version_bytes = b"25.2.3.5171\0";
        events.push(EVENT_FL_VERSION);
        encode_varint(version_bytes.len(), &mut events);
        events.extend_from_slice(version_bytes);

        // Simulate string data as BYTE id=0 events (like FL 2025.3 does)
        // App name: "FL Studio 25.2.3.5171.5171\0"
        let app_name = b"FL Studio 25.2.3.5171.5171\0";
        events.push(54u8); // event id=54 for first char
        events.push(app_name[0]); // 'F'
        for &ch in &app_name[1..] {
            events.push(0u8); // event id=0
            events.push(ch);
        }

        // Registration string: "some_reg_data\0"
        let reg_string = b"some_reg_data\0";
        for &ch in reg_string.iter() {
            events.push(0u8);
            events.push(ch);
        }

        // Extra 0x00 byte that causes the misalignment in FL 2025.3
        // This makes the parser consume EVENT_TEMPO (0x9c) as a BYTE value
        events.push(0u8); // stray id=0 event...
                          // ...whose value will be 0x9c (EVENT_TEMPO), consuming it

        // EVENT_TEMPO: 0x9c followed by tempo*1000 as u32
        events.push(EVENT_TEMPO); // 0x9c = 156
        events.extend_from_slice(&150000u32.to_le_bytes()); // 150 BPM

        // Some more normal events (these get slightly misaligned due to the
        // off-by-one, but that's expected behavior matching real FL 2025.3 files)
        events.push(9u8); // LoopActive
        events.push(1u8);

        // Timestamp event
        events.push(EVENT_TIMESTAMP);
        encode_varint(16, &mut events);
        let created_days: f64 = DELPHI_EPOCH_OFFSET_DAYS + 19000.0;
        let spent_days: f64 = 0.5 / 24.0; // 30 minutes
        events.extend_from_slice(&created_days.to_le_bytes());
        events.extend_from_slice(&spent_days.to_le_bytes());

        // Write events size
        let events_size = events.len() as u32;
        flp.extend_from_slice(&events_size.to_le_bytes());
        flp.extend_from_slice(&events);

        // Write to temp file
        let temp_dir = std::env::temp_dir();
        let temp_file = temp_dir.join(format!("test_2025_3_{}.flp", uuid::Uuid::new_v4()));
        fs::write(&temp_file, &flp).unwrap();

        let result = parse_flp(temp_file.to_str().unwrap());
        let _ = fs::remove_file(&temp_file);

        let metadata = result.unwrap();
        // BPM should be found via the raw byte scan fallback
        assert_eq!(metadata.bpm, Some(150.0), "BPM not found via fallback scan");
    }
}
