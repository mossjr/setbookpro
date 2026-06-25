import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const setsTable = pgTable("sets", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSetSchema = createInsertSchema(setsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertSet = z.infer<typeof insertSetSchema>;
export type SongSet = typeof setsTable.$inferSelect;
