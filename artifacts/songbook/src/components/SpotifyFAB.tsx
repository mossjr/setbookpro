import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useUpdateSong } from "@workspace/api-client-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Music } from "lucide-react"; // SiSpotify would be nice but using Music as fallback

export default function SpotifyFAB({ songId, initialLink }: { songId: string, initialLink?: string | null }) {
  const [link, setLink] = useState(initialLink || "");
  const updateMutation = useUpdateSong();

  const handleSave = () => {
    updateMutation.mutate({ id: songId, data: { spotifyLink: link } });
  };

  if (initialLink) {
    return (
      <Button 
        size="icon" 
        className="h-14 w-14 rounded-full shadow-lg bg-[#1DB954] hover:bg-[#1ed760] text-black"
        onClick={() => window.open(initialLink, "_blank")}
        onContextMenu={(e) => {
          e.preventDefault();
          updateMutation.mutate({ id: songId, data: { spotifyLink: null } });
        }}
      >
        <Music className="w-6 h-6" />
      </Button>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="icon" variant="outline" className="h-14 w-14 rounded-full shadow-lg bg-background">
          <Music className="w-5 h-5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-64 space-y-4">
        <h4 className="font-semibold text-sm">Add Spotify Link</h4>
        <div className="flex gap-2">
          <Input 
            placeholder="https://open.spotify.com/..." 
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
          <Button onClick={handleSave} disabled={updateMutation.isPending || !link}>Save</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}