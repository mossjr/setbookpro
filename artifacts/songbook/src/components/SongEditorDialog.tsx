import { useEffect, useState } from "react";
import {
  type Song,
  useCreateSong,
  useUpdateSong,
  useListTags,
  getListTagsQueryKey,
  useCreateTag,
  useAddTagToSong,
  useRemoveTagFromSong,
  getListSongsQueryKey,
  getGetSongQueryKey,
  getGetSongStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Star, Plus } from "lucide-react";
import { STATUS_OPTIONS, TAG_PALETTE, type SongStatus } from "@/lib/songMeta";
import { useToast } from "@/hooks/use-toast";

interface Props {
  song?: Song | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (id: string) => void;
}

export default function SongEditorDialog({
  song,
  open,
  onOpenChange,
  onSaved,
}: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!song;

  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [meta, setMeta] = useState("");
  const [lyricsChords, setLyricsChords] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [status, setStatus] = useState<SongStatus>("new");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState("");

  const { data: tags = [] } = useListTags({
    query: { queryKey: getListTagsQueryKey() },
  });
  const createSong = useCreateSong();
  const updateSong = useUpdateSong();
  const createTag = useCreateTag();
  const addTag = useAddTagToSong();
  const removeTag = useRemoveTagFromSong();

  useEffect(() => {
    if (open) {
      setTitle(song?.title ?? "");
      setArtist(song?.artist ?? "");
      setMeta(song?.meta ?? "");
      setLyricsChords(song?.lyricsChords ?? "");
      setRating(song?.rating ?? null);
      setStatus((song?.status as SongStatus) ?? "new");
      setSelectedTags(song?.tags?.map((t) => t.id) ?? []);
      setNewTagName("");
    }
  }, [open, song]);

  const busy = createSong.isPending || updateSong.isPending;

  const toggleTag = (id: string) =>
    setSelectedTags((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );

  const invalidate = (id?: string) => {
    qc.invalidateQueries({ queryKey: getListSongsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetSongStatsQueryKey() });
    if (id) qc.invalidateQueries({ queryKey: getGetSongQueryKey(id) });
  };

  const handleCreateTag = () => {
    const name = newTagName.trim();
    if (!name || createTag.isPending) return;
    const color = TAG_PALETTE[tags.length % TAG_PALETTE.length];
    createTag.mutate(
      { data: { name, color } },
      {
        onSuccess: (tag) => {
          setNewTagName("");
          setSelectedTags((prev) =>
            prev.includes(tag.id) ? prev : [...prev, tag.id],
          );
          qc.invalidateQueries({ queryKey: getListTagsQueryKey() });
        },
        onError: () =>
          toast({ title: "Could not create tag", variant: "destructive" }),
      },
    );
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    try {
      if (isEdit && song) {
        await updateSong.mutateAsync({
          id: song.id,
          data: {
            title: title.trim(),
            artist: artist.trim(),
            meta: meta.trim(),
            lyricsChords,
            rating,
            status,
          },
        });
        const current = song.tags?.map((t) => t.id) ?? [];
        const toAdd = selectedTags.filter((t) => !current.includes(t));
        const toRemove = current.filter((t) => !selectedTags.includes(t));
        await Promise.all([
          ...toAdd.map((tagId) =>
            addTag.mutateAsync({ id: song.id, data: { tagId } }),
          ),
          ...toRemove.map((tagId) =>
            removeTag.mutateAsync({ id: song.id, tagId }),
          ),
        ]);
        invalidate(song.id);
        toast({ title: "Song updated" });
        onSaved?.(song.id);
      } else {
        const created = await createSong.mutateAsync({
          data: {
            title: title.trim(),
            artist: artist.trim(),
            meta: meta.trim(),
            lyricsChords,
            rating,
            status,
          },
        });
        const newId = (created as Song).id;
        await Promise.all(
          selectedTags.map((tagId) =>
            addTag.mutateAsync({ id: newId, data: { tagId } }),
          ),
        );
        invalidate(newId);
        toast({ title: "Song created" });
        onSaved?.(newId);
      }
      onOpenChange(false);
    } catch {
      toast({ title: "Could not save song", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit song" : "New song"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Song title"
              />
            </div>
            <div className="space-y-2">
              <Label>Artist</Label>
              <Input
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="Artist"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes / key (optional)</Label>
            <Input
              value={meta}
              onChange={(e) => setMeta(e.target.value)}
              placeholder="e.g. Key of G, capo 2"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Rating</Label>
              <div className="flex items-center gap-1 h-10">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(rating === n ? null : n)}
                    className="p-0.5"
                    aria-label={`${n} star${n > 1 ? "s" : ""}`}
                  >
                    <Star
                      className={`w-6 h-6 transition-colors ${
                        rating != null && n <= rating
                          ? "fill-amber-400 text-amber-400"
                          : "text-muted-foreground/40 hover:text-muted-foreground"
                      }`}
                    />
                  </button>
                ))}
                {rating != null && (
                  <button
                    type="button"
                    onClick={() => setRating(null)}
                    className="ml-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as SongStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Tags</Label>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => {
                  const sel = selectedTags.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleTag(t.id)}
                      className="px-3 py-1.5 rounded-full text-sm font-medium border transition"
                      style={{
                        backgroundColor: sel ? t.color : `${t.color}20`,
                        color: sel ? "#fff" : t.color,
                        borderColor: `${t.color}80`,
                      }}
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="Create a new tag..."
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCreateTag();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleCreateTag}
                disabled={!newTagName.trim() || createTag.isPending}
                aria-label="Create tag"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Lyrics &amp; chords</Label>
            <Textarea
              value={lyricsChords}
              onChange={(e) => setLyricsChords(e.target.value)}
              placeholder="Use [Am] [C] markers for chords inline with lyrics..."
              className="min-h-[280px] font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Put chords inline in square brackets, e.g.{" "}
              <code>[G]Amazing [C]grace</code>.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={busy}>
            {busy ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
