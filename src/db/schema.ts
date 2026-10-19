import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core";

export const userAnime = sqliteTable(
  "user_anime",
  {
    userId: text("user_id").notNull(),
    anilistId: integer("anilist_id").notNull(),
    status: text("status").notNull().default("CURRENT"),
    progress: integer("progress").notNull().default(0),
    score: integer("score"),
    topPosition: integer("top_position"),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.anilistId] }),
    index("user_anime_user_status_updated_idx").on(table.userId, table.status, table.updatedAt),
    index("user_anime_user_status_idx").on(table.userId, table.status),
    index("user_anime_user_top_idx").on(table.userId, table.topPosition),
  ]
);

export const animeCache = sqliteTable("anime_cache", {
  anilistId: integer("anilist_id").primaryKey(),
  data: text("data").notNull(),
  fetchedAt: integer("fetched_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const animeDetailCache = sqliteTable("anime_detail_cache", {
  anilistId: integer("anilist_id").primaryKey(),
  data: text("data").notNull(),
  fetchedAt: integer("fetched_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
