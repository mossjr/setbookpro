import { useState } from "react";
import { useLocation } from "wouter";
import {
  useUgSearch, getUgSearchQueryKey,
  useUgExplore, getUgExploreQueryKey,
  useUgGetTab, getUgGetTabQueryKey,
  useUgImportTab,
} from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Download, Star, ArrowLeft, X, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAppStore } from "@/store";

interface TabSummary {
  id: string;
  title: string;
  artist: string;
  type: string;
  rating: number;
  votes: number;
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

function TabPreview({ tabId, onClose, onImported }: { tabId: string; onClose: () => void; onImported: (songId: string) => void }) {
  const { toast } = useToast();
  const importMutation = useUgImportTab();

  const { data: tab, isLoading, error } = useUgGetTab(
    tabId,
    { query: { queryKey: getUgGetTabQueryKey(tabId), enabled: !!tabId } },
  );

  const handleImport = () => {
    if (!tab) return;
    importMutation.mutate(
      {
        data: {
          ugId: tab.id,
          title: tab.title,
          artist: tab.artist,
          lyricsChords: tab.lyricsChords,
        },
      },
      {
        onSuccess: (song) => {
          toast({ title: `"${tab.title}" added to library` });
          onImported(song.id);
        },
        onError: () => {
          toast({ variant: "destructive", title: "Import failed", description: "Could not save this tab." });
        },
      },
    );
  };

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
        <Button
          onClick={handleImport}
          disabled={!tab || importMutation.isPending}
          className="shrink-0"
        >
          <Check className="w-4 h-4 mr-2" />
          {importMutation.isPending ? "Saving..." : "Add to Library"}
        </Button>
      </header>

      <ScrollArea className="flex-1">
        <div className="p-4 max-w-2xl mx-auto">
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

export default function ImportPage() {
  const [, setLocation] = useLocation();
  const { setSelectedSongId } = useAppStore();
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

  const handleImported = (songId: string) => {
    setPreviewId(null);
    setSelectedSongId(songId);
    setLocation("/");
  };

  const results: TabSummary[] = (activeSearch ? searchResults?.tabs : exploreResults?.tabs) ?? [];
  const isLoading = activeSearch ? isSearching : isExploring;

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {previewId && (
        <TabPreview
          tabId={previewId}
          onClose={() => setPreviewId(null)}
          onImported={handleImported}
        />
      )}

      <header className="flex items-center gap-3 p-4 border-b border-border bg-card shrink-0">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold">Import from Ultimate Guitar</h1>
      </header>

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
              <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-3 py-2 bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <span>Song / Artist</span>
                <span className="w-20 text-center">Type</span>
                <span className="w-16 text-right">Rating</span>
                <span className="w-16" />
              </div>

              {results.map((tab, i) => (
                <div
                  key={tab.id}
                  className={`grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-3 py-2.5 hover:bg-accent/50 transition-colors cursor-default ${
                    i !== results.length - 1 ? "border-b border-border/60" : ""
                  }`}
                >
                  {/* Title + artist */}
                  <div className="min-w-0">
                    <span className="font-semibold text-sm text-foreground truncate block leading-tight">
                      {tab.title}
                    </span>
                    <span className="text-xs text-muted-foreground truncate block">
                      {tab.artist}
                    </span>
                  </div>

                  {/* Type badge */}
                  <TypeBadge type={tab.type} />

                  {/* Rating */}
                  <div className="w-16 flex items-center justify-end gap-1 text-yellow-500">
                    <Star className="w-3.5 h-3.5 fill-current shrink-0" />
                    <span className="text-xs font-semibold tabular-nums">
                      {tab.rating > 0 ? tab.rating.toFixed(1) : "—"}
                    </span>
                  </div>

                  {/* Action */}
                  <div className="w-16 flex justify-end">
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
    </div>
  );
}
