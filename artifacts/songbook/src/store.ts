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
