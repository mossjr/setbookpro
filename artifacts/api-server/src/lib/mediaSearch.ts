export interface MediaSearchItem {
  id: string;
  url: string;
  title: string;
  subtitle: string | null;
  thumbnail: string | null;
  durationLabel: string | null;
}

export interface MediaSearchResults {
  results: MediaSearchItem[];
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function firstRunText(v: unknown): string | null {
  const rec = asRecord(v);
  if (!rec) return null;
  const runs = rec.runs;
  if (Array.isArray(runs) && runs.length) {
    const t = asRecord(runs[0])?.text;
    if (typeof t === "string" && t) return t;
  }
  const simple = rec.simpleText;
  return typeof simple === "string" && simple ? simple : null;
}

function formatMs(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// YouTube — scraped from the public results page (no API key required), mirroring
// the existing Ultimate Guitar approach. Returns an empty list on any failure.
// ---------------------------------------------------------------------------

function extractBalancedJson(src: string, braceStart: number): string | null {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = braceStart; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') {
      inStr = true;
    } else if (c === "{") {
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0) return src.slice(braceStart, i + 1);
    }
  }
  return null;
}

function collectVideoRenderers(
  node: unknown,
  out: Record<string, unknown>[],
  limit: number,
): void {
  if (out.length >= limit) return;
  if (Array.isArray(node)) {
    for (const item of node) {
      collectVideoRenderers(item, out, limit);
      if (out.length >= limit) return;
    }
    return;
  }
  const rec = asRecord(node);
  if (!rec) return;
  const vr = asRecord(rec.videoRenderer);
  if (vr) out.push(vr);
  for (const key of Object.keys(rec)) {
    if (key === "videoRenderer") continue;
    collectVideoRenderers(rec[key], out, limit);
    if (out.length >= limit) return;
  }
}

function mapVideoRenderer(v: Record<string, unknown>): MediaSearchItem | null {
  const id = v.videoId;
  if (typeof id !== "string" || !id) return null;
  const title = firstRunText(v.title);
  if (!title) return null;
  return {
    id,
    url: `https://www.youtube.com/watch?v=${id}`,
    title,
    subtitle: firstRunText(v.ownerText) ?? firstRunText(v.longBylineText),
    thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
    durationLabel: firstRunText(v.lengthText),
  };
}

export async function searchYouTube(query: string): Promise<MediaSearchResults> {
  try {
    const res = await fetch(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
        },
      },
    );
    if (!res.ok) return { results: [] };
    const html = await res.text();
    const marker = html.match(/ytInitialData["\]\s]*=\s*\{/);
    if (!marker || marker.index === undefined) return { results: [] };
    const braceStart = marker.index + marker[0].length - 1;
    const json = extractBalancedJson(html, braceStart);
    if (!json) return { results: [] };
    const data = JSON.parse(json) as unknown;

    const renderers: Record<string, unknown>[] = [];
    collectVideoRenderers(data, renderers, 40);

    const seen = new Set<string>();
    const results: MediaSearchItem[] = [];
    for (const r of renderers) {
      const item = mapVideoRenderer(r);
      if (!item || seen.has(item.id)) continue;
      seen.add(item.id);
      results.push(item);
      if (results.length >= 15) break;
    }
    return { results };
  } catch {
    return { results: [] };
  }
}

// ---------------------------------------------------------------------------
// Spotify — Web API search via the Client Credentials flow. Requires
// SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET. When those are absent the caller
// receives SpotifyNotConfiguredError so the UI can prompt for setup.
// ---------------------------------------------------------------------------

export class SpotifyNotConfiguredError extends Error {
  constructor() {
    super("Spotify search is not configured");
    this.name = "SpotifyNotConfiguredError";
  }
}

let spotifyToken: { value: string; expiresAt: number } | null = null;

async function getSpotifyToken(): Promise<string> {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) throw new SpotifyNotConfiguredError();

  if (spotifyToken && spotifyToken.expiresAt > Date.now() + 10_000) {
    return spotifyToken.value;
  }

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Spotify token request failed: ${res.status}`);

  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!data.access_token) throw new Error("Spotify token missing in response");

  spotifyToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return data.access_token;
}

export async function searchSpotify(query: string): Promise<MediaSearchResults> {
  try {
    const token = await getSpotifyToken();
    const res = await fetch(
      `https://api.spotify.com/v1/search?type=track&limit=15&q=${encodeURIComponent(query)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return { results: [] };

    const data = (await res.json()) as unknown;
    const items = asRecord(asRecord(data)?.tracks)?.items;
    if (!Array.isArray(items)) return { results: [] };

    const results: MediaSearchItem[] = [];
    for (const raw of items) {
      const t = asRecord(raw);
      if (!t) continue;
      const id = typeof t.id === "string" ? t.id : null;
      const title = typeof t.name === "string" ? t.name : "";
      if (!id || !title) continue;

      const artists = Array.isArray(t.artists)
        ? t.artists
            .map((a) => asRecord(a)?.name)
            .filter((n): n is string => typeof n === "string")
            .join(", ")
        : "";

      const images = asRecord(t.album)?.images;
      let thumbnail: string | null = null;
      if (Array.isArray(images) && images.length) {
        const url = (asRecord(images[1]) ?? asRecord(images[0]))?.url;
        thumbnail = typeof url === "string" ? url : null;
      }

      const spotifyUrl = asRecord(t.external_urls)?.spotify;
      const url =
        typeof spotifyUrl === "string"
          ? spotifyUrl
          : `https://open.spotify.com/track/${id}`;

      results.push({
        id,
        url,
        title,
        subtitle: artists || null,
        thumbnail,
        durationLabel:
          typeof t.duration_ms === "number" ? formatMs(t.duration_ms) : null,
      });
    }
    return { results };
  } catch (err) {
    if (err instanceof SpotifyNotConfiguredError) throw err;
    return { results: [] };
  }
}
