import { Router, type IRouter } from "express";
import { eq, sql, asc } from "drizzle-orm";
import { db, setsTable, setSongsTable, songsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import {
  CreateSetBody,
  UpdateSetBody,
  UpdateSetParams,
  GetSetParams,
  DeleteSetParams,
  AddSongToSetBody,
  AddSongToSetParams,
  RemoveSongFromSetParams,
  ReorderSetSongsBody,
  ReorderSetSongsParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function getSetWithSongs(setId: string) {
  const set = await db.query.setsTable.findFirst({
    where: eq(setsTable.id, setId),
  });
  if (!set) return null;

  const songs = await db
    .select({
      id: songsTable.id,
      title: songsTable.title,
      artist: songsTable.artist,
      meta: songsTable.meta,
      rating: songsTable.rating,
      status: songsTable.status,
      sortOrder: setSongsTable.sortOrder,
    })
    .from(setSongsTable)
    .innerJoin(songsTable, eq(songsTable.id, setSongsTable.songId))
    .where(eq(setSongsTable.setId, setId))
    .orderBy(asc(setSongsTable.sortOrder));

  return { ...set, songs };
}

router.get("/sets", requireAuth, async (_req, res): Promise<void> => {
  const sets = await db.select().from(setsTable).orderBy(setsTable.createdAt);

  const withCounts = await Promise.all(
    sets.map(async (s) => {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(setSongsTable)
        .where(eq(setSongsTable.setId, s.id));
      return { ...s, songCount: row?.count ?? 0 };
    }),
  );
  res.json(withCounts);
});

router.post("/sets", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateSetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [set] = await db.insert(setsTable).values(parsed.data).returning();
  res.status(201).json({ ...set, songCount: 0 });
});

router.get("/sets/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetSetParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const set = await getSetWithSongs(params.data.id);
  if (!set) {
    res.status(404).json({ error: "Set not found" });
    return;
  }
  res.json(set);
});

router.patch("/sets/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateSetParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = UpdateSetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [updated] = await db
    .update(setsTable)
    .set(parsed.data)
    .where(eq(setsTable.id, params.data.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Set not found" });
    return;
  }
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(setSongsTable)
    .where(eq(setSongsTable.setId, updated.id));
  res.json({ ...updated, songCount: row?.count ?? 0 });
});

router.delete("/sets/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteSetParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.delete(setsTable).where(eq(setsTable.id, params.data.id));
  res.sendStatus(204);
});

router.post("/sets/:id/songs", requireAuth, async (req, res): Promise<void> => {
  const params = AddSongToSetParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = AddSongToSetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid songId" });
    return;
  }

  const [maxRow] = await db
    .select({ max: sql<number>`coalesce(max(${setSongsTable.sortOrder}), -1)::int` })
    .from(setSongsTable)
    .where(eq(setSongsTable.setId, params.data.id));

  const nextOrder = (maxRow?.max ?? -1) + 1;

  await db
    .insert(setSongsTable)
    .values({ setId: params.data.id, songId: parsed.data.songId, sortOrder: nextOrder })
    .onConflictDoNothing();

  const set = await getSetWithSongs(params.data.id);
  if (!set) {
    res.status(404).json({ error: "Set not found" });
    return;
  }
  res.json(set);
});

router.delete(
  "/sets/:id/songs/:songId",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = RemoveSongFromSetParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid params" });
      return;
    }
    await db
      .delete(setSongsTable)
      .where(
        sql`${setSongsTable.setId} = ${params.data.id} and ${setSongsTable.songId} = ${params.data.songId}`,
      );
    const set = await getSetWithSongs(params.data.id);
    if (!set) {
      res.status(404).json({ error: "Set not found" });
      return;
    }
    res.json(set);
  },
);

router.patch(
  "/sets/:id/reorder",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = ReorderSetSongsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const parsed = ReorderSetSongsBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid songIds" });
      return;
    }

    await Promise.all(
      parsed.data.songIds.map((songId, index) =>
        db
          .update(setSongsTable)
          .set({ sortOrder: index })
          .where(
            sql`${setSongsTable.setId} = ${params.data.id} and ${setSongsTable.songId} = ${songId}`,
          ),
      ),
    );

    const set = await getSetWithSongs(params.data.id);
    if (!set) {
      res.status(404).json({ error: "Set not found" });
      return;
    }
    res.json(set);
  },
);

export default router;
