import { useRoute, Link } from "wouter";
import { useGetSet, getGetSetQueryKey } from "@workspace/api-client-react";
import { useAppStore } from "@/store";
import { ArrowLeft, Play, Music } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SetView() {
  const [, params] = useRoute("/sets/:id");
  const setId = params?.id || "";
  const { setSelectedSongId } = useAppStore();

  const { data: set, isLoading } = useGetSet(setId, {
    query: { enabled: !!setId, queryKey: getGetSetQueryKey(setId) }
  });

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading set...</div>;
  if (!set) return <div className="p-8 text-center text-muted-foreground">Set not found</div>;

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <header className="flex items-center justify-between p-4 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{set.title}</h1>
            <p className="text-muted-foreground">{set.songs.length} songs</p>
          </div>
        </div>
        <Button size="lg" className="rounded-full shadow-lg" onClick={() => {
          if (set.songs.length > 0) setSelectedSongId(set.songs[0].id);
        }}>
          <Play className="w-5 h-5 mr-2 fill-current" /> Start Set
        </Button>
      </header>

      <div className="flex-1 overflow-auto p-4 max-w-3xl mx-auto w-full">
        {set.songs.length === 0 ? (
          <div className="text-center p-12 border-2 border-dashed border-border rounded-xl mt-8">
            <Music className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">This set is empty</h3>
            <p className="text-muted-foreground mb-4">Go to your Songs library and add songs to this set.</p>
            <Button asChild variant="outline">
              <Link href="/">Go to Library</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {set.songs.map((song, i) => (
              <div 
                key={song.id} 
                className="flex items-center gap-4 p-4 bg-card border border-border rounded-lg shadow-sm hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => setSelectedSongId(song.id)}
              >
                <div className="w-8 h-8 flex items-center justify-center bg-muted rounded-full text-muted-foreground font-bold shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold truncate text-foreground">{song.title}</h4>
                  <p className="text-sm text-muted-foreground truncate">{song.artist}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setSelectedSongId(song.id); }}>
                  <Play className="w-5 h-5 text-primary" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}