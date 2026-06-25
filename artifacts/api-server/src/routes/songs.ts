import { Router, type IRouter } from "express";
import { eq, ilike, sql } from "drizzle-orm";
import { db, songsTable, tagsTable, songTagsTable, setsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import {
  CreateSongBody,
  UpdateSongBody,
  UpdateSongParams,
  GetSongParams,
  DeleteSongParams,
  AddTagToSongParams,
  AddTagToSongBody,
  RemoveTagFromSongParams,
  ListSongsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function getSongWithTags(songId: string) {
  const song = await db.query.songsTable.findFirst({
    where: eq(songsTable.id, songId),
  });
  if (!song) return null;

  const tags = await db
    .select({ id: tagsTable.id, name: tagsTable.name, color: tagsTable.color })
    .from(tagsTable)
    .innerJoin(songTagsTable, eq(songTagsTable.tagId, tagsTable.id))
    .where(eq(songTagsTable.songId, songId));

  return { ...song, tags };
}

router.get("/songs/stats", requireAuth, async (req, res): Promise<void> => {
  const [songCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(songsTable);
  const [setCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(setsTable);
  const [tagCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tagsTable);

  const recentRaw = await db
    .select()
    .from(songsTable)
    .orderBy(sql`${songsTable.createdAt} desc`)
    .limit(5);

  const recentSongs = await Promise.all(
    recentRaw.map((s) => getSongWithTags(s.id)),
  );

  res.json({
    totalSongs: songCount?.count ?? 0,
    totalSets: setCount?.count ?? 0,
    totalTags: tagCount?.count ?? 0,
    recentSongs: recentSongs.filter(Boolean),
  });
});

router.get("/songs", requireAuth, async (req, res): Promise<void> => {
  const params = ListSongsQueryParams.safeParse(req.query);
  const search = params.success ? params.data.search : undefined;
  const tagId = params.success ? params.data.tagId : undefined;

  let query = db.select().from(songsTable);

  if (search) {
    const songs = await db
      .select()
      .from(songsTable)
      .where(
        sql`(${songsTable.title} ilike ${"%" + search + "%"} or ${songsTable.artist} ilike ${"%" + search + "%"})`,
      )
      .orderBy(songsTable.title);

    const withTags = await Promise.all(songs.map((s) => getSongWithTags(s.id)));
    res.json(withTags.filter(Boolean));
    return;
  }

  if (tagId) {
    const songs = await db
      .select({ song: songsTable })
      .from(songsTable)
      .innerJoin(songTagsTable, eq(songTagsTable.songId, songsTable.id))
      .where(eq(songTagsTable.tagId, tagId))
      .orderBy(songsTable.title);

    const withTags = await Promise.all(
      songs.map((s) => getSongWithTags(s.song.id)),
    );
    res.json(withTags.filter(Boolean));
    return;
  }

  const songs = await db.select().from(songsTable).orderBy(songsTable.title);
  const withTags = await Promise.all(songs.map((s) => getSongWithTags(s.id)));
  res.json(withTags.filter(Boolean));
});

router.post("/songs", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateSongBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [song] = await db.insert(songsTable).values(parsed.data).returning();
  res.status(201).json({ ...song, tags: [] });
});

router.get("/songs/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetSongParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const song = await getSongWithTags(params.data.id);
  if (!song) {
    res.status(404).json({ error: "Song not found" });
    return;
  }
  res.json(song);
});

router.patch("/songs/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateSongParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = UpdateSongBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [updated] = await db
    .update(songsTable)
    .set(parsed.data)
    .where(eq(songsTable.id, params.data.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Song not found" });
    return;
  }
  const song = await getSongWithTags(updated.id);
  res.json(song);
});

router.delete("/songs/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteSongParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.delete(songsTable).where(eq(songsTable.id, params.data.id));
  res.sendStatus(204);
});

router.post("/songs/:id/tags", requireAuth, async (req, res): Promise<void> => {
  const params = AddTagToSongParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = AddTagToSongBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid tagId" });
    return;
  }
  await db
    .insert(songTagsTable)
    .values({ songId: params.data.id, tagId: parsed.data.tagId })
    .onConflictDoNothing();
  const song = await getSongWithTags(params.data.id);
  if (!song) {
    res.status(404).json({ error: "Song not found" });
    return;
  }
  res.json(song);
});

router.delete(
  "/songs/:id/tags/:tagId",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = RemoveTagFromSongParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid params" });
      return;
    }
    await db
      .delete(songTagsTable)
      .where(
        sql`${songTagsTable.songId} = ${params.data.id} and ${songTagsTable.tagId} = ${params.data.tagId}`,
      );
    const song = await getSongWithTags(params.data.id);
    if (!song) {
      res.status(404).json({ error: "Song not found" });
      return;
    }
    res.json(song);
  },
);

export default router;
