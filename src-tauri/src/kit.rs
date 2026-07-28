//! Stash Kit Creator backend (v2).
//!
//! Extracts the samples **referenced inside FL Studio project files** (FLPs, and FLPs
//! inside zips), classifies each one with an **audio-first** engine (rich DSP features
//! decide the category; the file name is only a secondary tie-breaker), detects the
//! musical key of tonal one-shots, and builds FL-Studio-styled drum kits by **copying**
//! files into a customizable taxonomy with name-based `.nfo` styling.
//!
//! Reuses: `scanner::*` (flp/zip discovery), `flp_parser::analyze_flp` (per-channel
//! sample path / name / color), Symphonia streaming decode.

use serde::{Deserialize, Serialize};
use std::collections::hash_map::DefaultHasher;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};

use crate::commands::{AppDataDir, SettingsState};
use crate::flp_parser;
use crate::scanner;

const AUDIO_EXTS: &[&str] = &["wav", "mp3", "flac", "ogg", "aiff", "aif", "m4a", "opus", "wma"];

/// Number of waveform peaks embedded per sample so the UI can draw instantly.
const EMBED_PEAKS: usize = 48;

pub const CANONICAL_CATEGORIES: &[&str] = &[
    "kick", "snare", "clap", "hat_closed", "hat_open", "perc", "808", "bass", "tom",
    "rim", "snap", "shaker", "crash", "ride", "cymbal", "fx", "vocal", "loop",
    "melody", "unknown",
];

// ───────────────────────── data types ─────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AudioFeatures {
    pub duration_secs: f32,
    pub peak: f32,
    pub rms: f32,
    pub crest: f32,
    pub attack_secs: f32,
    pub decay_secs: f32,
    pub zcr: f32,
    pub sub_ratio: f32,  // <120 Hz
    pub low_ratio: f32,  // <250 Hz
    pub mid_ratio: f32,  // 250–2k
    pub high_ratio: f32, // >6 kHz
    pub centroid_hz: f32,
    pub rolloff_hz: f32,
    pub flatness: f32, // 0 tonal … 1 noisy
    pub pitch_hz: f32,
    pub pitch_conf: f32, // 0..1
    pub onsets: u32,
    pub sample_rate: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SampleCandidate {
    pub id: String,
    pub source_path: String,
    pub file_name: String,
    pub ext: String,
    pub size: u64,
    pub category: String,
    pub confidence: f32,
    pub method: String, // "audio" | "audio+name" | "name"
    pub from_flp: Option<String>,
    pub flp_channel: Option<String>,
    pub flp_color: Option<String>,
    pub key: Option<String>,      // musical key/note for tonal one-shots, e.g. "C#2"
    pub tonal: bool,
    pub distorted: bool,
    pub length_class: String, // "short" | "medium" | "long"
    pub peaks: Vec<f32>,      // embedded waveform (EMBED_PEAKS values, 0..1)
    pub features: Option<AudioFeatures>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuildItem {
    pub source_path: String,
    pub dest_rel_path: String,
}

/// Full set of FL `.nfo` styling options for one folder (written as `<name>.nfo`).
#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct FolderStyle {
    pub rel_path: String, // "" = the kit root folder itself
    pub color: Option<String>,
    pub icon_index: Option<i64>,
    pub tip: Option<String>,
    pub sort_group: Option<i64>,
    pub height_ofs: Option<i64>,
    pub visible: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BuildResult {
    pub copied: usize,
    pub skipped: usize,
    pub errors: Vec<String>,
    pub output_dir: String,
    pub cover_path: Option<String>,
}

// ───────────────────────── small helpers ─────────────────────────

fn normalize_key(p: &str) -> String {
    p.to_lowercase().replace('\\', "/")
}
fn hash_id(s: &str) -> String {
    let mut h = DefaultHasher::new();
    normalize_key(s).hash(&mut h);
    format!("{:016x}", h.finish())
}
fn fl_install_dir(fl_exe: &Option<String>) -> Option<PathBuf> {
    Path::new(fl_exe.as_ref()?).parent().map(|d| d.to_path_buf())
}

fn resolve_sample_path(raw: &str, flp_dir: Option<&Path>, fl_install: Option<&Path>) -> Option<PathBuf> {
    if raw.trim().is_empty() {
        return None;
    }
    let direct = Path::new(raw);
    if direct.is_file() {
        return Some(direct.to_path_buf());
    }
    if raw.contains('%') {
        if let Some(install) = fl_install {
            let after = raw.splitn(2, '%').nth(2).unwrap_or("");
            let tail = after.trim_start_matches(['\\', '/']);
            for base in [install.join("Data"), install.to_path_buf()] {
                let cand = base.join(tail.replace('\\', "/"));
                if cand.is_file() {
                    return Some(cand);
                }
            }
        }
    }
    if let Some(dir) = flp_dir {
        let cand = dir.join(raw.trim_start_matches(['\\', '/']));
        if cand.is_file() {
            return Some(cand);
        }
        if let Some(name) = direct.file_name() {
            let cand = dir.join(name);
            if cand.is_file() {
                return Some(cand);
            }
        }
    }
    None
}

fn is_audio_file(p: &Path) -> bool {
    p.extension()
        .and_then(|e| e.to_str())
        .map(|e| AUDIO_EXTS.contains(&e.to_lowercase().as_str()))
        .unwrap_or(false)
}

// ───────────────────────── feature extraction ─────────────────────────

fn feature_cache_dir(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("kit_feature_cache_v2")
}
fn feature_cache_key(path: &str) -> String {
    let mut h = DefaultHasher::new();
    normalize_key(path).hash(&mut h);
    if let Ok(meta) = fs::metadata(path) {
        if let Ok(m) = meta.modified() {
            m.hash(&mut h);
        }
        meta.len().hash(&mut h);
    }
    format!("{:016x}", h.finish())
}

#[derive(Serialize, Deserialize, Clone)]
struct CachedAnalysis {
    features: AudioFeatures,
    peaks: Vec<f32>,
}

fn read_cache(app_data_dir: &Path, path: &str) -> Option<CachedAnalysis> {
    let p = feature_cache_dir(app_data_dir).join(format!("{}.json", feature_cache_key(path)));
    serde_json::from_str(&fs::read_to_string(&p).ok()?).ok()
}
fn write_cache(app_data_dir: &Path, path: &str, a: &CachedAnalysis) {
    let dir = feature_cache_dir(app_data_dir);
    let _ = fs::create_dir_all(&dir);
    if let Ok(json) = serde_json::to_string(a) {
        let _ = fs::write(dir.join(format!("{}.json", feature_cache_key(path))), json);
    }
}

fn decode_mono(file_path: &str) -> Result<(Vec<f32>, u32), String> {
    use symphonia::core::audio::SampleBuffer;
    use symphonia::core::codecs::DecoderOptions;
    use symphonia::core::formats::FormatOptions;
    use symphonia::core::io::MediaSourceStream;
    use symphonia::core::meta::MetadataOptions;
    use symphonia::core::probe::Hint;

    let file = fs::File::open(file_path).map_err(|e| e.to_string())?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());
    let mut hint = Hint::new();
    if let Some(ext) = Path::new(file_path).extension().and_then(|e| e.to_str()) {
        hint.with_extension(ext);
    }
    let probed = symphonia::default::get_probe()
        .format(&hint, mss, &FormatOptions::default(), &MetadataOptions::default())
        .map_err(|e| e.to_string())?;
    let mut format = probed.format;
    let track = format.default_track().ok_or("no track")?.clone();
    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &DecoderOptions::default())
        .map_err(|e| e.to_string())?;

    let mut samples: Vec<f32> = Vec::new();
    let mut sr: u32 = track.codec_params.sample_rate.unwrap_or(44100);
    let max_samples = (sr as usize) * 12;

    'outer: loop {
        let packet = match format.next_packet() {
            Ok(p) => p,
            Err(_) => break,
        };
        if packet.track_id() != track.id {
            continue;
        }
        match decoder.decode(&packet) {
            Ok(decoded) => {
                let spec = *decoded.spec();
                sr = spec.rate;
                let ch = spec.channels.count().max(1);
                let mut buf = SampleBuffer::<f32>::new(decoded.frames() as u64, spec);
                buf.copy_interleaved_ref(decoded);
                let s = buf.samples();
                for i in (0..s.len()).step_by(ch) {
                    samples.push(s[i]);
                    if samples.len() >= max_samples {
                        break 'outer;
                    }
                }
            }
            Err(symphonia::core::errors::Error::DecodeError(_)) => continue,
            Err(_) => break,
        }
    }
    if samples.is_empty() {
        return Err("no samples decoded".into());
    }
    Ok((samples, sr))
}

fn next_pow2(n: usize) -> usize {
    let mut p = 1;
    while p < n {
        p <<= 1;
    }
    p
}

fn note_name(hz: f32) -> Option<String> {
    if hz < 20.0 || hz > 5000.0 {
        return None;
    }
    let names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    let midi = (69.0 + 12.0 * (hz / 440.0).log2()).round() as i32;
    if !(0..=127).contains(&midi) {
        return None;
    }
    let note = names[(midi % 12) as usize];
    let octave = midi / 12 - 1;
    Some(format!("{}{}", note, octave))
}

/// Autocorrelation pitch estimate on a window taken just after the attack.
fn estimate_pitch(samples: &[f32], sr: u32) -> (f32, f32) {
    let n = samples.len();
    if n < 1024 {
        return (0.0, 0.0);
    }
    // Window: up to 8192 samples starting a touch after the loudest sample.
    let peak_idx = samples
        .iter()
        .enumerate()
        .max_by(|a, b| a.1.abs().partial_cmp(&b.1.abs()).unwrap())
        .map(|(i, _)| i)
        .unwrap_or(0);
    let start = (peak_idx + sr as usize / 200).min(n.saturating_sub(2048));
    let win = &samples[start..(start + 8192).min(n)];
    let wn = win.len();
    if wn < 1024 {
        return (0.0, 0.0);
    }
    let min_lag = (sr as f32 / 1000.0) as usize; // 1000 Hz
    let max_lag = (sr as f32 / 30.0) as usize; // 30 Hz
    let max_lag = max_lag.min(wn - 1);
    if max_lag <= min_lag {
        return (0.0, 0.0);
    }
    let energy: f32 = win.iter().map(|x| x * x).sum::<f32>().max(1e-9);
    let mut best_lag = 0usize;
    let mut best_val = 0.0f32;
    for lag in min_lag..=max_lag {
        let mut sum = 0.0f32;
        for i in 0..(wn - lag) {
            sum += win[i] * win[i + lag];
        }
        let norm = sum / energy;
        if norm > best_val {
            best_val = norm;
            best_lag = lag;
        }
    }
    if best_lag == 0 {
        return (0.0, 0.0);
    }
    (sr as f32 / best_lag as f32, best_val.clamp(0.0, 1.0))
}

fn downsample_peaks(samples: &[f32], num: usize) -> Vec<f32> {
    if samples.is_empty() {
        return vec![0.0; num];
    }
    let per = (samples.len() / num).max(1);
    let mut peaks = Vec::with_capacity(num);
    for i in 0..num {
        let start = i * per;
        let end = ((i + 1) * per).min(samples.len());
        let mut m = 0.0f32;
        for j in start..end {
            m = m.max(samples[j].abs());
        }
        peaks.push(m);
    }
    let max = peaks.iter().cloned().fold(0.0f32, f32::max);
    if max > 0.0 {
        for p in &mut peaks {
            *p = (*p / max).min(1.0);
        }
    }
    peaks
}

fn compute_analysis(file_path: &str) -> Result<CachedAnalysis, String> {
    let (samples, sr) = decode_mono(file_path)?;
    let n = samples.len();
    let dur = n as f32 / sr as f32;

    // ── time domain ──
    let mut peak = 0.0f32;
    let mut peak_idx = 0usize;
    let mut sumsq = 0.0f64;
    let mut zc = 0usize;
    let mut prev = 0.0f32;
    for (i, &s) in samples.iter().enumerate() {
        let a = s.abs();
        if a > peak {
            peak = a;
            peak_idx = i;
        }
        sumsq += (s as f64) * (s as f64);
        if (s >= 0.0) != (prev >= 0.0) {
            zc += 1;
        }
        prev = s;
    }
    let rms = (sumsq / n as f64).sqrt() as f32;
    let crest = if rms > 1e-6 { peak / rms } else { 0.0 };
    let zcr = zc as f32 / n as f32;

    // attack: from 10% of peak up to peak
    let atk_thresh = peak * 0.1;
    let mut atk_start = peak_idx;
    for i in (0..peak_idx).rev() {
        if samples[i].abs() < atk_thresh {
            atk_start = i;
            break;
        }
    }
    let attack_secs = (peak_idx.saturating_sub(atk_start)) as f32 / sr as f32;

    // decay: peak → sustained below -40 dB
    let dthresh = peak * 0.01;
    let mut decay_end = n;
    let look = (sr as usize / 200).max(1);
    for i in peak_idx..n {
        if samples[i].abs() < dthresh {
            let hi = (i + look).min(n);
            if samples[i..hi].iter().all(|s| s.abs() < dthresh) {
                decay_end = i;
                break;
            }
        }
    }
    let decay_secs = (decay_end.saturating_sub(peak_idx)) as f32 / sr as f32;

    // onsets in first 250 ms (multi-transient → clap)
    let hop = (sr as usize / 1000 * 5).max(1); // 5 ms
    let frames = ((sr as usize / 4) / hop).max(1); // ~250 ms
    let mut env = Vec::with_capacity(frames);
    for f in 0..frames {
        let st = f * hop;
        if st >= n {
            break;
        }
        let en = (st + hop).min(n);
        let e: f32 = samples[st..en].iter().map(|x| x * x).sum::<f32>() / (en - st) as f32;
        env.push(e.sqrt());
    }
    let env_max = env.iter().cloned().fold(0.0f32, f32::max).max(1e-9);
    let mut onsets = 0u32;
    let mut last_onset = -10i32;
    for i in 1..env.len().saturating_sub(1) {
        if env[i] > 0.3 * env_max && env[i] >= env[i - 1] && env[i] > env[i + 1] && (i as i32 - last_onset) > 4 {
            onsets += 1;
            last_onset = i as i32;
        }
    }

    // ── frequency domain ──
    let (centroid_hz, rolloff_hz, flatness, sub_ratio, low_ratio, mid_ratio, high_ratio) =
        compute_spectral(&samples, sr, peak_idx);

    // pitch
    let (pitch_hz, pitch_conf) = estimate_pitch(&samples, sr);

    let peaks = downsample_peaks(&samples, EMBED_PEAKS);

    Ok(CachedAnalysis {
        features: AudioFeatures {
            duration_secs: dur,
            peak,
            rms,
            crest,
            attack_secs,
            decay_secs,
            zcr,
            sub_ratio,
            low_ratio,
            mid_ratio,
            high_ratio,
            centroid_hz,
            rolloff_hz,
            flatness,
            pitch_hz,
            pitch_conf,
            onsets,
            sample_rate: sr,
        },
        peaks,
    })
}

fn compute_spectral(samples: &[f32], sr: u32, peak_idx: usize) -> (f32, f32, f32, f32, f32, f32, f32) {
    use rustfft::num_complex::Complex;
    use rustfft::FftPlanner;

    // Analyse a chunk anchored at the loudest region.
    let start = peak_idx.min(samples.len().saturating_sub(1));
    let avail = samples.len() - start;
    let max = avail.min(32768);
    if max < 256 {
        return (0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0);
    }
    let nfft = next_pow2(max).min(32768);
    let mut planner = FftPlanner::<f32>::new();
    let fft = planner.plan_fft_forward(nfft);
    let mut buf = vec![Complex { re: 0.0, im: 0.0 }; nfft];
    for i in 0..max {
        let w = 0.5 - 0.5 * (2.0 * std::f32::consts::PI * i as f32 / max as f32).cos();
        buf[i].re = samples[start + i] * w;
    }
    fft.process(&mut buf);

    let half = nfft / 2;
    let bin_hz = sr as f32 / nfft as f32;
    let mut mags = vec![0.0f32; half];
    let mut total = 0.0f64;
    let mut weighted = 0.0f64;
    let mut log_sum = 0.0f64;
    let mut lin_sum = 0.0f64;
    let mut sub = 0.0f64;
    let mut low = 0.0f64;
    let mut mid = 0.0f64;
    let mut high = 0.0f64;
    for k in 1..half {
        let m = (buf[k].re * buf[k].re + buf[k].im * buf[k].im).sqrt();
        mags[k] = m;
        let f = k as f32 * bin_hz;
        total += m as f64;
        weighted += (m * f) as f64;
        log_sum += ((m as f64) + 1e-9).ln();
        lin_sum += m as f64;
        if f < 120.0 {
            sub += m as f64;
        }
        if f < 250.0 {
            low += m as f64;
        }
        if (250.0..2000.0).contains(&f) {
            mid += m as f64;
        }
        if f > 6000.0 {
            high += m as f64;
        }
    }
    let centroid = if total > 0.0 { (weighted / total) as f32 } else { 0.0 };
    let nbins = (half - 1) as f64;
    let gmean = (log_sum / nbins).exp();
    let amean = lin_sum / nbins;
    let flatness = if amean > 0.0 { (gmean / amean) as f32 } else { 1.0 };
    let sub_r = if total > 0.0 { (sub / total) as f32 } else { 0.0 };
    let low_r = if total > 0.0 { (low / total) as f32 } else { 0.0 };
    let mid_r = if total > 0.0 { (mid / total) as f32 } else { 0.0 };
    let high_r = if total > 0.0 { (high / total) as f32 } else { 0.0 };

    // rolloff (85% of cumulative energy)
    let mut cum = 0.0f64;
    let target = total * 0.85;
    let mut rolloff = 0.0f32;
    for k in 1..half {
        cum += mags[k] as f64;
        if cum >= target {
            rolloff = k as f32 * bin_hz;
            break;
        }
    }
    (centroid, rolloff, flatness.clamp(0.0, 1.0), sub_r, low_r, mid_r, high_r)
}

// ───────────────────────── classifier ─────────────────────────

// ramp helpers: hi → rises a..b ; lo → falls a..b ; band → trapezoid
fn hi(x: f32, a: f32, b: f32) -> f32 {
    if x <= a { 0.0 } else if x >= b { 1.0 } else { (x - a) / (b - a) }
}
fn lo(x: f32, a: f32, b: f32) -> f32 {
    1.0 - hi(x, a, b)
}
fn band(x: f32, a: f32, b: f32, c: f32, d: f32) -> f32 {
    if x < a || x > d {
        0.0
    } else if x < b {
        (x - a) / (b - a).max(1e-6)
    } else if x <= c {
        1.0
    } else {
        (d - x) / (d - c).max(1e-6)
    }
}

/// Built-in filename keyword → category aliases (secondary signal).
fn keyword_table() -> Vec<(&'static str, Vec<&'static str>)> {
    vec![
        ("hat_open", vec!["open hat", "openhat", "open_hat", "ohh", "hat open", " oh "]),
        ("hat_closed", vec!["closed hat", "closedhat", "chh", "hihat", "hi hat", "hi-hat", " hat ", " ch ", " hh "]),
        ("808", vec!["808", "sub bass", "subbass", " sub "]),
        ("kick", vec!["kick", "kik", "bassdrum", "bass drum", " bd "]),
        ("snare", vec!["snare", "snr", " sd "]),
        ("clap", vec!["clap", "claps", "clp", "handclap"]),
        ("rim", vec!["rim", "rimshot"]),
        ("snap", vec!["snap", "finger"]),
        ("shaker", vec!["shaker", "shake", "shkr"]),
        ("tom", vec!["tom"]),
        ("crash", vec!["crash"]),
        ("ride", vec!["ride"]),
        ("cymbal", vec!["cymbal", " cym "]),
        ("perc", vec!["perc", "conga", "bongo", "tabla", "woodblock", "cowbell", "tambourine", "block", "tick"]),
        ("vocal", vec!["vocal", "vox", " voc ", "adlib", "acapella", "chant", "phrase"]),
        ("loop", vec!["loop", "groove", "break", "top loop"]),
        ("bass", vec!["reese", "bassline", "bass line"]),
        ("fx", vec!["fx", "riser", "downer", "sweep", "impact", "boom", "drone", "foley", "noise", "texture", "transition", "whoosh", "atmos"]),
        ("melody", vec!["melody", "chord", "piano", "pluck", "lead", "arp", "synth", "bell", "flute", "guitar", "string", "pad", "stab", "keys"]),
    ]
}

fn name_votes(haystack: &str, extra: &HashMap<String, Vec<String>>) -> HashMap<String, f32> {
    let h = format!(" {} ", haystack.to_lowercase().replace(['_', '-', '.', '/', '\\'], " "));
    let mut votes: HashMap<String, f32> = HashMap::new();
    for (cat, aliases) in extra {
        for a in aliases {
            let a = a.trim().to_lowercase();
            if !a.is_empty() && h.contains(&a) {
                *votes.entry(cat.clone()).or_insert(0.0) += 0.5;
            }
        }
    }
    for (cat, aliases) in keyword_table() {
        for a in aliases {
            if h.contains(a) {
                *votes.entry(cat.to_string()).or_insert(0.0) += 0.5;
                break;
            }
        }
    }
    votes
}

/// Audio-only membership scores per category. Returns (scores, tonal).
fn audio_scores(f: &AudioFeatures) -> (HashMap<String, f32>, bool) {
    let dur = f.duration_secs;
    let sub = f.sub_ratio;
    let high = f.high_ratio;
    let cen = f.centroid_hz;
    let flat = f.flatness;
    let pconf = f.pitch_conf;
    let crest = f.crest;
    let decay = f.decay_secs;
    let onsets = f.onsets as f32;
    let tonal = flat < 0.2 && pconf > 0.5;
    let noisy = flat; // higher = noisier

    let mut s: HashMap<String, f32> = HashMap::new();
    let mut put = |k: &str, v: f32| {
        s.insert(k.to_string(), v.clamp(0.0, 1.0));
    };

    // 808: sub-heavy, tonal, sustained, low centroid
    put("808",
        hi(sub, 0.45, 0.75) * 0.34
        + (1.0 - noisy) * 0.18
        + pconf * 0.16
        + hi(decay, 0.22, 0.55) * 0.18
        + lo(cen, 400.0, 1500.0) * 0.14);

    // kick: sub/low energy, transient, short tail, lower sustained tonality
    put("kick",
        hi(sub, 0.4, 0.7) * 0.3
        + hi(crest, 3.0, 9.0) * 0.2
        + lo(decay, 0.12, 0.45) * 0.22
        + lo(cen, 600.0, 2200.0) * 0.16
        + lo(dur, 0.25, 0.8) * 0.12);

    // snare: mid centroid, noisy, body not sub, moderate length
    put("snare",
        band(cen, 1200.0, 2000.0, 3800.0, 5500.0) * 0.3
        + noisy * 0.26
        + lo(sub, 0.25, 0.5) * 0.2
        + band(dur, 0.04, 0.08, 0.45, 0.8) * 0.14
        + lo(high, 0.55, 0.85) * 0.1);

    // clap: noisy, multi-onset, mid-high
    put("clap",
        hi(onsets, 1.5, 3.5) * 0.4
        + noisy * 0.2
        + band(cen, 1500.0, 2500.0, 5500.0, 8500.0) * 0.22
        + lo(sub, 0.2, 0.45) * 0.18);

    // closed hat: very bright, lots of HF, short decay, low sub
    put("hat_closed",
        hi(cen, 5000.0, 9000.0) * 0.3
        + hi(high, 0.3, 0.6) * 0.26
        + lo(decay, 0.04, 0.16) * 0.24
        + noisy * 0.12
        + lo(sub, 0.15, 0.4) * 0.08);

    // open hat: bright, noisy, longer decay
    put("hat_open",
        hi(cen, 4500.0, 8500.0) * 0.28
        + hi(high, 0.3, 0.6) * 0.22
        + band(decay, 0.16, 0.25, 0.7, 1.1) * 0.3
        + lo(sub, 0.15, 0.4) * 0.2);

    // crash / cymbal: very bright, very long, noisy
    put("crash",
        hi(cen, 5000.0, 9000.0) * 0.3
        + hi(decay, 0.8, 1.8) * 0.4
        + noisy * 0.2
        + lo(sub, 0.15, 0.4) * 0.1);

    // tom: tonal mid-low pitch, decays, not sub-only, not noisy
    put("tom",
        (1.0 - noisy) * 0.22
        + band(f.pitch_hz, 80.0, 110.0, 300.0, 450.0) * 0.3
        + band(decay, 0.12, 0.2, 0.6, 1.0) * 0.22
        + lo(sub, 0.3, 0.6) * 0.14
        + pconf * 0.12);

    // rim / snap: very short, transient, low energy
    put("rim",
        lo(dur, 0.03, 0.13) * 0.4
        + hi(crest, 3.0, 8.0) * 0.22
        + lo(sub, 0.15, 0.4) * 0.2
        + band(cen, 1500.0, 2500.0, 6000.0, 9000.0) * 0.18);
    put("snap",
        lo(dur, 0.03, 0.15) * 0.36
        + band(cen, 2000.0, 3000.0, 6500.0, 9000.0) * 0.24
        + noisy * 0.2
        + lo(sub, 0.15, 0.4) * 0.2);

    // shaker: bright, noisy, short, basically no sub. Audio signature overlaps hats
    // heavily, so keep the audio prior low — shakers are reliably named "shaker".
    put("shaker",
        hi(cen, 5000.0, 8500.0) * 0.2
        + noisy * 0.18
        + lo(sub, 0.1, 0.3) * 0.16
        + lo(dur, 0.05, 0.35) * 0.14);

    // bass: tonal low but sustained / not pure-sub
    put("bass",
        band(f.pitch_hz, 40.0, 60.0, 200.0, 350.0) * 0.3
        + (1.0 - noisy) * 0.2
        + hi(dur, 0.4, 1.2) * 0.22
        + band(sub, 0.25, 0.4, 0.6, 0.85) * 0.16
        + pconf * 0.12);

    // melody / instrument: tonal, harmonic, sustained, mid/high centroid
    put("melody",
        (1.0 - noisy) * 0.26
        + pconf * 0.2
        + hi(dur, 0.4, 1.2) * 0.2
        + band(cen, 500.0, 1000.0, 4000.0, 7000.0) * 0.22
        + lo(sub, 0.4, 0.7) * 0.12);

    // loop: long & sustained
    put("loop", hi(dur, 1.3, 2.6) * 0.7 + (1.0 - lo(crest, 2.0, 6.0)) * 0.0 + 0.1);

    // perc fallback: short percussive that isn't strongly anything
    put("perc",
        band(dur, 0.04, 0.08, 0.4, 0.7) * 0.3
        + lo(sub, 0.3, 0.6) * 0.2
        + 0.15);

    (s, tonal)
}

struct Classification {
    category: String,
    confidence: f32,
    method: String,
}

fn classify(
    features: Option<&AudioFeatures>,
    name_haystack: &str,
    folder_haystack: &str,
    extra: &HashMap<String, Vec<String>>,
) -> Classification {
    // Two secondary signals: the file name (+ channel) and the ORIGIN folders the
    // sample already lived in (a folder literally named "Snares" is a strong hint).
    let name_v = name_votes(name_haystack, extra);
    let folder_v = name_votes(folder_haystack, extra);

    let (mut scores, _tonal) = match features {
        Some(f) => audio_scores(f),
        None => (HashMap::new(), false),
    };
    for c in CANONICAL_CATEGORIES {
        scores.entry(c.to_string()).or_insert(0.0);
    }
    for (cat, v) in &name_v {
        *scores.entry(cat.clone()).or_insert(0.0) += v;
    }
    for (cat, v) in &folder_v {
        *scores.entry(cat.clone()).or_insert(0.0) += v;
    }

    let mut best = ("unknown".to_string(), -1.0f32);
    let mut second = -1.0f32;
    for (k, v) in &scores {
        if *v > best.1 {
            second = best.1;
            best = (k.clone(), *v);
        } else if *v > second {
            second = *v;
        }
    }

    let audio_best = features
        .map(|f| {
            audio_scores(f)
                .0
                .into_iter()
                .fold((String::new(), -1.0f32), |a, (k, v)| if v > a.1 { (k, v) } else { a })
        })
        .map(|(k, _)| k);

    // Describe which signals backed the winning category.
    let mut parts: Vec<&str> = Vec::new();
    if features.is_some() && audio_best.as_deref() == Some(best.0.as_str()) {
        parts.push("audio");
    }
    if name_v.get(&best.0).copied().unwrap_or(0.0) > 0.0 {
        parts.push("name");
    }
    if folder_v.get(&best.0).copied().unwrap_or(0.0) > 0.0 {
        parts.push("folder");
    }
    if parts.is_empty() {
        parts.push(if features.is_some() { "audio" } else { "name" });
    }
    let method = parts.join("+");

    let margin = (best.1 - second.max(0.0)).clamp(0.0, 1.0);
    let confidence = (best.1.min(1.0) * 0.7 + margin * 0.3).clamp(0.05, 0.99);

    Classification { category: best.0, confidence, method }
}

/// Build a haystack from up to `levels` ancestor folder names (origin context).
fn ancestor_folders(path: &Path, levels: usize) -> String {
    let mut names = Vec::new();
    let mut cur = path.parent();
    let mut i = 0;
    while let (Some(p), true) = (cur, i < levels) {
        if let Some(n) = p.file_name().and_then(|x| x.to_str()) {
            names.push(n.to_string());
        }
        cur = p.parent();
        i += 1;
    }
    names.join(" ")
}

fn length_class(dur: f32) -> &'static str {
    if dur < 0.4 {
        "short"
    } else if dur < 1.3 {
        "medium"
    } else {
        "long"
    }
}

/// Heuristic distortion flag: lots of high-frequency harmonics + high crest clipping.
fn is_distorted(f: &AudioFeatures) -> bool {
    (f.high_ratio > 0.25 && f.flatness < 0.35 && f.mid_ratio > 0.3) || f.peak >= 0.999
}

// ───────────────────────── scan command ─────────────────────────

fn emit_progress(app: &AppHandle, current: usize, total: usize, file: &str, phase: &str, scanning: bool) {
    app.emit(
        "stash-progress",
        serde_json::json!({ "current": current, "total": total, "file": file, "phase": phase, "isScanning": scanning }),
    )
    .ok();
}

struct SampleRef {
    path: PathBuf,
    from_flp: Option<String>,
    channel: Option<String>,
    color: Option<String>,
}

#[tauri::command]
pub fn stash_scan_sources(
    app: AppHandle,
    settings: State<'_, SettingsState>,
    app_data: State<'_, AppDataDir>,
    paths: Vec<String>,
    extra_keywords: Option<serde_json::Value>,
) -> Result<Vec<SampleCandidate>, String> {
    let fl_exe = {
        let s = settings.0.lock().map_err(|e| e.to_string())?;
        s.fl_studio_path.clone()
    };
    let fl_install = fl_install_dir(&fl_exe);
    let app_data_dir = app_data.0.clone();
    let extra: HashMap<String, Vec<String>> =
        extra_keywords.and_then(|v| serde_json::from_value(v).ok()).unwrap_or_default();

    emit_progress(&app, 0, 1, "Finding FL Studio projects…", "discovering", true);

    // 1) Discover FLP + zip-with-FLP from sources (folders are scanned for FLPs only —
    //    we deliberately do NOT vacuum up every loose audio file).
    let mut flp_files: Vec<String> = Vec::new();
    let mut zip_files: Vec<String> = Vec::new();
    for raw in &paths {
        let p = Path::new(raw);
        if p.is_dir() {
            flp_files.extend(scanner::scan_for_flp_files(raw, 12));
            zip_files.extend(scanner::scan_for_zip_files_with_flp(raw, 12));
        } else if p.is_file() {
            match p.extension().and_then(|e| e.to_str()).map(|e| e.to_lowercase()) {
                Some(ext) if ext == "flp" => flp_files.push(raw.clone()),
                Some(ext) if ext == "zip" && scanner::zip_contains_flp_quick(raw) => zip_files.push(raw.clone()),
                _ => {}
            }
        }
    }
    flp_files = scanner::filter_autosaves(&flp_files, "flp");
    zip_files = scanner::filter_autosaves(&zip_files, "zip");

    // 2) Collect referenced samples (only files that exist on disk).
    let mut refs: Vec<SampleRef> = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();
    let mut push = |refs: &mut Vec<SampleRef>, seen: &mut HashSet<String>, r: SampleRef| {
        if seen.insert(normalize_key(&r.path.to_string_lossy())) {
            refs.push(r);
        }
    };

    for flp in &flp_files {
        let dir = Path::new(flp).parent();
        if let Ok(a) = flp_parser::analyze_flp(flp) {
            for ch in &a.channels {
                if let Some(ref sp) = ch.sample_path {
                    if let Some(resolved) = resolve_sample_path(sp, dir, fl_install.as_deref()) {
                        push(&mut refs, &mut seen, SampleRef { path: resolved, from_flp: Some(flp.clone()), channel: ch.name.clone(), color: ch.color.clone() });
                    }
                }
            }
        }
    }
    for zip in &zip_files {
        let dir = Path::new(zip).parent();
        for entry in scanner::extract_flps_from_zip(zip) {
            if let Ok(a) = flp_parser::analyze_flp_from_bytes(&entry.flp_data, &entry.flp_name) {
                for ch in &a.channels {
                    if let Some(ref sp) = ch.sample_path {
                        if let Some(resolved) = resolve_sample_path(sp, dir, fl_install.as_deref()) {
                            push(&mut refs, &mut seen, SampleRef { path: resolved, from_flp: Some(zip.clone()), channel: ch.name.clone(), color: ch.color.clone() });
                        }
                    }
                }
            }
        }
    }

    let total = refs.len();
    if total == 0 {
        emit_progress(&app, 0, 0, "No samples referenced by these projects", "complete", false);
        return Ok(Vec::new());
    }

    // 3) Analyse + classify in parallel.
    let refs = Arc::new(refs);
    let extra = Arc::new(extra);
    let results: Arc<Mutex<Vec<SampleCandidate>>> = Arc::new(Mutex::new(Vec::with_capacity(total)));
    let counter = Arc::new(AtomicUsize::new(0));
    let threads = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(4).min(total).max(1);
    let chunk = (total + threads - 1) / threads;

    let mut handles = Vec::new();
    for t in 0..threads {
        let start = t * chunk;
        if start >= total {
            break;
        }
        let end = (start + chunk).min(total);
        let (refs, extra, results, counter, app, app_data_dir) =
            (Arc::clone(&refs), Arc::clone(&extra), Arc::clone(&results), Arc::clone(&counter), app.clone(), app_data_dir.clone());
        handles.push(std::thread::spawn(move || {
            let mut local = Vec::new();
            for r in &refs[start..end] {
                let path_str = r.path.to_string_lossy().to_string();
                let analysis = read_cache(&app_data_dir, &path_str).or_else(|| {
                    let a = compute_analysis(&path_str).ok();
                    if let Some(ref an) = a {
                        write_cache(&app_data_dir, &path_str, an);
                    }
                    a
                });
                let features = analysis.as_ref().map(|a| a.features.clone());
                let peaks = analysis.as_ref().map(|a| a.peaks.clone()).unwrap_or_else(|| vec![0.0; EMBED_PEAKS]);

                let file_name = r.path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
                let ext = r.path.extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default();
                let size = fs::metadata(&r.path).map(|m| m.len()).unwrap_or(0);
                // Name signal = filename + the FLP channel name; origin signal = the
                // folders the sample already lived in (up to 3 levels up).
                let name_haystack = format!("{} {}", file_name, r.channel.clone().unwrap_or_default());
                let folder_haystack = ancestor_folders(&r.path, 3);

                let cls = classify(features.as_ref(), &name_haystack, &folder_haystack, &extra);

                // key + descriptors for tonal one-shots
                let (key, tonal) = match features.as_ref() {
                    Some(f) if f.flatness < 0.22 && f.pitch_conf > 0.55 => (note_name(f.pitch_hz), true),
                    _ => (None, false),
                };
                let distorted = features.as_ref().map(is_distorted).unwrap_or(false);
                let len = features.as_ref().map(|f| length_class(f.duration_secs)).unwrap_or("medium").to_string();

                local.push(SampleCandidate {
                    id: hash_id(&path_str),
                    source_path: path_str,
                    file_name,
                    ext,
                    size,
                    category: cls.category,
                    confidence: cls.confidence,
                    method: cls.method,
                    from_flp: r.from_flp.clone(),
                    flp_channel: r.channel.clone(),
                    flp_color: r.color.clone(),
                    key,
                    tonal,
                    distorted,
                    length_class: len,
                    peaks,
                    features,
                });

                let done = counter.fetch_add(1, Ordering::Relaxed) + 1;
                if done % 8 == 0 || done == total {
                    let last = local.last().map(|c| c.file_name.clone()).unwrap_or_default();
                    emit_progress(&app, done, total, &last, "analyzing", true);
                }
            }
            results.lock().unwrap().extend(local);
        }));
    }
    for h in handles {
        h.join().ok();
    }
    emit_progress(&app, total, total, "Done", "complete", false);

    let out = Arc::try_unwrap(results).map(|m| m.into_inner().unwrap()).unwrap_or_else(|a| a.lock().unwrap().clone());
    Ok(out)
}

// ───────────────────────── build command ─────────────────────────

/// "#RRGGBB" → FL Delphi BGR "$BBGGRR".
fn hex_to_nfo_color(hex: &str) -> Option<String> {
    let h = hex.trim().trim_start_matches('#');
    if h.len() != 6 || !h.chars().all(|c| c.is_ascii_hexdigit()) {
        return None;
    }
    Some(format!("${}{}{}", h[4..6].to_uppercase(), h[2..4].to_uppercase(), h[0..2].to_uppercase()))
}

/// Write an FL `.nfo` named after the folder, placed as a SIBLING of that folder.
fn write_named_nfo(folder: &Path, style: &FolderStyle) -> std::io::Result<()> {
    let name = match folder.file_name() {
        Some(n) => n.to_string_lossy().to_string(),
        None => return Ok(()),
    };
    let dir = folder.parent().unwrap_or_else(|| Path::new("."));
    let mut lines: Vec<String> = Vec::new();
    if let Some(ref c) = style.color {
        if let Some(nfo) = hex_to_nfo_color(c) {
            lines.push(format!("Color={}", nfo));
        }
    }
    if let Some(i) = style.icon_index {
        lines.push(format!("IconIndex={}", i));
    }
    if let Some(ref t) = style.tip {
        if !t.trim().is_empty() {
            lines.push(format!("Tip={}", t));
        }
    }
    if let Some(s) = style.sort_group {
        lines.push(format!("SortGroup={}", s));
    }
    if let Some(h) = style.height_ofs {
        lines.push(format!("HeightOfs={}", h));
    }
    lines.push(format!("Visible={}", if style.visible.unwrap_or(true) { "True" } else { "False" }));
    fs::write(dir.join(format!("{}.nfo", name)), lines.join("\r\n"))
}

fn safe_dest(dest: &Path, src_len: u64, dedup: bool) -> Option<PathBuf> {
    if !dest.exists() {
        return Some(dest.to_path_buf());
    }
    if dedup {
        if let Ok(meta) = fs::metadata(dest) {
            if meta.len() == src_len {
                return None;
            }
        }
    }
    let stem = dest.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_default();
    let ext = dest.extension().map(|e| e.to_string_lossy().to_string());
    let parent = dest.parent().unwrap_or_else(|| Path::new("."));
    for i in 2..10000 {
        let name = match ext {
            Some(ref e) => format!("{} ({}).{}", stem, i, e),
            None => format!("{} ({})", stem, i),
        };
        let cand = parent.join(name);
        if !cand.exists() {
            return Some(cand);
        }
    }
    None
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct BuildOptions {
    pub write_nfo: bool,
    pub dedup: bool,
    #[serde(default)]
    pub agreement_text: Option<String>,
    #[serde(default)]
    pub cover_png: Option<Vec<u8>>, // raw PNG bytes for cover.png at kit root
    #[serde(default)]
    pub root_style: Option<FolderStyle>,
}

#[tauri::command]
pub fn stash_build_kit(
    output_dir: String,
    items: Vec<BuildItem>,
    folders: Vec<FolderStyle>,
    options: BuildOptions,
) -> Result<BuildResult, String> {
    let out_root = PathBuf::from(&output_dir);
    fs::create_dir_all(&out_root).map_err(|e| e.to_string())?;

    let mut copied = 0usize;
    let mut skipped = 0usize;
    let mut errors: Vec<String> = Vec::new();

    for item in &items {
        let src = Path::new(&item.source_path);
        if !src.is_file() {
            errors.push(format!("Missing: {}", item.source_path));
            continue;
        }
        let rel = item.dest_rel_path.trim_start_matches(['/', '\\']);
        let dest = out_root.join(rel);
        if let Some(parent) = dest.parent() {
            if let Err(e) = fs::create_dir_all(parent) {
                errors.push(format!("mkdir {}: {}", parent.display(), e));
                continue;
            }
        }
        let src_len = fs::metadata(src).map(|m| m.len()).unwrap_or(0);
        match safe_dest(&dest, src_len, options.dedup) {
            None => skipped += 1,
            Some(fd) => match fs::copy(src, &fd) {
                Ok(_) => copied += 1,
                Err(e) => errors.push(format!("copy {}: {}", item.source_path, e)),
            },
        }
    }

    if options.write_nfo {
        for style in &folders {
            let rel = style.rel_path.trim_start_matches(['/', '\\']);
            if rel.is_empty() {
                continue;
            }
            let dir = out_root.join(rel);
            if fs::create_dir_all(&dir).is_ok() {
                if let Err(e) = write_named_nfo(&dir, style) {
                    errors.push(format!("nfo {}: {}", dir.display(), e));
                }
            }
        }
        if let Some(ref rs) = options.root_style {
            let _ = write_named_nfo(&out_root, rs);
        }
    }

    // Cover art + agreement.
    let mut cover_path: Option<String> = None;
    if let Some(ref png) = options.cover_png {
        let p = out_root.join("cover.png");
        if fs::write(&p, png).is_ok() {
            cover_path = Some(p.to_string_lossy().to_string());
        }
    }
    if let Some(ref txt) = options.agreement_text {
        let _ = fs::write(out_root.join("LICENSE.txt"), txt);
    }

    Ok(BuildResult { copied, skipped, errors, output_dir, cover_path })
}

// ───────────────────────── FL icon font (cmap) ─────────────────────────

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FlIconFont {
    pub found: bool,
    pub path: Option<String>,
    pub data_url: Option<String>,
    pub base: u32,
    pub glyphs: Vec<u32>, // actual codepoints that have a glyph (IconIndex = cp - base)
}

fn parse_icon_font(bytes: &[u8], path: &str) -> Option<FlIconFont> {
    let face = ttf_parser::Face::parse(bytes, 0).ok()?;
    let mut cps: Vec<u32> = Vec::new();
    if let Some(cmap) = face.tables().cmap {
        for sub in cmap.subtables {
            if !sub.is_unicode() {
                continue;
            }
            sub.codepoints(|cp| {
                // Private Use Area where FL keeps its icons.
                if (0xE000..=0xF8FF).contains(&cp)
                    && char::from_u32(cp).and_then(|c| face.glyph_index(c)).is_some()
                {
                    cps.push(cp);
                }
            });
        }
    }
    cps.sort_unstable();
    cps.dedup();
    let base = if cps.iter().any(|&c| (0xE000..0xF000).contains(&c)) { 0xE000 } else { 0xF000 };
    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD.encode(bytes);
    Some(FlIconFont {
        found: true,
        path: Some(path.to_string()),
        data_url: Some(format!("data:font/ttf;base64,{}", b64)),
        base,
        glyphs: cps,
    })
}

fn load_icon_font_at(p: &Path) -> Option<FlIconFont> {
    if !p.is_file() {
        return None;
    }
    let bytes = fs::read(p).ok()?;
    parse_icon_font(&bytes, &p.to_string_lossy())
}

#[tauri::command]
pub fn get_fl_icon_font(settings: State<'_, SettingsState>, override_path: Option<String>) -> Result<FlIconFont, String> {
    if let Some(op) = override_path {
        if let Some(f) = load_icon_font_at(Path::new(&op)) {
            return Ok(f);
        }
    }
    let fl_exe = { settings.0.lock().map_err(|e| e.to_string())?.fl_studio_path.clone() };
    if let Some(install) = fl_install_dir(&fl_exe) {
        let candidates = [
            install.join("Data/Shared/Graphics/ILGlyphsEx.ttf"),
            install.join("Shared/Graphics/ILGlyphsEx.ttf"),
            install.join("Data/Shared/Graphics/ILGlyphs.ttf"),
        ];
        for c in candidates.iter() {
            if let Some(f) = load_icon_font_at(c) {
                return Ok(f);
            }
        }
    }
    Ok(FlIconFont { found: false, path: None, data_url: None, base: 0xE000, glyphs: vec![] })
}

// ───────────────────────── config persistence ─────────────────────────

fn kit_config_path(d: &Path) -> PathBuf {
    d.join("kit_config.json")
}

#[tauri::command]
pub fn load_kit_config(app_data: State<'_, AppDataDir>) -> Result<Option<String>, String> {
    let p = kit_config_path(&app_data.0);
    if p.exists() {
        fs::read_to_string(&p).map(Some).map_err(|e| e.to_string())
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub fn save_kit_config(app_data: State<'_, AppDataDir>, json: String) -> Result<(), String> {
    fs::write(kit_config_path(&app_data.0), json).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn feat() -> AudioFeatures {
        AudioFeatures { sample_rate: 44100, ..Default::default() }
    }

    #[test]
    fn test_nfo_color() {
        assert_eq!(hex_to_nfo_color("#FF9933").as_deref(), Some("$3399FF"));
        assert_eq!(hex_to_nfo_color("bad"), None);
    }

    #[test]
    fn test_808_not_snare() {
        // Sub-heavy, tonal, sustained → must be 808, never snare.
        let f = AudioFeatures {
            duration_secs: 0.9, peak: 0.9, rms: 0.4, crest: 2.2, decay_secs: 0.6,
            sub_ratio: 0.72, low_ratio: 0.8, mid_ratio: 0.15, high_ratio: 0.02,
            centroid_hz: 180.0, rolloff_hz: 300.0, flatness: 0.05, pitch_hz: 55.0,
            pitch_conf: 0.85, onsets: 1, ..feat()
        };
        let c = classify(Some(&f), "weird_name_2.wav", "", &HashMap::new());
        assert_eq!(c.category, "808", "got {} ({})", c.category, c.confidence);
    }

    #[test]
    fn test_kick_short_transient() {
        let f = AudioFeatures {
            duration_secs: 0.25, peak: 0.99, rms: 0.18, crest: 5.5, decay_secs: 0.18,
            sub_ratio: 0.62, low_ratio: 0.7, mid_ratio: 0.2, high_ratio: 0.03,
            centroid_hz: 350.0, flatness: 0.18, pitch_hz: 60.0, pitch_conf: 0.4, onsets: 1, ..feat()
        };
        let c = classify(Some(&f), "xxx.wav", "", &HashMap::new());
        assert_eq!(c.category, "kick", "got {}", c.category);
    }

    #[test]
    fn test_closed_hat_bright_short() {
        let f = AudioFeatures {
            duration_secs: 0.08, peak: 0.7, rms: 0.1, crest: 6.0, decay_secs: 0.07,
            sub_ratio: 0.02, high_ratio: 0.55, centroid_hz: 8000.0, flatness: 0.6,
            onsets: 1, ..feat()
        };
        let c = classify(Some(&f), "zzz.wav", "", &HashMap::new());
        assert_eq!(c.category, "hat_closed", "got {}", c.category);
    }

    #[test]
    fn test_name_breaks_audio_tie_when_audio_weak() {
        // Ambiguous audio, explicit name → name decides.
        let f = AudioFeatures { duration_secs: 0.3, flatness: 0.4, ..feat() };
        let c = classify(Some(&f), "fat_clap_03.wav", "", &HashMap::new());
        assert_eq!(c.category, "clap", "got {}", c.category);
    }

    #[test]
    fn test_audio_overrides_misleading_name() {
        // Clearly an 808 by audio even though the file is named "snare".
        let f = AudioFeatures {
            duration_secs: 0.9, peak: 0.9, rms: 0.4, crest: 2.0, decay_secs: 0.6,
            sub_ratio: 0.74, low_ratio: 0.82, mid_ratio: 0.12, high_ratio: 0.01,
            centroid_hz: 150.0, flatness: 0.04, pitch_hz: 50.0, pitch_conf: 0.9, onsets: 1, ..feat()
        };
        let c = classify(Some(&f), "snare_weird.wav", "", &HashMap::new());
        assert_eq!(c.category, "808", "audio should dominate, got {}", c.category);
    }

    #[test]
    fn test_origin_folder_decides_ambiguous() {
        // Ambiguous audio, generic file name, but the sample lives in a "Snares" folder.
        let f = AudioFeatures { duration_secs: 0.25, flatness: 0.4, centroid_hz: 1500.0, ..feat() };
        let c = classify(Some(&f), "vol2_07.wav", "Pack Snares Acoustic", &HashMap::new());
        assert_eq!(c.category, "snare", "origin folder should decide, got {}", c.category);
    }

    #[test]
    fn test_name_plus_folder_agree_high_conf() {
        let f = AudioFeatures { duration_secs: 0.3, flatness: 0.4, ..feat() };
        let c = classify(Some(&f), "clap_05.wav", "Drums Claps", &HashMap::new());
        assert_eq!(c.category, "clap");
        assert!(c.method.contains("name") && c.method.contains("folder"), "method {}", c.method);
    }

    #[test]
    fn test_note_name() {
        assert_eq!(note_name(440.0).as_deref(), Some("A4"));
        assert_eq!(note_name(55.0).as_deref(), Some("A1"));
    }
}
