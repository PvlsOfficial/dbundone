//! Native Rust Tracktion / Waveform (.tracktionedit) parser.
//!
//! Unlike .als (gzipped XML) or .flp (binary), a `.tracktionedit` file is plain
//! UTF-8 XML with a single `<EDIT>` root. This module streams the XML and extracts:
//! - lightweight metadata (app version, bpm, time signature, track count, created date)
//! - deep analysis (plugins/VSTs, instruments per track, effect chains, MIDI clips,
//!   note counts, sample references)
//!
//! Entry points mirror flp_parser / als_parser:
//! - parse_tracktion / parse_tracktion_from_bytes: lightweight metadata
//! - analyze_tracktion / analyze_tracktion_from_bytes: deep analysis
//!
//! The deep analysis intentionally reuses the FLP analysis structs
//! (`FlpAnalysis`, `FlpPlugin`, `FlpChannel`, `FlpMixerTrack`, `FlpPattern`) so the
//! existing ProjectAnalysis UI renders Waveform projects with no extra frontend work.

use crate::flp_parser::{FlpAnalysis, FlpChannel, FlpMixerTrack, FlpPattern, FlpPlugin};
use quick_xml::events::{BytesStart, Event};
use quick_xml::Reader;
use serde::Serialize;
use std::collections::HashMap;
use std::fs;

/// Lightweight metadata extracted from a `.tracktionedit` file.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TracktionMetadata {
    pub file_path: String,
    pub title: Option<String>,
    pub bpm: Option<f64>,
    pub tracks: Option<usize>,
    pub time_signature: Option<String>,
    /// The application that wrote the file, e.g. "Waveform 13.5.25".
    pub creator: Option<String>,
    /// The machine/user that last modified the edit (EDIT modifiedBy attr).
    pub modified_by: Option<String>,
    /// Tracktion project item id (EDIT projectID attr).
    pub project_id: Option<String>,
    /// ISO 8601 creation date derived from the EDIT creationTime (ms epoch).
    pub created_on: Option<String>,
    pub midi_clip_count: Option<usize>,
    pub note_count: Option<usize>,
}

impl TracktionMetadata {
    /// Convert to a JSON value with the same top-level keys used by FLP/ALS metadata
    /// so the scan path can consume it uniformly (e.g. `bpm`, `title`).
    pub fn to_json_value(&self) -> serde_json::Value {
        serde_json::json!({
            "file_path": self.file_path,
            "title": self.title,
            "bpm": self.bpm,
            "tracks": self.tracks,
            "timeSignature": self.time_signature,
            "creator": self.creator,
            "modifiedBy": self.modified_by,
            "projectId": self.project_id,
            "created_on": self.created_on,
            "midiClipCount": self.midi_clip_count,
            "noteCount": self.note_count,
        })
    }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/// Find attribute `name` in `tag` and return its unescaped value as String.
fn attr_value(tag: &BytesStart, name: &[u8]) -> Option<String> {
    for attr in tag.attributes().flatten() {
        if attr.key.as_ref() == name {
            return attr.unescape_value().ok().map(|s| s.to_string());
        }
    }
    None
}

/// Convert a Tracktion colour string (AARRGGBB or RRGGBB hex) to a CSS `#rrggbb`.
fn colour_to_hex(colour: &str) -> Option<String> {
    let c = colour.trim();
    let rgb = match c.len() {
        8 => &c[2..],  // strip alpha
        6 => c,
        _ => return None,
    };
    if rgb.chars().all(|ch| ch.is_ascii_hexdigit()) {
        Some(format!("#{}", rgb.to_lowercase()))
    } else {
        None
    }
}

/// Map a Tracktion built-in plugin `type` to a friendly display name.
/// Returns None for the per-track utility plugins ("volume", "level") that every
/// track carries — those are the fader/meter and would only add noise.
fn native_plugin_display_name(plugin_type: &str) -> Option<String> {
    let name = match plugin_type {
        "volume" | "level" => return None, // track fader / level meter — skip
        "8bandEq" => "EQ (8-band)",
        "4bandEq" | "eq" | "equaliser" => "EQ",
        "4osc" => "4OSC",
        "sampler" => "Sampler",
        "compressor" => "Compressor",
        "reverb" => "Reverb",
        "delay" => "Delay",
        "chorus" => "Chorus",
        "phaser" => "Phaser",
        "flanger" => "Flanger",
        "lowpass" | "highpass" | "bandpass" | "filter" => "Filter",
        "pitchShifter" | "pitch" => "Pitch Shifter",
        "midiModifier" => "MIDI Modifier",
        "patchbay" => "Patch Bay",
        "insert" => "Insert",
        "freeze" | "freezePoint" => "Freeze",
        "rewire" => "ReWire",
        "text" => "Text",
        "tracktionGroup" | "rack" => "Rack",
        "auxsend" | "aux" => "Aux Send",
        "auxreturn" => "Aux Return",
        other => {
            // Titlecase an unknown native type so it's still readable.
            return Some(titlecase(other));
        }
    };
    Some(name.to_string())
}

/// Crude titlecase used as a fallback for unknown native plugin types.
fn titlecase(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut prev_lower = false;
    for (i, ch) in s.chars().enumerate() {
        if i == 0 {
            out.extend(ch.to_uppercase());
        } else if ch.is_uppercase() && prev_lower {
            out.push(' ');
            out.push(ch);
        } else {
            out.push(ch);
        }
        prev_lower = ch.is_lowercase();
    }
    out
}

/// Extract a clean filename from a VST path (works for both `\` and `/`).
fn filename_of(path: &str) -> String {
    path.rsplit(|c| c == '\\' || c == '/')
        .next()
        .unwrap_or(path)
        .to_string()
}

/// Does this string contain a known audio file extension? Used for best-effort
/// sample detection (Tracktion usually references media by project id, not path).
fn looks_like_audio_path(s: &str) -> bool {
    let lower = s.to_lowercase();
    [".wav", ".aif", ".aiff", ".mp3", ".flac", ".ogg", ".m4a", ".wma"]
        .iter()
        .any(|ext| lower.ends_with(ext))
}

// ── Per-track accumulator used during deep analysis ──────────────────────────

#[derive(Default)]
struct TrackAcc {
    name: Option<String>,
    colour: Option<String>,
    /// (display_name, dll/filename, manufacturer) for VST plugins, in file order.
    vsts: Vec<(String, Option<String>, Option<String>)>,
    /// Display names of native (built-in) effect plugins.
    native_effects: Vec<String>,
    has_midi: bool,
    has_audio: bool,
    sample_paths: Vec<String>,
}

// ── Lightweight metadata parser ──────────────────────────────────────────────

pub fn parse_tracktion(file_path: &str) -> Result<TracktionMetadata, String> {
    let data = fs::read(file_path).map_err(|e| format!("Failed to read {}: {}", file_path, e))?;
    parse_tracktion_from_bytes(&data, file_path)
}

pub fn parse_tracktion_from_bytes(data: &[u8], label: &str) -> Result<TracktionMetadata, String> {
    let xml = std::str::from_utf8(data)
        .map_err(|e| format!("Not valid UTF-8 XML in {}: {}", label, e))?;
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);

    let mut creator: Option<String> = None;
    let mut modified_by: Option<String> = None;
    let mut project_id: Option<String> = None;
    let mut created_on: Option<String> = None;
    let mut bpm: Option<f64> = None;
    let mut ts_num: Option<u32> = None;
    let mut ts_den: Option<u32> = None;
    let mut track_count: usize = 0;
    let mut midi_clip_count: usize = 0;
    let mut note_count: usize = 0;

    let mut buf = Vec::new();
    loop {
        match reader.read_event_into(&mut buf) {
            Err(e) => {
                return Err(format!(
                    "XML parse error at byte {} in {}: {}",
                    reader.buffer_position(),
                    label,
                    e
                ));
            }
            Ok(Event::Eof) => break,
            Ok(Event::Start(e)) | Ok(Event::Empty(e)) => {
                match e.name().as_ref() {
                    b"EDIT" => {
                        creator = attr_value(&e, b"appVersion");
                        modified_by = attr_value(&e, b"modifiedBy");
                        project_id = attr_value(&e, b"projectID");
                        created_on = attr_value(&e, b"creationTime").and_then(|s| ms_epoch_to_iso(&s));
                    }
                    b"TEMPO" => {
                        if bpm.is_none() {
                            if let Some(v) = attr_value(&e, b"bpm").and_then(|s| s.parse::<f64>().ok())
                            {
                                if v > 0.0 && v < 1000.0 {
                                    bpm = Some(v);
                                }
                            }
                        }
                    }
                    b"TIMESIG" => {
                        if ts_num.is_none() {
                            ts_num = attr_value(&e, b"numerator").and_then(|s| s.parse().ok());
                            ts_den = attr_value(&e, b"denominator").and_then(|s| s.parse().ok());
                        }
                    }
                    b"TRACK" => track_count += 1,
                    b"MIDICLIP" => midi_clip_count += 1,
                    b"NOTE" => note_count += 1,
                    _ => {}
                }
            }
            _ => {}
        }
        buf.clear();
    }

    let time_signature = match (ts_num, ts_den) {
        (Some(n), Some(d)) => Some(format!("{}/{}", n, d)),
        _ => None,
    };

    // Edits don't store a project title in the XML — the filename is the title.
    let title = std::path::Path::new(label)
        .file_stem()
        .and_then(|s| s.to_str())
        .map(|s| s.to_string())
        .filter(|s| !s.is_empty());

    Ok(TracktionMetadata {
        file_path: label.to_string(),
        title,
        bpm,
        tracks: if track_count > 0 { Some(track_count) } else { None },
        time_signature,
        creator,
        modified_by,
        project_id,
        created_on,
        midi_clip_count: if midi_clip_count > 0 { Some(midi_clip_count) } else { None },
        note_count: if note_count > 0 { Some(note_count) } else { None },
    })
}

/// Convert a millisecond epoch string to an RFC 3339 timestamp.
fn ms_epoch_to_iso(ms: &str) -> Option<String> {
    let millis = ms.trim().parse::<i64>().ok()?;
    // Sanity: between year 2000 and 2100.
    if millis < 946_684_800_000 || millis > 4_102_444_800_000 {
        return None;
    }
    chrono::DateTime::from_timestamp_millis(millis).map(|dt| dt.to_rfc3339())
}

// ── Deep analysis parser ─────────────────────────────────────────────────────

pub fn analyze_tracktion(file_path: &str) -> Result<FlpAnalysis, String> {
    let data = fs::read(file_path).map_err(|e| format!("Failed to read {}: {}", file_path, e))?;
    analyze_tracktion_from_bytes(&data, file_path)
}

pub fn analyze_tracktion_from_bytes(data: &[u8], label: &str) -> Result<FlpAnalysis, String> {
    let xml = std::str::from_utf8(data)
        .map_err(|e| format!("Not valid UTF-8 XML in {}: {}", label, e))?;
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);

    let mut app_version: Option<String> = None;

    let mut channels: Vec<FlpChannel> = Vec::new();
    let mut mixer_tracks: Vec<FlpMixerTrack> = Vec::new();
    let mut patterns: Vec<FlpPattern> = Vec::new();

    // Deduplicated global plugin map (display name -> plugin).
    let mut plugin_map: HashMap<String, FlpPlugin> = HashMap::new();
    let mut plugin_order: Vec<String> = Vec::new();

    // Deduplicated sample paths, first-seen order.
    let mut samples: Vec<String> = Vec::new();
    let mut sample_seen: std::collections::HashSet<String> = std::collections::HashSet::new();

    // Track / master context.
    let mut track_stack: Vec<(TrackAcc, i32)> = Vec::new(); // (acc, depth)
    let mut track_index: usize = 0;
    let mut in_master_depth: i32 = -1;
    let mut master_plugins: Vec<String> = Vec::new();

    // MIDI clip context (for note counting & pattern naming).
    let mut clip_stack: Vec<(String, usize, i32)> = Vec::new(); // (name, note_count, depth)
    let mut pattern_index: usize = 0;

    let mut depth: i32 = 0;
    let mut buf = Vec::new();

    // Helper closure replacement: we register plugins inline (no closures to keep
    // borrow checker happy with the mutable maps).

    loop {
        let ev = reader.read_event_into(&mut buf);
        match ev {
            Err(e) => {
                return Err(format!(
                    "XML parse error at byte {} in {}: {}",
                    reader.buffer_position(),
                    label,
                    e
                ));
            }
            Ok(Event::Eof) => break,
            Ok(Event::Start(e)) => {
                depth += 1;
                match e.name().as_ref() {
                    b"EDIT" => {
                        app_version = attr_value(&e, b"appVersion");
                    }
                    b"MASTERTRACK" | b"MASTERPLUGINS" => {
                        if in_master_depth == -1 {
                            in_master_depth = depth;
                        }
                    }
                    b"TRACK" => {
                        let mut acc = TrackAcc::default();
                        acc.name = attr_value(&e, b"name").filter(|s| !s.is_empty());
                        acc.colour = attr_value(&e, b"colour").and_then(|c| colour_to_hex(&c));
                        track_stack.push((acc, depth));
                    }
                    b"MIDICLIP" => {
                        if let Some((acc, _)) = track_stack.last_mut() {
                            acc.has_midi = true;
                        }
                        let name = attr_value(&e, b"name").unwrap_or_else(|| "MIDI Clip".to_string());
                        clip_stack.push((name, 0, depth));
                    }
                    b"AUDIOCLIP" | b"WAVEAUDIOCLIP" | b"EDITCLIP" | b"CONTAINERCLIP" => {
                        if let Some((acc, _)) = track_stack.last_mut() {
                            acc.has_audio = true;
                            // Best-effort: some edits inline a source path.
                            for key in [b"source".as_ref(), b"file".as_ref(), b"sourceFile".as_ref()] {
                                if let Some(v) = attr_value(&e, key) {
                                    if looks_like_audio_path(&v) {
                                        acc.sample_paths.push(v);
                                    }
                                }
                            }
                        }
                    }
                    b"PLUGIN" => {
                        register_plugin(
                            &e,
                            in_master_depth != -1,
                            &mut track_stack,
                            &mut master_plugins,
                        );
                    }
                    _ => {}
                }
            }
            Ok(Event::Empty(e)) => {
                // Self-closing variants (rare for these tags, but handle anyway).
                match e.name().as_ref() {
                    b"NOTE" => {
                        if let Some((_, count, _)) = clip_stack.last_mut() {
                            *count += 1;
                        }
                    }
                    b"PLUGIN" => {
                        register_plugin(
                            &e,
                            in_master_depth != -1,
                            &mut track_stack,
                            &mut master_plugins,
                        );
                    }
                    b"AUDIOCLIP" | b"WAVEAUDIOCLIP" => {
                        if let Some((acc, _)) = track_stack.last_mut() {
                            acc.has_audio = true;
                            for key in [b"source".as_ref(), b"file".as_ref(), b"sourceFile".as_ref()] {
                                if let Some(v) = attr_value(&e, key) {
                                    if looks_like_audio_path(&v) {
                                        acc.sample_paths.push(v);
                                    }
                                }
                            }
                        }
                    }
                    _ => {}
                }
            }
            Ok(Event::End(e)) => {
                match e.name().as_ref() {
                    b"NOTE" => {} // handled on Start/Empty
                    b"MIDICLIP" => {
                        if let Some((name, notes, d)) = clip_stack.pop() {
                            if d == depth {
                                let label_name = if notes > 0 {
                                    format!("{} ({} notes)", name, notes)
                                } else {
                                    name
                                };
                                patterns.push(FlpPattern {
                                    index: pattern_index,
                                    name: Some(label_name),
                                });
                                pattern_index += 1;
                            } else {
                                // Depth mismatch — push back (shouldn't happen for well-formed XML).
                                clip_stack.push((name, notes, d));
                            }
                        }
                    }
                    b"MASTERTRACK" | b"MASTERPLUGINS" => {
                        if depth == in_master_depth {
                            in_master_depth = -1;
                        }
                    }
                    b"TRACK" => {
                        if let Some((_acc, d)) = track_stack.last() {
                            if *d == depth {
                                let (acc, _) = track_stack.pop().unwrap();
                                finalize_track(
                                    acc,
                                    track_index,
                                    &mut channels,
                                    &mut mixer_tracks,
                                    &mut plugin_map,
                                    &mut plugin_order,
                                    &mut samples,
                                    &mut sample_seen,
                                );
                                track_index += 1;
                            }
                        }
                    }
                    _ => {}
                }
                depth -= 1;
            }
            Ok(Event::Text(t)) => {
                // NOTE events are usually empty/start; ignore text.
                let _ = t;
            }
            _ => {}
        }
        buf.clear();
    }

    // Build the master mixer insert + register master plugins as effects.
    master_plugins.dedup();
    if !master_plugins.is_empty() {
        for p in &master_plugins {
            register_simple_plugin(&mut plugin_map, &mut plugin_order, p, None, Some("Master"), false);
        }
        mixer_tracks.insert(
            0,
            FlpMixerTrack {
                index: 0,
                name: Some("Master".to_string()),
                color: None,
                plugins: master_plugins.clone(),
            },
        );
    }

    let plugins: Vec<FlpPlugin> = plugin_order
        .into_iter()
        .filter_map(|k| plugin_map.remove(&k))
        .collect();

    Ok(FlpAnalysis {
        plugins,
        samples,
        channels,
        mixer_tracks,
        patterns,
        fl_version: app_version,
    })
}

/// Read a `<PLUGIN>` tag and stash it on the current track (or master list).
fn register_plugin(
    e: &BytesStart,
    in_master: bool,
    track_stack: &mut [(TrackAcc, i32)],
    master_plugins: &mut Vec<String>,
) {
    let ptype = attr_value(e, b"type").unwrap_or_default();
    if ptype == "vst" {
        let name = attr_value(e, b"name").unwrap_or_else(|| "VST".to_string());
        let filename = attr_value(e, b"filename").map(|p| filename_of(&p));
        let manufacturer = attr_value(e, b"manufacturer").filter(|s| !s.is_empty());
        if in_master {
            master_plugins.push(name);
        } else if let Some((acc, _)) = track_stack.last_mut() {
            acc.vsts.push((name, filename, manufacturer));
        }
    } else if let Some(display) = native_plugin_display_name(&ptype) {
        if in_master {
            master_plugins.push(display);
        } else if let Some((acc, _)) = track_stack.last_mut() {
            acc.native_effects.push(display);
        }
    }
}

/// Insert a plugin into the global dedup map, preserving first-seen order.
fn register_simple_plugin(
    plugin_map: &mut HashMap<String, FlpPlugin>,
    plugin_order: &mut Vec<String>,
    name: &str,
    dll_name: Option<String>,
    channel_name: Option<&str>,
    is_instrument: bool,
) {
    if name.is_empty() {
        return;
    }
    if !plugin_map.contains_key(name) {
        plugin_order.push(name.to_string());
        plugin_map.insert(
            name.to_string(),
            FlpPlugin {
                name: name.to_string(),
                dll_name,
                channel_name: channel_name.map(|s| s.to_string()),
                channel_index: None,
                is_instrument,
                preset_name: None,
            },
        );
    }
}

/// Turn a finished track accumulator into a channel + mixer insert + plugin entries.
#[allow(clippy::too_many_arguments)]
fn finalize_track(
    acc: TrackAcc,
    index: usize,
    channels: &mut Vec<FlpChannel>,
    mixer_tracks: &mut Vec<FlpMixerTrack>,
    plugin_map: &mut HashMap<String, FlpPlugin>,
    plugin_order: &mut Vec<String>,
    samples: &mut Vec<String>,
    sample_seen: &mut std::collections::HashSet<String>,
) {
    // The first VST on a track that contains MIDI is treated as the instrument.
    let instrument = if acc.has_midi { acc.vsts.first().cloned() } else { None };

    let track_name = acc
        .name
        .clone()
        .or_else(|| instrument.as_ref().map(|(n, _, _)| n.clone()))
        .unwrap_or_else(|| format!("Track {}", index + 1));

    let channel_type = if instrument.is_some() {
        "generator"
    } else if acc.has_audio {
        "audio_clip"
    } else if acc.has_midi {
        "generator"
    } else {
        "unknown"
    };

    // Effect plugins = native effects + any VST that isn't the instrument.
    let mut effect_names: Vec<String> = Vec::new();
    for (i, (name, _, _)) in acc.vsts.iter().enumerate() {
        let is_instrument_slot = instrument.is_some() && i == 0;
        if !is_instrument_slot {
            effect_names.push(name.clone());
        }
    }
    effect_names.extend(acc.native_effects.iter().cloned());

    // Register instrument plugin.
    if let Some((name, filename, manufacturer)) = &instrument {
        register_simple_plugin(
            plugin_map,
            plugin_order,
            name,
            filename.clone(),
            manufacturer.as_deref().or(Some(&track_name)),
            true,
        );
    }
    // Register effect plugins.
    for name in &effect_names {
        register_simple_plugin(plugin_map, plugin_order, name, None, Some(&track_name), false);
    }
    // Register VST effects with their filename/manufacturer where available.
    for (i, (name, filename, manufacturer)) in acc.vsts.iter().enumerate() {
        let is_instrument_slot = instrument.is_some() && i == 0;
        if !is_instrument_slot {
            register_simple_plugin(
                plugin_map,
                plugin_order,
                name,
                filename.clone(),
                manufacturer.as_deref().or(Some(&track_name)),
                false,
            );
        }
    }

    // Samples.
    for s in &acc.sample_paths {
        if !sample_seen.contains(s) {
            sample_seen.insert(s.clone());
            samples.push(s.clone());
        }
    }

    let plugin_name = instrument
        .as_ref()
        .map(|(n, _, _)| n.clone())
        .or_else(|| effect_names.first().cloned());

    channels.push(FlpChannel {
        index,
        name: Some(track_name.clone()),
        channel_type: channel_type.to_string(),
        plugin_name,
        sample_path: acc.sample_paths.first().cloned(),
        color: acc.colour.clone(),
        mixer_track: None,
    });

    // Mixer insert (only when the track actually has an effect chain).
    if !effect_names.is_empty() {
        let mut deduped = effect_names.clone();
        deduped.dedup();
        mixer_tracks.push(FlpMixerTrack {
            index: index + 1,
            name: Some(track_name),
            color: acc.colour,
            plugins: deduped,
        });
    }
}

// ── Batch parallel API (mirrors als_parser / flp_parser) ─────────────────────

pub fn parse_tracktion_batch_parallel(file_paths: &[String]) -> HashMap<String, serde_json::Value> {
    use std::sync::{Arc, Mutex};
    use std::thread;

    if file_paths.is_empty() {
        return HashMap::new();
    }

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
            let mut local = HashMap::new();
            for path in &chunk_owned {
                match parse_tracktion(path) {
                    Ok(metadata) => {
                        local.insert(path.clone(), metadata.to_json_value());
                    }
                    Err(e) => {
                        log::warn!("Failed to parse tracktionedit {}: {}", path, e);
                        local.insert(
                            path.clone(),
                            serde_json::json!({
                                "file_path": path,
                                "title": null,
                                "bpm": null,
                                "tracks": null,
                            }),
                        );
                    }
                }
            }
            results.lock().unwrap().extend(local);
        });
        handles.push(handle);
    }

    for h in handles {
        h.join().ok();
    }

    match Arc::try_unwrap(results) {
        Ok(m) => m.into_inner().unwrap(),
        Err(arc) => arc.lock().unwrap().clone(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<EDIT appVersion="Waveform 13.5.25" projectID="4d84c3/2a30ac3" creationTime="1778590576837" modifiedBy="ASUS tuf">
  <TRANSPORT position="34.4"/>
  <TEMPOSEQUENCE>
    <TEMPO startBeat="0.0" bpm="130.0" curve="1.0"/>
    <TIMESIG numerator="4" denominator="4" startBeat="0.0"/>
  </TEMPOSEQUENCE>
  <MASTERTRACK name="Master" id="1030">
    <MASTERPLUGINS>
      <PLUGIN type="8bandEq" id="1057" enabled="1"/>
    </MASTERPLUGINS>
  </MASTERTRACK>
  <TRACK id="1003" colour="ffff0000" mute="0" solo="0">
    <MIDICLIP name="New MIDI Clip" id="1038">
      <SEQUENCE ver="1" channelNumber="1">
        <NOTE p="54" b="0.0" l="4.0" v="77" c="5"/>
        <NOTE p="58" b="0.0" l="4.0" v="77" c="5"/>
      </SEQUENCE>
    </MIDICLIP>
    <PLUGIN type="vst" filename="C:\Program Files\Common Files\VST3\Kontakt 8.vst3" name="Kontakt 8" manufacturer="Native Instruments" id="1031" enabled="1"/>
    <PLUGIN type="8bandEq" id="1037" enabled="1"/>
    <PLUGIN type="volume" id="1004" enabled="1" volume="0.65"/>
    <PLUGIN type="level" id="1005" enabled="1"/>
  </TRACK>
  <TRACK id="1009" colour="ffaaff00" solo="0">
    <MIDICLIP name="Bass Clip" id="1040">
      <SEQUENCE ver="1" channelNumber="1">
        <NOTE p="40" b="0.0" l="4.0" v="77" c="5"/>
      </SEQUENCE>
    </MIDICLIP>
    <PLUGIN type="vst" filename="D:\Vsts\ABPL2.dll" name="ABPL2" manufacturer="Ample Sound" id="1056" enabled="1"/>
  </TRACK>
</EDIT>"#;

    #[test]
    fn test_parse_metadata() {
        let meta = parse_tracktion_from_bytes(SAMPLE.as_bytes(), "Rackrunt Edit 1.tracktionedit").unwrap();
        assert_eq!(meta.bpm, Some(130.0));
        assert_eq!(meta.tracks, Some(2));
        assert_eq!(meta.time_signature.as_deref(), Some("4/4"));
        assert_eq!(meta.creator.as_deref(), Some("Waveform 13.5.25"));
        assert_eq!(meta.modified_by.as_deref(), Some("ASUS tuf"));
        assert_eq!(meta.midi_clip_count, Some(2));
        assert_eq!(meta.note_count, Some(3));
        assert_eq!(meta.title.as_deref(), Some("Rackrunt Edit 1"));
        assert!(meta.created_on.is_some());
    }

    #[test]
    fn test_analyze_plugins_and_channels() {
        let a = analyze_tracktion_from_bytes(SAMPLE.as_bytes(), "test.tracktionedit").unwrap();

        let names: Vec<&str> = a.plugins.iter().map(|p| p.name.as_str()).collect();
        assert!(names.contains(&"Kontakt 8"), "missing Kontakt: {:?}", names);
        assert!(names.contains(&"ABPL2"), "missing ABPL2: {:?}", names);
        assert!(names.contains(&"EQ (8-band)"), "missing native EQ: {:?}", names);
        // volume/level utility plugins must be filtered out.
        assert!(!names.iter().any(|n| n.eq_ignore_ascii_case("volume")));
        assert!(!names.iter().any(|n| n.eq_ignore_ascii_case("level")));

        // Kontakt is an instrument (it's the VST on a MIDI track), EQ is an effect.
        let kontakt = a.plugins.iter().find(|p| p.name == "Kontakt 8").unwrap();
        assert!(kontakt.is_instrument);
        assert_eq!(kontakt.dll_name.as_deref(), Some("Kontakt 8.vst3"));
        assert_eq!(kontakt.channel_name.as_deref(), Some("Native Instruments"));
        let eq = a.plugins.iter().find(|p| p.name == "EQ (8-band)").unwrap();
        assert!(!eq.is_instrument);

        // Channels: 2 tracks, named after their instruments, coloured.
        assert_eq!(a.channels.len(), 2);
        assert_eq!(a.channels[0].name.as_deref(), Some("Kontakt 8"));
        assert_eq!(a.channels[0].channel_type, "generator");
        assert_eq!(a.channels[0].color.as_deref(), Some("#ff0000"));

        // Patterns from MIDI clips, with note counts.
        assert_eq!(a.patterns.len(), 2);
        assert_eq!(a.patterns[0].name.as_deref(), Some("New MIDI Clip (2 notes)"));

        // App version surfaces as the version badge.
        assert_eq!(a.fl_version.as_deref(), Some("Waveform 13.5.25"));

        // Master insert with the master EQ.
        let master = a.mixer_tracks.iter().find(|m| m.name.as_deref() == Some("Master")).unwrap();
        assert!(master.plugins.contains(&"EQ (8-band)".to_string()));
    }

    #[test]
    fn test_colour_to_hex() {
        assert_eq!(colour_to_hex("ffff0000").as_deref(), Some("#ff0000"));
        assert_eq!(colour_to_hex("00aaff").as_deref(), Some("#00aaff"));
        assert_eq!(colour_to_hex("xyz").as_deref(), None);
    }

    /// Validate against the real sample edit if present.
    #[test]
    fn test_real_edit_if_present() {
        let p = r"c:\Users\paulw\Documents\GitHub\dbundone\assets\waveform\Rackrunt Edit 1.tracktionedit";
        if !std::path::Path::new(p).exists() {
            eprintln!("skipping: {} not found", p);
            return;
        }
        let m = parse_tracktion(p).unwrap();
        assert_eq!(m.bpm, Some(130.0));
        assert_eq!(m.tracks, Some(9));
        assert_eq!(m.time_signature.as_deref(), Some("4/4"));
        assert!(m.creator.as_deref().unwrap_or("").starts_with("Waveform"));

        let a = analyze_tracktion(p).unwrap();
        let names: Vec<&str> = a.plugins.iter().map(|p| p.name.as_str()).collect();
        assert!(names.contains(&"Kontakt 8"), "plugins: {:?}", names);
        assert!(names.contains(&"BBC Symphony Orchestra"), "plugins: {:?}", names);
        assert_eq!(a.channels.len(), 9);
        assert!(!a.patterns.is_empty());
    }
}
