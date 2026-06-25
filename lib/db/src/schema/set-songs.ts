import { integer, pgTable, primaryKey, uuid } from "drizzle-orm/pg-core";
import { setsTable } from "./sets";
import { songsTable } from "./songs";

export const setSongsTable = pgTable(
  "set_songs",
  {
    setId: uuid("set_id")
      .notNull()
      .references(() => setsTable.id, { onDelete: "cascade" }),
    songId: uuid("song_id")
      .notNull()
      .references(() => songsTable.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.setId, t.songId] })],
);
