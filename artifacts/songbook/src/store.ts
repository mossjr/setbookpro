import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  displayMode: DisplayMode;
  setDisplayMode: (mode: DisplayMode) => void;
  lyricsOnly: boolean;
  setLyricsOnly: (only: boolean) => void;
  zoom: number;
  setZoom: (zoom: number) => void;
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
      displayMode: 'auto',
      setDisplayMode: (displayMode) => set({ displayMode }),
      lyricsOnly: false,
      setLyricsOnly: (lyricsOnly) => set({ lyricsOnly }),
      zoom: 1,
      setZoom: (zoom) => set({ zoom }),
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
        desktopSidebarOpen: state.desktopSidebarOpen
      }),
    }
  )
);
