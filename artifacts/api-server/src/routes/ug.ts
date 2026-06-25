import { Router, type IRouter } from "express";
import { db, songsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { searchUg, exploreUg, getUgTab } from "../lib/ug";
import { UgSearchQueryParams, UgGetTabParams, UgImportTabBody } from "@workspace/api-zod";

const router: IRouter = Router();

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

export default router;
