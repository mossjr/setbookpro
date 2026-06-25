import { useState, useRef, useEffect } from "react";
import { useGetSong, getGetSongQueryKey, useUpdateSong } from "@workspace/api-client-react";
import { useAppStore, useSettingsStore } from "@/store";
import ChordRenderer from "./ChordRenderer";
import { Button } from "@/components/ui/button";
import { Menu, Settings, Columns, AlignLeft, Minus, Plus, Play, Pause, Music, Settings2 } from "lucide-react";

export default function SongView({ songId }: { songId: string }) {
  const { data: song, isLoading } = useGetSong(songId, {
    query: { enabled: !!songId, queryKey: getGetSongQueryKey(songId) }
  });

  const { 
    zoom, setZoom, 
    displayMode, setDisplayMode, 
    lyricsOnly, setLyricsOnly,
    setSidebarOpen
  } = useAppStore();

  const { titleFontSize, lyricsFontSize, chordsFontSize, accentColor } = useSettingsStore();

  const [transpose, setTranspose] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logic could go here

  if (isLoading) return <div className="flex-1 flex items-center justify-center">Loading song...</div>;
  if (!song) return <div className="flex-1 flex items-center justify-center">Song not found</div>;

  return (
    <div className="flex flex-col h-full bg-background relative">
      {/* Top Bar */}
      <header className="flex items-center justify-between p-2 border-b border-border bg-card shadow-sm z-10 shrink-0">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="md:hidden">
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex flex-col max-w-[200px] sm:max-w-xs md:max-w-md">
            <h1 className="font-bold truncate text-foreground leading-tight" style={{ fontSize: `${titleFontSize}px` }}>{song.title}</h1>
            <span className="text-sm text-muted-foreground truncate leading-none">{song.artist}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {/* Transpose */}
          <div className="flex items-center bg-muted rounded-md overflow-hidden mr-2">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none" onClick={() => setTranspose(t => t - 1)}>
              <span className="font-bold">♭</span>
            </Button>
            <div className="w-8 text-center text-sm font-medium">{transpose > 0 ? `+${transpose}` : transpose}</div>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none" onClick={() => setTranspose(t => t + 1)}>
              <span className="font-bold">♯</span>
            </Button>
          </div>

          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setDisplayMode(displayMode === 'columns' ? 'scroll' : 'columns')}
            title="Toggle Layout"
          >
            {displayMode === 'columns' ? <Columns className="w-5 h-5" /> : <AlignLeft className="w-5 h-5" />}
          </Button>

          <Button variant="ghost" size="icon" onClick={() => setLyricsOnly(!lyricsOnly)} title="Lyrics Only">
            <Settings2 className={`w-5 h-5 ${lyricsOnly ? 'text-muted-foreground' : 'text-primary'}`} />
          </Button>
        </div>
      </header>

      {/* Song Body */}
      <div 
        ref={scrollRef}
        className={`flex-1 overflow-auto p-4 md:p-8 ${displayMode === 'columns' ? 'column-count-1 md:column-count-2 column-gap-8' : ''}`}
      >
        <ChordRenderer
          text={song.lyricsChords}
          zoom={zoom}
          transpose={transpose}
          lyricsOnly={lyricsOnly}
          lyricsFontSize={lyricsFontSize}
          chordsFontSize={chordsFontSize}
          accentColor={accentColor}
        />
      </div>

      {/* Floating Controls */}
      <div className="absolute bottom-6 right-6 flex flex-col gap-3">
        <div className="flex flex-col bg-card border border-border shadow-lg rounded-full overflow-hidden">
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-none" onClick={() => setZoom(Math.min(3, zoom + 0.1))}>
            <Plus className="w-4 h-4" />
          </Button>
          <div className="h-[1px] w-full bg-border" />
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-none" onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}>
            <Minus className="w-4 h-4" />
          </Button>
        </div>

        <Button 
          size="icon" 
          className="h-14 w-14 rounded-full shadow-xl bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={() => setIsPlaying(!isPlaying)}
        >
          {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
        </Button>
      </div>

    </div>
  );
}