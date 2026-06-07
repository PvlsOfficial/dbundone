//! Native Rust Ableton Live Set (.als) parser.
//!
//! .als files are gzipped XML. This module decompresses them and extracts metadata
//! (tempo, creator/version, track counts, scene count) plus deep analysis data
//! (plugins, samples, tracks).
//!
//! Entry points mirror flp_parser:
//! - parse_als / parse_als_from_bytes: lightweight metadata
//! - analyze_als / analyze_als_from_bytes: deep analysis

use flate2::read::GzDecoder;
use quick_xml::events::{BytesStart, Event};
use quick_xml::Reader;
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::Read;

/// Lightweight metadata extracted from an .als file.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AlsMetadata {
    pub file_path: String,
    pub title: Option<String>,
    pub bpm: Option<f64>,
    pub tracks: Option<usize>,
    pub scenes: Option<usize>,
    pub time_signature: Option<String>,
    pub creator: Option<String>,
    pub major_version: Option<String>,
    pub minor_version: Option<String>,
}

impl AlsMetadata {
    /// Convert to a JSON value with the same top-level keys used by FLP metadata,
    /// so the scan path can consume it uniformly (e.g. `bpm`, `title`).
    pub fn to_json_value(&self) -> serde_json::Value {
        serde_json::json!({
            "file_path": self.file_path,
            "title": self.title,
            "bpm": self.bpm,
            "tracks": self.tracks,
            "scenes": self.scenes,
            "timeSignature": self.time_signature,
            "creator": self.creator,
            "majorVersion": self.major_version,
            "minorVersion": self.minor_version,
        })
    }
}

/// Information about a single track in the Live Set.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AlsTrack {
    pub index: usize,
    pub name: Option<String>,
    pub track_type: String, // "midi", "audio", "return", "group"
    pub color: Option<u32>, // Ableton color index (0-69)
    pub plugins: Vec<String>,
}

/// A plugin reference (VST2/VST3/AU/native Ableton device).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AlsPlugin {
    pub name: String,
    pub plugin_type: String, // "vst2", "vst3", "au", "native"
    pub manufacturer: Option<String>,
}

/// Deep analysis result.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AlsAnalysis {
    pub plugins: Vec<AlsPlugin>,
    pub samples: Vec<String>,
    pub tracks: Vec<AlsTrack>,
    pub creator: Option<String>,
    pub major_version: Option<String>,
    pub minor_version: Option<String>,
}

// ── Helpers ──────────────────────────────────────────────────────────────────

fn decompress_als(data: &[u8]) -> Result<String, String> {
    let mut decoder = GzDecoder::new(data);
    let mut xml = String::new();
    decoder
        .read_to_string(&mut xml)
        .map_err(|e| format!("Failed to decompress .als (not gzip?): {}", e))?;
    Ok(xml)
}

/// Find attribute `name` in `tag` and return its unescaped value as String.
fn attr_value(tag: &BytesStart, name: &[u8]) -> Option<String> {
    for attr in tag.attributes().flatten() {
        if attr.key.as_ref() == name {
            return attr.unescape_value().ok().map(|s| s.to_string());
        }
    }
    None
}

fn is_track_tag(name: &[u8]) -> Option<&'static str> {
    match name {
        b"MidiTrack" => Some("midi"),
        b"AudioTrack" => Some("audio"),
        b"ReturnTrack" => Some("return"),
        b"GroupTrack" => Some("group"),
        _ => None,
    }
}

/// Native Ableton device element names that should be reported as plugins
/// in the deep analysis. This list covers the common audio effects and
/// instruments shipped with Live; anything not in it is ignored unless it
/// carries a PluginDesc child.
fn native_device_display_name(tag: &[u8]) -> Option<&'static str> {
    match tag {
        // Instruments
        b"OriginalSimpler" | b"MultiSampler" => Some("Simpler"),
        b"InstrumentImpulse" => Some("Impulse"),
        b"InstrumentVector" => Some("Wavetable"),
        b"OperatorDevice" | b"Operator" => Some("Operator"),
        b"UltraAnalog" => Some("Analog"),
        b"Collision" => Some("Collision"),
        b"Electric" => Some("Electric"),
        b"Tension" => Some("Tension"),
        b"DrumGroupDevice" => Some("Drum Rack"),
        b"InstrumentGroupDevice" => Some("Instrument Rack"),
        // Common effects
        b"Eq8" => Some("EQ Eight"),
        b"FilterEQ3" => Some("EQ Three"),
        b"Compressor2" => Some("Compressor"),
        b"Limiter" => Some("Limiter"),
        b"Saturator" => Some("Saturator"),
        b"Reverb" => Some("Reverb"),
        b"HybridReverb" => Some("Hybrid Reverb"),
        b"Echo" => Some("Echo"),
        b"PingPongDelay" => Some("Ping Pong Delay"),
        b"FilterDelay" => Some("Filter Delay"),
        b"GlueCompressor" => Some("Glue Compressor"),
        b"Gate" => Some("Gate"),
        b"AutoFilter" => Some("Auto Filter"),
        b"AutoPan" => Some("Auto Pan"),
        b"Chorus2" => Some("Chorus-Ensemble"),
        b"Flanger" => Some("Flanger"),
        b"Phaser" => Some("Phaser-Flanger"),
        b"Overdrive" => Some("Overdrive"),
        b"Amp" => Some("Amp"),
        b"Cabinet" => Some("Cabinet"),
        b"Erosion" => Some("Erosion"),
        b"Redux2" | b"Redux" => Some("Redux"),
        b"Utility" => Some("Utility"),
        b"StereoGain" => Some("Utility"),
        b"Spectrum" => Some("Spectrum"),
        b"Tuner" => Some("Tuner"),
        b"VinylDistortion" => Some("Vinyl Distortion"),
        b"FrequencyShifter" => Some("Frequency Shifter"),
        b"GrainDelay" => Some("Grain Delay"),
        b"Resonator" => Some("Resonators"),
        b"Vocoder" => Some("Vocoder"),
        b"BeatRepeat" => Some("Beat Repeat"),
        b"LoopShaper" => Some("LoopShaper"),
        b"Roar" => Some("Roar"),
        b"ChannelEq" => Some("Channel EQ"),
        b"Corpus" => Some("Corpus"),
        b"DrumBuss" => Some("Drum Buss"),
        b"Pedal" => Some("Pedal"),
        b"Shifter" => Some("Shifter"),
        b"Shaper" => Some("Shaper"),
        _ => None,
    }
}

// ── Lightweight metadata parser ──────────────────────────────────────────────

pub fn parse_als(file_path: &str) -> Result<AlsMetadata, String> {
    let data = fs::read(file_path).map_err(|e| format!("Failed to read {}: {}", file_path, e))?;
    parse_als_from_bytes(&data, file_path)
}

pub fn parse_als_from_bytes(data: &[u8], label: &str) -> Result<AlsMetadata, String> {
    let xml = decompress_als(data)?;
    let mut reader = Reader::from_str(&xml);
    reader.config_mut().trim_text(true);

    let mut creator: Option<String> = None;
    let mut major_version: Option<String> = None;
    let mut minor_version: Option<String> = None;
    let mut bpm: Option<f64> = None;
    let mut track_count: usize = 0;
    let mut scene_count: usize = 0;
    let mut ts_numerator: Option<u32> = None;
    let mut ts_denominator: Option<u32> = None;

    // Depth tracking: we record the element depth at which we entered certain
    // scopes, then clear it when we exit the element at that depth.
    let mut depth: i32 = 0;
    let mut in_master_track_depth: i32 = -1;
    let mut in_tempo_depth: i32 = -1;
    // TimeSignature nodes exist throughout the file; we want the first pair
    // we encounter inside MasterTrack's mixer (which is the project's initial
    // time signature). To keep things simple, we just grab the first
    // RemoteableTimeSignature we see.
    let mut ts_captured = false;
    let mut in_remoteable_ts = false;

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
            Ok(Event::Start(e)) => {
                depth += 1;
                let name_owned = e.name().as_ref().to_vec();
                let name = name_owned.as_slice();

                if name == b"Ableton" {
                    creator = attr_value(&e, b"Creator");
                    major_version = attr_value(&e, b"MajorVersion");
                    minor_version = attr_value(&e, b"MinorVersion");
                } else if (name == b"MasterTrack" || name == b"MainTrack")
                    && in_master_track_depth == -1
                {
                    // Ableton Live 12+ renamed <MasterTrack> to <MainTrack>.
                    in_master_track_depth = depth;
                } else if name == b"Tempo" && in_master_track_depth != -1 && in_tempo_depth == -1 {
                    in_tempo_depth = depth;
                } else if name == b"RemoteableTimeSignature" && !ts_captured {
                    in_remoteable_ts = true;
                } else if is_track_tag(name).is_some() {
                    track_count += 1;
                } else if name == b"Scene" {
                    scene_count += 1;
                }
            }
            Ok(Event::Empty(e)) => {
                let name_owned = e.name().as_ref().to_vec();
                let name = name_owned.as_slice();

                // Some <Scene/> elements are self-closing (no children).
                if name == b"Scene" {
                    scene_count += 1;
                }

                if name == b"Manual" && in_tempo_depth != -1 && bpm.is_none() {
                    if let Some(v) = attr_value(&e, b"Value") {
                        if let Ok(f) = v.parse::<f64>() {
                            if f > 0.0 && f < 1000.0 {
                                bpm = Some(f);
                            }
                        }
                    }
                } else if in_remoteable_ts {
                    if name == b"Numerator" {
                        if let Some(v) = attr_value(&e, b"Value") {
                            ts_numerator = v.parse().ok();
                        }
                    } else if name == b"Denominator" {
                        if let Some(v) = attr_value(&e, b"Value") {
                            ts_denominator = v.parse().ok();
                        }
                    }
                }
            }
            Ok(Event::End(e)) => {
                let name_owned = e.name().as_ref().to_vec();
                let name = name_owned.as_slice();

                if name == b"MasterTrack" && depth == in_master_track_depth {
                    in_master_track_depth = -1;
                } else if name == b"Tempo" && depth == in_tempo_depth {
                    in_tempo_depth = -1;
                } else if name == b"RemoteableTimeSignature" && in_remoteable_ts {
                    in_remoteable_ts = false;
                    if ts_numerator.is_some() && ts_denominator.is_some() {
                        ts_captured = true;
                    }
                }
                depth -= 1;
            }
            _ => {}
        }
        buf.clear();
    }

    let time_signature = match (ts_numerator, ts_denominator) {
        (Some(n), Some(d)) => Some(format!("{}/{}", n, d)),
        _ => None,
    };

    // Live Sets don't carry a project title in the XML — the filename is the title.
    let title = std::path::Path::new(label)
        .file_stem()
        .and_then(|s| s.to_str())
        .map(|s| s.to_string())
        .filter(|s| !s.is_empty());

    Ok(AlsMetadata {
        file_path: label.to_string(),
        title,
        bpm,
        tracks: if track_count > 0 { Some(track_count) } else { None },
        scenes: if scene_count > 0 { Some(scene_count) } else { None },
        time_signature,
        creator,
        major_version,
        minor_version,
    })
}

// ── Deep analysis parser ─────────────────────────────────────────────────────

pub fn analyze_als(file_path: &str) -> Result<AlsAnalysis, String> {
    let data = fs::read(file_path).map_err(|e| format!("Failed to read {}: {}", file_path, e))?;
    analyze_als_from_bytes(&data, file_path)
}

pub fn analyze_als_from_bytes(data: &[u8], label: &str) -> Result<AlsAnalysis, String> {
    let xml = decompress_als(data)?;
    let mut reader = Reader::from_str(&xml);
    reader.config_mut().trim_text(true);

    let mut creator: Option<String> = None;
    let mut major_version: Option<String> = None;
    let mut minor_version: Option<String> = None;

    // Track stack — nested GroupTracks push/pop, each finalizes to `tracks`.
    struct TrackCtx {
        track_type: String,
        name: Option<String>,
        color: Option<u32>,
        plugins: Vec<String>,
        depth: i32,
        index: usize,
    }
    let mut tracks: Vec<AlsTrack> = Vec::new();
    let mut track_stack: Vec<TrackCtx> = Vec::new();
    let mut next_track_index: usize = 0;

    // Plugin tracking — deduplicated by display name
    let mut plugin_map: HashMap<String, AlsPlugin> = HashMap::new();

    // Sample tracking — deduplicated, preserves first-seen order
    let mut samples: Vec<String> = Vec::new();
    let mut sample_seen: HashSet<String> = HashSet::new();

    // Inside a Name block? Track depth so child EffectiveName attr can flow back
    // to the enclosing track's name field.
    let mut in_name_block_depth: i32 = -1;
    // Inside a plugin-info block? Captures plugin name and (maybe) manufacturer.
    #[derive(Default)]
    struct PluginCtx {
        kind: &'static str, // "vst2" / "vst3" / "au"
        name: Option<String>,
        manufacturer: Option<String>,
        depth: i32,
    }
    let mut plugin_ctx: Option<PluginCtx> = None;

    // FileRef capture — remembers the most-recent Path inside the current
    // SampleRef so we can store it on SampleRef end.
    let mut in_sample_ref_depth: i32 = -1;
    let mut current_sample_path: Option<String> = None;

    let mut depth: i32 = 0;
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
            Ok(Event::Start(e)) => {
                depth += 1;
                let name_owned = e.name().as_ref().to_vec();
                let name = name_owned.as_slice();

                if name == b"Ableton" {
                    creator = attr_value(&e, b"Creator");
                    major_version = attr_value(&e, b"MajorVersion");
                    minor_version = attr_value(&e, b"MinorVersion");
                } else if let Some(track_type) = is_track_tag(name) {
                    track_stack.push(TrackCtx {
                        track_type: track_type.to_string(),
                        name: None,
                        color: None,
                        plugins: Vec::new(),
                        depth,
                        index: next_track_index,
                    });
                    next_track_index += 1;
                } else if name == b"Name" && in_name_block_depth == -1 {
                    in_name_block_depth = depth;
                } else if name == b"VstPluginInfo" {
                    plugin_ctx = Some(PluginCtx {
                        kind: "vst2",
                        depth,
                        ..Default::default()
                    });
                } else if name == b"Vst3PluginInfo" {
                    plugin_ctx = Some(PluginCtx {
                        kind: "vst3",
                        depth,
                        ..Default::default()
                    });
                } else if name == b"AuPluginInfo" {
                    plugin_ctx = Some(PluginCtx {
                        kind: "au",
                        depth,
                        ..Default::default()
                    });
                } else if name == b"SampleRef" && in_sample_ref_depth == -1 {
                    in_sample_ref_depth = depth;
                    current_sample_path = None;
                } else if let Some(device_name) = native_device_display_name(name) {
                    // Native Ableton device — add as plugin on the innermost track
                    let display = device_name.to_string();
                    if let Some(tc) = track_stack.last_mut() {
                        if !tc.plugins.contains(&display) {
                            tc.plugins.push(display.clone());
                        }
                    }
                    plugin_map
                        .entry(display.clone())
                        .or_insert_with(|| AlsPlugin {
                            name: display,
                            plugin_type: "native".to_string(),
                            manufacturer: Some("Ableton".to_string()),
                        });
                }
            }
            Ok(Event::Empty(e)) => {
                let name_owned = e.name().as_ref().to_vec();
                let name = name_owned.as_slice();

                // Native Ableton device used as self-closing (e.g. <Limiter/>).
                if let Some(device_name) = native_device_display_name(name) {
                    let display = device_name.to_string();
                    if let Some(tc) = track_stack.last_mut() {
                        if !tc.plugins.contains(&display) {
                            tc.plugins.push(display.clone());
                        }
                    }
                    plugin_map
                        .entry(display.clone())
                        .or_insert_with(|| AlsPlugin {
                            name: display,
                            plugin_type: "native".to_string(),
                            manufacturer: Some("Ableton".to_string()),
                        });
                }

                // Track name: EffectiveName / UserName inside a Name block
                if in_name_block_depth != -1
                    && (name == b"EffectiveName" || name == b"UserName")
                {
                    if let Some(tc) = track_stack.last_mut() {
                        if tc.name.is_none() {
                            if let Some(v) = attr_value(&e, b"Value") {
                                if !v.is_empty() {
                                    tc.name = Some(v);
                                }
                            }
                        }
                    }
                } else if name == b"Color" {
                    if let Some(tc) = track_stack.last_mut() {
                        if tc.color.is_none() {
                            if let Some(v) = attr_value(&e, b"Value") {
                                tc.color = v.parse::<u32>().ok();
                            }
                        }
                    }
                }

                // Plugin info attributes
                if let Some(ctx) = plugin_ctx.as_mut() {
                    // VST2: <PlugName Value="Serum"/>, <Manufacturer Value="..."/>
                    // VST3: <Name Value="Serum 2"/>, <Manufacturer Value="..."/>
                    // AU:   <Name Value="..."/>,      <Manufacturer Value="..."/>
                    let is_name_attr = match ctx.kind {
                        "vst2" => name == b"PlugName",
                        "vst3" | "au" => name == b"Name",
                        _ => false,
                    };
                    if is_name_attr && ctx.name.is_none() {
                        if let Some(v) = attr_value(&e, b"Value") {
                            if !v.is_empty() {
                                ctx.name = Some(v);
                            }
                        }
                    } else if name == b"Manufacturer" && ctx.manufacturer.is_none() {
                        if let Some(v) = attr_value(&e, b"Value") {
                            if !v.is_empty() {
                                ctx.manufacturer = Some(v);
                            }
                        }
                    }
                }

                // Sample path: <Path Value="..."/> inside SampleRef/FileRef
                if in_sample_ref_depth != -1 && name == b"Path" {
                    if let Some(v) = attr_value(&e, b"Value") {
                        if !v.is_empty() && current_sample_path.is_none() {
                            current_sample_path = Some(v);
                        }
                    }
                }
            }
            Ok(Event::End(e)) => {
                let name_owned = e.name().as_ref().to_vec();
                let name = name_owned.as_slice();

                if name == b"Name" && depth == in_name_block_depth {
                    in_name_block_depth = -1;
                }

                if let Some(ctx) = plugin_ctx.as_ref() {
                    if depth == ctx.depth {
                        // Finalize the plugin
                        if let Some(pname) = ctx.name.clone() {
                            let kind = ctx.kind.to_string();
                            // Register in the track (if we're inside a track)
                            if let Some(tc) = track_stack.last_mut() {
                                if !tc.plugins.contains(&pname) {
                                    tc.plugins.push(pname.clone());
                                }
                            }
                            plugin_map.entry(pname.clone()).or_insert_with(|| AlsPlugin {
                                name: pname,
                                plugin_type: kind,
                                manufacturer: ctx.manufacturer.clone(),
                            });
                        }
                        plugin_ctx = None;
                    }
                }

                if name == b"SampleRef" && depth == in_sample_ref_depth {
                    in_sample_ref_depth = -1;
                    if let Some(path) = current_sample_path.take() {
                        if !sample_seen.contains(&path) {
                            sample_seen.insert(path.clone());
                            samples.push(path);
                        }
                    }
                }

                // Finalize a track when its end tag is reached at the depth it was pushed
                if is_track_tag(name).is_some() {
                    if let Some(tc) = track_stack.last() {
                        if tc.depth == depth {
                            let tc = track_stack.pop().unwrap();
                            tracks.push(AlsTrack {
                                index: tc.index,
                                name: tc.name,
                                track_type: tc.track_type,
                                color: tc.color,
                                plugins: tc.plugins,
                            });
                        }
                    }
                }

                depth -= 1;
            }
            _ => {}
        }
        buf.clear();
    }

    tracks.sort_by_key(|t| t.index);

    Ok(AlsAnalysis {
        plugins: plugin_map.into_values().collect(),
        samples,
        tracks,
        creator,
        major_version,
        minor_version,
    })
}

// ── Batch parallel API (mirrors flp_parser::parse_flp_batch_parallel) ────────

pub fn parse_als_batch_parallel(file_paths: &[String]) -> HashMap<String, serde_json::Value> {
    use std::sync::{Arc, Mutex};
    use std::thread;

    let results = Arc::new(Mutex::new(HashMap::new()));
    if file_paths.is_empty() {
        return HashMap::new();
    }

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
                match parse_als(path) {
                    Ok(metadata) => {
                        local.insert(path.clone(), metadata.to_json_value());
                    }
                    Err(e) => {
                        log::warn!("Failed to parse ALS {}: {}", path, e);
                        local.insert(
                            path.clone(),
                            serde_json::json!({
                                "file_path": path,
                                "title": null,
                                "bpm": null,
                                "tracks": null,
                                "scenes": null,
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
    use flate2::write::GzEncoder;
    use flate2::Compression;
    use std::io::Write;

    fn gzip_bytes(xml: &str) -> Vec<u8> {
        let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
        encoder.write_all(xml.as_bytes()).unwrap();
        encoder.finish().unwrap()
    }

    #[test]
    fn test_parse_minimal_als() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<Ableton MajorVersion="5" MinorVersion="12.0_433" SchemaChangeCount="11" Creator="Ableton Live 12.0.5" Revision="abc">
  <LiveSet>
    <Tracks>
      <MidiTrack Id="1">
        <Name><EffectiveName Value="Drums"/><UserName Value=""/></Name>
        <Color Value="14"/>
      </MidiTrack>
      <AudioTrack Id="2">
        <Name><EffectiveName Value="Vocals"/></Name>
      </AudioTrack>
    </Tracks>
    <MasterTrack>
      <DeviceChain>
        <Mixer>
          <Tempo>
            <LomId Value="0"/>
            <Manual Value="128.5"/>
          </Tempo>
        </Mixer>
      </DeviceChain>
    </MasterTrack>
    <Scenes>
      <Scene Id="0"/>
      <Scene Id="1"/>
    </Scenes>
  </LiveSet>
</Ableton>"#;
        let bytes = gzip_bytes(xml);
        let meta = parse_als_from_bytes(&bytes, "test.als").unwrap();
        assert_eq!(meta.bpm, Some(128.5));
        assert_eq!(meta.tracks, Some(2));
        assert_eq!(meta.scenes, Some(2));
        assert_eq!(meta.creator.as_deref(), Some("Ableton Live 12.0.5"));
        assert_eq!(meta.major_version.as_deref(), Some("5"));
        assert_eq!(meta.title.as_deref(), Some("test"));
    }

    #[test]
    fn test_analyze_als_plugins_and_samples() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<Ableton MajorVersion="5" Creator="Ableton Live 12.0.5">
  <LiveSet>
    <Tracks>
      <MidiTrack Id="1">
        <Name><EffectiveName Value="Synth"/></Name>
        <DeviceChain><DeviceChain><Devices>
          <PluginDevice Id="0">
            <PluginDesc>
              <VstPluginInfo Id="0">
                <PlugName Value="Serum"/>
                <Manufacturer Value="Xfer Records"/>
              </VstPluginInfo>
            </PluginDesc>
          </PluginDevice>
          <Limiter/>
        </Devices></DeviceChain></DeviceChain>
      </MidiTrack>
      <AudioTrack Id="2">
        <Name><EffectiveName Value="Kick"/></Name>
        <DeviceChain><MainSequencer><Sample>
          <SampleRef>
            <FileRef>
              <Path Value="C:/Samples/kick.wav"/>
            </FileRef>
          </SampleRef>
        </Sample></MainSequencer></DeviceChain>
      </AudioTrack>
    </Tracks>
    <MasterTrack><DeviceChain><Mixer><Tempo><Manual Value="140"/></Tempo></Mixer></DeviceChain></MasterTrack>
  </LiveSet>
</Ableton>"#;
        let bytes = gzip_bytes(xml);
        let analysis = analyze_als_from_bytes(&bytes, "test.als").unwrap();

        let names: Vec<&str> = analysis.plugins.iter().map(|p| p.name.as_str()).collect();
        assert!(names.contains(&"Serum"), "Serum not found: {:?}", names);
        assert!(names.contains(&"Limiter"), "Limiter not found: {:?}", names);

        assert_eq!(analysis.samples.len(), 1);
        assert_eq!(analysis.samples[0], "C:/Samples/kick.wav");

        assert_eq!(analysis.tracks.len(), 2);
        let synth = analysis
            .tracks
            .iter()
            .find(|t| t.name.as_deref() == Some("Synth"))
            .unwrap();
        assert_eq!(synth.track_type, "midi");
        assert!(synth.plugins.contains(&"Serum".to_string()));
    }

    #[test]
    fn test_invalid_not_gzip() {
        let result = parse_als_from_bytes(b"not gzipped data", "bad.als");
        assert!(result.is_err());
    }

    #[test]
    fn test_vst3_plugin_extraction() {
        let xml = r#"<Ableton><LiveSet><Tracks>
  <MidiTrack Id="1">
    <Name><EffectiveName Value="Bass"/></Name>
    <DeviceChain><DeviceChain><Devices>
      <Vst3PluginDevice>
        <PluginDesc>
          <Vst3PluginInfo>
            <Name Value="Diva"/>
            <Manufacturer Value="u-he"/>
          </Vst3PluginInfo>
        </PluginDesc>
      </Vst3PluginDevice>
    </Devices></DeviceChain></DeviceChain>
  </MidiTrack>
</Tracks></LiveSet></Ableton>"#;
        let bytes = gzip_bytes(xml);
        let analysis = analyze_als_from_bytes(&bytes, "bass.als").unwrap();
        let diva = analysis.plugins.iter().find(|p| p.name == "Diva").unwrap();
        assert_eq!(diva.plugin_type, "vst3");
        assert_eq!(diva.manufacturer.as_deref(), Some("u-he"));
    }

    #[test]
    fn test_group_track_nested() {
        let xml = r#"<Ableton><LiveSet><Tracks>
  <GroupTrack Id="1">
    <Name><EffectiveName Value="Drum Bus"/></Name>
    <MidiTrack Id="2">
      <Name><EffectiveName Value="Kick"/></Name>
    </MidiTrack>
    <MidiTrack Id="3">
      <Name><EffectiveName Value="Snare"/></Name>
    </MidiTrack>
  </GroupTrack>
</Tracks></LiveSet></Ableton>"#;
        let bytes = gzip_bytes(xml);
        let analysis = analyze_als_from_bytes(&bytes, "g.als").unwrap();
        assert_eq!(analysis.tracks.len(), 3);
        let names: Vec<&str> = analysis
            .tracks
            .iter()
            .filter_map(|t| t.name.as_deref())
            .collect();
        assert!(names.contains(&"Drum Bus"));
        assert!(names.contains(&"Kick"));
        assert!(names.contains(&"Snare"));
    }

    #[test]
    fn test_inspect_echoes_of_rain() {
        let p = r"C:\Users\paulw\OneDrive\Music old\2025\Ableton\Echoes of Rain Project\Echoes of Rain.als";
        if !std::path::Path::new(p).exists() {
            eprintln!("skipping: {} not found", p);
            return;
        }
        let m = parse_als(p).unwrap();
        println!("\n==== LIGHTWEIGHT METADATA ====");
        println!("creator        = {:?}", m.creator);
        println!("majorVersion   = {:?}", m.major_version);
        println!("minorVersion   = {:?}", m.minor_version);
        println!("bpm            = {:?}", m.bpm);
        println!("tracks         = {:?}", m.tracks);
        println!("scenes         = {:?}", m.scenes);
        println!("timeSignature  = {:?}", m.time_signature);
        println!("title          = {:?}", m.title);

        let a = analyze_als(p).unwrap();
        println!("\n==== TRACKS ({}) ====", a.tracks.len());
        for t in &a.tracks {
            println!(
                "  [{}] type={:<6} color={:<4} name={:?} plugins={:?}",
                t.index,
                t.track_type,
                t.color.map(|c| c.to_string()).unwrap_or_else(|| "-".into()),
                t.name,
                t.plugins,
            );
        }
        println!("\n==== PLUGINS ({}) ====", a.plugins.len());
        let mut plugs = a.plugins.clone();
        plugs.sort_by(|a, b| a.plugin_type.cmp(&b.plugin_type).then(a.name.cmp(&b.name)));
        for p in &plugs {
            println!("  [{:<6}] {:<35} manufacturer={:?}", p.plugin_type, p.name, p.manufacturer);
        }
        println!("\n==== SAMPLES ({}) ====", a.samples.len());
        for s in &a.samples {
            println!("  {}", s);
        }
    }

    #[test]
    fn test_time_signature() {
        let xml = r#"<Ableton><LiveSet>
  <MasterTrack><DeviceChain><Mixer>
    <Tempo><Manual Value="120"/></Tempo>
    <TimeSignature><TimeSignatures>
      <RemoteableTimeSignature Id="0">
        <Numerator Value="3"/>
        <Denominator Value="4"/>
      </RemoteableTimeSignature>
    </TimeSignatures></TimeSignature>
  </Mixer></DeviceChain></MasterTrack>
</LiveSet></Ableton>"#;
        let bytes = gzip_bytes(xml);
        let meta = parse_als_from_bytes(&bytes, "ts.als").unwrap();
        assert_eq!(meta.time_signature.as_deref(), Some("3/4"));
    }
}
