import { useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  useListSongs, getListSongsQueryKey,
  useListSets, getListSetsQueryKey,
  useListTags, getListTagsQueryKey,
  useGetSongStats, getGetSongStatsQueryKey,
  useCreateSet
} from "@workspace/api-client-react";
import { useAppStore } from "@/store";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Music, ListMusic, Tags as TagsIcon, Search, Plus, Download } from "lucide-react";

export default function Sidebar() {
  const { selectedSongId, setSelectedSongId, setSidebarOpen } = useAppStore();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("songs");

  const { data: songs = [], isLoading: loadingSongs } = useListSongs({ search }, {
    query: { queryKey: getListSongsQueryKey({ search }) }
  });
  
  const { data: sets = [] } = useListSets({
    query: { queryKey: getListSetsQueryKey() }
  });
  
  const { data: tags = [] } = useListTags({
    query: { queryKey: getListTagsQueryKey() }
  });

  const { data: stats } = useGetSongStats({
    query: { queryKey: getGetSongStatsQueryKey() }
  });

  const createSetMutation = useCreateSet();

  const handleCreateSet = () => {
    const title = prompt("Set Name:");
    if (title) {
      createSetMutation.mutate({ data: { title } });
    }
  };

  const handleSelectSong = (id: string) => {
    setSelectedSongId(id);
    setSidebarOpen(false); // Close sidebar on mobile
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
            <TabsTrigger value="songs"><Music className="w-4 h-4 mr-2 hidden sm:block" />Songs</TabsTrigger>
            <TabsTrigger value="sets"><ListMusic className="w-4 h-4 mr-2 hidden sm:block" />Sets</TabsTrigger>
            <TabsTrigger value="tags"><TagsIcon className="w-4 h-4 mr-2 hidden sm:block" />Tags</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-hidden relative">
        <ScrollArea className="h-full">
          {activeTab === "songs" && (
            <div className="p-4 space-y-4">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                <Input 
                  placeholder="Search songs..." 
                  className="pl-9 bg-background/50 border-sidebar-border h-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              
              <div className="space-y-1">
                {loadingSongs ? (
                  <div className="text-center p-4 text-muted-foreground">Loading...</div>
                ) : songs.length === 0 ? (
                  <div className="text-center p-4 text-muted-foreground">No songs found.</div>
                ) : (
                  songs.map(song => (
                    <button
                      key={song.id}
                      onClick={() => handleSelectSong(song.id)}
                      className={`w-full text-left p-3 rounded-md transition-colors ${
                        selectedSongId === song.id 
                          ? "bg-primary/20 text-primary-foreground font-medium" 
                          : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-muted-foreground"
                      }`}
                    >
                      <div className="font-semibold text-foreground truncate">{song.title}</div>
                      <div className="text-sm opacity-80 truncate">{song.artist}</div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === "sets" && (
            <div className="p-4 space-y-4">
              <Button onClick={handleCreateSet} className="w-full" variant="outline">
                <Plus className="w-4 h-4 mr-2" /> New Set
              </Button>
              
              <div className="space-y-1">
                {sets.map(set => (
                  <Link href={`/sets/${set.id}`} key={set.id} className="block w-full text-left p-3 rounded-md transition-colors hover:bg-sidebar-accent text-foreground border border-transparent hover:border-sidebar-border">
                    <div className="font-semibold truncate">{set.title}</div>
                    <div className="text-sm text-muted-foreground">{set.songCount} songs</div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {activeTab === "tags" && (
            <div className="p-4 space-y-4">
              <div className="flex flex-wrap gap-2">
                {tags.map(tag => (
                  <div key={tag.id} className="px-3 py-1.5 rounded-full text-sm font-medium border border-border" style={{ backgroundColor: `${tag.color}20`, color: tag.color, borderColor: `${tag.color}40` }}>
                    {tag.name}
                  </div>
                ))}
              </div>
            </div>
          )}
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
    </div>
  );
}