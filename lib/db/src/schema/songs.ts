import { pgTable, text, integer, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const songsTable = pgTable("songs", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  artist: text("artist").notNull(),
  meta: text("meta"),
  lyricsChords: text("lyrics_chords").notNull().default(""),
  originalUgId: text("original_ug_id"),
  spotifyLink: text("spotify_link"),
  // Media player: which source the play button uses, plus per-source details.
  mediaType: text("media_type").notNull().default("none"),
  audioUrl: text("audio_url"),
  audioFileName: text("audio_file_name"),
  audioContentType: text("audio_content_type"),
  audioSize: integer("audio_size"),
  youtubeUrl: text("youtube_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSongSchema = createInsertSchema(songsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertSong = z.infer<typeof insertSongSchema>;
export type Song = typeof songsTable.$inferSelect;
