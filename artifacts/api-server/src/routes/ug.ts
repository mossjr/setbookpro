import { Router, type IRouter } from "express";
import { eq, inArray, sql } from "drizzle-orm";
import { db, songsTable, setsTable, setSongsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import {
  searchUg,
  exploreUg,
  getUgTab,
  scrapeUgPlaylist,
  isUgPlaylistUrl,
} from "../lib/ug";
import {
  UgSearchQueryParams,
  UgGetTabParams,
  UgImportTabBody,
  UgPlaylistPreviewBody,
  UgPlaylistImportBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

function normKey(title: string, artist: string): string {
  const t = title
    .toLowerCase()
    .replace(/\(ver\s*\d+\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const a = artist
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return `${t}|${a}`;
}

async function mapLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (cursor < items.length) {
        const idx = cursor++;
        await fn(items[idx], idx);
      }
    },
  );
  await Promise.all(workers);
}

router.get("/ug/search", requireAuth, async (req, res): Promise<void> => {
  const params = UgSearchQueryParams.safeParse(req.query);
  if (!params.success || !params.data.title) {
    res.status(400).json({ error: "title is required" });
    return;
  }
  const results = await searchUg(params.data.title);
  res.json(results);
});

router.get("/ug/explore", requireAuth, async (_req, res): Promise<void> => {
  const results = await exploreUg();
  res.json(results);
});

router.get("/ug/tab/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UgGetTabParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const tab = await getUgTab(params.data.id);
  res.json(tab);
});

router.post("/ug/import", requireAuth, async (req, res): Promise<void> => {
  const parsed = UgImportTabBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [song] = await db
    .insert(songsTable)
    .values({
      title: parsed.data.title,
      artist: parsed.data.artist,
      meta: parsed.data.meta ?? null,
      lyricsChords: parsed.data.lyricsChords,
      originalUgId: parsed.data.ugId,
    })
    .returning();
  res.status(201).json({ ...song, tags: [] });
});

router.post(
  "/ug/playlist/preview",
  requireAuth,
  async (req, res): Promise<void> => {
    const parsed = UgPlaylistPreviewBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const url = parsed.data.url.trim();
    if (!isUgPlaylistUrl(url)) {
      res.status(400).json({
        error:
          "Please paste a shared Ultimate Guitar playlist link (open a playlist, tap Share, and copy the link).",
      });
      return;
    }

    let scrape;
    try {
      scrape = await scrapeUgPlaylist(url);
    } catch (err) {
      req.log.error({ err }, "UG playlist scrape failed");
      res
        .status(400)
        .json({ error: "Could not read that playlist link. Check the URL and try again." });
      return;
    }

    if (scrape.songs.length === 0) {
      res.status(400).json({
        error:
          "No songs found at that link. Make sure it is a shared Ultimate Guitar playlist.",
      });
      return;
    }

    const library = await db
      .select({
        id: songsTable.id,
        title: songsTable.title,
        artist: songsTable.artist,
        originalUgId: songsTable.originalUgId,
      })
      .from(songsTable);

    const byUgId = new Map<string, string>();
    const byKey = new Map<string, string>();
    for (const s of library) {
      if (s.originalUgId) byUgId.set(s.originalUgId, s.id);
      byKey.set(normKey(s.title, s.artist), s.id);
    }

    const items = scrape.songs.map((song) => {
      const existingSongId =
        byUgId.get(song.tabId) ?? byKey.get(normKey(song.title, song.artist)) ?? null;
      return {
        tabId: song.tabId,
        title: song.title,
        artist: song.artist,
        status: existingSongId ? "duplicate" : "new",
        existingSongId,
      };
    });

    const existingSet = await db.query.setsTable.findFirst({
      where: eq(setsTable.title, scrape.playlistName),
    });

    res.json({
      playlistName: scrape.playlistName,
      setExists: !!existingSet,
      items,
    });
  },
);

router.post(
  "/ug/playlist/import",
  requireAuth,
  async (req, res): Promise<void> => {
    const parsed = UgPlaylistImportBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const setName = parsed.data.setName.trim();
    if (!setName) {
      res.status(400).json({ error: "Set name is required" });
      return;
    }

    // Dedupe incoming items by tabId, preserving playlist order.
    const seenTab = new Set<string>();
    const items = parsed.data.items.filter((it) => {
      if (!it.tabId || seenTab.has(it.tabId)) return false;
      seenTab.add(it.tabId);
      return true;
    });

    if (items.length === 0) {
      res.status(400).json({ error: "No songs to import" });
      return;
    }

    // Find or create the target set by name.
    let set = await db.query.setsTable.findFirst({
      where: eq(setsTable.title, setName),
    });
    if (!set) {
      [set] = await db.insert(setsTable).values({ title: setName }).returning();
    }
    const setId = set.id;

    // Existing library songs already keyed by their UG tab id.
    const tabIds = items.map((it) => it.tabId);
    const existingRows = await db
      .select({ id: songsTable.id, originalUgId: songsTable.originalUgId })
      .from(songsTable)
      .where(inArray(songsTable.originalUgId, tabIds));
    const existingByUgId = new Map<string, string>();
    for (const s of existingRows) {
      if (s.originalUgId) existingByUgId.set(s.originalUgId, s.id);
    }

    let imported = 0;
    let addedExisting = 0;
    let skipped = 0;
    const resolved: ({ songId: string; isNew: boolean } | null)[] = new Array(
      items.length,
    ).fill(null);

    // Resolve each item to a songId, fetching + inserting new ones concurrently.
    await mapLimit(items, 6, async (it, index) => {
      try {
        let songId = it.existingSongId ?? existingByUgId.get(it.tabId) ?? null;
        let isNew = false;
        if (!songId) {
          const tab = await getUgTab(it.tabId);
          if (!tab.lyricsChords) {
            skipped++;
            return;
          }
          const [song] = await db
            .insert(songsTable)
            .values({
              title: tab.title || it.title,
              artist: tab.artist || it.artist,
              lyricsChords: tab.lyricsChords,
              originalUgId: it.tabId,
            })
            .returning();
          songId = song.id;
          isNew = true;
        }
        resolved[index] = { songId, isNew };
      } catch (err) {
        req.log.warn({ err, tabId: it.tabId }, "Failed to import playlist song");
        skipped++;
      }
    });

    // Add resolved songs to the set in playlist order.
    const [maxRow] = await db
      .select({
        max: sql<number>`coalesce(max(${setSongsTable.sortOrder}), -1)::int`,
      })
      .from(setSongsTable)
      .where(eq(setSongsTable.setId, setId));
    let order = (maxRow?.max ?? -1) + 1;

    for (const r of resolved) {
      if (!r) continue;
      await db
        .insert(setSongsTable)
        .values({ setId, songId: r.songId, sortOrder: order })
        .onConflictDoNothing();
      order++;
      if (r.isNew) imported++;
      else addedExisting++;
    }

    res.json({ setId, imported, addedExisting, skipped });
  },
);

export default router;
