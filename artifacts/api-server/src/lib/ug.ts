import crypto from "crypto";

const UG_API_ENDPOINT = "https://api.ultimate-guitar.com/api/v1";

function getUgHeaders(): Record<string, string> {
  const deviceId = crypto.randomBytes(8).toString("hex");
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const hour = now.getUTCHours();
  const formattedDate = `${year}-${month}-${day}:${hour}`;
  const strToHash = `${deviceId}${formattedDate}createLog()`;
  const apiKey = crypto.createHash("md5").update(strToHash).digest("hex");

  return {
    "Accept-Charset": "utf-8",
    Accept: "application/json",
    "User-Agent": "UGT_ANDROID/4.11.1 (Pixel; 8.1.0)",
    "X-UG-CLIENT-ID": deviceId,
    "X-UG-API-KEY": apiKey,
  };
}

async function ugFetch(path: string): Promise<unknown> {
  const url = `${UG_API_ENDPOINT}${path}`;
  const res = await fetch(url, { headers: getUgHeaders() });
  if (!res.ok) {
    throw new Error(`UG API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

interface UgTabRaw {
  id?: number;
  song_name?: string;
  artist_name?: string;
  type?: string;
  rating?: number;
  votes?: number;
  version?: number;
  content?: string;
  tab_url?: string;
}

function extractLyricsChords(raw: UgTabRaw): string {
  const content = (raw as Record<string, unknown>).content as string | undefined;
  if (!content) return "";
  // Strip [tab] [/tab] markers and [ch] [/ch] wrapper tags, keeping chord names
  return content
    .replace(/\[tab\]/gi, "")
    .replace(/\[\/tab\]/gi, "")
    .replace(/\[ch\]/gi, "[")
    .replace(/\[\/ch\]/gi, "]")
    .trim();
}

export interface UgTabSummary {
  id: string;
  title: string;
  artist: string;
  type: string;
  rating: number;
  votes: number;
  version: number | null;
}

export interface UgTabDetail {
  id: string;
  title: string;
  artist: string;
  type: string;
  lyricsChords: string;
  rating: number | null;
  votes: number | null;
}

function mapTabSummary(t: UgTabRaw): UgTabSummary {
  return {
    id: String(t.id ?? ""),
    title: t.song_name ?? "",
    artist: t.artist_name ?? "",
    type: t.type ?? "Chords",
    rating: t.rating ?? 0,
    votes: t.votes ?? 0,
    version: t.version ?? null,
  };
}

export async function searchUg(title: string): Promise<{ tabs: UgTabSummary[] }> {
  try {
    const data = await ugFetch(
      `/tab/search?title=${encodeURIComponent(title)}&page=1&type[]=Chords`,
    );
    const d = data as Record<string, unknown>;
    const tabs: UgTabRaw[] = (d.tabs as UgTabRaw[]) ?? [];
    return { tabs: tabs.map(mapTabSummary) };
  } catch {
    return { tabs: [] };
  }
}

export async function exploreUg(): Promise<{ tabs: UgTabSummary[] }> {
  try {
    const data = await ugFetch(
      `/tab/explore?order=hitsdailygroup_desc&type[]=Chords`,
    );
    const d = data as Record<string, unknown>;
    const tabs: UgTabRaw[] = (d.tabs as UgTabRaw[]) ?? [];
    return { tabs: tabs.map(mapTabSummary) };
  } catch {
    return { tabs: [] };
  }
}

export async function getUgTab(id: string): Promise<UgTabDetail> {
  const data = await ugFetch(`/tab/info?tab_id=${id}&tab_access_type=private`);
  const d = data as Record<string, unknown>;
  const tab = (d.tab ?? d) as UgTabRaw;
  return {
    id: String(tab.id ?? id),
    title: tab.song_name ?? "",
    artist: tab.artist_name ?? "",
    type: tab.type ?? "Chords",
    lyricsChords: extractLyricsChords(tab),
    rating: tab.rating ?? null,
    votes: tab.votes ?? null,
  };
}

export interface UgPlaylistSong {
  tabId: string;
  title: string;
  artist: string;
}

export interface UgPlaylistScrape {
  playlistName: string;
  songs: UgPlaylistSong[];
}

const FIRECRAWL_ENDPOINT = "https://api.firecrawl.dev/v1/scrape";

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function parsePlaylistHtml(html: string): UgPlaylistScrape {
  const rawName =
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ??
    html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ??
    "";
  const playlistName = decodeEntities(rawName.replace(/<[^>]+>/g, ""))
    .replace(/\s*@\s*Ultimate-Guitar\.Com\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  const re =
    /<a href="https:\/\/tabs\.ultimate-guitar\.com\/tab\/([^/]+)\/[^"]*?-(\d+)"[^>]*>([^<]*)<\/a>/g;
  const seen = new Map<string, UgPlaylistSong>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const artistSlug = m[1];
    const tabId = m[2];
    const title = decodeEntities(m[3].trim());
    if (!tabId || seen.has(tabId)) continue;
    const artist = artistSlug
      .split("-")
      .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
      .join(" ");
    seen.set(tabId, { tabId, title, artist });
  }
  return { playlistName, songs: [...seen.values()] };
}

/**
 * Validate that a URL is a shared Ultimate Guitar playlist link before we hand
 * it to Firecrawl. Without this, the endpoint would be an authenticated proxy
 * that scrapes arbitrary URLs on our Firecrawl quota (SSRF-style abuse).
 */
export function isUgPlaylistUrl(url: string): boolean {
  if (typeof url !== "string" || url.length > 2048) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  const host = parsed.hostname.toLowerCase();
  if (host !== "ultimate-guitar.com" && host !== "www.ultimate-guitar.com") {
    return false;
  }
  if (parsed.pathname.replace(/\/+$/, "") !== "/user/playlist/shared") {
    return false;
  }
  const h = parsed.searchParams.get("h");
  return !!h && h.trim().length > 0;
}

/**
 * Read a shared Ultimate Guitar playlist link. The page is behind Cloudflare
 * bot protection, so a plain fetch is blocked — we use Firecrawl to render the
 * page and return the song anchors. See `.agents/memory/ug-playlist-import.md`.
 */
export async function scrapeUgPlaylist(url: string): Promise<UgPlaylistScrape> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) {
    throw new Error("FIRECRAWL_API_KEY is not configured");
  }
  const res = await fetch(FIRECRAWL_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url, formats: ["rawHtml"], onlyMainContent: false }),
  });
  if (!res.ok) {
    throw new Error(`Firecrawl error: ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as { data?: { rawHtml?: string } };
  const html = json?.data?.rawHtml ?? "";
  if (!html) {
    throw new Error("Firecrawl returned no HTML");
  }
  return parsePlaylistHtml(html);
}
