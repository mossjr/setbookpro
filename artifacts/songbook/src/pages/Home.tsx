import { useAppStore, useGigStore } from "@/store";
import SongView from "@/components/SongView";
import { Music, Radio, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  const selectedSongId = useAppStore((s) => s.selectedSongId);
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);
  const role = useGigStore((s) => s.role);
  const hostSongId = useGigStore((s) => s.hostSongId);

  if (role === "participant") {
    if (!hostSongId) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-background">
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-6">
            <Radio className="w-12 h-12" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Following the host</h2>
          <p className="text-muted-foreground max-w-md">
            Waiting for the host to pick a song. It'll appear here automatically.
          </p>
        </div>
      );
    }
    return <SongView songId={hostSongId} />;
  }

  if (!selectedSongId) {
    return (
      <div className="flex flex-col h-full bg-background">
        {/* Mobile-only header — the hamburger button only exists inside SongView
            on desktop/tablet, so on phone this is the only way to open the sidebar
            when no song is selected yet. */}
        <header className="md:hidden flex items-center p-2 border-b border-border bg-card shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open library"
          >
            <Menu className="w-5 h-5" />
          </Button>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-6">
            <Music className="w-12 h-12" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Ready to Play</h2>
          <p className="text-muted-foreground max-w-md">
            Select a song from your library or open a set to get started.
          </p>
          <Button
            className="mt-6 md:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            Open Library
          </Button>
        </div>
      </div>
    );
  }

  return <SongView songId={selectedSongId} />;
}
