import { useRef, useState, useEffect } from "react";
import {
  type Song,
  SongUpdateMediaType,
  useUpdateSong,
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
import { useYouTubePlayer } from "@/hooks/useYouTubePlayer";
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
} from "lucide-react";

interface MediaPlayerModalProps {
  song: Song;
  audio: AudioController;
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

export default function MediaPlayerModal({
  song,
  audio,
  open,
  onOpenChange,
}: MediaPlayerModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateMutation = useUpdateSong();
  const { upload, isUploading, progress } = useAudioUpload();

  const [spotifyInput, setSpotifyInput] = useState(song.spotifyLink ?? "");
  const [youtubeInput, setYoutubeInput] = useState(song.youtubeUrl ?? "");

  useEffect(() => {
    setSpotifyInput(song.spotifyLink ?? "");
    setYoutubeInput(song.youtubeUrl ?? "");
  }, [song.spotifyLink, song.youtubeUrl]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const ytWrapperRef = useRef<HTMLDivElement>(null);

  const audioConfigured = !!song.audioUrl;
  const spotifyConfigured = !!song.spotifyLink;
  const youtubeVideoId = song.youtubeUrl
    ? parseYouTubeId(song.youtubeUrl)
    : null;
  const youtubeConfigured = !!youtubeVideoId;
  const spotifyEmbed = song.spotifyLink
    ? parseSpotifyEmbedUrl(song.spotifyLink)
    : null;

  const yt = useYouTubePlayer(
    ytWrapperRef,
    open && song.mediaType === "youtube" ? youtubeVideoId : null,
  );

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
    // Stop any uploaded audio still playing when switching to another source.
    if (type !== "audio") audio.pause();
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

  const removeYoutube = () =>
    persist({
      mediaType: song.mediaType === "youtube" ? "none" : song.mediaType,
      youtubeUrl: null,
    });

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

          {song.mediaType === "youtube" && youtubeConfigured && (
            <div className="space-y-3">
              <div className="aspect-video w-full rounded-md overflow-hidden bg-black">
                <div ref={ytWrapperRef} className="w-full h-full" />
              </div>
              <MediaTransport
                isPlaying={yt.isPlaying}
                currentTime={yt.currentTime}
                duration={yt.duration}
                onToggle={yt.toggle}
                onSeek={yt.seek}
                disabled={!yt.ready}
              />
            </div>
          )}

          {song.mediaType === "spotify" && spotifyEmbed && (
            <iframe
              title="Spotify player"
              src={spotifyEmbed}
              className="w-full rounded-md"
              height={152}
              frameBorder={0}
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
            />
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
              <Music2 className="w-4 h-4" /> Spotify link
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder="https://open.spotify.com/track/..."
                value={spotifyInput}
                onChange={(e) => setSpotifyInput(e.target.value)}
              />
              <Button onClick={saveSpotify} disabled={!spotifyInput.trim()}>
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
              <Youtube className="w-4 h-4" /> YouTube link
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder="https://youtube.com/watch?v=..."
                value={youtubeInput}
                onChange={(e) => setYoutubeInput(e.target.value)}
              />
              <Button onClick={saveYoutube} disabled={!youtubeInput.trim()}>
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
