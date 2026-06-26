import { useRef, useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import {
  useGetSet,
  getGetSetQueryKey,
  getListSetsQueryKey,
  useReorderSetSongs,
  useRemoveSongFromSet,
  type SongSetDetail,
  type SetSong,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAppStore } from "@/store";
import { ArrowLeft, Play, Music, GripVertical, MoreVertical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

function SortableSongRow({
  song,
  index,
  onPlay,
  onRenumber,
  onRemove,
}: {
  song: SetSong;
  index: number;
  onPlay: (songId: string) => void;
  onRenumber: () => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: song.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  // Stop drag sensors from claiming taps on interactive controls.
  const stopPointer = (e: React.PointerEvent | React.MouseEvent) =>
    e.stopPropagation();

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 bg-card border border-border rounded-lg shadow-sm transition-colors ${
        isDragging ? "border-primary shadow-lg opacity-90" : "hover:border-primary/50"
      }`}
    >
      <button
        type="button"
        onClick={onRenumber}
        onPointerDown={stopPointer}
        className="w-8 h-8 flex items-center justify-center bg-muted rounded-full text-muted-foreground font-bold shrink-0 hover:bg-primary/20 hover:text-primary transition-colors tabular-nums"
        title="Tap to change position"
        aria-label={`Position ${index + 1}. Tap to change.`}
      >
        {index + 1}
      </button>

      <button
        type="button"
        className="flex items-center justify-center text-muted-foreground/60 hover:text-foreground cursor-grab active:cursor-grabbing touch-none shrink-0 p-1 -ml-1"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-5 h-5" />
      </button>

      <button
        type="button"
        onClick={() => onPlay(song.id)}
        className="flex-1 min-w-0 text-left"
      >
        <h4 className="font-bold truncate text-foreground">{song.title}</h4>
        <p className="text-sm text-muted-foreground truncate">{song.artist}</p>
      </button>

      <Button
        variant="ghost"
        size="icon"
        className="shrink-0"
        onPointerDown={stopPointer}
        onClick={() => onPlay(song.id)}
        aria-label="Play song"
      >
        <Play className="w-5 h-5 text-primary" />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onPointerDown={stopPointer}
            aria-label="More actions"
          >
            <MoreVertical className="w-5 h-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onRenumber}>Change position…</DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={onRemove}
          >
            Remove from set
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default function SetView() {
  const [, params] = useRoute("/sets/:id");
  const [, setLocation] = useLocation();
  const setId = params?.id || "";
  const qc = useQueryClient();
  const { toast } = useToast();
  const { setSelectedSongId, setActiveSetId, setSidebarOpen } = useAppStore();

  const { data: set, isLoading } = useGetSet(setId, {
    query: { enabled: !!setId, queryKey: getGetSetQueryKey(setId) },
  });

  const reorderMutation = useReorderSetSongs();
  const removeMutation = useRemoveSongFromSet();

  const [renumberSong, setRenumberSong] = useState<SetSong | null>(null);
  const [renumberValue, setRenumberValue] = useState("");

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Monotonic token shared by every set mutation. Responses that resolve out of
  // order (an older reorder/remove landing after a newer one) are ignored so a
  // stale server payload or rollback can't clobber the latest intended state.
  // Must stay above the early returns so hook order is stable across renders.
  const opSeqRef = useRef(0);

  if (isLoading)
    return (
      <div className="p-8 text-center text-muted-foreground">Loading set...</div>
    );
  if (!set)
    return (
      <div className="p-8 text-center text-muted-foreground">Set not found</div>
    );

  const songs = set.songs ?? [];

  const startSong = (songId: string) => {
    setActiveSetId(set.id);
    setSelectedSongId(songId);
    setSidebarOpen(false);
    setLocation("/");
  };

  const setKey = getGetSetQueryKey(setId);

  // Persist a new full ordering. Applies an optimistic cache update, sends the
  // ordered ids to the server, and rolls back if the request fails.
  const persistOrder = async (ordered: SetSong[]) => {
    const token = ++opSeqRef.current;
    await qc.cancelQueries({ queryKey: setKey });
    const previous = qc.getQueryData<SongSetDetail>(setKey);
    const optimistic: SetSong[] = ordered.map((s, i) => ({ ...s, sortOrder: i }));
    qc.setQueryData<SongSetDetail>(setKey, (old) =>
      old ? { ...old, songs: optimistic } : old,
    );
    reorderMutation.mutate(
      { id: setId, data: { songIds: ordered.map((s) => s.id) } },
      {
        onSuccess: (updated) => {
          if (token === opSeqRef.current)
            qc.setQueryData<SongSetDetail>(setKey, updated);
          qc.invalidateQueries({ queryKey: getListSetsQueryKey() });
        },
        onError: () => {
          if (token !== opSeqRef.current) return;
          if (previous) qc.setQueryData<SongSetDetail>(setKey, previous);
          toast({
            variant: "destructive",
            title: "Couldn't reorder",
            description: "Your change wasn't saved. Try again.",
          });
        },
      },
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = songs.findIndex((s) => s.id === active.id);
    const newIndex = songs.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    persistOrder(arrayMove(songs, oldIndex, newIndex));
  };

  const openRenumber = (song: SetSong) => {
    const currentPos = songs.findIndex((s) => s.id === song.id) + 1;
    setRenumberSong(song);
    setRenumberValue(String(currentPos));
  };

  const submitRenumber = () => {
    if (!renumberSong) return;
    const total = songs.length;
    const oldIndex = songs.findIndex((s) => s.id === renumberSong.id);
    const parsed = parseInt(renumberValue, 10);
    if (oldIndex === -1 || Number.isNaN(parsed)) {
      setRenumberSong(null);
      return;
    }
    const target = Math.min(Math.max(parsed, 1), total);
    const newIndex = target - 1;
    if (newIndex !== oldIndex) {
      persistOrder(arrayMove(songs, oldIndex, newIndex));
    }
    setRenumberSong(null);
  };

  const handleRemove = async (song: SetSong) => {
    const token = ++opSeqRef.current;
    await qc.cancelQueries({ queryKey: setKey });
    const previous = qc.getQueryData<SongSetDetail>(setKey);
    qc.setQueryData<SongSetDetail>(setKey, (old) =>
      old ? { ...old, songs: old.songs.filter((s) => s.id !== song.id) } : old,
    );
    removeMutation.mutate(
      { id: setId, songId: song.id },
      {
        onSuccess: (updated) => {
          if (token === opSeqRef.current)
            qc.setQueryData<SongSetDetail>(setKey, updated);
          qc.invalidateQueries({ queryKey: getListSetsQueryKey() });
          toast({ title: `Removed "${song.title}" from this set` });
        },
        onError: () => {
          if (token !== opSeqRef.current) return;
          if (previous) qc.setQueryData<SongSetDetail>(setKey, previous);
          toast({
            variant: "destructive",
            title: "Couldn't remove song",
            description: "Try again.",
          });
        },
      },
    );
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <header className="flex items-center justify-between p-4 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold truncate">{set.title}</h1>
            <p className="text-muted-foreground">{songs.length} songs</p>
          </div>
        </div>
        <Button
          size="lg"
          className="rounded-full shadow-lg shrink-0"
          disabled={songs.length === 0}
          onClick={() => {
            if (songs.length > 0) startSong(songs[0].id);
          }}
        >
          <Play className="w-5 h-5 mr-2 fill-current" /> Start Set
        </Button>
      </header>

      <div className="flex-1 overflow-auto p-4 max-w-3xl mx-auto w-full">
        {songs.length === 0 ? (
          <div className="text-center p-12 border-2 border-dashed border-border rounded-xl mt-8">
            <Music className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">This set is empty</h3>
            <p className="text-muted-foreground mb-4">
              Go to your Songs library and add songs to this set.
            </p>
            <Button asChild variant="outline">
              <Link href="/">Go to Library</Link>
            </Button>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-3">
              Drag the handle to reorder, or tap a number to set its position.
            </p>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={songs.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {songs.map((song, i) => (
                    <SortableSongRow
                      key={song.id}
                      song={song}
                      index={i}
                      onPlay={startSong}
                      onRenumber={() => openRenumber(song)}
                      onRemove={() => handleRemove(song)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </>
        )}
      </div>

      <Dialog
        open={!!renumberSong}
        onOpenChange={(open) => !open && setRenumberSong(null)}
      >
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Change position</DialogTitle>
            <DialogDescription className="truncate">
              {renumberSong?.title}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitRenumber();
            }}
          >
            <Input
              type="number"
              min={1}
              max={songs.length}
              inputMode="numeric"
              value={renumberValue}
              autoFocus
              onChange={(e) => setRenumberValue(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-2">
              Enter a number between 1 and {songs.length}. Other songs reflow.
            </p>
            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setRenumberSong(null)}
              >
                <X className="w-4 h-4 mr-1" /> Cancel
              </Button>
              <Button type="submit">Move</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
