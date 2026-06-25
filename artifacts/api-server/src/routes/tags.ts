import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, tagsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import {
  CreateTagBody,
  UpdateTagBody,
  UpdateTagParams,
  DeleteTagParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/tags", requireAuth, async (_req, res): Promise<void> => {
  const tags = await db.select().from(tagsTable).orderBy(tagsTable.name);
  res.json(tags);
});

router.post("/tags", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateTagBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [tag] = await db.insert(tagsTable).values(parsed.data).returning();
  res.status(201).json(tag);
});

router.patch("/tags/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateTagParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = UpdateTagBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [tag] = await db
    .update(tagsTable)
    .set(parsed.data)
    .where(eq(tagsTable.id, params.data.id))
    .returning();
  if (!tag) {
    res.status(404).json({ error: "Tag not found" });
    return;
  }
  res.json(tag);
});

router.delete("/tags/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteTagParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.delete(tagsTable).where(eq(tagsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
