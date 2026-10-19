import { and, asc, eq, isNotNull } from "drizzle-orm";
import { db } from "./db";
import { userAnime } from "../db/schema";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function compactTopPositions(userId: string, tx: Transaction): Promise<void> {
  const rows = await tx
    .select({ anilistId: userAnime.anilistId, topPosition: userAnime.topPosition })
    .from(userAnime)
    .where(and(eq(userAnime.userId, userId), isNotNull(userAnime.topPosition)))
    .orderBy(asc(userAnime.topPosition));

  for (let index = 0; index < rows.length; index += 1) {
    const position = index + 1;
    if (rows[index].topPosition === position) continue;

    await tx
      .update(userAnime)
      .set({ topPosition: position })
      .where(and(eq(userAnime.userId, userId), eq(userAnime.anilistId, rows[index].anilistId)));
  }
}
