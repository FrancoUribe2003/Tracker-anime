import type { APIRoute } from "astro";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { auth } from "../../../lib/auth";
import { db } from "../../../lib/db";
import { userAnime } from "../../../db/schema";
import { getCachedAnime } from "../../../lib/anilist";
import { compactTopPositions } from "../../../lib/top";
import { getCounts } from "../../../lib/counts";

export const prerender = false;

const MAX_UNKNOWN_EPISODES = 3000;

const progressSchema = z
  .object({
    anilistId: z.number().int().positive("El ID de AniList debe ser un número entero positivo"),
    delta: z.number().int("El delta debe ser un número entero").optional(),
    progress: z
      .number()
      .int()
      .nonnegative("El progreso no puede ser negativo")
      .max(100000, "El progreso es demasiado alto")
      .optional(),
    score: z.number().min(0).max(10).nullable().optional(),
  })
  .refine((data) => data.delta !== undefined || data.progress !== undefined || data.score !== undefined, {
    message: "Debes enviar 'delta', 'progress' o 'score'",
  });

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const PATCH: APIRoute = async (ctx) => {
  try {
    const sessionUser =
      ctx.locals.user ?? (await auth.api.getSession({ headers: ctx.request.headers }))?.user;

    if (!sessionUser) {
      return json({ error: "No autorizado" }, 401);
    }

    let body: unknown;
    try {
      body = await ctx.request.json();
    } catch {
      return json({ error: "Cuerpo de solicitud inválido" }, 400);
    }

    const validation = progressSchema.safeParse(body);
    if (!validation.success) {
      return json(
        { error: validation.error.errors[0]?.message ?? "Datos inválidos" },
        400
      );
    }

    const { anilistId, delta, progress, score } = validation.data;

    let current: typeof userAnime.$inferSelect | undefined;
    try {
      const rows = await db
        .select()
        .from(userAnime)
        .where(and(eq(userAnime.userId, sessionUser.id), eq(userAnime.anilistId, anilistId)))
        .limit(1);
      current = rows[0];
    } catch (dbError: any) {
      console.error("Error al consultar userAnime en PATCH /api/list/progress:", dbError?.cause ?? dbError);
      return json({ error: "Error al consultar tu lista" }, 500);
    }

    if (!current) {
      return json({ error: "El anime no está en tu lista" }, 404);
    }

    const now = new Date();
    const updateSet: {
      progress?: number;
      status?: string;
      score?: number | null;
      updatedAt: Date;
    } = { updatedAt: now };

    let nextProgress = current.progress ?? 0;
    let nextStatus = current.status;
    let knownEpisodes: number | null = null;

    if (progress !== undefined || delta !== undefined) {
      const cached = await getCachedAnime(anilistId);
      knownEpisodes =
        typeof cached?.episodes === "number" && cached.episodes > 0 ? cached.episodes : null;
      const finished = cached?.status === "FINISHED";

      const base = current.progress ?? 0;
      nextProgress = progress !== undefined ? progress : base + (delta ?? 0);

      if (nextProgress < 0) nextProgress = 0;
      const cap = knownEpisodes ?? MAX_UNKNOWN_EPISODES;
      if (nextProgress > cap) nextProgress = cap;

      const reachedEnd = finished && knownEpisodes !== null && nextProgress >= knownEpisodes;
      nextStatus = reachedEnd ? "COMPLETED" : current.status;

      updateSet.progress = nextProgress;
      updateSet.status = nextStatus;
    }

    if (score !== undefined) {
      updateSet.score = score;
    }

    try {
      await db.transaction(async (tx) => {
        await tx
          .update(userAnime)
          .set(updateSet)
          .where(and(eq(userAnime.userId, sessionUser.id), eq(userAnime.anilistId, anilistId)));

        if (current.status === "COMPLETED" && nextStatus !== "COMPLETED") {
          await tx
            .update(userAnime)
            .set({ topPosition: null })
            .where(and(eq(userAnime.userId, sessionUser.id), eq(userAnime.anilistId, anilistId)));
          await compactTopPositions(sessionUser.id, tx);
        }
      });
    } catch (saveError: any) {
      console.error("Error al actualizar progreso en PATCH /api/list/progress:", saveError?.cause ?? saveError);
      return json({ error: "Error al actualizar el progreso" }, 500);
    }

    const counts = await getCounts(sessionUser.id);

    return json({
      success: true,
      status: nextStatus,
      progress: nextProgress,
      episodes: knownEpisodes,
      score: score !== undefined ? score : current.score,
      counts,
    });
  } catch (error: any) {
    console.error("Error no controlado en PATCH /api/list/progress:", error?.cause ?? error);
    return json({ error: "Error interno al actualizar el progreso" }, 500);
  }
};
