import { type Song } from "@workspace/api-client-react";

export interface ExportedSong {
  title: string;
  artist: string;
  meta?: string | null;
  lyricsChords: string;
  spotifyLink?: string | null;
  youtubeUrl?: string | null;
  mediaType?: string;
  tags?: string[];
}

export interface LibraryExport {
  version: number;
  exportedAt: string;
  songs: ExportedSong[];
}

export function exportLibrary(songs: Song[]) {
  const data: LibraryExport = {
    version: 1,
    exportedAt: new Date().toISOString(),
    songs: songs.map((s) => ({
      title: s.title,
      artist: s.artist,
      meta: s.meta ?? null,
      lyricsChords: s.lyricsChords,
      spotifyLink: s.spotifyLink ?? null,
      youtubeUrl: s.youtubeUrl ?? null,
      mediaType: s.mediaType,
      tags: s.tags?.map((t) => t.name) ?? [],
    })),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `songbook-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function parseImportFile(file: File): Promise<ExportedSong[]> {
  const text = await file.text();
  const data = JSON.parse(text);
  const songs = Array.isArray(data) ? data : data?.songs;
  if (!Array.isArray(songs)) throw new Error("Invalid file format");
  return songs
    .filter(
      (s: any) =>
        s &&
        typeof s.title === "string" &&
        typeof s.lyricsChords === "string",
    )
    .map((s: any) => ({
      title: String(s.title),
      artist: String(s.artist ?? ""),
      meta: s.meta ?? null,
      lyricsChords: String(s.lyricsChords),
      spotifyLink: s.spotifyLink ?? null,
      youtubeUrl: s.youtubeUrl ?? null,
      mediaType: typeof s.mediaType === "string" ? s.mediaType : "none",
      tags: Array.isArray(s.tags) ? s.tags.map(String) : [],
    }));
}
