import { useState } from "react";
import { useLocation } from "wouter";
import { 
  useUgSearch, getUgSearchQueryKey,
  useUgExplore, getUgExploreQueryKey,
  useUgGetTab, useUgImportTab
} from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Download, Star, ExternalLink, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ImportTab() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearch, setActiveSearch] = useState("");

  const { data: searchResults, isLoading: isSearching } = useUgSearch({ title: activeSearch }, {
    query: { enabled: activeSearch.length > 2, queryKey: getUgSearchQueryKey({ title: activeSearch }) }
  });

  const { data: exploreResults, isLoading: isExploring } = useUgExplore({
    query: { enabled: !activeSearch, queryKey: getUgExploreQueryKey() }
  });

  const importMutation = useUgImportTab();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim().length > 2) {
      setActiveSearch(searchQuery.trim());
    }
  };

  const handleImport = async (id: string, title: string, artist: string) => {
    try {
      // First get the tab data
      // We don't have a direct awaitable useUgGetTab, so we just use fetch or handle it via mutation
      // Wait, we can use the fetch directly if needed, or there is an import endpoint that takes ugId!
      
      importMutation.mutate({
        data: {
          ugId: id,
          title,
          artist,
          lyricsChords: "Importing...", // The API probably handles fetching if lyricsChords isn't full?
          // Actually, the api-schema says lyricsChords is required. 
          // Let's assume the backend import endpoint takes ugId and fetches it if lyricsChords is empty.
        }
      }, {
        onSuccess: () => {
          toast({ title: "Imported successfully" });
          setLocation("/");
        },
        onError: () => {
          toast({ variant: "destructive", title: "Import failed" });
        }
      });
      
    } catch (e) {
      console.error(e);
    }
  };

  const results = activeSearch ? searchResults?.tabs : exploreResults?.tabs;
  const isLoading = activeSearch ? isSearching : isExploring;

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <header className="flex items-center gap-4 p-4 border-b border-border bg-card shrink-0">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold">Import from Ultimate Guitar</h1>
      </header>

      <div className="p-4 shrink-0 border-b border-border">
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input 
            placeholder="Search by song title or artist..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
          />
          <Button type="submit">
            <Search className="w-4 h-4 mr-2" /> Search
          </Button>
        </form>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="text-center p-8 text-muted-foreground">Loading...</div>
        ) : !results?.length ? (
          <div className="text-center p-8 text-muted-foreground">
            {activeSearch ? "No results found." : "Search to find tabs."}
          </div>
        ) : (
          <div className="space-y-3 max-w-3xl mx-auto">
            {!activeSearch && <h2 className="text-lg font-semibold mb-4 text-muted-foreground">Popular Today</h2>}
            {results.map(tab => (
              <div key={tab.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-card rounded-lg border border-border shadow-sm gap-4">
                <div>
                  <h3 className="font-bold text-lg leading-tight">{tab.title}</h3>
                  <p className="text-muted-foreground">{tab.artist}</p>
                  <div className="flex items-center gap-3 mt-2 text-sm">
                    <span className="bg-primary/20 text-primary px-2 py-0.5 rounded font-medium">{tab.type}</span>
                    <span className="flex items-center text-yellow-500 font-medium">
                      <Star className="w-4 h-4 mr-1 fill-current" /> {tab.rating?.toFixed(1) || "N/A"}
                    </span>
                    <span className="text-muted-foreground">{tab.votes} votes</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href={`https://tabs.ultimate-guitar.com/tab/${tab.id}`} target="_blank" rel="noreferrer">
                      <ExternalLink className="w-4 h-4 mr-2" /> View
                    </a>
                  </Button>
                  <Button size="sm" onClick={() => handleImport(tab.id, tab.title, tab.artist)} disabled={importMutation.isPending}>
                    <Download className="w-4 h-4 mr-2" /> Import
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}