import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useGetSong, getGetSongQueryKey } from "@workspace/api-client-react";
import { useAppStore, useSettingsStore } from "@/store";
import ChordRenderer from "./ChordRenderer";
import Metronome from "./Metronome";
import MediaPlayerModal from "./MediaPlayerModal";
import BottomScrollScrubber from "./BottomScrollScrubber";
import SettingsDialog from "./SettingsDialog";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useYouTubePlayer } from "@/hooks/useYouTubePlayer";
import { resolveAudioUrl, parseSpotifyEmbedUrl } from "@/lib/media";
import { parseYouTubeId } from "@/lib/youtube";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Menu,
  Columns,
  AlignLeft,
  Minus,
  Plus,
  Play,
  Pause,
  Music,
  Music2,
  Eye,
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
  const spotifyEmbed =
    song?.mediaType === "spotify" && song.spotifyLink
      ? parseSpotifyEmbedUrl(song.spotifyLink)
      : null;

  // Persistent host node for the YouTube/Spotify iframe. Created once and
  // physically relocated (appendChild) between the in-modal slot and the
  // closed-state mini-player, so playback survives the modal opening/closing.
  const ytHostRef = useRef<HTMLDivElement | null>(null);
  if (ytHostRef.current === null && typeof document !== "undefined") {
    ytHostRef.current = document.createElement("div");
    ytHostRef.current.style.width = "100%";
  }
  const ytInnerRef = useRef<HTMLDivElement>(null);
  const closedSlotRef = useRef<HTMLDivElement>(null);
  const modalSlotRef = useRef<HTMLDivElement>(null);

  const yt = useYouTubePlayer(ytInnerRef, youtubeVideoId);

  // Move the persistent host into whichever slot is currently mounted/visible.
  // appendChild on the same node keeps the iframe alive (never unmounted), so
  // YouTube playback continues across modal toggles. Runs before paint so the
  // node is never painted inside a hidden slot.
  useLayoutEffect(() => {
    const host = ytHostRef.current;
    if (!host) return;
    const target = mediaOpen ? modalSlotRef.current : closedSlotRef.current;
    if (target && host.parentElement !== target) {
      target.appendChild(host);
    }
  });

  const handleMediaOpenChange = (next: boolean) => {
    // When closing, move the persistent host back to the always-mounted slot
    // BEFORE the dialog unmounts. Otherwise the host (an imperative child of the
    // modal slot) is torn down with the dialog subtree, reloading the iframe.
    if (!next) {
      const host = ytHostRef.current;
      const home = closedSlotRef.current;
      if (host && home && host.parentElement !== home) {
        home.appendChild(host);
      }
    }
    setMediaOpen(next);
  };

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
      case "spotify":
        // Spotify embeds can't be controlled programmatically; open the modal.
        setMediaOpen(true);
        break;
      default:
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
    if (song.mediaType === "spotify") return <Music2 className="w-6 h-6" />;
    return <Music className="w-6 h-6" />;
  };

  const mediaLabel = () => {
    switch (song.mediaType) {
      case "audio":
        return audio.isPlaying ? "Pause audio" : "Play audio";
      case "youtube":
        return yt.isPlaying ? "Pause video" : "Play video";
      case "spotify":
        return "Open media player";
      default:
        return "Add media";
    }
  };

  const hasMedia = song.mediaType !== "none";
  const showMiniPlayer =
    !mediaOpen &&
    (song.mediaType === "youtube" || song.mediaType === "spotify");

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
            onClick={() =>
              setDisplayMode(displayMode === "columns" ? "scroll" : "columns")
            }
            title="Toggle Layout"
          >
            {displayMode === "columns" ? (
              <Columns className="w-5 h-5" />
            ) : (
              <AlignLeft className="w-5 h-5" />
            )}
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

      {/* Song Body */}
      <div
        ref={scrollRef}
        className={`flex-1 overflow-auto p-4 md:p-8 ${displayMode === "columns" ? "md:columns-2 md:gap-8" : ""}`}
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

      {/* Floating Controls (sit above the scroll scrubber) */}
      <div className="absolute bottom-[4.5rem] right-4 sm:right-6 flex flex-col gap-3 items-center z-20">
        <div className="flex flex-col bg-card border border-border shadow-lg rounded-full overflow-hidden">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-none"
            onClick={() => setZoom(Math.min(3, zoom + 0.1))}
          >
            <Plus className="w-4 h-4" />
          </Button>
          <div className="h-[1px] w-full bg-border" />
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-none"
            onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
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

      {/* Always-visible auto-scroll speed scrubber */}
      <BottomScrollScrubber scrollRef={scrollRef} />

      {/* Persistent mini-player: keeps YouTube/Spotify audible while the modal
          is closed. The shared host node docks here (visible) or in the modal. */}
      <div
        ref={closedSlotRef}
        className={cn(
          "fixed left-4 bottom-[4.5rem] z-30 w-44 overflow-hidden rounded-lg border border-border bg-black shadow-xl sm:w-56",
          showMiniPlayer ? "block" : "hidden",
        )}
      />

      {/* Host contents rendered via portal into the relocatable node above. */}
      {ytHostRef.current &&
        createPortal(
          <>
            {song.mediaType === "youtube" && youtubeVideoId && (
              <div className="aspect-video w-full bg-black">
                <div ref={ytInnerRef} className="h-full w-full" />
              </div>
            )}
            {song.mediaType === "spotify" && spotifyEmbed && (
              <iframe
                title="Spotify player"
                src={spotifyEmbed}
                className="w-full"
                height={152}
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
              />
            )}
          </>,
          ytHostRef.current,
        )}

      <MediaPlayerModal
        song={song}
        audio={audio}
        youtube={yt}
        youtubeSlotRef={modalSlotRef}
        open={mediaOpen}
        onOpenChange={handleMediaOpenChange}
      />
    </div>
  );
}
