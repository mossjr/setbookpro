import { useState, useRef, useEffect } from "react";
import {
  useGetSong,
  getGetSongQueryKey,
  useGetSet,
  getGetSetQueryKey,
} from "@workspace/api-client-react";
import { useAppStore, useSettingsStore, useGigStore } from "@/store";
import {
  claimHost,
  releaseHost,
  hostPresent,
  hostScrollStart,
  hostScrollSeek,
  hostScrollStop,
} from "@/lib/gig";
import ChordRenderer from "./ChordRenderer";
import Metronome from "./Metronome";
import MediaPlayerModal from "./MediaPlayerModal";
import ScrollScrubber from "./ScrollScrubber";
import SettingsDialog from "./SettingsDialog";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useYouTubePlayer } from "@/hooks/useYouTubePlayer";
import { useSongViewLayout, EDGE } from "@/hooks/useSongViewLayout";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { usePinchZoom } from "@/hooks/usePinchZoom";
import { useIsMobile } from "@/hooks/use-mobile";
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
  SkipBack,
  SkipForward,
  Star,
  Radio,
} from "lucide-react";

// Horizontal safe zones so song content never renders under floating overlays.
// Left clears the collapsed-sidebar reveal tab (Layout.tsx, w-7 ≈ 28px); only
// reserved while the desktop sidebar is collapsed (the tab is hidden otherwise).
// Right clears the floating control stack (media FAB w-14 = 56px + edge offset).
const SAFE_LEFT = 24;
const SAFE_RIGHT = 72;

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
    participantZoom,
    setParticipantZoom,
    participantLyricsOnly,
    setParticipantLyricsOnly,
    setSidebarOpen,
    desktopSidebarOpen,
    setDesktopSidebarOpen,
    activeSetId,
    setSelectedSongId,
    lastPlayedSongId,
    setLastPlayedSongId,
  } = useAppStore();

  const { titleFontSize, lyricsFontSize, chordsFontSize, accentColor } =
    useSettingsStore();

  // --- Live gig role ------------------------------------------------------
  const role = useGigStore((s) => s.role);
  const hostTranspose = useGigStore((s) => s.hostTranspose);
  const hostMode = useGigStore((s) => s.hostMode);
  const scrollCmd = useGigStore((s) => s.scrollCmd);
  const isHost = role === "host";
  const isParticipant = role === "participant";
  // Participants follow the host's scroll when both are in scroll mode; when the
  // host is paging they get their own auxiliary scroll controls instead.
  const participantFollows = isParticipant && hostMode === "scroll";

  // Participants mirror the host's transpose; everyone else controls their own.
  // Zoom and lyrics-only are always per-device, but participants keep a separate
  // persisted set so toggling roles never clobbers their own preferences.
  const userZoom = isParticipant ? participantZoom : zoom;
  const applyZoom = isParticipant ? setParticipantZoom : setZoom;
  const effectiveLyricsOnly = isParticipant ? participantLyricsOnly : lyricsOnly;
  const applyLyricsOnly = isParticipant
    ? setParticipantLyricsOnly
    : setLyricsOnly;

  // Active set (for in-header Prev/Next navigation). Called before any early
  // return to keep hook order stable; shares cache with the Sidebar via key.
  const { data: activeSet } = useGetSet(activeSetId ?? "", {
    query: {
      enabled: !!activeSetId,
      queryKey: getGetSetQueryKey(activeSetId ?? ""),
    },
  });

  const [transpose, setTranspose] = useState(0);
  // Participants render at the host's transpose; everyone else uses their own.
  const effectiveTranspose = isParticipant ? hostTranspose : transpose;
  const [mediaOpen, setMediaOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const pagerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  // Live-scaled during a pinch gesture; reflows on release.
  const scrollContentRef = useRef<HTMLDivElement>(null);
  const splitStageRef = useRef<HTMLDivElement>(null);

  // Single auto-scroll engine for this view; shared by the scrubber (host /
  // solo / aux) and by participant follow-mode.
  const scroller = useAutoScroll(scrollRef);

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

  // Reserve the left safe zone only on desktop while the reveal tab is showing
  // (the tab is `hidden md:flex`, so it never appears on mobile — and a collapsed
  // state can persist from a desktop session). The right zone is always reserved
  // for the floating controls.
  const isMobile = useIsMobile();
  const safeLeft = !isMobile && !desktopSidebarOpen ? SAFE_LEFT : 0;
  const safeRight = SAFE_RIGHT;

  // Layout hook is called BEFORE any early return to keep hook order stable.
  const layout = useSongViewLayout({
    displayMode,
    userZoom,
    lyricsOnly: effectiveLyricsOnly,
    lyricsFontSize,
    frameRef,
    pagerRef,
    measureRef,
    safeLeft,
    safeRight,
    recomputeKey: `${song?.id ?? ""}|${effectiveTranspose}|${effectiveLyricsOnly ? 1 : 0}|${lyricsFontSize}|${chordsFontSize}|${userZoom}|${displayMode}`,
  });

  const isSplit = layout.effectiveMode === "split";
  const { pageIndex, pageCount, nextPage, prevPage } = layout;

  // Pinch-to-zoom (touch): scale the content live, commit + reflow on release.
  usePinchZoom({
    frameRef,
    enabled: !!song,
    getStage: () => (isSplit ? splitStageRef.current : scrollContentRef.current),
    getZoom: () => userZoom,
    setZoom: applyZoom,
    min: 0.5,
    max: 3,
  });

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

  // HOST: broadcast what we're presenting so participants mirror song,
  // transpose, and scroll-vs-page mode.
  useEffect(() => {
    if (!isHost || !song) return;
    hostPresent({
      songId: song.id,
      transpose,
      hostMode: isSplit ? "page" : "scroll",
    });
  }, [isHost, song?.id, transpose, isSplit]);

  // PARTICIPANT (scroll-follow): apply the host's scroll commands. The engine
  // re-derives speed so this device lands at the bottom at the same time as the
  // host regardless of its own font size / pixel height.
  useEffect(() => {
    if (!participantFollows || isSplit || !scrollCmd) return;
    if (scrollCmd.type === "start") {
      scroller.startFollow(scrollCmd.fraction, scrollCmd.ms);
    } else if (scrollCmd.type === "seek") {
      scroller.seekFollow(scrollCmd.fraction, scrollCmd.ms);
    } else {
      scroller.stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollCmd?.seq, participantFollows, isSplit]);

  // Halt the engine whenever follow no longer applies (host starts paging, this
  // device switches to split, role changes) so no orphaned scroll keeps running.
  useEffect(() => {
    if (!participantFollows || isSplit) scroller.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participantFollows, isSplit]);

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

  // Set navigation: move through the active set in order.
  const setSongs = activeSet?.songs ?? [];
  const inActiveSet = !!activeSetId && setSongs.length > 0;
  const setIndex = inActiveSet
    ? setSongs.findIndex((s) => s.id === song.id)
    : -1;
  const canPrev = setIndex > 0;
  const canNext =
    inActiveSet && (setIndex < 0 || setIndex < setSongs.length - 1);
  const goPrev = () => {
    if (canPrev) setSelectedSongId(setSongs[setIndex - 1].id);
  };
  const goNext = () => {
    if (!inActiveSet) return;
    if (setIndex < 0) setSelectedSongId(setSongs[0].id);
    else if (setIndex < setSongs.length - 1)
      setSelectedSongId(setSongs[setIndex + 1].id);
  };

  // "Last Played" bookmark: marks a single song so it's easy to return to.
  const isBookmarked = lastPlayedSongId === song.id;
  const toggleBookmark = () =>
    setLastPlayedSongId(isBookmarked ? null : song.id);

  // Claiming demotes any current host (newest-claim-wins, enforced server-side).
  const toggleHost = () => {
    if (isHost) {
      releaseHost();
    } else {
      claimHost({
        songId: song.id,
        transpose,
        hostMode: isSplit ? "page" : "scroll",
      });
    }
  };

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

  const zoomIn = () =>
    applyZoom(Math.min(3, Math.round((userZoom + 0.1) * 100) / 100));
  const zoomOut = () =>
    applyZoom(Math.max(0.5, Math.round((userZoom - 0.1) * 100) / 100));

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
      applyZoom(next);
      if (passesLeft > 0) requestAnimationFrame(() => run(passesLeft - 1));
    };
    run(3);
  };

  const translate = -pageIndex * layout.pageWidth;

  // Participants in scroll-follow mode have no manual scrubber; the host (and
  // solo/idle users, and participants when the host is paging) keep one.
  const showScrubber = !isSplit && !participantFollows;

  return (
    <div className="flex flex-col h-full bg-background relative overflow-hidden">
      {/* Top Bar */}
      <header className="flex items-center justify-between p-2 border-b border-border bg-card shadow-sm z-10 shrink-0">
        <div className="flex items-center gap-2">
          {!isParticipant && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
              className="md:hidden"
            >
              <Menu className="w-5 h-5" />
            </Button>
          )}
          {!isParticipant && inActiveSet && (
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={goPrev}
                disabled={!canPrev}
                title="Previous song"
                aria-label="Previous song"
              >
                <SkipBack className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={goNext}
                disabled={!canNext}
                title="Next song"
                aria-label="Next song"
              >
                <SkipForward className="w-4 h-4" />
              </Button>
            </div>
          )}
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
          {/* Transpose — host/solo only; participants follow the host's key. */}
          {!isParticipant && (
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
          )}

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
            onClick={() => applyLyricsOnly(!effectiveLyricsOnly)}
            title="Lyrics Only"
          >
            <Eye
              className={`w-5 h-5 ${effectiveLyricsOnly ? "text-primary" : "text-muted-foreground"}`}
            />
          </Button>

          {!isParticipant && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleBookmark}
              title={isBookmarked ? "Clear Last Played" : "Mark as Last Played"}
              aria-label="Last Played"
            >
              <Star
                className={`w-5 h-5 ${isBookmarked ? "text-primary fill-primary" : "text-muted-foreground"}`}
              />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleHost}
            title={isHost ? "Stop hosting" : "Host this session"}
            aria-label={isHost ? "Stop hosting" : "Host this session"}
            aria-pressed={isHost}
          >
            <Radio
              className={`w-5 h-5 ${isHost ? "text-primary" : "text-muted-foreground"}`}
            />
          </Button>

          <SettingsDialog />
        </div>
      </header>

      {isParticipant && (
        <div className="flex items-center justify-center gap-2 bg-primary/10 text-primary text-xs font-medium py-1.5 px-3 shrink-0 border-b border-border">
          <Radio className="w-3.5 h-3.5" />
          {hostMode === "scroll"
            ? "Following host"
            : "Following host — scroll on your own"}
        </div>
      )}

      {/* Auto-scroll scrubber — pinned to the top to keep clear of the
          bottom-edge app-switcher gesture; only used in scroll mode. The host
          broadcasts its scroll; idle/aux usage stays local to the device. */}
      {showScrubber && (
        <ScrollScrubber
          scroller={scroller}
          songId={song.id}
          {...(isHost
            ? {
                onHostStart: (fraction, durationMs) =>
                  hostScrollStart({ fraction, durationMs }),
                onHostSeek: (fraction, remainingMs) =>
                  hostScrollSeek({ fraction, remainingMs }),
                onHostStop: (fraction) => hostScrollStop(fraction),
              }
            : {})}
        />
      )}

      {/* Song Body — a stable measured frame that hosts either the scroll
          viewport or the paginated split pager. Tapping the song collapses the
          desktop sidebar so the music can fill the screen. */}
      <div
        ref={frameRef}
        className="flex-1 relative overflow-hidden"
        onClick={() => {
          // Tap the song to give it the full screen — desktop widths only, so
          // a mobile tap never persists a collapsed sidebar for later desktop use.
          if (
            desktopSidebarOpen &&
            window.matchMedia("(min-width: 768px)").matches
          ) {
            setDesktopSidebarOpen(false);
          }
        }}
      >
        {isSplit ? (
          <div
            className="absolute inset-0"
            style={{
              paddingTop: EDGE,
              paddingBottom: EDGE,
              paddingLeft: EDGE + safeLeft,
              paddingRight: EDGE + safeRight,
            }}
          >
            <div
              ref={splitStageRef}
              className="relative w-full h-full overflow-hidden"
            >
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
                  transpose={effectiveTranspose}
                  lyricsOnly={effectiveLyricsOnly}
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
            style={{
              paddingTop: EDGE,
              paddingBottom: EDGE,
              paddingLeft: EDGE + safeLeft,
              paddingRight: EDGE + safeRight,
            }}
          >
            <div ref={scrollContentRef}>
              <ChordRenderer
                text={song.lyricsChords}
                zoom={layout.effectiveZoom}
                transpose={effectiveTranspose}
                lyricsOnly={effectiveLyricsOnly}
                lyricsFontSize={lyricsFontSize}
                chordsFontSize={chordsFontSize}
                accentColor={accentColor}
              />
            </div>
          </div>
        )}
      </div>

      {/* Hidden measurer: a zoom-1 mirror of the song used purely to measure the
          widest chord line for the width-safe zoom clamp. Never shown. */}
      {!effectiveLyricsOnly && (
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
            transpose={effectiveTranspose}
            lyricsOnly={effectiveLyricsOnly}
            lyricsFontSize={lyricsFontSize}
            chordsFontSize={chordsFontSize}
            accentColor={accentColor}
          />
        </div>
      )}

      {/* Floating Controls (sit above the page-turn tap zones) */}
      <div
        data-no-page-nav
        className="absolute bottom-6 right-4 sm:right-6 flex flex-col gap-3 items-center z-20"
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
