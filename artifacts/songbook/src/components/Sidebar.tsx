import { useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  type Song,
  type SongInput,
  useListSongs,
  getListSongsQueryKey,
  useListSets,
  getListSetsQueryKey,
  useListTags,
  getListTagsQueryKey,
  useGetSongStats,
  getGetSongStatsQueryKey,
  useCreateSet,
  useDeleteSong,
  useAddSongToSet,
  useCreateSong,
  useCreateTag,
  useAddTagToSong,
  getGetSongQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Music,
  ListMusic,
  Tags as TagsIcon,
  Search,
  Plus,
  Download,
  Upload,
  CheckSquare,
  Square,
  Trash2,
  Pencil,
  ListPlus,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { exportLibrary, parseImportFile } from "@/lib/importExport";
import SongEditorDialog from "@/components/SongEditorDialog";
import TagsManager from "@/components/TagsManager";

export default function Sidebar() {
  const { selectedSongId, setSelectedSongId, setSidebarOpen } = useAppStore();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("songs");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingSong, setEditingSong] = useState<Song | null>(null);

  const { data: songs = [], isLoading: loadingSongs } = useListSongs(
    { search },
    { query: { queryKey: getListSongsQueryKey({ search }) } },
  );
  const { data: allSongs = [] } = useListSongs(undefined, {
    query: { queryKey: getListSongsQueryKey() },
  });
  const { data: sets = [] } = useListSets({
    query: { queryKey: getListSetsQueryKey() },
  });
  const { data: tags = [] } = useListTags({
    query: { queryKey: getListTagsQueryKey() },
  });
  const { data: stats } = useGetSongStats({
    query: { queryKey: getGetSongStatsQueryKey() },
  });

  const createSetMutation = useCreateSet();
  const deleteSong = useDeleteSong();
  const addSongToSet = useAddSongToSet();
  const createSong = useCreateSong();
  const createTag = useCreateTag();
  const addTagToSong = useAddTagToSong();

  const grouped = useMemo(() => {
    const sorted = [...songs].sort((a, b) =>
      a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
    );
    const map = new Map<string, Song[]>();
    for (const s of sorted) {
      const first = (s.title.trim()[0] || "#").toUpperCase();
      const key = /[A-Z]/.test(first) ? first : "#";
      const arr = map.get(key);
      if (arr) arr.push(s);
      else map.set(key, [s]);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [songs]);

  const invalidateSongs = () => {
    qc.invalidateQueries({ queryKey: getListSongsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetSongStatsQueryKey() });
  };

  const handleCreateSet = () => {
    const title = prompt("Set name:");
    if (title?.trim()) {
      createSetMutation.mutate(
        { data: { title: title.trim() } },
        {
          onSuccess: () =>
            qc.invalidateQueries({ queryKey: getListSetsQueryKey() }),
        },
      );
    }
  };

  const handleSelectSong = (id: string) => {
    if (selectMode) {
      toggleSelected(id);
      return;
    }
    setSelectedSongId(id);
    setSidebarOpen(false);
  };

  const toggleSelected = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const displayedIds = songs.map((s) => s.id);
  const allSelected =
    displayedIds.length > 0 && displayedIds.every((id) => selected.has(id));

  const selectAll = () => setSelected(new Set(displayedIds));
  const clearSelection = () => setSelected(new Set());
  const invertSelection = () =>
    setSelected(new Set(displayedIds.filter((id) => !selected.has(id))));

  const exitSelectMode = () => {
    setSelectMode(false);
    clearSelection();
  };

  const handleDeleteSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} song(s)? This cannot be undone.`))
      return;
    try {
      for (const id of selected) {
        await deleteSong.mutateAsync({ id });
        if (id === selectedSongId) setSelectedSongId(null);
      }
      toast({ title: `Deleted ${selected.size} song(s)` });
      exitSelectMode();
      invalidateSongs();
    } catch {
      toast({ title: "Could not delete songs", variant: "destructive" });
    }
  };

  const handleDeleteSong = async (song: Song) => {
    if (!confirm(`Delete "${song.title}"?`)) return;
    try {
      await deleteSong.mutateAsync({ id: song.id });
      if (song.id === selectedSongId) setSelectedSongId(null);
      toast({ title: "Song deleted" });
      invalidateSongs();
    } catch {
      toast({ title: "Could not delete song", variant: "destructive" });
    }
  };

  const handleAddToSet = async (setId: string) => {
    if (selected.size === 0) return;
    try {
      for (const songId of selected) {
        await addSongToSet.mutateAsync({ id: setId, data: { songId } });
      }
      toast({ title: `Added ${selected.size} song(s) to set` });
      exitSelectMode();
      qc.invalidateQueries({ queryKey: getListSetsQueryKey() });
    } catch {
      toast({ title: "Could not add to set", variant: "destructive" });
    }
  };

  const openNewSong = () => {
    setEditingSong(null);
    setEditorOpen(true);
  };

  const openEditSong = (song: Song) => {
    setEditingSong(song);
    setEditorOpen(true);
  };

  const handleExport = () => {
    if (allSongs.length === 0) {
      toast({ title: "Nothing to export" });
      return;
    }
    exportLibrary(allSongs);
    toast({ title: `Exported ${allSongs.length} song(s)` });
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const imported = await parseImportFile(file);
      if (imported.length === 0) {
        toast({ title: "No songs found in file", variant: "destructive" });
        return;
      }
      const tagMap = new Map(tags.map((t) => [t.name.toLowerCase(), t.id]));
      let count = 0;
      for (const s of imported) {
        const created = await createSong.mutateAsync({
          data: {
            title: s.title,
            artist: s.artist,
            meta: s.meta ?? undefined,
            lyricsChords: s.lyricsChords,
            spotifyLink: s.spotifyLink ?? undefined,
            youtubeUrl: s.youtubeUrl ?? undefined,
            mediaType: s.mediaType as SongInput["mediaType"],
          },
        });
        const newId = (created as Song).id;
        for (const tagName of s.tags ?? []) {
          let tagId = tagMap.get(tagName.toLowerCase());
          if (!tagId) {
            const newTag = await createTag.mutateAsync({
              data: { name: tagName, color: "#64748b" },
            });
            tagId = newTag.id;
            tagMap.set(tagName.toLowerCase(), tagId);
          }
          await addTagToSong.mutateAsync({ id: newId, data: { tagId } });
        }
        count++;
      }
      qc.invalidateQueries({ queryKey: getListSongsQueryKey() });
      qc.invalidateQueries({ queryKey: getListTagsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetSongStatsQueryKey() });
      toast({ title: `Imported ${count} song${count === 1 ? "" : "s"}` });
    } catch {
      toast({
        title: "Import failed",
        description: "Could not read that file.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      <div className="p-4 border-b border-sidebar-border">
        <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
          <Music className="w-5 h-5 text-primary" />
          SongBook
        </h2>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-sidebar-accent/50">
            <TabsTrigger value="songs">
              <Music className="w-4 h-4 mr-2 hidden sm:block" />
              Songs
            </TabsTrigger>
            <TabsTrigger value="sets">
              <ListMusic className="w-4 h-4 mr-2 hidden sm:block" />
              Sets
            </TabsTrigger>
            <TabsTrigger value="tags">
              <TagsIcon className="w-4 h-4 mr-2 hidden sm:block" />
              Tags
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-hidden relative">
        <ScrollArea className="h-full">
          {activeTab === "songs" && (
            <div className="p-4 space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                <Input
                  placeholder="Search songs..."
                  className="pl-9 bg-background/50 border-sidebar-border h-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={openNewSong}
                >
                  <Plus className="w-4 h-4 mr-1" /> Add
                </Button>
                <Button
                  size="sm"
                  variant={selectMode ? "default" : "outline"}
                  onClick={() =>
                    selectMode ? exitSelectMode() : setSelectMode(true)
                  }
                >
                  {selectMode ? (
                    <X className="w-4 h-4" />
                  ) : (
                    <CheckSquare className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  title="Import songs (JSON)"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  title="Export songs (JSON)"
                  onClick={handleExport}
                >
                  <Download className="w-4 h-4" />
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={handleImportFile}
                />
              </div>

              {selectMode && (
                <div className="flex flex-wrap items-center gap-1.5 rounded-md bg-sidebar-accent/40 p-2 text-xs">
                  <span className="font-medium px-1">
                    {selected.size} selected
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2"
                    onClick={allSelected ? clearSelection : selectAll}
                  >
                    {allSelected ? "Clear" : "All"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2"
                    onClick={invertSelection}
                  >
                    Invert
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        disabled={selected.size === 0}
                      >
                        <ListPlus className="w-3.5 h-3.5 mr-1" /> Add to set
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuLabel>Add to set</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {sets.length === 0 ? (
                        <DropdownMenuItem disabled>No sets yet</DropdownMenuItem>
                      ) : (
                        sets.map((set) => (
                          <DropdownMenuItem
                            key={set.id}
                            onClick={() => handleAddToSet(set.id)}
                          >
                            {set.title}
                          </DropdownMenuItem>
                        ))
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-destructive hover:text-destructive"
                    disabled={selected.size === 0}
                    onClick={handleDeleteSelected}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                  </Button>
                </div>
              )}

              <div className="space-y-2">
                {loadingSongs ? (
                  <div className="text-center p-4 text-muted-foreground">
                    Loading...
                  </div>
                ) : songs.length === 0 ? (
                  <div className="text-center p-4 text-muted-foreground">
                    No songs found.
                  </div>
                ) : (
                  grouped.map(([letter, items]) => (
                    <div key={letter}>
                      <div className="sticky top-0 z-10 bg-sidebar/95 backdrop-blur px-2 py-1 text-xs font-bold text-muted-foreground uppercase tracking-wide">
                        {letter}
                      </div>
                      <div className="space-y-0.5">
                        {items.map((song) => {
                          const isSel = selected.has(song.id);
                          return (
                            <div
                              key={song.id}
                              className={`group flex items-center gap-2 rounded-md pr-1 transition-colors ${
                                selectedSongId === song.id && !selectMode
                                  ? "bg-primary/20"
                                  : "hover:bg-sidebar-accent"
                              }`}
                            >
                              {selectMode && (
                                <button
                                  type="button"
                                  onClick={() => toggleSelected(song.id)}
                                  className="pl-2 py-3 shrink-0 text-muted-foreground"
                                >
                                  {isSel ? (
                                    <CheckSquare className="w-4 h-4 text-primary" />
                                  ) : (
                                    <Square className="w-4 h-4" />
                                  )}
                                </button>
                              )}
                              <button
                                onClick={() => handleSelectSong(song.id)}
                                className="flex-1 min-w-0 text-left py-2.5 px-2"
                              >
                                <div className="font-semibold text-foreground truncate">
                                  {song.title}
                                </div>
                                <div className="text-sm text-muted-foreground truncate">
                                  {song.artist}
                                </div>
                                {song.tags && song.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {song.tags.map((t) => (
                                      <span
                                        key={t.id}
                                        className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                                        style={{
                                          backgroundColor: `${t.color}22`,
                                          color: t.color,
                                        }}
                                      >
                                        {t.name}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </button>
                              {!selectMode && (
                                <div className="flex shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8"
                                    onClick={() => openEditSong(song)}
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8"
                                    onClick={() => handleDeleteSong(song)}
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === "sets" && (
            <div className="p-4 space-y-4">
              <Button
                onClick={handleCreateSet}
                className="w-full"
                variant="outline"
              >
                <Plus className="w-4 h-4 mr-2" /> New Set
              </Button>

              <div className="space-y-1">
                {sets.length === 0 ? (
                  <div className="text-center p-4 text-muted-foreground text-sm">
                    No sets yet.
                  </div>
                ) : (
                  sets.map((set) => (
                    <Link
                      href={`/sets/${set.id}`}
                      key={set.id}
                      className="block w-full text-left p-3 rounded-md transition-colors hover:bg-sidebar-accent text-foreground border border-transparent hover:border-sidebar-border"
                    >
                      <div className="font-semibold truncate">{set.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {set.songCount} songs
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === "tags" && <TagsManager />}
        </ScrollArea>
      </div>

      <div className="p-3 border-t border-sidebar-border shrink-0">
        <Button
          variant="outline"
          className="w-full justify-start gap-2 text-primary border-primary/30 hover:bg-primary/10"
          onClick={() => {
            setSidebarOpen(false);
            setLocation("/import");
          }}
        >
          <Download className="w-4 h-4" />
          Import from Ultimate Guitar
        </Button>
      </div>

      {stats && (
        <div className="p-3 border-t border-sidebar-border text-xs text-muted-foreground flex justify-between bg-sidebar-accent/20">
          <span>{stats.totalSongs} Songs</span>
          <span>{stats.totalSets} Sets</span>
          <span>{stats.totalTags} Tags</span>
        </div>
      )}

      <SongEditorDialog
        song={editingSong}
        open={editorOpen}
        onOpenChange={setEditorOpen}
        onSaved={(id) => {
          if (!selectMode) {
            setSelectedSongId(id);
            setSidebarOpen(false);
          }
        }}
      />
    </div>
  );
}
