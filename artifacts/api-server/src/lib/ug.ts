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
