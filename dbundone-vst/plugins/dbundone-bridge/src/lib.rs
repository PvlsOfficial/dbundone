mod protocol;
mod recorder;
mod ws_client;

use nih_plug::prelude::*;
use nih_plug_egui::{create_egui_editor, egui, EguiState};
use parking_lot::Mutex;
use std::sync::atomic::{AtomicBool, AtomicU8, Ordering};
use std::sync::Arc;

/// The main VST3 plugin struct
pub struct DbundonePlugin {
    params: Arc<DbundoneParams>,
    /// Audio recorder handling disk I/O on a background thread
    recorder: Arc<Mutex<recorder::AudioRecorder>>,
    /// WebSocket client for communicating with the DBundone app
    ws_client: Arc<Mutex<ws_client::WsClient>>,
    /// Current sample rate (set in initialize())
    sample_rate: Arc<atomic_float::AtomicF32>,
    /// Number of channels
    num_channels: Arc<AtomicU8>,
    /// Is recording active
    is_recording: Arc<AtomicBool>,
    /// Is auto-record armed (follows DAW transport)
    auto_record: Arc<AtomicBool>,
    /// Capture offline renders automatically
    capture_offline_renders: Arc<AtomicBool>,
    /// Was the DAW playing on the previous process() call
    was_playing: bool,
    /// Tracks whether we're in an offline/non-realtime render
    is_offline_rendering: Arc<AtomicBool>,
    /// Peak meter values (left, right) for the UI
    peak_left: Arc<atomic_float::AtomicF32>,
    peak_right: Arc<atomic_float::AtomicF32>,
    /// Recording duration in seconds
    recording_duration: Arc<atomic_float::AtomicF32>,
    /// Connected project info for the UI
    linked_project: Arc<Mutex<Option<protocol::ProjectInfo>>>,
    /// Connection status
    is_connected: Arc<AtomicBool>,
    /// Whether the ws loop thread has already been spawned
    ws_thread_spawned: bool,
    /// Signal the WS thread to shut down when the plugin is dropped
    shutdown: Arc<AtomicBool>,
    /// Source of the current recording ("manual", "auto", "offline")
    recording_source: Arc<Mutex<String>>,
    /// User-supplied name for manual recordings (set via UI text input)
    manual_sample_name: Arc<Mutex<String>>,
    /// Project list received from server (for plugin UI browsing)
    project_list: Arc<Mutex<Vec<protocol::ProjectInfo>>>,
    /// Tasks for the linked project
    plugin_tasks: Arc<Mutex<Vec<protocol::TaskInfo>>>,
    /// Pending MIDI CC to send from process(): 0 = none, 1 = rec start, 2 = rec stop
    pending_midi_cc: Arc<std::sync::atomic::AtomicU8>,
}

/// Plugin parameters exposed to the DAW
#[derive(Params)]
pub struct DbundoneParams {
    /// Editor state (window size/position)
    #[persist = "editor-state"]
    editor_state: Arc<EguiState>,

    /// Stable plugin identity that survives DAW project save/load.
    /// This lets the server recognize us across sessions.
    #[persist = "plugin-id"]
    pub plugin_id: Arc<Mutex<String>>,

    /// The last project we were linked to. On reconnect the server
    /// will auto-relink us to this project if it still exists.
    #[persist = "last-project-id"]
    pub last_project_id: Arc<Mutex<Option<String>>>,

    /// Input gain in dB
    #[id = "gain"]
    pub gain: FloatParam,

    /// Monitor (pass-through) toggle
    #[id = "monitor"]
    pub monitor: BoolParam,
}

impl Default for DbundonePlugin {
    fn default() -> Self {
        let recorder = Arc::new(Mutex::new(recorder::AudioRecorder::new()));
        let ws_client = Arc::new(Mutex::new(ws_client::WsClient::new()));

        Self {
            params: Arc::new(DbundoneParams::default()),
            recorder,
            ws_client,
            sample_rate: Arc::new(atomic_float::AtomicF32::new(44100.0)),
            num_channels: Arc::new(AtomicU8::new(2)),
            is_recording: Arc::new(AtomicBool::new(false)),
            auto_record: Arc::new(AtomicBool::new(false)),
            capture_offline_renders: Arc::new(AtomicBool::new(false)),
            was_playing: false,
            is_offline_rendering: Arc::new(AtomicBool::new(false)),
            peak_left: Arc::new(atomic_float::AtomicF32::new(0.0)),
            peak_right: Arc::new(atomic_float::AtomicF32::new(0.0)),
            recording_duration: Arc::new(atomic_float::AtomicF32::new(0.0)),
            linked_project: Arc::new(Mutex::new(None)),
            is_connected: Arc::new(AtomicBool::new(false)),
            ws_thread_spawned: false,
            shutdown: Arc::new(AtomicBool::new(false)),
            recording_source: Arc::new(Mutex::new("manual".to_string())),
            manual_sample_name: Arc::new(Mutex::new(String::new())),
            project_list: Arc::new(Mutex::new(Vec::new())),
            plugin_tasks: Arc::new(Mutex::new(Vec::new())),
            pending_midi_cc: Arc::new(std::sync::atomic::AtomicU8::new(0)),
        }
    }
}

impl Default for DbundoneParams {
    fn default() -> Self {
        Self {
            editor_state: EguiState::from_size(420, 480),
            plugin_id: Arc::new(Mutex::new(uuid::Uuid::new_v4().to_string())),
            last_project_id: Arc::new(Mutex::new(None)),

            gain: FloatParam::new(
                "Gain",
                util::db_to_gain(0.0),
                FloatRange::Skewed {
                    min: util::db_to_gain(-24.0),
                    max: util::db_to_gain(24.0),
                    factor: FloatRange::gain_skew_factor(-24.0, 24.0),
                },
            )
            .with_smoother(SmoothingStyle::Logarithmic(50.0))
            .with_unit(" dB")
            .with_value_to_string(formatters::v2s_f32_gain_to_db(2))
            .with_string_to_value(formatters::s2v_f32_gain_to_db()),

            monitor: BoolParam::new("Monitor", true),
        }
    }
}

impl Plugin for DbundonePlugin {
    const NAME: &'static str = "DBundone Bridge";
    const VENDOR: &'static str = "DBundone";
    const URL: &'static str = "https://github.com/pvls/dbundone";
    const EMAIL: &'static str = "";
    const VERSION: &'static str = env!("CARGO_PKG_VERSION");

    const AUDIO_IO_LAYOUTS: &'static [AudioIOLayout] = &[
        // Stereo
        AudioIOLayout {
            main_input_channels: NonZeroU32::new(2),
            main_output_channels: NonZeroU32::new(2),
            ..AudioIOLayout::const_default()
        },
        // Mono
        AudioIOLayout {
            main_input_channels: NonZeroU32::new(1),
            main_output_channels: NonZeroU32::new(1),
            ..AudioIOLayout::const_default()
        },
    ];

    const MIDI_OUTPUT: MidiConfig = MidiConfig::MidiCCs;
    const SAMPLE_ACCURATE_AUTOMATION: bool = true;
    type SysExMessage = ();
    type BackgroundTask = ();

    fn params(&self) -> Arc<dyn Params> {
        self.params.clone()
    }

    fn editor(&mut self, _async_executor: AsyncExecutor<Self>) -> Option<Box<dyn Editor>> {
        let params = self.params.clone();
        let peak_left = self.peak_left.clone();
        let peak_right = self.peak_right.clone();
        let is_recording = self.is_recording.clone();
        let auto_record = self.auto_record.clone();
        let capture_offline = self.capture_offline_renders.clone();
        let recording_duration = self.recording_duration.clone();
        let linked_project = self.linked_project.clone();
        let is_connected = self.is_connected.clone();
        let recorder = self.recorder.clone();
        let ws_client = self.ws_client.clone();
        let sample_rate = self.sample_rate.clone();
        let num_channels = self.num_channels.clone();
        let recording_source = self.recording_source.clone();
        let manual_sample_name = self.manual_sample_name.clone();
        let is_offline_rendering = self.is_offline_rendering.clone();
        let pending_midi_cc = self.pending_midi_cc.clone();

        create_egui_editor(
            self.params.editor_state.clone(),
            (),
            |_, _| {},
            move |egui_ctx, setter, _state| {
                draw_ui(
                    egui_ctx,
                    setter,
                    &params,
                    &peak_left,
                    &peak_right,
                    &is_recording,
                    &auto_record,
                    &capture_offline,
                    &recording_duration,
                    &linked_project,
                    &is_connected,
                    &recorder,
                    &ws_client,
                    &sample_rate,
                    &num_channels,
                    &recording_source,
                    &manual_sample_name,
                    &is_offline_rendering,
                    &pending_midi_cc,
                );
            },
        )
    }

    fn initialize(
        &mut self,
        audio_io_layout: &AudioIOLayout,
        buffer_config: &BufferConfig,
        _context: &mut impl InitContext<Self>,
    ) -> bool {
        let sr = buffer_config.sample_rate;
        let channels = audio_io_layout
            .main_input_channels
            .map(|c| c.get() as u8)
            .unwrap_or(2);

        self.sample_rate.store(sr as f32, Ordering::Relaxed);
        self.num_channels.store(channels, Ordering::Relaxed);

        // Detect offline/non-realtime rendering from the buffer config.
        // process_mode == Offline means the DAW is doing a bounce/export.
        let offline = matches!(buffer_config.process_mode, ProcessMode::Offline);
        self.is_offline_rendering.store(offline, Ordering::Relaxed);

        // Only spawn the WebSocket loop thread once per plugin instance.
        // DAWs may call initialize() multiple times (e.g. when changing
        // sample rate or I/O layout), so guard against duplicate threads.
        if !self.ws_thread_spawned {
            self.ws_thread_spawned = true;

            let ws = self.ws_client.clone();
            let connected = self.is_connected.clone();
            let project = self.linked_project.clone();
            let rec = self.is_recording.clone();
            let rec_clone = self.recorder.clone();
            let sr_clone = self.sample_rate.clone();
            let ch_clone = self.num_channels.clone();
            let plugin_id = self.params.plugin_id.lock().clone();
            let last_project_id = self.params.last_project_id.clone();
            let shutdown = self.shutdown.clone();
            let proj_list = self.project_list.clone();
            let tasks = self.plugin_tasks.clone();

            std::thread::spawn(move || {
                ws_client::run_ws_loop(
                    ws,
                    connected,
                    project,
                    rec,
                    rec_clone,
                    sr_clone,
                    ch_clone,
                    plugin_id,
                    last_project_id,
                    proj_list,
                    tasks,
                    shutdown,
                );
            });
        }

        true
    }

    fn process(
        &mut self,
        buffer: &mut Buffer,
        _aux: &mut AuxiliaryBuffers,
        context: &mut impl ProcessContext<Self>,
    ) -> ProcessStatus {
        // Send pending MIDI CC (recording start/stop notification)
        let cc_flag = self.pending_midi_cc.swap(0, Ordering::Relaxed);
        if cc_flag == 1 {
            // Recording started: CC 119 value 127
            context.send_event(NoteEvent::MidiCC {
                timing: 0,
                channel: 0,
                cc: 119,
                value: 1.0,
            });
        } else if cc_flag == 2 {
            // Recording stopped: CC 119 value 0
            context.send_event(NoteEvent::MidiCC {
                timing: 0,
                channel: 0,
                cc: 119,
                value: 0.0,
            });
        }

        let transport = context.transport();
        let is_playing = transport.playing;

        // Detect offline (non-realtime) rendering.
        // nih-plug exposes `context.transport()` which has no direct offline flag,
        // but the BufferConfig set in initialize() does. We detect offline rendering
        // heuristically: if process_mode was set to Offline in initialize we track it,
        // AND/OR we detect that the DAW jumps from not-playing to playing with a
        // non-zero sample position (bounce from start). For a simpler approach we
        // use the process_mode stored from initialize.
        let is_offline = self.is_offline_rendering.load(Ordering::Relaxed);

        // Capture offline renders: start when an offline render begins playing,
        // stop when it stops.
        if self.capture_offline_renders.load(Ordering::Relaxed) && is_offline {
            if is_playing && !self.was_playing {
                if !self.is_recording.load(Ordering::Relaxed) {
                    *self.recording_source.lock() = "offline".to_string();
                    self.start_recording();
                }
            } else if !is_playing && self.was_playing {
                if self.is_recording.load(Ordering::Relaxed) {
                    self.stop_recording();
                }
            }
        }

        // Auto-record: start when DAW starts playing, stop when it stops
        // (only in realtime mode, not during offline renders)
        if self.auto_record.load(Ordering::Relaxed) && !is_offline {
            if is_playing && !self.was_playing {
                // DAW just started playing -- start recording
                if !self.is_recording.load(Ordering::Relaxed) {
                    *self.recording_source.lock() = "auto".to_string();
                    self.start_recording();
                }
            } else if !is_playing && self.was_playing {
                // DAW just stopped -- stop recording
                if self.is_recording.load(Ordering::Relaxed) {
                    self.stop_recording();
                }
            }
        }
        self.was_playing = is_playing;

        // Process audio
        let gain = self.params.gain.smoothed.next();
        let monitor = self.params.monitor.value();
        let recording = self.is_recording.load(Ordering::Relaxed);

        let num_samples = buffer.samples();
        let num_channels = buffer.channels();

        // Track peak levels for the UI meter
        let mut peak_l: f32 = 0.0;
        let mut peak_r: f32 = 0.0;

        // Collect samples for recording (we need to do this before modifying the buffer)
        if recording {
            let mut interleaved = Vec::with_capacity(num_samples * num_channels);
            for sample_idx in 0..num_samples {
                for ch_idx in 0..num_channels {
                    let sample = *buffer.as_slice()[ch_idx].get(sample_idx).unwrap_or(&0.0) * gain;
                    interleaved.push(sample);
                }
            }

            // Send to the recorder's ring buffer (non-blocking)
            let mut rec = self.recorder.lock();
            let tail = recorder::TailSettings::default();
            let tail_exceeded = rec.push_samples(&interleaved, &tail);
            if tail_exceeded {
                // Tail silence limit reached — auto-stop
                drop(rec);
                self.stop_recording();
            }

            // Update recording duration
            let sr = self.sample_rate.load(Ordering::Relaxed);
            if sr > 0.0 {
                let current = self.recording_duration.load(Ordering::Relaxed);
                self.recording_duration
                    .store(current + (num_samples as f32 / sr), Ordering::Relaxed);
            }
        }

        // Apply gain and track peaks
        for (ch_idx, channel_samples) in buffer.iter_samples().enumerate() {
            for sample in channel_samples {
                *sample *= gain;
                let abs = sample.abs();
                match ch_idx {
                    0 => peak_l = peak_l.max(abs),
                    1 => peak_r = peak_r.max(abs),
                    _ => {}
                }
            }
        }

        // If not monitoring, silence the output (plugin acts as a tap, not an insert)
        if !monitor {
            for channel_samples in buffer.iter_samples() {
                for sample in channel_samples {
                    *sample = 0.0;
                }
            }
        }

        // Smooth peak meters (fast attack, slow release)
        let attack = 1.0;
        let release = 0.9995_f32.powi(num_samples as i32);

        let prev_l = self.peak_left.load(Ordering::Relaxed);
        let prev_r = self.peak_right.load(Ordering::Relaxed);

        self.peak_left.store(
            if peak_l > prev_l {
                peak_l * attack
            } else {
                prev_l * release
            },
            Ordering::Relaxed,
        );
        self.peak_right.store(
            if peak_r > prev_r {
                peak_r * attack
            } else {
                prev_r * release
            },
            Ordering::Relaxed,
        );

        ProcessStatus::Normal
    }
}

impl DbundonePlugin {
    fn start_recording(&self) {
        let sr = self.sample_rate.load(Ordering::Relaxed) as u32;
        let ch = self.num_channels.load(Ordering::Relaxed) as u16;

        let mut rec = self.recorder.lock();
        rec.start(sr, ch);
        self.is_recording.store(true, Ordering::Relaxed);
        self.recording_duration.store(0.0, Ordering::Relaxed);

        // Queue MIDI CC 119 value 127 (recording started)
        self.pending_midi_cc.store(1, Ordering::Relaxed);

        // Notify WebSocket
        let ws = self.ws_client.lock();
        ws.send_state_update(
            true,
            false,
            0.0,
            self.auto_record.load(Ordering::Relaxed),
            Some(self.capture_offline_renders.load(Ordering::Relaxed)),
        );
    }

    fn stop_recording(&self) {
        let mut rec = self.recorder.lock();
        let tail = recorder::TailSettings::default();
        if let Some(file_path) = rec.stop(&tail) {
            self.is_recording.store(false, Ordering::Relaxed);
            let duration = self.recording_duration.load(Ordering::Relaxed);

            // Queue MIDI CC 119 value 0 (recording stopped)
            self.pending_midi_cc.store(2, Ordering::Relaxed);

            // Determine the recording name based on source
            let source = self.recording_source.lock().clone();
            let name = match source.as_str() {
                "manual" => {
                    let user_name = self.manual_sample_name.lock().clone();
                    if user_name.trim().is_empty() {
                        format!(
                            "Recording {}",
                            chrono::Local::now().format("%Y-%m-%d %H:%M:%S")
                        )
                    } else {
                        user_name.trim().to_string()
                    }
                }
                "auto" => format!(
                    "Recording {}",
                    chrono::Local::now().format("%Y-%m-%d %H:%M:%S")
                ),
                "offline" => {
                    // Include project name if available
                    let proj = self.linked_project.lock();
                    if let Some(ref p) = *proj {
                        format!(
                            "Offline Render - {} {}",
                            p.title,
                            chrono::Local::now().format("%Y-%m-%d %H:%M")
                        )
                    } else {
                        format!(
                            "Offline Render {}",
                            chrono::Local::now().format("%Y-%m-%d %H:%M:%S")
                        )
                    }
                }
                _ => format!(
                    "Recording {}",
                    chrono::Local::now().format("%Y-%m-%d %H:%M:%S")
                ),
            };

            // Capture analysis data (peak/RMS are still valid after stop)
            let peak_db = rec.peak_db();
            let rms_db = rec.rms_db();

            // Notify the DBundone app about the completed recording
            let ws = self.ws_client.lock();
            ws.send_recording_complete(
                &file_path,
                &name,
                duration as f64,
                rec.sample_rate(),
                rec.channels(),
                Some(source.clone()),
                Some(peak_db),
                Some(rms_db),
            );
            ws.send_state_update(
                false,
                false,
                0.0,
                self.auto_record.load(Ordering::Relaxed),
                Some(self.capture_offline_renders.load(Ordering::Relaxed)),
            );
        }
    }
}

// ============================================================================
//  UI Drawing – Futuristic minimal interface
// ============================================================================

struct Theme {
    bg: egui::Color32,
    bg_surface: egui::Color32,
    bg_elevated: egui::Color32,
    border: egui::Color32,
    accent: egui::Color32,
    text: egui::Color32,
    text_secondary: egui::Color32,
    text_muted: egui::Color32,
    green: egui::Color32,
    red: egui::Color32,
    yellow: egui::Color32,
    cyan: egui::Color32,
}

impl Theme {
    fn new() -> Self {
        Self {
            bg: egui::Color32::from_rgb(8, 8, 12),
            bg_surface: egui::Color32::from_rgb(16, 16, 20),
            bg_elevated: egui::Color32::from_rgb(26, 26, 32),
            border: egui::Color32::from_rgba_unmultiplied(255, 255, 255, 10),
            accent: egui::Color32::from_rgb(99, 102, 241),
            text: egui::Color32::from_rgb(225, 225, 230),
            text_secondary: egui::Color32::from_rgb(110, 110, 120),
            text_muted: egui::Color32::from_rgb(55, 55, 65),
            green: egui::Color32::from_rgb(34, 197, 94),
            red: egui::Color32::from_rgb(239, 68, 68),
            yellow: egui::Color32::from_rgb(234, 179, 8),
            cyan: egui::Color32::from_rgb(6, 182, 212),
        }
    }

    fn status_color(&self, status: &str) -> egui::Color32 {
        match status {
            "idea" => egui::Color32::from_rgb(168, 85, 247),
            "in-progress" => egui::Color32::from_rgb(59, 130, 246),
            "mixing" => egui::Color32::from_rgb(249, 115, 22),
            "mastering" => egui::Color32::from_rgb(6, 182, 212),
            "completed" => self.green,
            "released" => egui::Color32::from_rgb(236, 72, 153),
            "archived" => egui::Color32::from_rgb(156, 163, 175),
            _ => self.accent,
        }
    }

    fn with_alpha(c: egui::Color32, a: u8) -> egui::Color32 {
        egui::Color32::from_rgba_unmultiplied(c.r(), c.g(), c.b(), a)
    }

    fn lerp_color(a: egui::Color32, b: egui::Color32, t: f32) -> egui::Color32 {
        let t = t.clamp(0.0, 1.0);
        egui::Color32::from_rgba_unmultiplied(
            (a.r() as f32 + (b.r() as f32 - a.r() as f32) * t) as u8,
            (a.g() as f32 + (b.g() as f32 - a.g() as f32) * t) as u8,
            (a.b() as f32 + (b.b() as f32 - a.b() as f32) * t) as u8,
            (a.a() as f32 + (b.a() as f32 - a.a() as f32) * t) as u8,
        )
    }
}

#[allow(clippy::too_many_arguments)]
fn draw_ui(
    ctx: &egui::Context,
    setter: &ParamSetter,
    params: &DbundoneParams,
    peak_left: &atomic_float::AtomicF32,
    peak_right: &atomic_float::AtomicF32,
    is_recording: &AtomicBool,
    auto_record: &AtomicBool,
    capture_offline: &AtomicBool,
    recording_duration: &atomic_float::AtomicF32,
    linked_project: &Mutex<Option<protocol::ProjectInfo>>,
    is_connected: &AtomicBool,
    recorder: &Mutex<recorder::AudioRecorder>,
    ws_client: &Mutex<ws_client::WsClient>,
    sample_rate: &atomic_float::AtomicF32,
    num_channels: &AtomicU8,
    recording_source: &Mutex<String>,
    manual_sample_name: &Mutex<String>,
    is_offline_rendering: &AtomicBool,
    pending_midi_cc: &std::sync::atomic::AtomicU8,
) {
    let t = Theme::new();
    let recording = is_recording.load(Ordering::Relaxed);
    let connected = is_connected.load(Ordering::Relaxed);
    let auto_rec = auto_record.load(Ordering::Relaxed);
    let offline_cap = capture_offline.load(Ordering::Relaxed);
    let duration = recording_duration.load(Ordering::Relaxed);
    let peak_l = peak_left.load(Ordering::Relaxed);
    let peak_r = peak_right.load(Ordering::Relaxed);
    let time = ctx.input(|i| i.time);
    let is_offline = is_offline_rendering.load(Ordering::Relaxed);

    // Global style
    let mut style = (*ctx.style()).clone();
    style.visuals.window_fill = t.bg;
    style.visuals.panel_fill = t.bg;
    style.visuals.widgets.inactive.bg_fill = t.bg_surface;
    style.visuals.widgets.inactive.weak_bg_fill = t.bg_surface;
    style.visuals.widgets.inactive.bg_stroke = egui::Stroke::new(0.0, t.border);
    style.visuals.widgets.hovered.bg_fill = t.bg_elevated;
    style.visuals.widgets.hovered.weak_bg_fill = t.bg_elevated;
    style.visuals.widgets.hovered.bg_stroke = egui::Stroke::new(0.0, t.border);
    style.visuals.widgets.active.bg_fill = t.accent;
    style.visuals.widgets.active.bg_stroke = egui::Stroke::new(0.0, t.accent);
    style.visuals.override_text_color = Some(t.text);
    style.visuals.selection.bg_fill = Theme::with_alpha(t.accent, 40);
    style.visuals.selection.stroke = egui::Stroke::new(1.0, t.accent);
    style.spacing.item_spacing = egui::vec2(6.0, 3.0);
    style.spacing.button_padding = egui::vec2(10.0, 5.0);
    style.visuals.widgets.inactive.corner_radius = egui::CornerRadius::same(8);
    style.visuals.widgets.hovered.corner_radius = egui::CornerRadius::same(8);
    style.visuals.widgets.active.corner_radius = egui::CornerRadius::same(8);
    style.visuals.widgets.noninteractive.corner_radius = egui::CornerRadius::same(8);
    ctx.set_style(style);

    egui::CentralPanel::default()
        .frame(egui::Frame::NONE.fill(t.bg).inner_margin(0.0))
        .show(ctx, |ui| {
            let panel_rect = ui.max_rect();
            let mx = 16.0;

            // ── Header ──
            let hdr_h = 32.0;
            let hdr_rect = egui::Rect::from_min_size(
                panel_rect.min,
                egui::vec2(panel_rect.width(), hdr_h),
            );
            ui.painter().rect_filled(hdr_rect, 0.0, t.bg_surface);

            ui.allocate_new_ui(
                egui::UiBuilder::new()
                    .max_rect(hdr_rect.shrink2(egui::vec2(mx, 0.0))),
                |ui| {
                    ui.horizontal_centered(|ui| {
                        let dot_color = if recording {
                            // Smooth pulsing recording dot
                            let s = ((time * 2.0).sin() * 0.5 + 0.5) as f32;
                            let pulse = s * s * (3.0 - 2.0 * s); // smoothstep
                            Theme::with_alpha(t.red, (pulse * 100.0 + 155.0) as u8)
                        } else if is_offline {
                            t.cyan
                        } else if connected {
                            t.green
                        } else {
                            t.text_muted
                        };
                        let (dot_r, _) = ui.allocate_exact_size(
                            egui::vec2(6.0, 6.0),
                            egui::Sense::hover(),
                        );
                        ui.painter()
                            .circle_filled(dot_r.center(), 3.0, dot_color);

                        ui.add_space(5.0);
                        ui.label(
                            egui::RichText::new("DBundone")
                                .size(11.0)
                                .color(t.text_secondary),
                        );

                        ui.with_layout(
                            egui::Layout::right_to_left(egui::Align::Center),
                            |ui| {
                                let (status_text, status_color) = if recording {
                                    let src = recording_source.lock().clone();
                                    let lbl = match src.as_str() {
                                        "offline" => "Rendering",
                                        "auto" => "Auto",
                                        _ => "Rec",
                                    };
                                    (lbl, t.red)
                                } else if connected {
                                    ("Online", t.green)
                                } else {
                                    ("Offline", t.text_muted)
                                };
                                ui.label(
                                    egui::RichText::new(status_text)
                                        .size(9.0)
                                        .color(status_color),
                                );
                            },
                        );
                    });
                },
            );

            // ── Content ──
            let content_rect = egui::Rect::from_min_max(
                egui::pos2(panel_rect.min.x + mx, hdr_rect.max.y + 10.0),
                egui::pos2(panel_rect.max.x - mx, panel_rect.max.y - 8.0),
            );

            ui.allocate_new_ui(
                egui::UiBuilder::new().max_rect(content_rect),
                |ui| {
                    ui.set_width(content_rect.width());

                    // Project info
                    draw_project_bar(ui, &t, linked_project, connected);
                    ui.add_space(6.0);

                    // Record hero
                    draw_record_hero(
                        ui,
                        ctx,
                        &t,
                        time,
                        recording,
                        duration,
                        connected,
                        linked_project,
                        is_recording,
                        recorder,
                        ws_client,
                        recording_duration,
                        sample_rate,
                        num_channels,
                        recording_source,
                        manual_sample_name,
                        auto_record,
                        capture_offline,
                        pending_midi_cc,
                    );

                    ui.add_space(8.0);

                    // Gain
                    draw_gain_control(ui, &t, setter, params);
                    ui.add_space(8.0);

                    // Toggles
                    draw_toggle_row(
                        ui, &t, setter, params, auto_rec, auto_record,
                        offline_cap, capture_offline, ws_client,
                    );
                    ui.add_space(8.0);

                    // Meters
                    draw_meters_compact(ui, &t, peak_l, peak_r);
                },
            );

            // Continuous repaint at ~60fps for smooth animations & meters
            ctx.request_repaint_after(std::time::Duration::from_millis(16));
        });
}

fn draw_project_bar(
    ui: &mut egui::Ui,
    t: &Theme,
    linked_project: &Mutex<Option<protocol::ProjectInfo>>,
    connected: bool,
) {
    let project = linked_project.lock();

    if let Some(ref proj) = *project {
        ui.horizontal(|ui| {
            ui.label(
                egui::RichText::new(&proj.title)
                    .size(12.0)
                    .color(t.text)
                    .strong(),
            );
            ui.with_layout(
                egui::Layout::right_to_left(egui::Align::Center),
                |ui| {
                    if proj.bpm > 0 {
                        ui.label(
                            egui::RichText::new(format!("{}", proj.bpm))
                                .size(10.0)
                                .color(t.text_muted)
                                .family(egui::FontFamily::Monospace),
                        );
                        ui.add_space(4.0);
                    }
                    if !proj.musical_key.is_empty() && proj.musical_key != "None" {
                        ui.label(
                            egui::RichText::new(&proj.musical_key)
                                .size(10.0)
                                .color(t.text_muted),
                        );
                    }
                },
            );
        });

        ui.horizontal(|ui| {
            let sc = t.status_color(&proj.status);
            let sl = match proj.status.as_str() {
                "in-progress" => "In Progress",
                "idea" => "Idea",
                "mixing" => "Mixing",
                "mastering" => "Mastering",
                "completed" => "Completed",
                "released" => "Released",
                "archived" => "Archived",
                o => o,
            };
            draw_pill(ui, sl, sc, 9.0);

            if let Some(ref col) = proj.collection_name {
                if !col.is_empty() {
                    ui.add_space(4.0);
                    ui.label(
                        egui::RichText::new(col)
                            .size(9.0)
                            .color(t.text_muted)
                            .italics(),
                    );
                }
            }
        });
    } else {
        ui.label(
            egui::RichText::new(if connected {
                "No project linked"
            } else {
                "Connecting\u{2026}"
            })
            .size(11.0)
            .color(t.text_muted),
        );
    }
}

// ============================================================================
//  Nebula shader helpers
// ============================================================================

fn smoothstep_f32(edge0: f32, edge1: f32, x: f32) -> f32 {
    let t = ((x - edge0) / (edge1 - edge0)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

/// Approximate FBM noise via layered trigonometric wave interference.
/// Produces organic, cloud-like values in the 0..1 range.
fn fbm_trig(x: f32, y: f32, time: f32) -> f32 {
    let mut val = 0.0f32;
    let mut amp = 0.5;
    let mut fx = x;
    let mut fy = y;
    for i in 0..5 {
        let phase = time * (0.12 + i as f32 * 0.04);
        let wave = (fx * 2.7 + phase).sin() * (fy * 3.1 - phase * 0.7).cos();
        val += amp * (wave * 0.5 + 0.5);
        // Domain rotation to break axis alignment
        let angle = 0.8 + i as f32 * 0.15;
        let (s, c) = angle.sin_cos();
        let nx = fx * c - fy * s;
        let ny = fx * s + fy * c;
        fx = nx * 2.0 + 1.7;
        fy = ny * 2.0 + 3.1;
        amp *= 0.5;
    }
    val.clamp(0.0, 1.0)
}

/// Draw an animated nebula background using a vertex-colored mesh grid.
/// Each vertex color is computed per-frame like a fragment shader, then the
/// GPU interpolates smoothly between vertices for a continuous gradient.
fn draw_nebula_background(
    painter: &egui::Painter,
    rect: egui::Rect,
    time: f64,
    recording: bool,
    intensity: f32,
) {
    let t = time as f32;
    let res: usize = 32;
    let mut mesh = egui::Mesh::default();

    // DBundone palette (linear 0..1) — base must match Theme::bg exactly (8,8,12)
    let base   = [8.0 / 255.0, 8.0 / 255.0, 12.0 / 255.0];
    let indigo = [0.39, 0.40, 0.95];
    let cyan   = [0.02, 0.71, 0.83];
    let pink   = [0.93, 0.28, 0.58];
    let violet = [0.55, 0.24, 0.79];

    for iy in 0..=res {
        for ix in 0..=res {
            let u = ix as f32 / res as f32;
            let v = iy as f32 / res as f32;
            let pos = egui::pos2(
                rect.min.x + u * rect.width(),
                rect.min.y + v * rect.height(),
            );

            // Centered normalised coords (-1..1)
            let cx = (u - 0.5) * 2.0;
            let cy = (v - 0.5) * 2.0;
            let r = (cx * cx + cy * cy).sqrt();
            let theta = cy.atan2(cx);

            // Three independent noise layers
            let n1 = fbm_trig(cx * 1.5, cy * 1.5, t * 0.3);
            let n2 = fbm_trig(cx * 2.0 + 7.0, cy * 2.0 + 7.0, t * 0.22 + 4.0);
            let n3 = fbm_trig(cx * 1.0 - 3.0, cy * 1.0 - 3.0, t * 0.18 + 9.0);

            let mut rgb = base;

            // Indigo nebula cloud — main body
            let indigo_m = n1 * smoothstep_f32(1.3, 0.15, r) * intensity;
            for c in 0..3 { rgb[c] += indigo[c] * indigo_m * 0.22; }

            // Cyan directional streaks
            let cyan_dir = smoothstep_f32(-0.2, 0.6, (theta * 2.0 + t * 0.08).sin());
            let cyan_m = n2 * cyan_dir * smoothstep_f32(1.1, 0.25, r) * intensity;
            for c in 0..3 { rgb[c] += cyan[c] * cyan_m * 0.15; }

            // Pink highlights at noise peaks
            let pink_m = (n3 - 0.52).max(0.0) * 3.0
                * smoothstep_f32(1.0, 0.1, r) * intensity;
            for c in 0..3 { rgb[c] += pink[c] * pink_m * 0.18; }

            // Violet depth layer
            let violet_m = (n1 * n2).sqrt() * smoothstep_f32(1.0, 0.35, r) * intensity;
            for c in 0..3 { rgb[c] += violet[c] * violet_m * 0.10; }

            // Radial breathing pulse
            let pulse_band = r - ((t * 0.35).sin() * 0.2 + 0.35);
            let pulse = smoothstep_f32(0.12, 0.0, pulse_band.abs()) * 0.06 * intensity;
            for c in 0..3 { rgb[c] += indigo[c] * pulse; }

            // Center glow — bright core
            let glow = smoothstep_f32(0.55, 0.0, r);
            let glow_v = glow * glow * 0.12 * intensity;
            for c in 0..3 { rgb[c] += indigo[c] * glow_v; }

            // Recording: warm red shift
            if recording {
                let rp = {
                    let s = (t * 1.8).sin() * 0.5 + 0.5;
                    s * s * (3.0 - 2.0 * s)
                };
                let warmth = rp * 0.35 * smoothstep_f32(1.2, 0.0, r);
                rgb[0] += warmth * 0.4;
                rgb[1] = (rgb[1] - warmth * 0.03).max(0.0);
                rgb[2] = (rgb[2] - warmth * 0.06).max(0.0);
            }

            // Vignette — fade edges completely to plugin bg
            let vig = smoothstep_f32(0.4, 1.0, r);
            let bg = [8.0 / 255.0f32, 8.0 / 255.0, 12.0 / 255.0];
            for c in 0..3 { rgb[c] = rgb[c] * (1.0 - vig) + bg[c] * vig; }

            let color = egui::Color32::from_rgb(
                (rgb[0].clamp(0.0, 1.0) * 255.0) as u8,
                (rgb[1].clamp(0.0, 1.0) * 255.0) as u8,
                (rgb[2].clamp(0.0, 1.0) * 255.0) as u8,
            );
            mesh.vertices.push(egui::epaint::Vertex {
                pos,
                uv: egui::epaint::WHITE_UV,
                color,
            });
        }
    }

    // Triangulate the quad grid
    let stride = (res + 1) as u32;
    for iy in 0..res as u32 {
        for ix in 0..res as u32 {
            let i = iy * stride + ix;
            mesh.indices.extend_from_slice(&[i, i + 1, i + stride]);
            mesh.indices.extend_from_slice(&[i + 1, i + 1 + stride, i + stride]);
        }
    }
    painter.add(egui::Shape::mesh(mesh));
}

#[allow(clippy::too_many_arguments)]
fn draw_record_hero(
    ui: &mut egui::Ui,
    ctx: &egui::Context,
    t: &Theme,
    time: f64,
    recording: bool,
    duration: f32,
    connected: bool,
    linked_project: &Mutex<Option<protocol::ProjectInfo>>,
    is_recording: &AtomicBool,
    recorder: &Mutex<recorder::AudioRecorder>,
    ws_client: &Mutex<ws_client::WsClient>,
    recording_duration: &atomic_float::AtomicF32,
    sample_rate: &atomic_float::AtomicF32,
    num_channels: &AtomicU8,
    recording_source: &Mutex<String>,
    manual_sample_name: &Mutex<String>,
    auto_record: &AtomicBool,
    capture_offline: &AtomicBool,
    pending_midi_cc: &std::sync::atomic::AtomicU8,
) {
    let has_project = linked_project.lock().is_some();
    let can_record = connected && has_project;

    let btn_r: f32 = 60.0;
    let nebula_pad: f32 = 58.0;
    let side = (btn_r + nebula_pad) * 2.0; // square nebula area

    // ── Button area — allocate full width but nebula is square & centered ──
    let avail_w = ui.available_width();
    let (area_rect, _) = ui.allocate_exact_size(
        egui::vec2(avail_w, side),
        egui::Sense::hover(),
    );
    let center = area_rect.center();
    let painter = ui.painter();

    // Square nebula rect, centered in the allocated area
    let nebula_rect = egui::Rect::from_center_size(center, egui::vec2(side, side));

    // Clickable region over the button
    let btn_sense_rect = egui::Rect::from_center_size(
        center,
        egui::vec2(btn_r * 2.0 + 8.0, btn_r * 2.0 + 8.0),
    );
    let btn_id = ui.id().with("rec_btn");
    let btn_resp = ui.interact(btn_sense_rect, btn_id, egui::Sense::click());
    let hovered = btn_resp.hovered() && (can_record || recording);

    // Smooth easing: cubic smoothstep for organic feel
    fn smooth_pulse(time: f64, freq: f64) -> f32 {
        let t = ((time * freq).sin() * 0.5 + 0.5) as f32;
        t * t * (3.0 - 2.0 * t)
    }

    // ── Animated nebula background (square, not stretched) ──
    let nebula_intensity = if recording {
        0.85 + smooth_pulse(time, 1.2) * 0.15
    } else if hovered {
        0.7
    } else if can_record {
        0.45 + smooth_pulse(time, 0.3) * 0.15
    } else {
        0.2
    };
    draw_nebula_background(painter, nebula_rect, time, recording, nebula_intensity);

    // ── Soft outer glow halo ──
    let halo_color = if recording { t.red } else { t.accent };
    let halo_a = if recording {
        smooth_pulse(time, 1.4) * 0.18 + 0.08
    } else if hovered {
        0.14
    } else if can_record {
        smooth_pulse(time, 0.4) * 0.06 + 0.03
    } else {
        0.0
    };
    if halo_a > 0.001 {
        for i in 0..6 {
            let t_n = i as f32 / 6.0;
            let r = btn_r + 4.0 + t_n * 18.0;
            let falloff = (1.0 - t_n);
            let a = (falloff * falloff * halo_a * 255.0).min(255.0) as u8;
            if a > 0 {
                painter.circle_filled(center, r, Theme::with_alpha(halo_color, a));
            }
        }
    }

    // ── Button body — frosted glass disc ──
    // Gradient: darker at edge, slightly lighter toward center
    let base_fill: [f32; 4] = if !can_record && !recording {
        [0.07, 0.06, 0.10, 0.85]
    } else if recording {
        let p = smooth_pulse(time, 1.0) * 0.12 + 0.04;
        [0.12 + p * 0.6, 0.03, 0.05, 0.88]
    } else if hovered {
        [0.10, 0.09, 0.18, 0.90]
    } else {
        [0.06, 0.05, 0.10, 0.86]
    };
    // Draw concentric bands for a subtle radial gradient (3 bands)
    for band in 0..3 {
        let t_b = band as f32 / 3.0;
        let r_band = btn_r * (1.0 - t_b * 0.25); // outer to ~75% radius
        let brighten = t_b * 0.025;
        let a_shift = t_b * 0.04;
        let c = egui::Color32::from_rgba_unmultiplied(
            ((base_fill[0] + brighten).min(1.0) * 255.0) as u8,
            ((base_fill[1] + brighten).min(1.0) * 255.0) as u8,
            ((base_fill[2] + brighten * 1.5).min(1.0) * 255.0) as u8,
            ((base_fill[3] + a_shift).min(1.0) * 255.0) as u8,
        );
        painter.circle_filled(center, r_band, c);
    }

    // ── Border ring — thin, elegant ──
    let ring_color = if recording {
        let pa = smooth_pulse(time, 1.6) * 0.3 + 0.5;
        Theme::with_alpha(t.red, (pa * 255.0) as u8)
    } else if hovered {
        Theme::with_alpha(t.accent, 180)
    } else if can_record {
        Theme::with_alpha(t.accent, 55)
    } else {
        Theme::with_alpha(egui::Color32::WHITE, 12)
    };
    painter.circle_stroke(center, btn_r, egui::Stroke::new(1.2, ring_color));

    // ── Second subtle inner ring ──
    let inner_ring_a = if recording { 20 } else if hovered { 15 } else if can_record { 8 } else { 3 };
    painter.circle_stroke(
        center,
        btn_r - 8.0,
        egui::Stroke::new(0.4, Theme::with_alpha(ring_color, inner_ring_a)),
    );

    // ── Center icon ──
    if recording {
        // Rounded stop square with soft glow
        let sq = 16.0;
        let sq_rect = egui::Rect::from_center_size(center, egui::vec2(sq, sq));
        // Glow behind the square
        let glow_p = smooth_pulse(time, 1.2);
        painter.rect_filled(
            egui::Rect::from_center_size(center, egui::vec2(sq + 14.0, sq + 14.0)),
            10.0,
            Theme::with_alpha(t.red, (glow_p * 25.0 + 8.0) as u8),
        );
        // The stop square itself — white with rounded corners
        painter.rect_filled(sq_rect, 5.0, egui::Color32::from_rgb(240, 240, 245));
    } else {
        // Record icon — concentric circles with accent color
        if can_record {
            // Outer soft glow ring
            let breath = smooth_pulse(time, 0.45);
            let glow_a = if hovered { 35 } else { (breath * 18.0 + 6.0) as u8 };
            painter.circle_filled(center, 22.0, Theme::with_alpha(t.accent, glow_a));

            // Main record circle
            let main_c = if hovered {
                Theme::lerp_color(t.accent, egui::Color32::WHITE, 0.35)
            } else {
                Theme::lerp_color(t.accent, egui::Color32::WHITE, breath * 0.12 + 0.05)
            };
            painter.circle_filled(center, 15.0, main_c);

            // Inner bright dot
            let dot_c = if hovered {
                egui::Color32::from_rgb(220, 220, 235)
            } else {
                Theme::with_alpha(egui::Color32::WHITE, (breath * 60.0 + 140.0) as u8)
            };
            painter.circle_filled(center, 6.5, dot_c);
        } else {
            // Disabled state — muted concentric circles
            painter.circle_filled(center, 15.0, Theme::with_alpha(egui::Color32::WHITE, 18));
            painter.circle_filled(center, 6.5, Theme::with_alpha(egui::Color32::WHITE, 35));
        }
    }

    // ── Below button: timer / name input / status message ──
    ui.add_space(2.0);

    if recording {
        let mins = (duration as u32) / 60;
        let secs = (duration as u32) % 60;
        let ms = ((duration * 100.0) as u32) % 100;

        ui.vertical_centered(|ui| {
            ui.label(
                egui::RichText::new(format!("{:02}:{:02}.{:02}", mins, secs, ms))
                    .size(18.0)
                    .color(t.text)
                    .family(egui::FontFamily::Monospace)
                    .strong(),
            );
            let src = recording_source.lock().clone();
            let src_label = match src.as_str() {
                "offline" => "Offline Render",
                "auto" => "Auto Record",
                _ => "Manual",
            };
            ui.label(
                egui::RichText::new(src_label)
                    .size(8.0)
                    .color(t.text_muted),
            );
        });

        ctx.request_repaint();
    } else if can_record {
        ui.vertical_centered(|ui| {
            let mut name = manual_sample_name.lock().clone();
            let te = egui::TextEdit::singleline(&mut name)
                .font(egui::FontId::proportional(11.0))
                .text_color(t.text)
                .hint_text(
                    egui::RichText::new("Sample name (optional)").color(t.text_muted),
                )
                .desired_width(200.0)
                .margin(egui::Margin::symmetric(8, 5));
            let resp = ui.add(te);
            if resp.changed() {
                *manual_sample_name.lock() = name;
            }
        });
    } else {
        ui.vertical_centered(|ui| {
            ui.label(
                egui::RichText::new(if !connected {
                    "Connecting\u{2026}"
                } else {
                    "Link a project to record"
                })
                .size(10.0)
                .color(t.text_muted),
            );
        });
    }

    // ── Click handling ──
    if btn_resp.clicked() {
        if recording {
            // Stop recording
            let source = recording_source.lock().clone();
            let mut rec = recorder.lock();
            let tail = crate::recorder::TailSettings::default();
            if let Some(file_path) = rec.stop(&tail) {
                is_recording.store(false, Ordering::Relaxed);
                // Queue MIDI CC 119 value 0 (recording stopped)
                pending_midi_cc.store(2, Ordering::Relaxed);
                let name = match source.as_str() {
                    "manual" => {
                        let user_name = manual_sample_name.lock().clone();
                        if user_name.trim().is_empty() {
                            format!(
                                "Recording {}",
                                chrono::Local::now().format("%Y-%m-%d %H:%M:%S")
                            )
                        } else {
                            user_name.trim().to_string()
                        }
                    }
                    "offline" => {
                        let proj = linked_project.lock();
                        if let Some(ref p) = *proj {
                            format!(
                                "Offline Render - {} {}",
                                p.title,
                                chrono::Local::now().format("%Y-%m-%d %H:%M")
                            )
                        } else {
                            format!(
                                "Offline Render {}",
                                chrono::Local::now().format("%Y-%m-%d %H:%M:%S")
                            )
                        }
                    }
                    _ => format!(
                        "Recording {}",
                        chrono::Local::now().format("%Y-%m-%d %H:%M:%S")
                    ),
                };
                // Capture analysis data (peak/RMS are still valid after stop)
                let peak_db = rec.peak_db();
                let rms_db = rec.rms_db();

                let ws = ws_client.lock();
                ws.send_recording_complete(
                    &file_path,
                    &name,
                    duration as f64,
                    rec.sample_rate(),
                    rec.channels(),
                    Some(source),
                    Some(peak_db),
                    Some(rms_db),
                );
                ws.send_state_update(
                    false,
                    false,
                    0.0,
                    auto_record.load(Ordering::Relaxed),
                    Some(capture_offline.load(Ordering::Relaxed)),
                );
            }
        } else if can_record {
            // Start recording
            *recording_source.lock() = "manual".to_string();
            let sr = sample_rate.load(Ordering::Relaxed) as u32;
            let ch = num_channels.load(Ordering::Relaxed) as u16;
            let mut rec = recorder.lock();
            rec.start(sr, ch);
            is_recording.store(true, Ordering::Relaxed);
            recording_duration.store(0.0, Ordering::Relaxed);
            // Queue MIDI CC 119 value 127 (recording started)
            pending_midi_cc.store(1, Ordering::Relaxed);

            let ws = ws_client.lock();
            ws.send_state_update(
                true,
                false,
                0.0,
                auto_record.load(Ordering::Relaxed),
                Some(capture_offline.load(Ordering::Relaxed)),
            );
        }
    }
}

fn draw_gain_control(
    ui: &mut egui::Ui,
    t: &Theme,
    setter: &ParamSetter,
    params: &DbundoneParams,
) {
    let gain_db = util::gain_to_db(params.gain.value());

    ui.horizontal(|ui| {
        ui.label(
            egui::RichText::new("GAIN")
                .size(9.0)
                .color(t.text_muted),
        );
        ui.with_layout(
            egui::Layout::right_to_left(egui::Align::Center),
            |ui| {
                ui.label(
                    egui::RichText::new(format!("{:+.1} dB", gain_db))
                        .size(9.0)
                        .color(t.text_secondary)
                        .family(egui::FontFamily::Monospace),
                );
            },
        );
    });
    ui.add_space(2.0);

    let sw = ui.available_width();
    let sh = 18.0;
    let (sr_rect, sr_resp) =
        ui.allocate_exact_size(egui::vec2(sw, sh), egui::Sense::click_and_drag());
    let p = ui.painter();

    let track_h = 3.0;
    let ty = sr_rect.center().y;
    let norm = ((gain_db + 24.0) / 48.0).clamp(0.0, 1.0);
    let thumb_x = sr_rect.min.x + sw * norm;
    let cx = sr_rect.min.x + sw * 0.5;

    // Drag interaction
    if sr_resp.dragged() {
        if let Some(pos) = sr_resp.interact_pointer_pos() {
            let n = ((pos.x - sr_rect.min.x) / sw).clamp(0.0, 1.0);
            let db = n * 48.0 - 24.0;
            setter.begin_set_parameter(&params.gain);
            setter.set_parameter(&params.gain, util::db_to_gain(db));
            setter.end_set_parameter(&params.gain);
        }
    }
    if sr_resp.double_clicked() {
        setter.begin_set_parameter(&params.gain);
        setter.set_parameter(&params.gain, util::db_to_gain(0.0));
        setter.end_set_parameter(&params.gain);
    }

    // Track background
    let tr = egui::Rect::from_min_size(
        egui::pos2(sr_rect.min.x, ty - track_h / 2.0),
        egui::vec2(sw, track_h),
    );
    p.rect_filled(tr, 2.0, t.bg_elevated);

    // Fill from center
    let fl = thumb_x.min(cx);
    let fr = thumb_x.max(cx);
    p.rect_filled(
        egui::Rect::from_min_max(
            egui::pos2(fl, tr.min.y),
            egui::pos2(fr, tr.max.y),
        ),
        2.0,
        t.accent,
    );

    // Center tick
    p.line_segment(
        [egui::pos2(cx, ty - 4.0), egui::pos2(cx, ty + 4.0)],
        egui::Stroke::new(0.5, t.text_muted),
    );

    // Thumb glow + circle
    let tr_h = if sr_resp.hovered() || sr_resp.dragged() {
        5.0
    } else {
        3.5
    };
    if sr_resp.hovered() || sr_resp.dragged() {
        p.circle_filled(
            egui::pos2(thumb_x, ty),
            tr_h + 5.0,
            Theme::with_alpha(t.accent, 25),
        );
    }
    p.circle_filled(egui::pos2(thumb_x, ty), tr_h, t.accent);
}

#[allow(clippy::too_many_arguments)]
fn draw_toggle_row(
    ui: &mut egui::Ui,
    t: &Theme,
    setter: &ParamSetter,
    params: &DbundoneParams,
    auto_rec: bool,
    auto_record: &AtomicBool,
    offline_cap: bool,
    capture_offline: &AtomicBool,
    ws_client: &Mutex<ws_client::WsClient>,
) {
    // Monitor
    ui.horizontal(|ui| {
        ui.label(
            egui::RichText::new("Monitor")
                .size(10.0)
                .color(t.text_secondary),
        );
        ui.with_layout(
            egui::Layout::right_to_left(egui::Align::Center),
            |ui| {
                let mut val = params.monitor.value();
                if draw_toggle(ui, t, &mut val, t.accent) {
                    setter.begin_set_parameter(&params.monitor);
                    setter.set_parameter(&params.monitor, val);
                    setter.end_set_parameter(&params.monitor);
                }
            },
        );
    });

    ui.add_space(1.0);

    // Auto Record
    ui.horizontal(|ui| {
        ui.label(
            egui::RichText::new("Auto Record")
                .size(10.0)
                .color(t.text_secondary),
        );
        ui.with_layout(
            egui::Layout::right_to_left(egui::Align::Center),
            |ui| {
                let mut val = auto_rec;
                if draw_toggle(ui, t, &mut val, t.yellow) {
                    auto_record.store(val, Ordering::Relaxed);
                    let ws = ws_client.lock();
                    ws.send_state_update(
                        false,
                        false,
                        0.0,
                        val,
                        Some(capture_offline.load(Ordering::Relaxed)),
                    );
                }
            },
        );
    });

    ui.add_space(1.0);

    // Capture Renders
    ui.horizontal(|ui| {
        ui.label(
            egui::RichText::new("Capture Renders")
                .size(10.0)
                .color(t.text_secondary),
        );
        ui.with_layout(
            egui::Layout::right_to_left(egui::Align::Center),
            |ui| {
                let mut val = offline_cap;
                if draw_toggle(ui, t, &mut val, t.cyan) {
                    capture_offline.store(val, Ordering::Relaxed);
                    let ws = ws_client.lock();
                    ws.send_state_update(
                        false,
                        false,
                        0.0,
                        auto_record.load(Ordering::Relaxed),
                        Some(val),
                    );
                }
            },
        );
    });
}

fn draw_meters_compact(ui: &mut egui::Ui, t: &Theme, peak_l: f32, peak_r: f32) {
    let bar_h = 3.0;
    let label_w = 12.0;
    let db_w = 42.0;
    let bar_w = ui.available_width() - label_w - db_w - 8.0;

    for (ch, level) in [("L", peak_l), ("R", peak_r)] {
        ui.horizontal(|ui| {
            ui.label(
                egui::RichText::new(ch)
                    .size(8.0)
                    .color(t.text_muted)
                    .family(egui::FontFamily::Monospace),
            );
            ui.add_space(2.0);
            let (rect, _) =
                ui.allocate_exact_size(egui::vec2(bar_w, bar_h), egui::Sense::hover());
            draw_meter_bar(ui.painter(), rect, level, t);
            let db = if level > 0.0 {
                20.0 * level.log10()
            } else {
                -60.0
            };
            let dc = if db > -3.0 {
                t.red
            } else if db > -12.0 {
                t.yellow
            } else {
                t.text_muted
            };
            ui.label(
                egui::RichText::new(format!("{:>5.1}", db))
                    .size(8.0)
                    .color(dc)
                    .family(egui::FontFamily::Monospace),
            );
        });
        ui.add_space(1.0);
    }
}

fn draw_meter_bar(painter: &egui::Painter, rect: egui::Rect, level: f32, t: &Theme) {
    let r = 2.0;
    painter.rect_filled(rect, r, t.bg_elevated);
    let db = if level > 0.0 {
        (20.0 * level.log10()).max(-60.0)
    } else {
        -60.0
    };
    let norm = ((db + 60.0) / 60.0).clamp(0.0, 1.0);
    let w = rect.width() * norm;
    if w > 0.5 {
        let color = if db > -3.0 {
            t.red
        } else if db > -12.0 {
            Theme::lerp_color(t.yellow, t.red, (db + 12.0) / 9.0)
        } else {
            t.accent
        };
        painter.rect_filled(
            egui::Rect::from_min_size(rect.min, egui::vec2(w, rect.height())),
            r,
            color,
        );
    }
}

/// Compact toggle switch. Returns true if toggled.
fn draw_toggle(
    ui: &mut egui::Ui,
    t: &Theme,
    value: &mut bool,
    active_color: egui::Color32,
) -> bool {
    let w = 28.0;
    let h = 14.0;
    let (rect, resp) = ui.allocate_exact_size(egui::vec2(w, h), egui::Sense::click());
    let p = ui.painter();

    let mut toggled = false;
    if resp.clicked() {
        *value = !*value;
        toggled = true;
    }

    let rounding = h / 2.0;
    let track_c = if *value { active_color } else { t.bg_elevated };
    p.rect_filled(rect, rounding, track_c);

    let pad = 2.0;
    let thumb_r = (h - pad * 2.0) / 2.0;
    let thumb_x = if *value {
        rect.max.x - pad - thumb_r
    } else {
        rect.min.x + pad + thumb_r
    };
    p.circle_filled(
        egui::pos2(thumb_x, rect.center().y),
        thumb_r,
        egui::Color32::WHITE,
    );

    toggled
}

fn draw_pill(ui: &mut egui::Ui, label: &str, color: egui::Color32, font_size: f32) {
    let galley = ui.fonts(|f| {
        f.layout_no_wrap(
            label.to_string(),
            egui::FontId::proportional(font_size),
            color,
        )
    });
    let pw = galley.size().x + 10.0;
    let ph = galley.size().y + 4.0;
    let (rect, _) = ui.allocate_exact_size(egui::vec2(pw, ph), egui::Sense::hover());
    ui.painter()
        .rect_filled(rect, ph / 2.0, Theme::with_alpha(color, 18));
    let tp = egui::pos2(
        rect.center().x - galley.size().x / 2.0,
        rect.center().y - galley.size().y / 2.0,
    );
    ui.painter().galley(tp, galley, color);
}


impl ClapPlugin for DbundonePlugin {
    const CLAP_ID: &'static str = "com.dbundone.bridge";
    const CLAP_DESCRIPTION: Option<&'static str> =
        Some("Record audio from your DAW directly into DBundone projects");
    const CLAP_MANUAL_URL: Option<&'static str> = None;
    const CLAP_SUPPORT_URL: Option<&'static str> = None;
    const CLAP_FEATURES: &'static [ClapFeature] = &[ClapFeature::AudioEffect, ClapFeature::Utility];
}

impl Vst3Plugin for DbundonePlugin {
    const VST3_CLASS_ID: [u8; 16] = *b"DBundoneVST3Brdg";
    const VST3_SUBCATEGORIES: &'static [Vst3SubCategory] =
        &[Vst3SubCategory::Fx, Vst3SubCategory::Tools];
}

impl Drop for DbundonePlugin {
    fn drop(&mut self) {
        // Signal the WebSocket thread to shut down gracefully
        self.shutdown.store(true, Ordering::Relaxed);
        // Give the thread a moment to notice the flag and close the socket
        std::thread::sleep(std::time::Duration::from_millis(100));
    }
}

nih_export_clap!(DbundonePlugin);
nih_export_vst3!(DbundonePlugin);
