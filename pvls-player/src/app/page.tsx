"use client";

import { useState, useCallback, useEffect } from "react";
import { Settings, Menu, RefreshCw, Music2 } from "lucide-react";

import { useSettings } from "@/hooks/useSettings";
import { usePlayer } from "@/hooks/usePlayer";
import { useLibrary } from "@/hooks/useLibrary";
import { useAuth } from "@/hooks/useAuth";
import { oneDriveFilesToSongs } from "@/lib/onedrive";
import { ONEDRIVE_URL, MS_CLIENT_ID } from "@/lib/config";

import { PlayerBar } from "@/components/PlayerBar";
import { NowPlaying } from "@/components/NowPlaying";
import { SongLibrary } from "@/components/SongLibrary";
import { PlaylistSidebar } from "@/components/PlaylistSidebar";
import { SongModal } from "@/components/SongModal";
import { SettingsModal } from "@/components/SettingsModal";

import type { Song } from "@/types";

export default function Home() {
  const { settings, updateSettings, loaded } = useSettings();
  const { auth, login, logout, getValidToken } = useAuth(MS_CLIENT_ID);
  const player = usePlayer();
  const library = useLibrary();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [nowPlayingOpen, setNowPlayingOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modalSong, setModalSong] = useState<Song | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  const syncLibrary = useCallback(async () => {
    const token = await getValidToken();
    if (!token) {
      setError("Sign in with Microsoft to load your music.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/songs?shareUrl=${encodeURIComponent(ONEDRIVE_URL)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch songs");

      const songs = oneDriveFilesToSongs(data.files ?? []);
      library.syncSongs(songs);
      setLastSynced(new Date());

      if (settings.autoDownload) {
        for (const song of songs) {
          const existing = library.songs.find((s) => s.id === song.id);
          if (!existing?.isDownloaded) {
            player.downloadSong(song).catch(() => {});
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [getValidToken, settings.autoDownload, library, player]);

  // Auto-sync once authenticated
  const isAuthenticated = !!auth.tokens;
  useEffect(() => {
    if (loaded && isAuthenticated && !auth.loading) {
      syncLibrary();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, isAuthenticated, auth.loading]);

  // Open settings if not signed in
  useEffect(() => {
    if (loaded && !auth.loading && !isAuthenticated) {
      setSettingsOpen(true);
    }
  }, [loaded, auth.loading, isAuthenticated]);

  const handlePlay = useCallback(
    (song: Song) => player.play(song, library.activeSongs, library.activeSongs.indexOf(song)),
    [player, library.activeSongs]
  );

  const handleRating = useCallback(
    (song: Song, rating: number) => library.updateSong(song.id, { rating }),
    [library]
  );

  const handleCurrentRating = useCallback(
    (rating: number) => {
      if (player.state.currentSong) handleRating(player.state.currentSong, rating);
    },
    [player.state.currentSong, handleRating]
  );

  const handleDownload = useCallback(
    async (song: Song) => {
      await player.downloadSong(song);
      library.updateSong(song.id, { isDownloaded: true });
    },
    [player, library]
  );

  // Keep modal and player bar/now-playing in sync with live library state
  const liveSong = modalSong
    ? (library.songs.find((s) => s.id === modalSong.id) ?? modalSong)
    : null;

  const liveCurrentSong = player.state.currentSong
    ? (library.songs.find((s) => s.id === player.state.currentSong!.id) ?? player.state.currentSong)
    : null;

  const livePlayerState = { ...player.state, currentSong: liveCurrentSong };

  if (!loaded || auth.loading) {
    return (
      <div className="flex items-center justify-center h-dvh bg-[#0a0a0a]">
        <div className="w-8 h-8 border-2 border-white/10 border-t-[hsl(238_87%_67%)] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-dvh bg-[#0a0a0a] overflow-hidden">
      <PlaylistSidebar
        playlists={library.playlists}
        activePlaylistId={library.activePlaylistId}
        onSelect={library.setActivePlaylistId}
        onCreatePlaylist={(name, color) => library.createPlaylist(name, color)}
        onDeletePlaylist={library.removePlaylist}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-white/5">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            title="Open sidebar"
            className="w-9 h-9 rounded-xl hover:bg-white/6 flex items-center justify-center text-white/40 hover:text-white transition-colors lg:hidden"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-[hsl(var(--accent-hsl)/0.15)] flex items-center justify-center shrink-0">
              <Music2 className="w-4 h-4 text-[hsl(var(--accent-hsl))]" />
            </div>
            <span className="font-brand text-sm font-semibold text-white/80 truncate">
              {library.activePlaylistId
                ? (library.playlists.find((p) => p.id === library.activePlaylistId)?.name ?? "Playlist")
                : "pvls player"}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {lastSynced && (
              <span className="text-xs text-white/20 hidden sm:block mr-1">
                {lastSynced.toLocaleTimeString()}
              </span>
            )}
            <button
              type="button"
              onClick={syncLibrary}
              disabled={loading || !isAuthenticated}
              className="w-9 h-9 rounded-xl hover:bg-white/6 flex items-center justify-center text-white/40 hover:text-white transition-colors disabled:opacity-30"
              title="Sync library"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              title="Settings"
              className="w-9 h-9 rounded-xl hover:bg-white/6 flex items-center justify-center text-white/40 hover:text-white transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-hidden px-4 pt-4 pb-24">
          <SongLibrary
            songs={library.activeSongs}
            currentSongId={player.state.currentSong?.id}
            isPlaying={player.state.isPlaying}
            playlists={library.playlists}
            search={library.search}
            onSearch={library.setSearch}
            sortField={library.sortField}
            onSortField={library.setSortField}
            sortDir={library.sortDir}
            onSortDir={library.setSortDir}
            viewMode={library.viewMode}
            onViewMode={library.setViewMode}
            filterFormat={library.filterFormat}
            onFilterFormat={library.setFilterFormat}
            formats={library.formats}
            onPlay={handlePlay}
            onOpenModal={setModalSong}
            onDownload={handleDownload}
            onRating={handleRating}
            loading={loading}
            error={error ?? undefined}
            totalCount={library.songs.length}
          />
        </main>
      </div>

      <PlayerBar
        state={livePlayerState}
        onTogglePlay={player.togglePlay}
        onSeek={player.seek}
        onVolume={player.setVolume}
        onMute={player.toggleMute}
        onNext={player.playNext}
        onPrev={player.playPrev}
        onShuffle={player.toggleShuffle}
        onRepeat={player.cycleRepeat}
        onExpandNowPlaying={() => setNowPlayingOpen(true)}
        onRating={handleCurrentRating}
      />

      <NowPlaying
        open={nowPlayingOpen}
        onClose={() => setNowPlayingOpen(false)}
        state={livePlayerState}
        onTogglePlay={player.togglePlay}
        onSeek={player.seek}
        onVolume={player.setVolume}
        onMute={player.toggleMute}
        onNext={player.playNext}
        onPrev={player.playPrev}
        onShuffle={player.toggleShuffle}
        onRepeat={player.cycleRepeat}
        onRating={handleCurrentRating}
        onOpenModal={setModalSong}
        onDownload={handleDownload}
        showWaveform={settings.showWaveform}
        accentColor={settings.accentColor}
      />

      {liveSong && (
        <SongModal
          song={liveSong}
          playlists={library.playlists}
          onClose={() => setModalSong(null)}
          onUpdateSong={(id, patch) => library.updateSong(id, patch)}
          onAddToPlaylist={library.addToPlaylist}
          onCreatePlaylist={library.createPlaylist}
          onDownload={handleDownload}
        />
      )}

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onUpdate={updateSettings}
        isAuthenticated={isAuthenticated}
        authError={auth.error}
        onLogin={() => login()}
        onLogout={logout}
      />
    </div>
  );
}
