import { useRef, useState, useEffect, type RefObject } from "react";
import {
  type Song,
  type MediaSearchItem,
  SongUpdateMediaType,
  useUpdateSong,
  useSearchYoutube,
  getSearchYoutubeQueryKey,
  useSearchSpotify,
  getSearchSpotifyQueryKey,
  getGetSongQueryKey,
  getListSongsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { parseSpotifyEmbedUrl, formatTime } from "@/lib/media";
import {
  Play,
  Pause,
  Upload,
  Trash2,
  FileAudio,
  Youtube,
  Music2,
  Loader2,
  Search,
} from "lucide-react";

interface MediaPlayerModalProps {
  song: Song;
  audio: AudioController;
  youtube: YouTubeController;
  youtubeSlotRef: RefObject<HTMLDivElement | null>;
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
  notConfigured,
  emptyHint,
  onPick,
}: {
  items: MediaSearchItem[];
  isFetching: boolean;
  isError: boolean;
  notConfigured?: boolean;
  emptyHint: string;
  onPick: (item: MediaSearchItem) => void;
}) {
  if (notConfigured) {
    return (
      <p className="text-xs text-muted-foreground py-3 text-center">
        Spotify search isn’t set up on the server yet.
      </p>
    );
  }
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
  youtubeSlotRef,
  open,
  onOpenChange,
}: MediaPlayerModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateMutation = useUpdateSong();
  const { upload, isUploading, progress } = useAudioUpload();

  const [spotifyInput, setSpotifyInput] = useState(song.spotifyLink ?? "");
  const [youtubeInput, setYoutubeInput] = useState(song.youtubeUrl ?? "");

  const initialTerm = [song.title, song.artist]
    .filter(Boolean)
    .join(" ")
    .trim();
  const [spTerm, setSpTerm] = useState(initialTerm);
  const [spQuery, setSpQuery] = useState(initialTerm);
  const [spSearchOpen, setSpSearchOpen] = useState(false);
  const [ytTerm, setYtTerm] = useState(initialTerm);
  const [ytQuery, setYtQuery] = useState(initialTerm);
  const [ytSearchOpen, setYtSearchOpen] = useState(false);

  useEffect(() => {
    setSpotifyInput(song.spotifyLink ?? "");
    setYoutubeInput(song.youtubeUrl ?? "");
  }, [song.spotifyLink, song.youtubeUrl]);

  useEffect(() => {
    const term = [song.title, song.artist].filter(Boolean).join(" ").trim();
    setSpTerm(term);
    setSpQuery(term);
    setSpSearchOpen(false);
    setYtTerm(term);
    setYtQuery(term);
    setYtSearchOpen(false);
  }, [song.id, song.title, song.artist]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const audioConfigured = !!song.audioUrl;
  const spotifyConfigured = !!song.spotifyLink;
  const youtubeVideoId = song.youtubeUrl
    ? parseYouTubeId(song.youtubeUrl)
    : null;
  const youtubeConfigured = !!youtubeVideoId;

  const spotifySearch = useSearchSpotify(
    { q: spQuery },
    {
      query: {
        enabled: open && spSearchOpen && spQuery.trim().length > 0,
        queryKey: getSearchSpotifyQueryKey({ q: spQuery }),
        staleTime: 5 * 60 * 1000,
        retry: false,
      },
    },
  );
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
  const spotifyNotConfigured = spotifySearch.error?.status === 503;

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

  const saveSpotify = () => {
    const embed = parseSpotifyEmbedUrl(spotifyInput);
    if (!embed) {
      toast({ title: "Not a valid Spotify link", variant: "destructive" });
      return;
    }
    audio.pause();
    youtube.pause();
    persist({ mediaType: "spotify", spotifyLink: spotifyInput.trim() });
  };

  const removeSpotify = () =>
    persist({
      mediaType: song.mediaType === "spotify" ? "none" : song.mediaType,
      spotifyLink: null,
    });

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

  const runSpotifySearch = () => {
    const term = spTerm.trim();
    if (!term) return;
    setSpQuery(term);
    setSpSearchOpen(true);
  };

  const runYoutubeSearch = () => {
    const term = ytTerm.trim();
    if (!term) return;
    setYtQuery(term);
    setYtSearchOpen(true);
  };

  const pickSpotify = (item: MediaSearchItem) => {
    if (!parseSpotifyEmbedUrl(item.url)) {
      toast({
        title: "Couldn't use that Spotify result",
        variant: "destructive",
      });
      return;
    }
    audio.pause();
    youtube.pause();
    setSpotifyInput(item.url);
    persist({ mediaType: "spotify", spotifyLink: item.url });
    setSpSearchOpen(false);
    toast({ title: `Spotify set: ${item.title}` });
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
      type: "spotify",
      label: "Spotify",
      icon: <Music2 className="w-4 h-4" />,
      configured: spotifyConfigured,
    },
    {
      type: "youtube",
      label: "YouTube",
      icon: <Youtube className="w-4 h-4" />,
      configured: youtubeConfigured,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="truncate pr-6">
            {song.title}
            <span className="block text-sm font-normal text-muted-foreground truncate">
              {song.artist}
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Active source switcher */}
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
              <span className="hidden sm:inline">{s.label}</span>
            </Button>
          ))}
        </div>

        {/* Active player */}
        <div className="min-h-[3rem]">
          {song.mediaType === "audio" && audioConfigured && (
            <div className="space-y-2">
              <MediaTransport
                isPlaying={audio.isPlaying}
                currentTime={audio.currentTime}
                duration={audio.duration}
                onToggle={audio.toggle}
                onSeek={audio.seek}
              />
              {song.audioFileName && (
                <p className="text-xs text-muted-foreground truncate">
                  {song.audioFileName}
                </p>
              )}
            </div>
          )}

          {(song.mediaType === "youtube" || song.mediaType === "spotify") && (
            <div className="space-y-3">
              {/* The persistent YouTube/Spotify host (owned by SongView) docks
                  here while the modal is open, then returns to the mini-player. */}
              <div
                ref={youtubeSlotRef}
                className="w-full overflow-hidden rounded-md"
              />
              {song.mediaType === "youtube" && youtubeConfigured && (
                <MediaTransport
                  isPlaying={youtube.isPlaying}
                  currentTime={youtube.currentTime}
                  duration={youtube.duration}
                  onToggle={youtube.toggle}
                  onSeek={youtube.seek}
                  disabled={!youtube.ready}
                />
              )}
              {song.mediaType === "spotify" && (
                <p className="text-xs text-muted-foreground">
                  Spotify plays through its own embedded controls and keeps
                  playing when this player is closed.
                </p>
              )}
            </div>
          )}

          {song.mediaType === "none" && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No media attached yet. Add a source below.
            </p>
          )}
        </div>

        <div className="h-px bg-border" />

        {/* Setup / sources */}
        <div className="space-y-5">
          {/* Audio */}
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

          {/* Spotify */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Music2 className="w-4 h-4" /> Spotify
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search Spotify…"
                  value={spTerm}
                  onChange={(e) => setSpTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      runSpotifySearch();
                    }
                  }}
                />
              </div>
              <Button onClick={runSpotifySearch} disabled={!spTerm.trim()}>
                Search
              </Button>
            </div>
            {spSearchOpen && (
              <SearchResults
                items={spotifySearch.data?.results ?? []}
                isFetching={spotifySearch.isFetching}
                isError={!!spotifySearch.error && !spotifyNotConfigured}
                notConfigured={spotifyNotConfigured}
                emptyHint="No tracks found."
                onPick={pickSpotify}
              />
            )}
            <div className="flex gap-2">
              <Input
                placeholder="or paste a Spotify link"
                value={spotifyInput}
                onChange={(e) => setSpotifyInput(e.target.value)}
              />
              <Button
                variant="secondary"
                onClick={saveSpotify}
                disabled={!spotifyInput.trim()}
              >
                Save
              </Button>
              {spotifyConfigured && (
                <Button variant="ghost" size="icon" onClick={removeSpotify}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              )}
            </div>
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
                <Button variant="ghost" size="icon" onClick={removeYoutube}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
