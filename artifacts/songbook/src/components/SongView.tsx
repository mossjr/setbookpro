import { useState, useRef, useEffect } from "react";
import { useGetSong, getGetSongQueryKey } from "@workspace/api-client-react";
import { useAppStore, useSettingsStore } from "@/store";
import ChordRenderer from "./ChordRenderer";
import Metronome from "./Metronome";
import MediaPlayerModal from "./MediaPlayerModal";
import BottomScrollScrubber from "./BottomScrollScrubber";
import SettingsDialog from "./SettingsDialog";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useYouTubePlayer } from "@/hooks/useYouTubePlayer";
import { useSongViewLayout, EDGE } from "@/hooks/useSongViewLayout";
import { resolveAudioUrl } from "@/lib/media";
import { parseYouTubeId } from "@/lib/youtube";
import { Button } from "@/components/ui/button";
import {
  Menu,
  Columns,
  AlignLeft,
  Wand2,
  Minus,
  Plus,
  Play,
  Pause,
  Music,
  Eye,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export default function SongView({ songId }: { songId: string }) {
  const { data: song, isLoading } = useGetSong(songId, {
    query: { enabled: !!songId, queryKey: getGetSongQueryKey(songId) },
  });

  const {
    zoom,
    setZoom,
    displayMode,
    setDisplayMode,
    lyricsOnly,
    setLyricsOnly,
    setSidebarOpen,
  } = useAppStore();

  const { titleFontSize, lyricsFontSize, chordsFontSize, accentColor } =
    useSettingsStore();

  const [transpose, setTranspose] = useState(0);
  const [mediaOpen, setMediaOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const pagerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);

  const pressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);

  // Cancel any pending long-press timer if the view unmounts mid-press.
  useEffect(() => {
    return () => {
      if (pressTimer.current) clearTimeout(pressTimer.current);
    };
  }, []);

  const audioSrc =
    song?.mediaType === "audio" ? resolveAudioUrl(song.audioUrl) : null;
  const audio = useAudioPlayer(audioSrc);

  const youtubeVideoId =
    song?.mediaType === "youtube" && song.youtubeUrl
      ? parseYouTubeId(song.youtubeUrl)
      : null;

  // The YouTube iframe lives in this wrapper, which is rendered once inside the
  // always-mounted media panel. Because the wrapper is never unmounted or moved,
  // the iframe never reloads — so playback continues and the floating tap-toggle
  // stays in sync whether the panel is open or closed.
  const ytWrapperRef = useRef<HTMLDivElement>(null);
  const yt = useYouTubePlayer(ytWrapperRef, youtubeVideoId);

  // Layout hook is called BEFORE any early return to keep hook order stable.
  const layout = useSongViewLayout({
    displayMode,
    userZoom: zoom,
    lyricsOnly,
    lyricsFontSize,
    frameRef,
    pagerRef,
    measureRef,
    recomputeKey: `${song?.id ?? ""}|${transpose}|${lyricsOnly ? 1 : 0}|${lyricsFontSize}|${chordsFontSize}|${zoom}|${displayMode}`,
  });

  const isSplit = layout.effectiveMode === "split";
  const { pageIndex, pageCount, nextPage, prevPage } = layout;

  // Keyboard paging in split mode.
  useEffect(() => {
    if (!isSplit) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") nextPage();
      else if (e.key === "ArrowLeft") prevPage();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isSplit, nextPage, prevPage]);

  if (isLoading)
    return (
      <div className="flex-1 flex items-center justify-center">
        Loading song...
      </div>
    );
  if (!song)
    return (
      <div className="flex-1 flex items-center justify-center">
        Song not found
      </div>
    );

  const handleMediaTap = () => {
    switch (song.mediaType) {
      case "audio":
        if (song.audioUrl) audio.toggle();
        else setMediaOpen(true);
        break;
      case "youtube":
        // Call toggle directly inside the gesture so autoplay policy allows it.
        if (youtubeVideoId) yt.toggle();
        else setMediaOpen(true);
        break;
      default:
        // No controllable source attached (or a legacy one) — open the player.
        setMediaOpen(true);
    }
  };

  const onMediaPointerDown = () => {
    longPressed.current = false;
    pressTimer.current = window.setTimeout(() => {
      longPressed.current = true;
      setMediaOpen(true);
    }, 500);
  };

  const clearPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const onMediaPointerUp = () => {
    clearPress();
    if (longPressed.current) return;
    handleMediaTap();
  };

  const mediaIcon = () => {
    if (song.mediaType === "audio")
      return audio.isPlaying ? (
        <Pause className="w-6 h-6" />
      ) : (
        <Play className="w-6 h-6 ml-1" />
      );
    if (song.mediaType === "youtube")
      return yt.isPlaying ? (
        <Pause className="w-6 h-6" />
      ) : (
        <Play className="w-6 h-6 ml-1" />
      );
    return <Music className="w-6 h-6" />;
  };

  const mediaLabel = () => {
    switch (song.mediaType) {
      case "audio":
        return audio.isPlaying ? "Pause audio" : "Play audio";
      case "youtube":
        return yt.isPlaying ? "Pause video" : "Play video";
      default:
        return "Add media";
    }
  };

  const hasMedia = song.mediaType === "audio" || song.mediaType === "youtube";

  const cycleMode = () =>
    setDisplayMode(
      displayMode === "scroll"
        ? "split"
        : displayMode === "split"
          ? "auto"
          : "scroll",
    );

  const modeIcon =
    displayMode === "scroll" ? (
      <AlignLeft className="w-5 h-5" />
    ) : displayMode === "split" ? (
      <Columns className="w-5 h-5" />
    ) : (
      <Wand2 className="w-5 h-5" />
    );

  const zoomIn = () => setZoom(Math.min(3, Math.round((zoom + 0.1) * 100) / 100));
  const zoomOut = () =>
    setZoom(Math.max(0.5, Math.round((zoom - 0.1) * 100) / 100));

  // Zoom out until the whole song fits vertically (scroll mode only). Content
  // height scales with zoom, but fixed margins make it non-linear, so we
  // estimate then refine over a couple of frames until it actually fits.
  const fitToScreen = () => {
    const run = (passesLeft: number) => {
      const node = scrollRef.current;
      if (!node) return;
      const availH = node.clientHeight - 2 * EDGE;
      const contentH = node.scrollHeight - 2 * EDGE;
      if (availH <= 0 || contentH <= 0) return;
      if (contentH <= availH + 1) return; // already fits

      const current = layout.effectiveZoom;
      const ratio = availH / contentH;
      if (!Number.isFinite(ratio) || ratio <= 0) return;
      const next = Math.max(0.5, Math.floor(current * ratio * 100) / 100);
      if (next >= current) return; // at min zoom
      setZoom(next);
      if (passesLeft > 0) requestAnimationFrame(() => run(passesLeft - 1));
    };
    run(3);
  };

  const translate = -pageIndex * layout.pageWidth;

  return (
    <div className="flex flex-col h-full bg-background relative overflow-hidden">
      {/* Top Bar */}
      <header className="flex items-center justify-between p-2 border-b border-border bg-card shadow-sm z-10 shrink-0">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            className="md:hidden"
          >
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex flex-col max-w-[160px] sm:max-w-xs md:max-w-md">
            <h1
              className="font-bold truncate text-foreground leading-tight"
              style={{ fontSize: `${titleFontSize}px` }}
            >
              {song.title}
            </h1>
            <span className="text-sm text-muted-foreground truncate leading-none">
              {song.artist}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {/* Transpose */}
          <div className="flex items-center bg-muted rounded-md overflow-hidden mr-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-none"
              onClick={() => setTranspose((t) => t - 1)}
            >
              <span className="font-bold">♭</span>
            </Button>
            <div className="w-8 text-center text-sm font-medium">
              {transpose > 0 ? `+${transpose}` : transpose}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-none"
              onClick={() => setTranspose((t) => t + 1)}
            >
              <span className="font-bold">♯</span>
            </Button>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={cycleMode}
            title={`Layout: ${displayMode} (tap to change)`}
          >
            {modeIcon}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLyricsOnly(!lyricsOnly)}
            title="Lyrics Only"
          >
            <Eye
              className={`w-5 h-5 ${lyricsOnly ? "text-primary" : "text-muted-foreground"}`}
            />
          </Button>

          <SettingsDialog />
        </div>
      </header>

      {/* Song Body — a stable measured frame that hosts either the scroll
          viewport or the paginated split pager. */}
      <div ref={frameRef} className="flex-1 relative overflow-hidden">
        {isSplit ? (
          <div className="absolute inset-0" style={{ padding: EDGE }}>
            <div className="relative w-full h-full overflow-hidden">
              <div
                ref={pagerRef}
                style={{
                  height: "100%",
                  columnWidth: `${layout.columnWidth}px`,
                  columnGap: `${layout.columnGap}px`,
                  columnFill: "auto",
                  transform: `translateX(${translate}px)`,
                  transition: "transform 220ms ease",
                  willChange: "transform",
                }}
              >
                <ChordRenderer
                  text={song.lyricsChords}
                  zoom={layout.effectiveZoom}
                  transpose={transpose}
                  lyricsOnly={lyricsOnly}
                  lyricsFontSize={lyricsFontSize}
                  chordsFontSize={chordsFontSize}
                  accentColor={accentColor}
                />
              </div>

              {/* Page-turn tap zones (left = prev, right = next). */}
              <button
                type="button"
                aria-label="Previous page"
                onClick={prevPage}
                className="absolute inset-y-0 left-0 w-1/2 cursor-w-resize disabled:cursor-default"
                disabled={pageIndex <= 0}
              />
              <button
                type="button"
                aria-label="Next page"
                onClick={nextPage}
                className="absolute inset-y-0 right-0 w-1/2 cursor-e-resize disabled:cursor-default"
                disabled={pageIndex >= pageCount - 1}
              />

              {/* Page indicator */}
              {pageCount > 1 && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-card/90 border border-border px-3 py-1 text-xs font-medium shadow-sm pointer-events-none">
                  <ChevronLeft
                    className={`w-3.5 h-3.5 ${pageIndex <= 0 ? "opacity-30" : ""}`}
                  />
                  {pageIndex + 1} / {pageCount}
                  <ChevronRight
                    className={`w-3.5 h-3.5 ${pageIndex >= pageCount - 1 ? "opacity-30" : ""}`}
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div
            ref={scrollRef}
            className="absolute inset-0 overflow-x-hidden overflow-y-auto"
            style={{ padding: EDGE }}
          >
            <ChordRenderer
              text={song.lyricsChords}
              zoom={layout.effectiveZoom}
              transpose={transpose}
              lyricsOnly={lyricsOnly}
              lyricsFontSize={lyricsFontSize}
              chordsFontSize={chordsFontSize}
              accentColor={accentColor}
            />
          </div>
        )}
      </div>

      {/* Hidden measurer: a zoom-1 mirror of the song used purely to measure the
          widest chord line for the width-safe zoom clamp. Never shown. */}
      {!lyricsOnly && (
        <div
          ref={measureRef}
          aria-hidden
          className="pointer-events-none"
          style={{
            position: "absolute",
            visibility: "hidden",
            display: "inline-block",
            left: -99999,
            top: 0,
            zIndex: -1,
            width: "auto",
          }}
        >
          <ChordRenderer
            text={song.lyricsChords}
            zoom={1}
            transpose={transpose}
            lyricsOnly={lyricsOnly}
            lyricsFontSize={lyricsFontSize}
            chordsFontSize={chordsFontSize}
            accentColor={accentColor}
          />
        </div>
      )}

      {/* Floating Controls (sit above the scroll scrubber and tap zones) */}
      <div
        data-no-page-nav
        className="absolute bottom-[5.5rem] right-4 sm:right-6 flex flex-col gap-3 items-center z-20"
      >
        <div className="flex flex-col bg-card border border-border shadow-lg rounded-full overflow-hidden">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-none"
            onClick={zoomIn}
            aria-label="Zoom in"
          >
            <Plus className="w-4 h-4" />
          </Button>
          {!isSplit && (
            <>
              <div className="h-[1px] w-full bg-border" />
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-none text-[11px] font-semibold"
                onClick={fitToScreen}
                aria-label="Fit song to screen"
                title="Fit whole song on screen"
              >
                Fit
              </Button>
            </>
          )}
          <div className="h-[1px] w-full bg-border" />
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-none"
            onClick={zoomOut}
            aria-label="Zoom out"
          >
            <Minus className="w-4 h-4" />
          </Button>
        </div>

        <Metronome />

        <Button
          size="icon"
          variant={hasMedia ? "default" : "outline"}
          className={`h-14 w-14 rounded-full shadow-xl ${hasMedia ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-card"}`}
          onPointerDown={onMediaPointerDown}
          onPointerUp={onMediaPointerUp}
          onPointerLeave={clearPress}
          onPointerCancel={clearPress}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleMediaTap();
            }
          }}
          aria-label={mediaLabel()}
          title="Media player (long-press for options)"
        >
          {mediaIcon()}
        </Button>
      </div>

      {/* Auto-scroll scrubber — only meaningful in single-column scroll mode. */}
      {!isSplit && (
        <BottomScrollScrubber scrollRef={scrollRef} songId={song.id} />
      )}

      <MediaPlayerModal
        song={song}
        audio={audio}
        youtube={yt}
        ytWrapperRef={ytWrapperRef}
        open={mediaOpen}
        onOpenChange={setMediaOpen}
      />
    </div>
  );
}
