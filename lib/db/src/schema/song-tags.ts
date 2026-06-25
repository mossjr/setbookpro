import { pgTable, primaryKey, uuid } from "drizzle-orm/pg-core";
import { songsTable } from "./songs";
import { tagsTable } from "./tags";

export const songTagsTable = pgTable(
  "song_tags",
  {
    songId: uuid("song_id")
      .notNull()
      .references(() => songsTable.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tagsTable.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.songId, t.tagId] })],
);
