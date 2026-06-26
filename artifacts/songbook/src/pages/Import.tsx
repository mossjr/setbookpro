import { useState } from "react";
import { useLocation } from "wouter";
import {
  useUgSearch, getUgSearchQueryKey,
  useUgExplore, getUgExploreQueryKey,
  useUgGetTab, getUgGetTabQueryKey,
  useUgImportTab,
  useUgPlaylistPreview,
  useUgPlaylistImport,
  useCreateSet,
  useAddSongToSet,
  getListSongsQueryKey,
  getGetSongStatsQueryKey,
  getListSetsQueryKey,
  getGetSetQueryKey,
  type UgPlaylistPreview,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search, Download, Star, ArrowLeft, X, Check,
  Link2, ListMusic, Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAppStore } from "@/store";
import {
  ImportDestinationPicker,
  emptyDestination,
  isDestinationReady,
  destinationPayload,
  type DestinationState,
} from "@/components/ImportDestinationPicker";

interface TabSummary {
  id: string;
  title: string;
  artist: string;
  type: string;
  rating: number;
  votes: number;
  version?: number | null;
}

const TYPE_STYLES: Record<string, string> = {
  Chords:      "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  Tab:         "bg-blue-500/15 text-blue-400 border-blue-500/30",
  "Pro Tab":   "bg-purple-500/15 text-purple-400 border-purple-500/30",
  Bass:        "bg-orange-500/15 text-orange-400 border-orange-500/30",
  Drums:       "bg-red-500/15 text-red-400 border-red-500/30",
  Ukulele:     "bg-pink-500/15 text-pink-400 border-pink-500/30",
};

function TypeBadge({ type }: { type: string }) {
  const cls = TYPE_STYLES[type] ?? "bg-muted text-muted-foreground border-border";
  return (
    <span className={`w-20 text-center inline-block text-xs font-semibold px-2 py-0.5 rounded border ${cls} truncate`}>
      {type}
    </span>
  );
}

function TabPreview({
  tabId,
  onClose,
  onImported,
  onAddedToSet,
}: {
  tabId: string;
  onClose: () => void;
  onImported: (songId: string) => void;
  onAddedToSet: (setId: string) => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const importMutation = useUgImportTab();
  const createSet = useCreateSet();
  const addSongToSet = useAddSongToSet();
  const [dest, setDest] = useState<DestinationState>(emptyDestination());

  const { data: tab, isLoading, error } = useUgGetTab(
    tabId,
    { query: { queryKey: getUgGetTabQueryKey(tabId), enabled: !!tabId } },
  );

  const busy =
    importMutation.isPending || createSet.isPending || addSongToSet.isPending;
  const ready = !!tab && isDestinationReady(dest);

  const invalidateLibrary = () => {
    qc.invalidateQueries({ queryKey: getListSongsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetSongStatsQueryKey() });
  };

  const handleImport = async () => {
    if (!tab || !ready) return;
    try {
      const song = await importMutation.mutateAsync({
        data: {
          ugId: tab.id,
          title: tab.title,
          artist: tab.artist,
          lyricsChords: tab.lyricsChords,
        },
      });

      if (dest.mode === "existing") {
        await addSongToSet.mutateAsync({
          id: dest.existingSetId,
          data: { songId: song.id },
        });
        invalidateLibrary();
        qc.invalidateQueries({ queryKey: getListSetsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetSetQueryKey(dest.existingSetId) });
        toast({ title: `"${tab.title}" added to set` });
        onAddedToSet(dest.existingSetId);
      } else if (dest.mode === "new") {
        const newSet = await createSet.mutateAsync({
          data: { title: dest.newName.trim() },
        });
        await addSongToSet.mutateAsync({
          id: newSet.id,
          data: { songId: song.id },
        });
        invalidateLibrary();
        qc.invalidateQueries({ queryKey: getListSetsQueryKey() });
        toast({ title: `"${tab.title}" added to "${newSet.title}"` });
        onAddedToSet(newSet.id);
      } else {
        invalidateLibrary();
        toast({ title: `"${tab.title}" added to library` });
        onImported(song.id);
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Import failed",
        description: "Could not save this tab.",
      });
    }
  };

  const buttonLabel = busy
    ? "Saving..."
    : dest.mode === "library"
      ? "Add to Library"
      : "Add to set";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex items-center gap-3 p-4 border-b border-border bg-card shrink-0">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          {tab ? (
            <>
              <div className="font-bold text-lg leading-tight truncate">{tab.title}</div>
              <div className="text-sm text-muted-foreground truncate">{tab.artist}</div>
            </>
          ) : (
            <div className="text-muted-foreground">Loading preview...</div>
          )}
        </div>
        <Button onClick={handleImport} disabled={!ready || busy} className="shrink-0">
          <Check className="w-4 h-4 mr-2" />
          {buttonLabel}
        </Button>
      </header>

      <ScrollArea className="flex-1">
        <div className="p-4 max-w-2xl mx-auto space-y-4">
          {tab && (
            <div className="rounded-lg border border-border p-4 bg-card">
              <ImportDestinationPicker value={dest} onChange={setDest} />
            </div>
          )}
          {isLoading && (
            <div className="text-center py-16 text-muted-foreground">Fetching tab...</div>
          )}
          {error && (
            <div className="text-center py-16 text-destructive">Failed to load tab. Try again.</div>
          )}
          {tab && (
            <pre className="font-mono text-sm leading-relaxed whitespace-pre-wrap text-foreground">
              {tab.lyricsChords || "No content available for this tab."}
            </pre>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function SearchImport({
  onImported,
  onAddedToSet,
}: {
  onImported: (songId: string) => void;
  onAddedToSet: (setId: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);

  const { data: searchResults, isLoading: isSearching } = useUgSearch(
    { title: activeSearch },
    { query: { enabled: activeSearch.length > 0, queryKey: getUgSearchQueryKey({ title: activeSearch }) } },
  );

  const { data: exploreResults, isLoading: isExploring } = useUgExplore({
    query: { enabled: activeSearch.length === 0, queryKey: getUgExploreQueryKey() },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q.length > 0) setActiveSearch(q);
  };

  const results: TabSummary[] = (activeSearch ? searchResults?.tabs : exploreResults?.tabs) ?? [];
  const isLoading = activeSearch ? isSearching : isExploring;

  return (
    <>
      {previewId && (
        <TabPreview
          tabId={previewId}
          onClose={() => setPreviewId(null)}
          onImported={(songId) => { setPreviewId(null); onImported(songId); }}
          onAddedToSet={(setId) => { setPreviewId(null); onAddedToSet(setId); }}
        />
      )}

      <div className="p-4 shrink-0 border-b border-border">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by song title or artist..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button type="submit">Search</Button>
          {activeSearch && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => { setActiveSearch(""); setSearchQuery(""); }}
            >
              Clear
            </Button>
          )}
        </form>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 max-w-3xl mx-auto space-y-3">
          {!activeSearch && (
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Popular Today
            </h2>
          )}

          {isLoading ? (
            <div className="text-center py-16 text-muted-foreground">Searching...</div>
          ) : results.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              {activeSearch ? "No results found." : "Loading popular tabs..."}
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              {/* Header row */}
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-3 px-3 py-2 bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <span>Song / Artist</span>
                <span className="w-20 text-center">Type</span>
                <span className="w-14 text-right">Rating</span>
                <span className="w-14 text-right">Votes</span>
                <span className="w-14" />
              </div>

              {results.map((tab, i) => (
                <div
                  key={tab.id}
                  className={`grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-3 px-3 py-2.5 hover:bg-accent/50 transition-colors cursor-default ${
                    i !== results.length - 1 ? "border-b border-border/60" : ""
                  }`}
                >
                  {/* Title + version + artist */}
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2 leading-tight">
                      <span className="font-semibold text-sm text-foreground truncate">
                        {tab.title}
                      </span>
                      {tab.version != null && tab.version > 1 && (
                        <span className="text-xs font-normal text-primary/70 shrink-0">
                          v{tab.version}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground truncate block">
                      {tab.artist}
                    </span>
                  </div>

                  {/* Type badge */}
                  <TypeBadge type={tab.type} />

                  {/* Rating */}
                  <div className="w-14 flex items-center justify-end gap-1 text-yellow-500">
                    <Star className="w-3.5 h-3.5 fill-current shrink-0" />
                    <span className="text-xs font-semibold tabular-nums">
                      {tab.rating > 0 ? tab.rating.toFixed(1) : "—"}
                    </span>
                  </div>

                  {/* Vote count */}
                  <div className="w-14 text-right text-xs tabular-nums text-muted-foreground">
                    {tab.votes > 0 ? tab.votes.toLocaleString() : "—"}
                  </div>

                  {/* Action */}
                  <div className="w-14 flex justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-primary hover:text-primary hover:bg-primary/10"
                      onClick={() => setPreviewId(tab.id)}
                    >
                      <Download className="w-3.5 h-3.5 mr-1" />
                      <span className="text-xs">Get</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </>
  );
}

function PlaylistImport({ onDone }: { onDone: (setId: string | null) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [url, setUrl] = useState("");
  const [dest, setDest] = useState<DestinationState>(emptyDestination());
  const [preview, setPreview] = useState<UgPlaylistPreview | null>(null);

  const previewMutation = useUgPlaylistPreview();
  const importMutation = useUgPlaylistImport();

  const handlePreview = (e: React.FormEvent) => {
    e.preventDefault();
    const u = url.trim();
    if (!u) return;
    setPreview(null);
    previewMutation.mutate(
      { data: { url: u } },
      {
        onSuccess: (data) => {
          setPreview(data);
          // Default to creating a new set named after the playlist.
          setDest({ mode: "new", existingSetId: "", newName: data.playlistName });
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Couldn't read that link",
            description: "Make sure it's a shared Ultimate Guitar playlist link, then try again.",
          });
        },
      },
    );
  };

  const handleImport = () => {
    if (!preview || !isDestinationReady(dest)) return;
    const items = preview.items.map((it) => ({
      tabId: it.tabId,
      title: it.title,
      artist: it.artist,
      existingSongId: it.existingSongId ?? null,
    }));
    importMutation.mutate(
      { data: { ...destinationPayload(dest), items } },
      {
        onSuccess: (result) => {
          qc.invalidateQueries({ queryKey: getListSongsQueryKey() });
          qc.invalidateQueries({ queryKey: getGetSongStatsQueryKey() });
          qc.invalidateQueries({ queryKey: getListSetsQueryKey() });
          if (result.setId)
            qc.invalidateQueries({ queryKey: getGetSetQueryKey(result.setId) });
          const where =
            dest.mode === "library" ? "your library" : "the set";
          toast({
            title: `Imported into ${where}`,
            description:
              `${result.imported} new, ${result.addedExisting} already in library` +
              (result.skipped ? `, ${result.skipped} skipped` : "") + ".",
          });
          onDone(result.setId);
        },
        onError: () => {
          toast({ variant: "destructive", title: "Import failed", description: "Something went wrong while importing." });
        },
      },
    );
  };

  const newCount = preview?.items.filter((i) => i.status === "new").length ?? 0;
  const dupCount = preview?.items.filter((i) => i.status === "duplicate").length ?? 0;
  const importing = importMutation.isPending;

  return (
    <>
      <div className="p-4 shrink-0 border-b border-border space-y-2">
        <form onSubmit={handlePreview} className="flex gap-2">
          <div className="relative flex-1">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Paste an Ultimate Guitar playlist link..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button type="submit" disabled={previewMutation.isPending || !url.trim()}>
            {previewMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scanning…</>
            ) : (
              "Preview"
            )}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">
          In Ultimate Guitar, open a playlist, tap Share, and paste the link here. We'll scan it and you choose where the songs go.
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 max-w-3xl mx-auto">
          {!preview && !previewMutation.isPending && (
            <div className="text-center py-16 text-muted-foreground">
              <ListMusic className="w-10 h-10 mx-auto mb-3 opacity-40" />
              Paste a shared playlist link to get started.
            </div>
          )}

          {previewMutation.isPending && (
            <div className="text-center py-16 text-muted-foreground">Scanning playlist…</div>
          )}

          {preview && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border p-4 bg-card space-y-4">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Playlist</div>
                  <div className="font-bold text-lg leading-tight">
                    {preview.playlistName || "Untitled playlist"}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="px-2 py-0.5 rounded border bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                    {newCount} new
                  </span>
                  <span className="px-2 py-0.5 rounded border bg-muted text-muted-foreground border-border">
                    {dupCount} already in library
                  </span>
                  <span className="px-2 py-0.5 rounded border bg-muted text-muted-foreground border-border">
                    {preview.items.length} total
                  </span>
                </div>

                <ImportDestinationPicker value={dest} onChange={setDest} />

                <Button
                  onClick={handleImport}
                  disabled={importing || !isDestinationReady(dest)}
                  className="w-full"
                >
                  {importing ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importing… this can take a minute</>
                  ) : (
                    <><Download className="w-4 h-4 mr-2" />Import {preview.items.length} songs</>
                  )}
                </Button>
              </div>

              <div className="rounded-lg border border-border overflow-hidden">
                {preview.items.map((it, i) => (
                  <div
                    key={`${it.tabId}-${i}`}
                    className={`flex items-center gap-3 px-3 py-2 ${
                      i !== preview.items.length - 1 ? "border-b border-border/60" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">{it.title}</div>
                      <div className="text-xs text-muted-foreground truncate">{it.artist}</div>
                    </div>
                    {it.status === "new" ? (
                      <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded border bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                        New
                      </span>
                    ) : (
                      <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded border bg-muted text-muted-foreground border-border">
                        In library
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </>
  );
}

export default function ImportPage() {
  const [, setLocation] = useLocation();
  const { setSelectedSongId } = useAppStore();
  const [mode, setMode] = useState<"search" | "playlist">("search");

  const handleImported = (songId: string) => {
    setSelectedSongId(songId);
    setLocation("/");
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <header className="flex items-center gap-3 p-4 border-b border-border bg-card shrink-0">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold">Import from Ultimate Guitar</h1>
      </header>

      <div className="px-4 pt-3 shrink-0">
        <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1 text-sm font-medium">
          <button
            type="button"
            onClick={() => setMode("search")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
              mode === "search" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Search className="w-4 h-4" />
            Search
          </button>
          <button
            type="button"
            onClick={() => setMode("playlist")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
              mode === "playlist" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Link2 className="w-4 h-4" />
            From Playlist Link
          </button>
        </div>
      </div>

      {mode === "search" ? (
        <SearchImport
          onImported={handleImported}
          onAddedToSet={(setId) => setLocation(`/sets/${setId}`)}
        />
      ) : (
        <PlaylistImport
          onDone={(setId) => setLocation(setId ? `/sets/${setId}` : "/")}
        />
      )}
    </div>
  );
}
