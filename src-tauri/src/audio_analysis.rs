//! Audio analysis: computes peak dB, RMS dB, approximate LUFS, and per-frame loudness.
//!
//! The per-frame analysis is saved as a JSON sidecar file next to the audio, allowing
//! the frontend to display real-time dB/LUFS at the playhead position.

use serde::{Deserialize, Serialize};
use std::path::Path;
use symphonia::core::codecs::DecoderOptions;
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;

/// Per-frame loudness entry
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LoudnessFrame {
    /// Time in seconds from start
    pub time: f64,
    /// RMS level in dBFS for this window
    pub rms_db: f64,
    /// Peak level in dBFS for this window
    pub peak_db: f64,
}

/// Complete audio analysis result
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AudioAnalysis {
    pub sample_rate: u32,
    pub channels: u16,
    pub duration_secs: f64,
    /// Analysis window size in milliseconds
    pub window_size_ms: u32,
    /// Hop size (step) in milliseconds
    pub hop_size_ms: u32,
    /// Per-frame loudness data
    pub frames: Vec<LoudnessFrame>,
    /// Overall peak in dBFS
    pub peak_db: f64,
    /// Overall RMS in dBFS
    pub rms_db: f64,
    /// Approximate integrated LUFS (simplified ITU-R BS.1770)
    pub lufs_integrated: f64,
}

/// K-weighting biquad filter coefficients for a given sample rate.
/// Simplified implementation of the ITU-R BS.1770-4 pre-filter.
struct Biquad {
    b0: f64,
    b1: f64,
    b2: f64,
    a1: f64,
    a2: f64,
    // state
    x1: f64,
    x2: f64,
    y1: f64,
    y2: f64,
}

impl Biquad {
    fn new(b0: f64, b1: f64, b2: f64, a1: f64, a2: f64) -> Self {
        Self {
            b0,
            b1,
            b2,
            a1,
            a2,
            x1: 0.0,
            x2: 0.0,
            y1: 0.0,
            y2: 0.0,
        }
    }

    fn reset(&mut self) {
        self.x1 = 0.0;
        self.x2 = 0.0;
        self.y1 = 0.0;
        self.y2 = 0.0;
    }

    fn process(&mut self, x: f64) -> f64 {
        let y = self.b0 * x + self.b1 * self.x1 + self.b2 * self.x2
            - self.a1 * self.y1
            - self.a2 * self.y2;
        self.x2 = self.x1;
        self.x1 = x;
        self.y2 = self.y1;
        self.y1 = y;
        y
    }

    /// Stage 1: High-shelf filter for K-weighting
    /// Designed from the analog prototype specified in ITU-R BS.1770-4
    fn k_weight_stage1(sample_rate: u32) -> Self {
        let sr = sample_rate as f64;
        // Pre-computed for 48kHz from the standard
        if sample_rate == 48000 {
            return Self::new(
                1.53512485958697,
                -2.69169618940638,
                1.19839281085285,
                -1.69065929318241,
                0.73248077421585,
            );
        }
        if sample_rate == 44100 {
            return Self::new(
                1.5308412300498355,
                -2.6509799951547297,
                1.1690790799210947,
                -1.6636551132560204,
                0.7125954280732254,
            );
        }
        // Generic bilinear transform for other rates
        // High shelf: fc=1681.97Hz, gain=+3.9998dB, Q=0.7072
        let fc = 1681.974450955533;
        let g = 10.0_f64.powf(3.999843853973347 / 40.0); // sqrt of linear gain
        let w0 = 2.0 * std::f64::consts::PI * fc / sr;
        let alpha = w0.sin() / (2.0 * 0.7071752369554196);

        let a0 = (g + 1.0) - (g - 1.0) * w0.cos() + 2.0 * alpha * g.sqrt();
        let a1_raw = 2.0 * ((g - 1.0) - (g + 1.0) * w0.cos());
        let a2_raw = (g + 1.0) - (g - 1.0) * w0.cos() - 2.0 * alpha * g.sqrt();
        let b0_raw = g * ((g + 1.0) + (g - 1.0) * w0.cos() + 2.0 * alpha * g.sqrt());
        let b1_raw = -2.0 * g * ((g - 1.0) + (g + 1.0) * w0.cos());
        let b2_raw = g * ((g + 1.0) + (g - 1.0) * w0.cos() - 2.0 * alpha * g.sqrt());

        Self::new(
            b0_raw / a0,
            b1_raw / a0,
            b2_raw / a0,
            a1_raw / a0,
            a2_raw / a0,
        )
    }

    /// Stage 2: High-pass filter for K-weighting
    fn k_weight_stage2(sample_rate: u32) -> Self {
        let sr = sample_rate as f64;
        if sample_rate == 48000 {
            return Self::new(
                1.0,
                -2.0,
                1.0,
                -1.99004745483398,
                0.99007225036621,
            );
        }
        if sample_rate == 44100 {
            return Self::new(
                1.0,
                -2.0,
                1.0,
                -1.9891696736297957,
                0.9891990357870394,
            );
        }
        // Generic 2nd-order high-pass
        let fc = 38.13547087602444;
        let q = 0.5003270373238773;
        let w0 = 2.0 * std::f64::consts::PI * fc / sr;
        let alpha = w0.sin() / (2.0 * q);

        let a0 = 1.0 + alpha;
        let cos_w0 = w0.cos();
        Self::new(
            (1.0 + cos_w0) / (2.0 * a0),
            -(1.0 + cos_w0) / a0,
            (1.0 + cos_w0) / (2.0 * a0),
            -2.0 * cos_w0 / a0,
            (1.0 - alpha) / a0,
        )
    }
}

/// Decode an audio file and compute full analysis.
pub fn analyze_audio_file(file_path: &str) -> Result<AudioAnalysis, String> {
    let path = Path::new(file_path);
    if !path.exists() {
        return Err(format!("Audio file not found: {}", file_path));
    }

    let file = std::fs::File::open(file_path)
        .map_err(|e| format!("Failed to open audio file: {}", e))?;

    let mss = MediaSourceStream::new(Box::new(file), Default::default());
    let mut hint = Hint::new();
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        hint.with_extension(ext);
    }

    let probed = symphonia::default::get_probe()
        .format(
            &hint,
            mss,
            &FormatOptions::default(),
            &MetadataOptions::default(),
        )
        .map_err(|e| format!("Failed to probe audio: {}", e))?;

    let mut format_reader = probed.format;
    let track = format_reader
        .default_track()
        .ok_or("No audio track found")?
        .clone();

    let sample_rate = track.codec_params.sample_rate.unwrap_or(44100);
    let channels = track
        .codec_params
        .channels
        .map(|c| c.count() as u16)
        .unwrap_or(2);

    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &DecoderOptions::default())
        .map_err(|e| format!("Failed to create decoder: {}", e))?;

    // Collect all interleaved samples
    let mut all_samples: Vec<f32> = Vec::new();

    loop {
        let packet = match format_reader.next_packet() {
            Ok(p) => p,
            Err(symphonia::core::errors::Error::IoError(ref e))
                if e.kind() == std::io::ErrorKind::UnexpectedEof =>
            {
                break
            }
            Err(_) => break,
        };
        if packet.track_id() != track.id {
            continue;
        }

        match decoder.decode(&packet) {
            Ok(decoded) => {
                let num_frames = decoded.frames();
                let mut sample_buf = symphonia::core::audio::SampleBuffer::<f32>::new(
                    num_frames as u64,
                    *decoded.spec(),
                );
                sample_buf.copy_interleaved_ref(decoded);
                all_samples.extend_from_slice(sample_buf.samples());
            }
            Err(symphonia::core::errors::Error::DecodeError(_)) => continue,
            Err(_) => break,
        }
    }

    if all_samples.is_empty() {
        return Err("No audio samples decoded".to_string());
    }

    let ch = channels as usize;
    let total_frames = all_samples.len() / ch;
    let duration_secs = total_frames as f64 / sample_rate as f64;

    // ── Overall peak and RMS ──
    let mut overall_peak: f32 = 0.0;
    let mut overall_sum_sq: f64 = 0.0;
    for &s in &all_samples {
        let abs = s.abs();
        if abs > overall_peak {
            overall_peak = abs;
        }
        overall_sum_sq += (s as f64) * (s as f64);
    }
    let overall_rms = (overall_sum_sq / all_samples.len() as f64).sqrt();
    let peak_db = if overall_peak > 0.0 {
        20.0 * (overall_peak as f64).log10()
    } else {
        -120.0
    };
    let rms_db = if overall_rms > 0.0 {
        20.0 * overall_rms.log10()
    } else {
        -120.0
    };

    // ── Per-frame loudness (100ms windows, 50ms hop) ──
    let window_size_ms: u32 = 100;
    let hop_size_ms: u32 = 50;
    let window_frames = (sample_rate as usize * window_size_ms as usize) / 1000;
    let hop_frames = (sample_rate as usize * hop_size_ms as usize) / 1000;

    let mut frames = Vec::new();
    let mut pos = 0usize;
    while pos + window_frames <= total_frames {
        let mut win_peak: f32 = 0.0;
        let mut win_sum_sq: f64 = 0.0;
        let mut win_count = 0usize;

        for f in pos..pos + window_frames {
            for c in 0..ch {
                let idx = f * ch + c;
                if idx < all_samples.len() {
                    let s = all_samples[idx];
                    let abs = s.abs();
                    if abs > win_peak {
                        win_peak = abs;
                    }
                    win_sum_sq += (s as f64) * (s as f64);
                    win_count += 1;
                }
            }
        }

        let win_rms = if win_count > 0 {
            (win_sum_sq / win_count as f64).sqrt()
        } else {
            0.0
        };

        let frame_peak_db = if win_peak > 0.0 {
            20.0 * (win_peak as f64).log10()
        } else {
            -120.0
        };
        let frame_rms_db = if win_rms > 0.0 {
            20.0 * win_rms.log10()
        } else {
            -120.0
        };

        let time = pos as f64 / sample_rate as f64;
        frames.push(LoudnessFrame {
            time,
            rms_db: (frame_rms_db * 10.0).round() / 10.0, // round to 1 decimal
            peak_db: (frame_peak_db * 10.0).round() / 10.0,
        });

        pos += hop_frames;
    }

    // ── Integrated LUFS (ITU-R BS.1770 K-weighting + gating) ──
    let lufs_integrated = compute_lufs(&all_samples, sample_rate, ch);

    Ok(AudioAnalysis {
        sample_rate,
        channels,
        duration_secs,
        window_size_ms,
        hop_size_ms,
        frames,
        peak_db: (peak_db * 10.0).round() / 10.0,
        rms_db: (rms_db * 10.0).round() / 10.0,
        lufs_integrated: (lufs_integrated * 10.0).round() / 10.0,
    })
}

/// Compute integrated LUFS per ITU-R BS.1770-4 with K-weighting and gating.
fn compute_lufs(samples: &[f32], sample_rate: u32, channels: usize) -> f64 {
    let total_frames = samples.len() / channels;
    if total_frames == 0 {
        return -120.0;
    }

    // Apply K-weighting to each channel separately
    let mut k_weighted: Vec<Vec<f64>> = Vec::with_capacity(channels);
    for ch in 0..channels {
        let mut stage1 = Biquad::k_weight_stage1(sample_rate);
        let mut stage2 = Biquad::k_weight_stage2(sample_rate);
        let mut filtered = Vec::with_capacity(total_frames);

        for f in 0..total_frames {
            let s = samples[f * channels + ch] as f64;
            let s1 = stage1.process(s);
            let s2 = stage2.process(s1);
            filtered.push(s2);
        }
        k_weighted.push(filtered);
    }

    // Compute momentary loudness in 400ms overlapping blocks (step = 100ms = 75% overlap per EBU)
    let block_size = (sample_rate as usize * 400) / 1000; // 400ms
    let step_size = (sample_rate as usize * 100) / 1000; // 100ms step
    if block_size == 0 || total_frames < block_size {
        // File too short for proper LUFS, compute simple
        let mut sum = 0.0f64;
        for f in 0..total_frames {
            for ch in 0..channels {
                let s = k_weighted[ch][f];
                sum += s * s;
            }
        }
        let mean = sum / (total_frames as f64 * channels as f64);
        return if mean > 0.0 {
            -0.691 + 10.0 * mean.log10()
        } else {
            -120.0
        };
    }

    // Channel weight: 1.0 for L/R (channels 0,1), 1.41 for surround (channels 4,5)
    let channel_weights: Vec<f64> = (0..channels)
        .map(|ch| if ch >= 4 { 1.41 } else { 1.0 })
        .collect();

    // Compute momentary loudness per block
    let mut block_loudness: Vec<f64> = Vec::new();
    let mut pos = 0usize;
    while pos + block_size <= total_frames {
        let mut sum = 0.0f64;
        for ch in 0..channels {
            let mut ch_sum = 0.0f64;
            for f in pos..pos + block_size {
                let s = k_weighted[ch][f];
                ch_sum += s * s;
            }
            sum += channel_weights[ch] * (ch_sum / block_size as f64);
        }
        block_loudness.push(sum);
        pos += step_size;
    }

    // Absolute gating threshold: -70 LUFS
    let abs_threshold_power = 10.0_f64.powf((-70.0 + 0.691) / 10.0);
    let ungated: Vec<f64> = block_loudness
        .iter()
        .copied()
        .filter(|&l| l > abs_threshold_power)
        .collect();

    if ungated.is_empty() {
        return -70.0;
    }

    // Relative threshold: -10 dB below ungated mean
    let ungated_mean = ungated.iter().sum::<f64>() / ungated.len() as f64;
    let rel_threshold = ungated_mean * 10.0_f64.powf(-10.0 / 10.0); // -10 dB

    // Final gating
    let gated: Vec<f64> = block_loudness
        .iter()
        .copied()
        .filter(|&l| l > abs_threshold_power && l > rel_threshold)
        .collect();

    if gated.is_empty() {
        return -70.0;
    }

    let gated_mean = gated.iter().sum::<f64>() / gated.len() as f64;
    if gated_mean > 0.0 {
        -0.691 + 10.0 * gated_mean.log10()
    } else {
        -120.0
    }
}

/// Save analysis to a JSON sidecar file next to the audio file.
pub fn save_analysis_sidecar(
    audio_path: &str,
    analysis: &AudioAnalysis,
) -> Result<String, String> {
    let analysis_path = format!("{}.analysis.json", audio_path);
    let json = serde_json::to_string(analysis)
        .map_err(|e| format!("Failed to serialize analysis: {}", e))?;
    std::fs::write(&analysis_path, json)
        .map_err(|e| format!("Failed to write analysis file: {}", e))?;
    Ok(analysis_path)
}
