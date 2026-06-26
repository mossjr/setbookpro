import { useRef, useState, useEffect, type RefObject } from "react";
import {
  type Song,
  type MediaSearchItem,
  SongUpdateMediaType,
  useUpdateSong,
  useSearchYoutube,
  getSearchYoutubeQueryKey,
  getGetSongQueryKey,
  getListSongsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { type AudioController } from "@/hooks/useAudioPlayer";
import { type YouTubeController } from "@/hooks/useYouTubePlayer";
import { useAudioUpload } from "@/lib/upload";
import { parseYouTubeId } from "@/lib/youtube";
import { formatTime } from "@/lib/media";
import { cn } from "@/lib/utils";
import {
  Play,
  Pause,
  Upload,
  Trash2,
  FileAudio,
  Youtube,
  Loader2,
  Search,
  X,
} from "lucide-react";

interface MediaPlayerModalProps {
  song: Song;
  audio: AudioController;
  youtube: YouTubeController;
  /** Container (owned by SongView) where the persistent YouTube iframe lives. */
  ytWrapperRef: RefObject<HTMLDivElement | null>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TransportProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onToggle: () => void;
  onSeek: (time: number) => void;
  disabled?: boolean;
}

/** Generic play/pause + scrub transport, identical for every media source. */
function MediaTransport({
  isPlaying,
  currentTime,
  duration,
  onToggle,
  onSeek,
  disabled,
}: TransportProps) {
  return (
    <div className="flex items-center gap-3 w-full">
      <Button
        size="icon"
        className="h-12 w-12 rounded-full shrink-0"
        onClick={onToggle}
        disabled={disabled}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? (
          <Pause className="w-5 h-5" />
        ) : (
          <Play className="w-5 h-5 ml-0.5" />
        )}
      </Button>
      <div className="flex-1 space-y-1">
        <Slider
          value={[currentTime]}
          min={0}
          max={duration || 1}
          step={0.1}
          onValueChange={([v]) => onSeek(v)}
          disabled={disabled || !duration}
          aria-label="Seek"
        />
        <div className="flex justify-between text-xs text-muted-foreground font-mono">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}

function SearchResults({
  items,
  isFetching,
  isError,
  emptyHint,
  onPick,
}: {
  items: MediaSearchItem[];
  isFetching: boolean;
  isError: boolean;
  emptyHint: string;
  onPick: (item: MediaSearchItem) => void;
}) {
  if (isFetching) {
    return (
      <div className="flex items-center justify-center py-6 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
      </div>
    );
  }
  if (isError) {
    return (
      <p className="text-xs text-destructive py-3 text-center">
        Search failed. Try again.
      </p>
    );
  }
  if (!items.length) {
    return (
      <p className="text-xs text-muted-foreground py-3 text-center">
        {emptyHint}
      </p>
    );
  }
  return (
    <div className="max-h-60 overflow-y-auto rounded-md border border-border divide-y divide-border/60">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onPick(item)}
          className="flex items-center gap-3 w-full p-2 text-left hover:bg-accent/50 transition-colors"
        >
          {item.thumbnail ? (
            <img
              src={item.thumbnail}
              alt=""
              loading="lazy"
              className="w-12 h-12 rounded object-cover shrink-0 bg-muted"
            />
          ) : (
            <div className="w-12 h-12 rounded bg-muted shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">{item.title}</div>
            <div className="text-xs text-muted-foreground truncate">
              {item.subtitle}
              {item.subtitle && item.durationLabel ? " · " : ""}
              {item.durationLabel}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

export default function MediaPlayerModal({
  song,
  audio,
  youtube,
  ytWrapperRef,
  open,
  onOpenChange,
}: MediaPlayerModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateMutation = useUpdateSong();
  const { upload, isUploading, progress } = useAudioUpload();

  const [youtubeInput, setYoutubeInput] = useState(song.youtubeUrl ?? "");

  const initialTerm = [song.title, song.artist]
    .filter(Boolean)
    .join(" ")
    .trim();
  const [ytTerm, setYtTerm] = useState(initialTerm);
  const [ytQuery, setYtQuery] = useState(initialTerm);
  const [ytSearchOpen, setYtSearchOpen] = useState(false);

  useEffect(() => {
    setYoutubeInput(song.youtubeUrl ?? "");
  }, [song.youtubeUrl]);

  useEffect(() => {
    const term = [song.title, song.artist].filter(Boolean).join(" ").trim();
    setYtTerm(term);
    setYtQuery(term);
    setYtSearchOpen(false);
  }, [song.id, song.title, song.artist]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  // Android ghost-click guard: a tap that opens the modal fires a synthetic
  // click event ~100-300 ms later at the same screen coords, which lands on
  // the backdrop and immediately closes the modal. Ignore backdrop clicks
  // within 350 ms of the modal opening.
  const openedAtRef = useRef<number>(0);
  useEffect(() => {
    if (open) openedAtRef.current = Date.now();
  }, [open]);

  const audioConfigured = !!song.audioUrl;
  const youtubeVideoId = song.youtubeUrl
    ? parseYouTubeId(song.youtubeUrl)
    : null;
  const youtubeConfigured = !!youtubeVideoId;

  const youtubeSearch = useSearchYoutube(
    { q: ytQuery },
    {
      query: {
        enabled: open && ytSearchOpen && ytQuery.trim().length > 0,
        queryKey: getSearchYoutubeQueryKey({ q: ytQuery }),
        staleTime: 5 * 60 * 1000,
        retry: false,
      },
    },
  );

  // Keep the iframe alive (opacity, not display:none) when closed so audio
  // keeps playing; mark the offscreen subtree inert/hidden from a11y.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    if (open) el.removeAttribute("inert");
    else el.setAttribute("inert", "");
  }, [open]);

  // Focus trap, Escape-to-close, scroll lock, and focus restoration.
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const getFocusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => el.offsetParent !== null);

    (getFocusable()[0] ?? dialog)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
        return;
      }
      if (e.key !== "Tab") return;
      const items = getFocusable();
      if (items.length === 0) {
        e.preventDefault();
        dialog?.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (dialog && active && !dialog.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, onOpenChange]);

  const persist = (data: Parameters<typeof updateMutation.mutate>[0]["data"]) => {
    updateMutation.mutate(
      { id: song.id, data },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getGetSongQueryKey(song.id),
          });
          // List caches hold full song rows (sidebar, export), so refresh them too.
          queryClient.invalidateQueries({ queryKey: getListSongsQueryKey() });
        },
        onError: () =>
          toast({ title: "Could not save media", variant: "destructive" }),
      },
    );
  };

  const setActive = (type: SongUpdateMediaType) => {
    // Stop whichever controllable source is no longer the active one.
    if (type !== "audio") audio.pause();
    if (type !== "youtube") youtube.pause();
    persist({ mediaType: type });
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("audio/")) {
      toast({ title: "Please choose an audio file", variant: "destructive" });
      return;
    }
    const result = await upload(file);
    if (!result) {
      toast({ title: "Upload failed", variant: "destructive" });
      return;
    }
    youtube.pause();
    persist({
      mediaType: "audio",
      audioUrl: result.objectPath,
      audioFileName: file.name,
      audioContentType: file.type,
      audioSize: file.size,
    });
    toast({ title: "Audio uploaded" });
  };

  const removeAudio = () => {
    audio.pause();
    persist({
      mediaType: song.mediaType === "audio" ? "none" : song.mediaType,
      audioUrl: null,
      audioFileName: null,
      audioContentType: null,
      audioSize: null,
    });
  };

  const saveYoutube = () => {
    if (!parseYouTubeId(youtubeInput)) {
      toast({ title: "Not a valid YouTube link", variant: "destructive" });
      return;
    }
    audio.pause();
    persist({ mediaType: "youtube", youtubeUrl: youtubeInput.trim() });
  };

  const removeYoutube = () => {
    youtube.pause();
    persist({
      mediaType: song.mediaType === "youtube" ? "none" : song.mediaType,
      youtubeUrl: null,
    });
  };

  const runYoutubeSearch = () => {
    const term = ytTerm.trim();
    if (!term) return;
    setYtQuery(term);
    setYtSearchOpen(true);
  };

  const pickYoutube = (item: MediaSearchItem) => {
    audio.pause();
    setYoutubeInput(item.url);
    persist({ mediaType: "youtube", youtubeUrl: item.url });
    setYtSearchOpen(false);
    toast({ title: `YouTube set: ${item.title}` });
  };

  const sourceButtons: {
    type: SongUpdateMediaType;
    label: string;
    icon: React.ReactNode;
    configured: boolean;
  }[] = [
    {
      type: "audio",
      label: "Audio",
      icon: <FileAudio className="w-4 h-4" />,
      configured: audioConfigured,
    },
    {
      type: "youtube",
      label: "YouTube",
      icon: <Youtube className="w-4 h-4" />,
      configured: youtubeConfigured,
    },
  ];

  // Which generic transport drives the active source.
  const activeTransport =
    song.mediaType === "audio" && audioConfigured ? (
      <MediaTransport
        isPlaying={audio.isPlaying}
        currentTime={audio.currentTime}
        duration={audio.duration}
        onToggle={audio.toggle}
        onSeek={audio.seek}
      />
    ) : song.mediaType === "youtube" && youtubeConfigured ? (
      <MediaTransport
        isPlaying={youtube.isPlaying}
        currentTime={youtube.currentTime}
        duration={youtube.duration}
        onToggle={youtube.toggle}
        onSeek={youtube.seek}
        disabled={!youtube.ready}
      />
    ) : null;

  return (
    <div
      ref={rootRef}
      aria-hidden={!open}
      className={cn(
        "fixed inset-0 z-50 flex items-end sm:items-center justify-center transition-opacity duration-200",
        open ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => {
          if (Date.now() - openedAtRef.current < 350) return;
          onOpenChange(false);
        }}
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Media player: ${song.title}`}
        tabIndex={-1}
        className={cn(
          "relative z-10 w-full sm:max-w-lg max-h-[88vh] overflow-y-auto bg-background shadow-xl outline-none",
          "rounded-t-2xl sm:rounded-2xl border border-border p-5 space-y-4",
          "transition-transform duration-200",
          open ? "translate-y-0" : "translate-y-4 sm:translate-y-0",
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-semibold truncate leading-tight">
              {song.title}
            </h2>
            <p className="text-sm text-muted-foreground truncate">
              {song.artist}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 -mr-2 -mt-1"
            onClick={() => onOpenChange(false)}
            aria-label="Close media player"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Source switcher (only enabled once a source is attached) */}
        <div className="flex gap-2">
          {sourceButtons.map((s) => (
            <Button
              key={s.type}
              variant={song.mediaType === s.type ? "default" : "outline"}
              className="flex-1 gap-2"
              disabled={!s.configured}
              onClick={() => setActive(s.type)}
            >
              {s.icon}
              <span>{s.label}</span>
            </Button>
          ))}
        </div>

        {/* Player surface */}
        <div className="space-y-3">
          {/* YouTube video container — ALWAYS mounted so the iframe persists
              across open/close (it is never moved or unmounted, so it never
              reloads). Hidden unless YouTube is the active source. */}
          <div className={cn(song.mediaType === "youtube" ? "block" : "hidden")}>
            <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
              <div ref={ytWrapperRef} className="h-full w-full" />
            </div>
          </div>

          {activeTransport}

          {song.mediaType === "audio" && audioConfigured && song.audioFileName && (
            <p className="text-xs text-muted-foreground truncate">
              {song.audioFileName}
            </p>
          )}

          {!activeTransport && (
            <p className="text-sm text-muted-foreground text-center py-3">
              No media attached yet. Add a source below.
            </p>
          )}
        </div>

        <div className="h-px bg-border" />

        {/* Setup / sources */}
        <div className="space-y-5">
          {/* Uploaded audio */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <FileAudio className="w-4 h-4" /> Uploaded audio
            </Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
            {audioConfigured ? (
              <div className="flex items-center gap-2">
                <span className="flex-1 text-sm truncate text-muted-foreground">
                  {song.audioFileName || "audio file"}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  Replace
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={removeAudio}
                  disabled={isUploading}
                  aria-label="Remove audio"
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                {isUploading ? "Uploading..." : "Upload audio file"}
              </Button>
            )}
            {isUploading && <Progress value={progress} className="h-1" />}
          </div>

          {/* YouTube */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Youtube className="w-4 h-4" /> YouTube
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search YouTube…"
                  value={ytTerm}
                  onChange={(e) => setYtTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      runYoutubeSearch();
                    }
                  }}
                />
              </div>
              <Button onClick={runYoutubeSearch} disabled={!ytTerm.trim()}>
                Search
              </Button>
            </div>
            {ytSearchOpen && (
              <SearchResults
                items={youtubeSearch.data?.results ?? []}
                isFetching={youtubeSearch.isFetching}
                isError={!!youtubeSearch.error}
                emptyHint="No videos found."
                onPick={pickYoutube}
              />
            )}
            <div className="flex gap-2">
              <Input
                placeholder="or paste a YouTube link"
                value={youtubeInput}
                onChange={(e) => setYoutubeInput(e.target.value)}
              />
              <Button
                variant="secondary"
                onClick={saveYoutube}
                disabled={!youtubeInput.trim()}
              >
                Save
              </Button>
              {youtubeConfigured && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={removeYoutube}
                  aria-label="Remove YouTube"
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
