import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { HostMode, PresentState, SyncState } from '@workspace/gig-protocol';

type DisplayMode = 'scroll' | 'split' | 'auto';

interface SettingsState {
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  accentColor: string;
  setAccentColor: (color: string) => void;
  titleFontSize: number;
  setTitleFontSize: (size: number) => void;
  lyricsFontSize: number;
  setLyricsFontSize: (size: number) => void;
  chordsFontSize: number;
  setChordsFontSize: (size: number) => void;
  instrument: 'guitar' | 'piano';
  setInstrument: (inst: 'guitar' | 'piano') => void;
  // Auto-scroll (px per second).
  autoScrollSpeed: number;
  setAutoScrollSpeed: (speed: number) => void;
  autoScrollMinSpeed: number;
  setAutoScrollMinSpeed: (speed: number) => void;
  autoScrollMaxSpeed: number;
  setAutoScrollMaxSpeed: (speed: number) => void;
  autoScrollStartDelay: number;
  setAutoScrollStartDelay: (seconds: number) => void;
  // Per-song saved auto-scroll speed (px/sec), keyed by song id.
  songScrollSpeeds: Record<string, number>;
  setSongScrollSpeed: (songId: string, speed: number) => void;
  // Metronome.
  metronomeFlash: boolean;
  setMetronomeFlash: (on: boolean) => void;
  metronomeSound: boolean;
  setMetronomeSound: (on: boolean) => void;
}

interface AppState {
  token: string | null;
  setToken: (token: string | null) => void;
  selectedSongId: string | null;
  setSelectedSongId: (id: string | null) => void;
  activeSetId: string | null;
  setActiveSetId: (id: string | null) => void;
  lastPlayedSongId: string | null;
  setLastPlayedSongId: (id: string | null) => void;
  displayMode: DisplayMode;
  setDisplayMode: (mode: DisplayMode) => void;
  lyricsOnly: boolean;
  setLyricsOnly: (only: boolean) => void;
  zoom: number;
  setZoom: (zoom: number) => void;
  // Per-device PARTICIPANT overrides. Kept separate from the host-side `zoom`
  // and `lyricsOnly` so a device that alternates roles never clobbers its own
  // participant preferences with host settings.
  participantZoom: number;
  setParticipantZoom: (zoom: number) => void;
  participantLyricsOnly: boolean;
  setParticipantLyricsOnly: (only: boolean) => void;
  isSidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  desktopSidebarOpen: boolean;
  setDesktopSidebarOpen: (open: boolean) => void;
  toggleDesktopSidebar: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'dark',
      setTheme: (theme) => set({ theme }),
      accentColor: '38 92% 50%',
      setAccentColor: (accentColor) => set({ accentColor }),
      titleFontSize: 24,
      setTitleFontSize: (titleFontSize) => set({ titleFontSize }),
      lyricsFontSize: 18,
      setLyricsFontSize: (lyricsFontSize) => set({ lyricsFontSize }),
      chordsFontSize: 16,
      setChordsFontSize: (chordsFontSize) => set({ chordsFontSize }),
      instrument: 'guitar',
      setInstrument: (instrument) => set({ instrument }),
      autoScrollSpeed: 40,
      setAutoScrollSpeed: (autoScrollSpeed) =>
        set((s) => ({
          autoScrollSpeed: Math.min(
            Math.max(autoScrollSpeed, s.autoScrollMinSpeed),
            s.autoScrollMaxSpeed,
          ),
        })),
      autoScrollMinSpeed: 10,
      setAutoScrollMinSpeed: (val) =>
        set((s) => {
          const autoScrollMinSpeed = Math.min(val, s.autoScrollMaxSpeed);
          return {
            autoScrollMinSpeed,
            autoScrollSpeed: Math.min(
              Math.max(s.autoScrollSpeed, autoScrollMinSpeed),
              s.autoScrollMaxSpeed,
            ),
          };
        }),
      autoScrollMaxSpeed: 200,
      setAutoScrollMaxSpeed: (val) =>
        set((s) => {
          const autoScrollMaxSpeed = Math.max(val, s.autoScrollMinSpeed);
          return {
            autoScrollMaxSpeed,
            autoScrollSpeed: Math.min(
              Math.max(s.autoScrollSpeed, s.autoScrollMinSpeed),
              autoScrollMaxSpeed,
            ),
          };
        }),
      autoScrollStartDelay: 0,
      setAutoScrollStartDelay: (autoScrollStartDelay) =>
        set({ autoScrollStartDelay }),
      songScrollSpeeds: {},
      setSongScrollSpeed: (songId, speed) =>
        set((state) => ({
          songScrollSpeeds: { ...state.songScrollSpeeds, [songId]: speed },
        })),
      metronomeFlash: false,
      setMetronomeFlash: (metronomeFlash) => set({ metronomeFlash }),
      metronomeSound: true,
      setMetronomeSound: (metronomeSound) => set({ metronomeSound }),
    }),
    {
      name: 'songbook-settings',
      version: 1,
      // Ensure a previously-persisted speed range is internally consistent and
      // that the base (1×) speed sits within [min, max] on rehydration.
      migrate: (persisted, _version) => {
        const s = persisted as Partial<SettingsState> | undefined;
        if (s) {
          const min =
            typeof s.autoScrollMinSpeed === 'number' ? s.autoScrollMinSpeed : 10;
          const max = Math.max(
            min,
            typeof s.autoScrollMaxSpeed === 'number' ? s.autoScrollMaxSpeed : 200,
          );
          s.autoScrollMinSpeed = min;
          s.autoScrollMaxSpeed = max;
          if (typeof s.autoScrollSpeed === 'number') {
            s.autoScrollSpeed = Math.min(Math.max(s.autoScrollSpeed, min), max);
          }
        }
        return s as SettingsState;
      },
    }
  )
);

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      token: null,
      setToken: (token) => set({ token }),
      selectedSongId: null,
      setSelectedSongId: (selectedSongId) => set({ selectedSongId }),
      activeSetId: null,
      setActiveSetId: (activeSetId) => set({ activeSetId }),
      lastPlayedSongId: null,
      setLastPlayedSongId: (lastPlayedSongId) => set({ lastPlayedSongId }),
      displayMode: 'auto',
      setDisplayMode: (displayMode) => set({ displayMode }),
      lyricsOnly: false,
      setLyricsOnly: (lyricsOnly) => set({ lyricsOnly }),
      zoom: 1,
      setZoom: (zoom) => set({ zoom }),
      participantZoom: 1,
      setParticipantZoom: (participantZoom) => set({ participantZoom }),
      participantLyricsOnly: false,
      setParticipantLyricsOnly: (participantLyricsOnly) =>
        set({ participantLyricsOnly }),
      isSidebarOpen: false,
      setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),
      desktopSidebarOpen: true,
      setDesktopSidebarOpen: (desktopSidebarOpen) => set({ desktopSidebarOpen }),
      toggleDesktopSidebar: () =>
        set((s) => ({ desktopSidebarOpen: !s.desktopSidebarOpen })),
    }),
    {
      name: 'songbook-app-state',
      version: 1,
      migrate: (persisted, _version) => {
        const state = persisted as Partial<AppState> | undefined;
        if (state && (state.displayMode as string) === 'columns') {
          state.displayMode = 'split';
        }
        return state as AppState;
      },
      partialize: (state) => ({ 
        token: state.token, 
        zoom: state.zoom, 
        displayMode: state.displayMode,
        lyricsOnly: state.lyricsOnly,
        participantZoom: state.participantZoom,
        participantLyricsOnly: state.participantLyricsOnly,
        desktopSidebarOpen: state.desktopSidebarOpen,
        activeSetId: state.activeSetId,
        lastPlayedSongId: state.lastPlayedSongId
      }),
    }
  )
);

// --- Live gig session (ephemeral; never persisted) -------------------------
// Mirrors the server-authoritative HOST/PARTICIPANT state pushed over the
// socket. Role is derived from whether *this* device owns the host slot.

export type GigRole = 'idle' | 'host' | 'participant';

export interface GigScrollCommand {
  type: 'start' | 'stop' | 'seek';
  fraction: number;
  /** durationMs for 'start', remainingMs for 'seek', unused for 'stop'. */
  ms: number;
  /** Monotonic so an identical repeated command still re-fires its effect. */
  seq: number;
}

interface GigState {
  connected: boolean;
  myId: string | null;
  hostId: string | null;
  role: GigRole;
  hostSongId: string | null;
  hostTranspose: number;
  hostMode: HostMode;
  scrollCmd: GigScrollCommand | null;
  setConnected: (connected: boolean) => void;
  setIdentity: (myId: string | null) => void;
  applyHostChanged: (hostId: string | null) => void;
  applyPresent: (present: PresentState) => void;
  applySync: (snapshot: SyncState) => void;
  pushScroll: (cmd: Omit<GigScrollCommand, 'seq'>) => void;
  reset: () => void;
}

const roleFor = (hostId: string | null, myId: string | null): GigRole =>
  hostId === null ? 'idle' : hostId === myId ? 'host' : 'participant';

export const useGigStore = create<GigState>()((set) => ({
  connected: false,
  myId: null,
  hostId: null,
  role: 'idle',
  hostSongId: null,
  hostTranspose: 0,
  hostMode: 'scroll',
  scrollCmd: null,
  setConnected: (connected) => set({ connected }),
  setIdentity: (myId) => set((s) => ({ myId, role: roleFor(s.hostId, myId) })),
  applyHostChanged: (hostId) =>
    set((s) => ({ hostId, role: roleFor(hostId, s.myId) })),
  applyPresent: (present) =>
    set((s) => ({
      hostSongId: present.songId,
      hostTranspose: present.transpose,
      hostMode: present.hostMode,
      // A new presentation cancels any in-flight scroll everywhere. The fresh
      // 'stop' (new seq) halts current followers and prevents a stale 'start'
      // from replaying when the next song mounts; a real scroll_start re-arms.
      scrollCmd: {
        type: 'stop' as const,
        fraction: 0,
        ms: 0,
        seq: (s.scrollCmd?.seq ?? 0) + 1,
      },
    })),
  applySync: (snapshot) =>
    set((s) => ({
      hostId: snapshot.hostId,
      role: roleFor(snapshot.hostId, s.myId),
      hostSongId: snapshot.songId,
      hostTranspose: snapshot.transpose,
      hostMode: snapshot.hostMode,
      scrollCmd: snapshot.scroll
        ? {
            type: 'start',
            fraction: snapshot.scroll.fraction,
            ms: snapshot.scroll.remainingMs,
            seq: (s.scrollCmd?.seq ?? 0) + 1,
          }
        : {
            // No active scroll in the snapshot: emit a fresh 'stop' so a
            // reconnect that missed a present/scroll_stop can't replay a stale
            // scroll command.
            type: 'stop',
            fraction: 0,
            ms: 0,
            seq: (s.scrollCmd?.seq ?? 0) + 1,
          },
    })),
  pushScroll: (cmd) =>
    set((s) => ({ scrollCmd: { ...cmd, seq: (s.scrollCmd?.seq ?? 0) + 1 } })),
  reset: () =>
    set({
      connected: false,
      hostId: null,
      role: 'idle',
      hostSongId: null,
      hostTranspose: 0,
      hostMode: 'scroll',
      scrollCmd: null,
    }),
}));
