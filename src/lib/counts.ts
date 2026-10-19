import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import { userAnime } from "../db/schema";

export interface UserCounts {
  completed: number;
  current: number;
  planning: number;
  top: number;
}

export const EMPTY_COUNTS: UserCounts = {
  completed: 0,
  current: 0,
  planning: 0,
  top: 0,
};

export async function getCounts(userId: string): Promise<UserCounts> {
  try {
    const rows = await db
      .select({
        completed: sql<number>`coalesce(sum(case when ${userAnime.status} = 'COMPLETED' then 1 else 0 end), 0)`,
        current: sql<number>`coalesce(sum(case when ${userAnime.status} = 'CURRENT' then 1 else 0 end), 0)`,
        planning: sql<number>`coalesce(sum(case when ${userAnime.status} = 'PLANNING' then 1 else 0 end), 0)`,
        top: sql<number>`coalesce(sum(case when ${userAnime.status} = 'COMPLETED' and ${userAnime.topPosition} is not null then 1 else 0 end), 0)`,
      })
      .from(userAnime)
      .where(eq(userAnime.userId, userId));

    const row = rows[0];
    return {
      completed: Number(row?.completed ?? 0),
      current: Number(row?.current ?? 0),
      planning: Number(row?.planning ?? 0),
      top: Number(row?.top ?? 0),
    };
  } catch (error: any) {
    console.error("Error al obtener los contadores:", error?.cause ?? error);
    return { ...EMPTY_COUNTS };
  }
}
