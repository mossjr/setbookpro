import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  type Song,
  type SongInput,
  useListSongs,
  getListSongsQueryKey,
  useListSets,
  getListSetsQueryKey,
  useGetSet,
  getGetSetQueryKey,
  useListTags,
  getListTagsQueryKey,
  useGetSongStats,
  getGetSongStatsQueryKey,
  useCreateSet,
  useDeleteSet,
  useUpdateSet,
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
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
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
  MoreVertical,
  ListPlus,
  X,
  PanelLeftClose,
  Star,
  SlidersHorizontal,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { exportLibrary, parseImportFile } from "@/lib/importExport";
import SongEditorDialog from "@/components/SongEditorDialog";
import TagsManager from "@/components/TagsManager";
import {
  STATUS_OPTIONS,
  statusColor,
  statusLabel,
  songMatchesFilters,
  activeFilterCount,
  emptyFilters,
  type SongFilterValues,
} from "@/lib/songMeta";

export default function Sidebar() {
  const {
    selectedSongId,
    setSelectedSongId,
    setSidebarOpen,
    setDesktopSidebarOpen,
    activeSetId,
    setActiveSetId,
    lastPlayedSongId,
  } = useAppStore();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [setsSearch, setSetsSearch] = useState("");
  const [activeTab, setActiveTab] = useState("songs");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [filters, setFilters] = useState<SongFilterValues>(emptyFilters);

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
  const deleteSet = useDeleteSet();
  const updateSet = useUpdateSet();
  const deleteSong = useDeleteSong();
  const addSongToSet = useAddSongToSet();
  const createSong = useCreateSong();
  const createTag = useCreateTag();
  const addTagToSong = useAddTagToSong();

  const { data: activeSet, isError: activeSetError } = useGetSet(
    activeSetId ?? "",
    {
      query: {
        enabled: !!activeSetId,
        queryKey: getGetSetQueryKey(activeSetId ?? ""),
      },
    },
  );

  // Jump to the Songs tab when a set starts playing so its filtered list shows.
  useEffect(() => {
    if (activeSetId) setActiveTab("songs");
  }, [activeSetId]);

  // If the active set no longer exists, drop out of set mode.
  useEffect(() => {
    if (activeSetId && activeSetError) setActiveSetId(null);
  }, [activeSetId, activeSetError, setActiveSetId]);

  const filteredSongs = useMemo(
    () => songs.filter((s) => songMatchesFilters(s, filters)),
    [songs, filters],
  );

  const visibleSetSongs = useMemo(() => {
    if (!activeSet) return [];
    return activeSet.songs
      .map((song, i) => ({ song, position: i + 1 }))
      .filter(({ song }) => songMatchesFilters(song, filters));
  }, [activeSet, filters]);

  const grouped = useMemo(() => {
    const sorted = [...filteredSongs].sort((a, b) =>
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
  }, [filteredSongs]);

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
    setLocation("/");
  };

  const toggleSelected = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const displayedIds = filteredSongs.map((s) => s.id);
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

  const handleDeleteSet = async (setId: string, setTitle: string) => {
    if (!confirm(`Delete "${setTitle}"? This cannot be undone.`)) return;
    try {
      await deleteSet.mutateAsync({ id: setId });
      toast({ title: "Set deleted" });
      qc.invalidateQueries({ queryKey: getListSetsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetSongStatsQueryKey() });
    } catch {
      toast({ title: "Could not delete set", variant: "destructive" });
    }
  };

  const handleRenameSet = async (setId: string, currentTitle: string) => {
    const newTitle = prompt("Rename set:", currentTitle);
    if (!newTitle || newTitle.trim() === "" || newTitle.trim() === currentTitle)
      return;
    try {
      await updateSet.mutateAsync({ id: setId, data: { title: newTitle.trim() } });
      toast({ title: "Set renamed" });
      qc.invalidateQueries({ queryKey: getListSetsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetSetQueryKey(setId) });
    } catch {
      toast({ title: "Could not rename set", variant: "destructive" });
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
      qc.invalidateQueries({ queryKey: getGetSetQueryKey(setId) });
    } catch {
      toast({ title: "Could not add to set", variant: "destructive" });
    }
  };

  const handleAddSongToSet = async (
    songId: string,
    setId: string,
    setTitle: string,
  ) => {
    try {
      await addSongToSet.mutateAsync({ id: setId, data: { songId } });
      toast({ title: `Added to "${setTitle}"` });
      qc.invalidateQueries({ queryKey: getGetSetQueryKey(setId) });
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

  const filterCount = activeFilterCount(filters);

  const renderFilters = () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="outline"
          className="relative h-10 w-10 shrink-0"
          aria-label="Filter songs"
          title="Filter songs"
        >
          <SlidersHorizontal className="w-4 h-4" />
          {filterCount > 0 && (
            <Badge className="absolute -top-1.5 -right-1.5 h-4 min-w-[16px] justify-center rounded-full px-1 text-[10px]">
              {filteredSongs.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Filters</span>
          {filterCount > 0 && (
            <button
              type="button"
              onClick={() => setFilters(emptyFilters)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear all
            </button>
          )}
        </div>
        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground">
            Star rating
          </span>
          <div className="flex items-center gap-2">
            <Select
              value={
                filters.ratingMin == null ? "any" : String(filters.ratingMin)
              }
              onValueChange={(v) =>
                setFilters((f) => {
                  const min = v === "any" ? null : Number(v);
                  return {
                    ...f,
                    ratingMin: min,
                    ratingMax:
                      min != null && f.ratingMax != null && f.ratingMax < min
                        ? min
                        : f.ratingMax,
                  };
                })
              }
            >
              <SelectTrigger className="h-8 flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                {[1, 2, 3, 4, 5].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} ★
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">to</span>
            <Select
              value={
                filters.ratingMax == null ? "any" : String(filters.ratingMax)
              }
              onValueChange={(v) =>
                setFilters((f) => {
                  const max = v === "any" ? null : Number(v);
                  return {
                    ...f,
                    ratingMax: max,
                    ratingMin:
                      max != null && f.ratingMin != null && f.ratingMin > max
                        ? max
                        : f.ratingMin,
                  };
                })
              }
            >
              <SelectTrigger className="h-8 flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                {[1, 2, 3, 4, 5].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} ★
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground">
            Status
          </span>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_OPTIONS.map((s) => {
              const active = filters.statuses.includes(s.value);
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() =>
                    setFilters((f) => ({
                      ...f,
                      statuses: active
                        ? f.statuses.filter((x) => x !== s.value)
                        : [...f.statuses, s.value],
                    }))
                  }
                  className="px-2.5 py-1 rounded-full text-xs font-medium border transition"
                  style={{
                    backgroundColor: active ? s.color : `${s.color}20`,
                    color: active ? "#fff" : s.color,
                    borderColor: `${s.color}80`,
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );

  const renderMetaRow = (s: {
    rating?: number | null;
    status?: string | null;
  }) => {
    const showStatus = !!s.status && s.status !== "new";
    if (s.rating == null && !showStatus) return null;
    return (
      <div className="flex items-center gap-1.5 mt-1">
        {s.rating != null && (
          <span className="flex items-center gap-0.5">
            {Array.from({ length: s.rating }).map((_, i) => (
              <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
            ))}
          </span>
        )}
        {showStatus && (
          <span
            className="px-1.5 py-0.5 rounded text-[10px] font-medium"
            style={{
              backgroundColor: `${statusColor(s.status)}22`,
              color: statusColor(s.status),
            }}
          >
            {statusLabel(s.status)}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <img
              src="/setbook-icon.png"
              alt=""
              className="w-7 h-7 rounded-md shadow-sm"
            />
            Set Book Pro
          </h2>
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:inline-flex h-8 w-8 text-muted-foreground"
            onClick={() => setDesktopSidebarOpen(false)}
            aria-label="Hide sidebar"
            title="Hide sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </Button>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(tab) => {
            if (tab !== "sets") setSetsSearch("");
            setActiveTab(tab);
          }}
          className="w-full"
        >
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

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Sticky toolbar: songs tab, no active set */}
        {activeTab === "songs" && !activeSetId && (
          <div className="px-4 pt-4 pb-3 space-y-3 shrink-0 border-b border-sidebar-border">
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                <Input
                  placeholder="Search songs..."
                  className="pl-9 bg-background/50 border-sidebar-border h-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              {renderFilters()}
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
          </div>
        )}

        {/* Sticky toolbar: sets tab */}
        {activeTab === "sets" && (
          <div className="px-4 pt-4 pb-3 space-y-3 shrink-0 border-b border-sidebar-border">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
              <Input
                placeholder="Search sets..."
                className="pl-9 bg-background/50 border-sidebar-border h-10"
                value={setsSearch}
                onChange={(e) => setSetsSearch(e.target.value)}
              />
            </div>
            <Button
              onClick={handleCreateSet}
              className="w-full"
              variant="outline"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-2" /> New Set
            </Button>
          </div>
        )}

        {/* Sticky toolbar: songs tab, active set */}
        {activeTab === "songs" && activeSetId && (
          <div className="px-4 pt-4 pb-3 space-y-3 shrink-0 border-b border-sidebar-border">
            {!activeSet ? (
              <div className="text-center p-4 text-muted-foreground">
                Loading set...
              </div>
            ) : (
              <>
                <div className="rounded-md bg-primary/10 border border-primary/30 p-2.5 space-y-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <ListMusic className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-wide text-primary font-semibold">
                        Playing set
                      </div>
                      <div className="font-semibold text-foreground break-words">
                        {activeSet.title}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-full justify-center text-muted-foreground"
                    onClick={() => setActiveSetId(null)}
                    title="Exit set"
                  >
                    <X className="w-4 h-4 mr-1" /> Exit set
                  </Button>
                </div>

                {activeSet.songs.length > 0 && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      {visibleSetSongs.length}/{activeSet.songs.length} songs
                    </span>
                    {renderFilters()}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <ScrollArea className="flex-1">
          {activeTab === "songs" && !activeSetId && (
            <div className="px-4 pt-3 pb-4 space-y-2">
              {loadingSongs ? (
                <div className="text-center p-4 text-muted-foreground">
                  Loading...
                </div>
              ) : songs.length === 0 ? (
                <div className="text-center p-4 text-muted-foreground">
                  No songs found.
                </div>
              ) : filteredSongs.length === 0 ? (
                <div className="text-center p-4 text-muted-foreground">
                  No songs match your filters.
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
                            } ${lastPlayedSongId === song.id ? "ring-1 ring-primary/60" : ""}`}
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
                              {renderMetaRow(song)}
                            </button>
                            {lastPlayedSongId === song.id && (
                              <Star className="w-4 h-4 text-primary fill-primary shrink-0" />
                            )}
                            {!selectMode && (
                              <div className="flex shrink-0">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8"
                                      aria-label="Song actions"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <MoreVertical className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() => openEditSong(song)}
                                    >
                                      <Pencil className="w-3.5 h-3.5 mr-2" /> Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuSub>
                                      <DropdownMenuSubTrigger>
                                        <ListPlus className="w-3.5 h-3.5 mr-2" />
                                        Add to set
                                      </DropdownMenuSubTrigger>
                                      <DropdownMenuSubContent>
                                        {sets.length === 0 ? (
                                          <DropdownMenuItem disabled>
                                            No sets yet
                                          </DropdownMenuItem>
                                        ) : (
                                          sets.map((set) => (
                                            <DropdownMenuItem
                                              key={set.id}
                                              onClick={() =>
                                                handleAddSongToSet(
                                                  song.id,
                                                  set.id,
                                                  set.title,
                                                )
                                              }
                                            >
                                              {set.title}
                                            </DropdownMenuItem>
                                          ))
                                        )}
                                      </DropdownMenuSubContent>
                                    </DropdownMenuSub>
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onClick={() => handleDeleteSong(song)}
                                    >
                                      <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
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
          )}

          {activeTab === "songs" && activeSetId && activeSet && (
            <div className="px-4 pt-3 pb-4">
              {activeSet.songs.length === 0 ? (
                <div className="text-center p-4 text-muted-foreground text-sm">
                  This set has no songs.
                </div>
              ) : visibleSetSongs.length === 0 ? (
                <div className="text-center p-4 text-muted-foreground text-sm">
                  No songs match your filters.
                </div>
              ) : (
                <div className="space-y-0.5">
                  {visibleSetSongs.map(({ song, position }) => {
                    const isCurrent = selectedSongId === song.id;
                    const isLast = lastPlayedSongId === song.id;
                    return (
                      <button
                        key={song.id}
                        onClick={() => handleSelectSong(song.id)}
                        className={`group flex items-center gap-3 w-full text-left rounded-md p-2.5 transition-colors ${
                          isCurrent
                            ? "bg-primary/20"
                            : "hover:bg-sidebar-accent"
                        } ${isLast ? "ring-1 ring-primary/60" : ""}`}
                      >
                        <div className="w-6 h-6 flex items-center justify-center bg-muted rounded-full text-xs font-bold text-muted-foreground shrink-0">
                          {position}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-foreground truncate">
                            {song.title}
                          </div>
                          <div className="text-sm text-muted-foreground truncate">
                            {song.artist}
                          </div>
                          {renderMetaRow(song)}
                        </div>
                        {isLast && (
                          <Star className="w-4 h-4 text-primary fill-primary shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === "sets" && (
            <div className="p-4">
              {(() => {
                const filtered = sets.filter((s) =>
                  s.title.toLowerCase().includes(setsSearch.toLowerCase()),
                );
                if (sets.length === 0) {
                  return (
                    <div className="text-center p-4 text-muted-foreground text-sm">
                      No sets yet.
                    </div>
                  );
                }
                if (filtered.length === 0) {
                  return (
                    <div className="text-center p-4 text-muted-foreground text-sm">
                      No sets match your search.
                    </div>
                  );
                }
                return (
                  <div className="space-y-1">
                    {filtered.map((set) => (
                      <div
                        key={set.id}
                        className="group flex items-center rounded-md border border-transparent hover:bg-sidebar-accent hover:border-sidebar-border transition-colors"
                      >
                        <Link
                          href={`/sets/${set.id}`}
                          className="flex-1 min-w-0 p-3 text-left text-foreground"
                        >
                          <div className="font-semibold truncate">{set.title}</div>
                          <div className="text-sm text-muted-foreground">
                            {set.songCount} songs
                          </div>
                        </Link>
                        <div className="shrink-0 pr-1">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 opacity-0 group-hover:opacity-100 focus:opacity-100"
                                aria-label="Set actions"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleRenameSet(set.id, set.title)}
                              >
                                <Pencil className="w-3.5 h-3.5 mr-2" /> Rename
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleDeleteSet(set.id, set.title)}
                              >
                                <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
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
          if (activeSetId) {
            qc.invalidateQueries({ queryKey: getGetSetQueryKey(activeSetId) });
          }
          if (!selectMode) {
            setSelectedSongId(id);
            setSidebarOpen(false);
          }
        }}
      />
    </div>
  );
}
