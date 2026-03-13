export interface Song {
  id: string;
  name: string;
  originalName: string;
  url: string;
  downloadUrl: string;
  size: number;
  duration?: number;
  format: "mp3" | "flac" | "wav" | "aac" | "ogg" | string;
  addedAt: string;
  customName?: string;
  rating?: number; // 1-5
  comments?: Comment[];
  playCount?: number;
  lastPlayedAt?: string;
  isDownloaded?: boolean;
  artworkColor?: string;
}

export interface Comment {
  id: string;
  text: string;
  timestamp: number;
  createdAt: string;
}

export interface Playlist {
  id: string;
  name: string;
  songIds: string[];
  createdAt: string;
  updatedAt: string;
  color?: string;
}

export interface PlayerState {
  currentSong: Song | null;
  queue: Song[];
  queueIndex: number;
  isPlaying: boolean;
  volume: number;
  muted: boolean;
  currentTime: number;
  duration: number;
  shuffle: boolean;
  repeat: "none" | "all" | "one";
}

export interface AppSettings {
  playbackMode: "streaming" | "local";
  autoDownload: boolean;
  accentColor: string;
  showWaveform: boolean;
}
