import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type DisplayMode = 'scroll' | 'columns' | 'auto';

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
      setAutoScrollSpeed: (autoScrollSpeed) => set({ autoScrollSpeed }),
      autoScrollMinSpeed: 10,
      setAutoScrollMinSpeed: (autoScrollMinSpeed) => set({ autoScrollMinSpeed }),
      autoScrollMaxSpeed: 200,
      setAutoScrollMaxSpeed: (autoScrollMaxSpeed) => set({ autoScrollMaxSpeed }),
      autoScrollStartDelay: 0,
      setAutoScrollStartDelay: (autoScrollStartDelay) =>
        set({ autoScrollStartDelay }),
      metronomeFlash: false,
      setMetronomeFlash: (metronomeFlash) => set({ metronomeFlash }),
      metronomeSound: true,
      setMetronomeSound: (metronomeSound) => set({ metronomeSound }),
    }),
    { name: 'songbook-settings' }
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
    }),
    {
      name: 'songbook-app-state',
      partialize: (state) => ({ 
        token: state.token, 
        zoom: state.zoom, 
        displayMode: state.displayMode,
        lyricsOnly: state.lyricsOnly
      }),
    }
  )
);
