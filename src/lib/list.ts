import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { userAnime } from "../db/schema";
import { getAnimeByIds, type AniListAnime } from "./anilist";
import { getCounts, type UserCounts } from "./counts";

export type UserAnimeRecord = typeof userAnime.$inferSelect;

export type UserStatus = "CURRENT" | "PLANNING" | "COMPLETED";

export interface AnimeListItem {
  userRecord: UserAnimeRecord;
  animeData?: AniListAnime;
}

export interface UserAnimeList {
  records: UserAnimeRecord[];
  items: AnimeListItem[];
  counts: UserCounts;
  animeDataMap: Map<number, AniListAnime>;
}

export async function getUserAnimeList(userId: string): Promise<UserAnimeList> {
  let records: UserAnimeRecord[] = [];
  try {
    records = await db.select().from(userAnime).where(eq(userAnime.userId, userId));
  } catch (dbError: any) {
    console.error("Error al consultar userAnime:", dbError?.cause ?? dbError);
  }

  const counts = await getCounts(userId);

  const animeDataMap = await getAnimeByIds(records.map((r) => r.anilistId));

  const items: AnimeListItem[] = records.map((userRecord) => ({
    userRecord,
    animeData: animeDataMap.get(userRecord.anilistId),
  }));

  return { records, items, counts, animeDataMap };
}

export interface HomeStats {
  completedCount: number;
  completedEpisodes: number;
  averageScore: number | null;
  animesProgressPercent: number;
  episodesProgressPercent: number;
  scoreProgressPercent: number;
}

export async function getHomeStats(userId: string): Promise<HomeStats> {
  let records: UserAnimeRecord[] = [];
  try {
    records = await db.select().from(userAnime).where(eq(userAnime.userId, userId));
  } catch (dbError: any) {
    console.error("Error al consultar userAnime para las estadísticas:", dbError?.cause ?? dbError);
  }

  const completed = records.filter((record) => record.status === "COMPLETED");
  const animeDataMap = await getAnimeByIds(completed.map((record) => record.anilistId));

  let completedEpisodes = 0;
  let totalEpisodesAllStates = 0;

  for (const record of records) {
    const isCompleted = record.status === "COMPLETED";
    if (isCompleted) {
      const anime = animeDataMap.get(record.anilistId);
      const epCount = anime?.episodes ?? record.progress ?? 0;
      completedEpisodes += epCount;
      totalEpisodesAllStates += epCount;
    } else {
      totalEpisodesAllStates += record.progress ?? 0;
    }
  }

  const scored = completed.filter((record) => typeof record.score === "number" && record.score > 0);
  const averageScore =
    scored.length > 0
      ? scored.reduce((acc, record) => acc + (record.score ?? 0), 0) / scored.length
      : null;

  const totalCount = records.length;
  const completedCount = completed.length;

  return {
    completedCount,
    completedEpisodes,
    averageScore,
    animesProgressPercent: totalCount > 0 ? (completedCount / totalCount) * 100 : 0,
    episodesProgressPercent: totalEpisodesAllStates > 0 ? (completedEpisodes / totalEpisodesAllStates) * 100 : 0,
    scoreProgressPercent: averageScore !== null ? (averageScore / 10) * 100 : 0,
  };
}

export interface RowCard {
  anilistId: number;
  title: string;
  coverImage: string | null;
  color: string | null;
  year: number | null;
  episodes: number | null;
  progress: number;
  score: number | null;
}

export async function getUserAnimeRow(
  userId: string,
  status: UserStatus,
  offset: number,
  limit: number
): Promise<RowCard[]> {
  let records: UserAnimeRecord[] = [];
  try {
    records = await db
      .select()
      .from(userAnime)
      .where(and(eq(userAnime.userId, userId), eq(userAnime.status, status)))
      .orderBy(desc(userAnime.updatedAt), desc(userAnime.anilistId))
      .limit(limit)
      .offset(offset);
  } catch (dbError: any) {
    console.error("Error al consultar la fila de userAnime:", dbError?.cause ?? dbError);
    return [];
  }

  const animeDataMap = await getAnimeByIds(records.map((record) => record.anilistId));

  return records.map((record) => {
    const anime = animeDataMap.get(record.anilistId);
    const title =
      anime?.title?.romaji || anime?.title?.english || `Anime #${record.anilistId}`;
    return {
      anilistId: record.anilistId,
      title,
      coverImage: anime?.coverImage?.large ?? null,
      color: anime?.coverImage?.color ?? null,
      year: anime?.seasonYear ?? null,
      episodes: anime?.episodes ?? null,
      progress: record.progress ?? 0,
      score: record.score ?? null,
    };
  });
}

export async function getUserStatuses(
  userId: string,
  anilistIds: number[]
): Promise<Map<number, UserStatus>> {
  const resultMap = new Map<number, UserStatus>();
  const ids = Array.from(new Set(anilistIds.filter((id) => Number.isInteger(id) && id > 0)));

  if (ids.length === 0) return resultMap;

  try {
    const rows = await db
      .select({ anilistId: userAnime.anilistId, status: userAnime.status })
      .from(userAnime)
      .where(and(eq(userAnime.userId, userId), inArray(userAnime.anilistId, ids)));

    for (const row of rows) {
      if (row.status === "CURRENT" || row.status === "PLANNING" || row.status === "COMPLETED") {
        resultMap.set(row.anilistId, row.status);
      }
    }
  } catch (dbError: any) {
    console.error("Error al consultar los estados del usuario:", dbError?.cause ?? dbError);
  }

  return resultMap;
}

export function byUpdatedAtDesc(a: AnimeListItem, b: AnimeListItem): number {
  const timeA = a.userRecord.updatedAt ? new Date(a.userRecord.updatedAt).getTime() : 0;
  const timeB = b.userRecord.updatedAt ? new Date(b.userRecord.updatedAt).getTime() : 0;
  return timeB - timeA;
}
