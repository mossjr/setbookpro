import { useAppStore, useGigStore } from "@/store";
import SongView from "@/components/SongView";
import { Music, Radio } from "lucide-react";

export default function Home() {
  const selectedSongId = useAppStore((s) => s.selectedSongId);
  const role = useGigStore((s) => s.role);
  const hostSongId = useGigStore((s) => s.hostSongId);

  // Participants are pinned to whatever the host is presenting.
  if (role === "participant") {
    if (!hostSongId) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-background">
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-6">
            <Radio className="w-12 h-12" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Following the host</h2>
          <p className="text-muted-foreground max-w-md">
            Waiting for the host to pick a song. It’ll appear here automatically.
          </p>
        </div>
      );
    }
    return <SongView songId={hostSongId} />;
  }

  if (!selectedSongId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-background">
        <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-6">
          <Music className="w-12 h-12" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Ready to Play</h2>
        <p className="text-muted-foreground max-w-md">
          Select a song from your library or open a set to get started. 
          Swipe from the left edge or tap the menu icon to open the sidebar.
        </p>
      </div>
    );
  }

  return <SongView songId={selectedSongId} />;
}
