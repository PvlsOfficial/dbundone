use std::path::PathBuf;

/// Handles buffering audio samples and writing them to a WAV file.
/// Includes tail silence detection to avoid excessively long recordings.
pub struct AudioRecorder {
    /// Buffered samples waiting to be written (interleaved)
    buffer: Vec<f32>,
    /// Whether we're currently recording
    is_recording: bool,
    /// Output file path
    output_path: Option<PathBuf>,
    /// Sample rate of the current recording
    sample_rate: u32,
    /// Number of channels
    channels: u16,
    /// Total samples recorded (for duration calculation)
    total_samples: usize,
    /// Tail silence detection: consecutive silent samples count
    silent_samples: usize,
    /// Whether the tail was auto-trimmed
    pub was_tail_trimmed: bool,
    /// Running peak (absolute max sample)
    peak: f32,
    /// Running sum-of-squares for RMS
    sum_sq: f64,
    /// Number of mono frames counted for RMS
    rms_frames: u64,
}

/// Settings for tail silence detection
#[derive(Clone)]
pub struct TailSettings {
    /// Threshold in linear amplitude below which audio is considered "silent"
    pub threshold: f32,
    /// Maximum tail length in seconds before auto-trimming
    pub max_tail_secs: f32,
    /// Whether tail trimming is enabled
    pub enabled: bool,
}

impl Default for TailSettings {
    fn default() -> Self {
        Self {
            threshold: 0.001, // ~-60 dB
            max_tail_secs: 10.0,
            enabled: true,
        }
    }
}

impl AudioRecorder {
    pub fn new() -> Self {
        Self {
            buffer: Vec::with_capacity(1024 * 1024), // Pre-allocate 1M samples (~23s stereo at 44.1k)
            is_recording: false,
            output_path: None,
            sample_rate: 44100,
            channels: 2,
            total_samples: 0,
            silent_samples: 0,
            was_tail_trimmed: false,
            peak: 0.0,
            sum_sq: 0.0,
            rms_frames: 0,
        }
    }

    pub fn sample_rate(&self) -> u32 {
        self.sample_rate
    }

    pub fn channels(&self) -> u16 {
        self.channels
    }

    /// Start a new recording session
    pub fn start(&mut self, sample_rate: u32, channels: u16) {
        self.buffer.clear();
        self.sample_rate = sample_rate;
        self.channels = channels;
        self.total_samples = 0;
        self.silent_samples = 0;
        self.was_tail_trimmed = false;
        self.peak = 0.0;
        self.sum_sq = 0.0;
        self.rms_frames = 0;
        self.is_recording = true;

        // Generate a unique output path in the system temp directory
        let filename = format!("dbundone_recording_{}.wav", uuid::Uuid::new_v4());
        let temp_dir = std::env::temp_dir().join("dbundone-vst");
        std::fs::create_dir_all(&temp_dir).ok();
        self.output_path = Some(temp_dir.join(filename));
    }

    /// Push interleaved audio samples into the buffer.
    /// This is called from the audio thread and must be fast.
    /// Returns true if the tail limit was exceeded (caller should stop recording).
    pub fn push_samples(&mut self, samples: &[f32], tail_settings: &TailSettings) -> bool {
        if !self.is_recording {
            return false;
        }

        self.buffer.extend_from_slice(samples);
        self.total_samples += samples.len();

        // Track peak and RMS per mono frame
        let ch = self.channels.max(1) as usize;
        for frame in samples.chunks(ch) {
            let mut frame_peak: f32 = 0.0;
            let mut frame_sum: f64 = 0.0;
            for &s in frame {
                let a = s.abs();
                if a > frame_peak { frame_peak = a; }
                frame_sum += (s as f64) * (s as f64);
            }
            if frame_peak > self.peak { self.peak = frame_peak; }
            self.sum_sq += frame_sum / ch as f64;
            self.rms_frames += 1;
        }

        // Tail silence detection
        if tail_settings.enabled && self.channels > 0 {
            let max_sample = samples.iter().map(|s| s.abs()).fold(0.0f32, f32::max);
            if max_sample < tail_settings.threshold {
                self.silent_samples += samples.len() / self.channels as usize;
            } else {
                self.silent_samples = 0;
            }

            let max_tail_samples = (tail_settings.max_tail_secs * self.sample_rate as f32) as usize;
            if self.silent_samples >= max_tail_samples {
                return true; // Signal caller to stop recording
            }
        }

        false
    }

    /// Stop recording and write the WAV file.
    /// If tail_trim is requested, trims trailing silence from the buffer.
    /// Returns the file path if successful.
    pub fn stop(&mut self, tail_settings: &TailSettings) -> Option<String> {
        if !self.is_recording {
            return None;
        }
        self.is_recording = false;

        let path = self.output_path.take()?;

        if self.buffer.is_empty() {
            return None;
        }

        // Trim trailing silence if enabled and there's significant silence
        if tail_settings.enabled && self.channels > 0 {
            let ch = self.channels as usize;
            let min_tail_samples = (1.0 * self.sample_rate as f32) as usize; // Keep at least 1s of tail
            let mut last_loud_frame = self.buffer.len() / ch;

            // Walk backwards to find the last frame above threshold
            for frame_idx in (0..self.buffer.len() / ch).rev() {
                let frame_start = frame_idx * ch;
                let mut frame_peak = 0.0f32;
                for c in 0..ch {
                    if frame_start + c < self.buffer.len() {
                        frame_peak = frame_peak.max(self.buffer[frame_start + c].abs());
                    }
                }
                if frame_peak >= tail_settings.threshold {
                    last_loud_frame = frame_idx;
                    break;
                }
            }

            // Add the minimum tail after the last loud frame
            let trim_to_frame = (last_loud_frame + min_tail_samples).min(self.buffer.len() / ch);
            let trim_to_sample = trim_to_frame * ch;

            if trim_to_sample < self.buffer.len() {
                let removed = self.buffer.len() - trim_to_sample;
                self.buffer.truncate(trim_to_sample);
                if removed > ch * self.sample_rate as usize {
                    // Only mark as trimmed if we removed more than 1 second
                    self.was_tail_trimmed = true;
                }
            }
        }

        // Write the WAV file
        let spec = hound::WavSpec {
            channels: self.channels,
            sample_rate: self.sample_rate,
            bits_per_sample: 32,
            sample_format: hound::SampleFormat::Float,
        };

        match hound::WavWriter::create(&path, spec) {
            Ok(mut writer) => {
                for &sample in &self.buffer {
                    if writer.write_sample(sample).is_err() {
                        break;
                    }
                }
                if writer.finalize().is_ok() {
                    let path_str = path.to_string_lossy().to_string();
                    self.buffer.clear();
                    return Some(path_str);
                }
            }
            Err(e) => {
                eprintln!("Failed to create WAV writer: {}", e);
            }
        }

        self.buffer.clear();
        None
    }

    /// Get the current recording duration in seconds
    pub fn duration_secs(&self) -> f64 {
        if self.sample_rate == 0 || self.channels == 0 {
            return 0.0;
        }
        self.total_samples as f64 / (self.sample_rate as f64 * self.channels as f64)
    }

    /// Peak level in dBFS
    pub fn peak_db(&self) -> f64 {
        if self.peak > 0.0 {
            20.0 * (self.peak as f64).log10()
        } else {
            -120.0
        }
    }

    /// RMS level in dBFS
    pub fn rms_db(&self) -> f64 {
        if self.rms_frames > 0 {
            let rms = (self.sum_sq / self.rms_frames as f64).sqrt();
            if rms > 0.0 {
                20.0 * rms.log10()
            } else {
                -120.0
            }
        } else {
            -120.0
        }
    }
}
