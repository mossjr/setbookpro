export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Stored audio paths look like "/objects/uploads/uuid"; serve them via the API. */
export function resolveAudioUrl(
  objectPath: string | null | undefined,
): string | null {
  if (!objectPath) return null;
  if (objectPath.startsWith("/objects/")) {
    const token =
      typeof localStorage !== "undefined"
        ? localStorage.getItem("songbook_token")
        : null;
    const query = token ? `?token=${encodeURIComponent(token)}` : "";
    return `/api/storage${objectPath}${query}`;
  }
  return objectPath;
}

/** Turn a public Spotify link into its embeddable player URL (host-validated). */
export function parseSpotifyEmbedUrl(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    const host = u.hostname.toLowerCase();
    if (
      host !== "spotify.com" &&
      host !== "open.spotify.com" &&
      !host.endsWith(".spotify.com")
    )
      return null;
    const parts = u.pathname.split("/").filter(Boolean);
    let idx = 0;
    if (parts[0]?.startsWith("intl-")) idx = 1;
    const type = parts[idx];
    const id = parts[idx + 1];
    const valid = ["track", "album", "playlist", "artist", "episode", "show"];
    if (!type || !id || !valid.includes(type)) return null;
    return `https://open.spotify.com/embed/${type}/${id}`;
  } catch {
    return null;
  }
}
