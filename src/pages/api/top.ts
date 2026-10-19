import type { APIRoute } from "astro";
import { z } from "zod";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { auth } from "../../lib/auth";
import { db } from "../../lib/db";
import { userAnime } from "../../db/schema";
import { getAnimeByIds } from "../../lib/anilist";
import { compactTopPositions } from "../../lib/top";
import { getCounts } from "../../lib/counts";

export const prerender = false;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const idSchema = z.object({
  anilistId: z.number().int().positive("El ID de AniList debe ser un número entero positivo"),
});

async function getSessionUser(ctx: Parameters<APIRoute>[0]) {
  return ctx.locals.user ?? (await auth.api.getSession({ headers: ctx.request.headers }))?.user ?? null;
}

export const GET: APIRoute = async (ctx) => {
  try {
    const user = await getSessionUser(ctx);
    if (!user) return json({ error: "No autorizado" }, 401);

    const rows = await db
      .select()
      .from(userAnime)
      .where(and(eq(userAnime.userId, user.id), isNotNull(userAnime.topPosition)))
      .orderBy(asc(userAnime.topPosition));

    const animeMap = await getAnimeByIds(rows.map((row) => row.anilistId));

    const items = rows.map((row) => {
      const anime = animeMap.get(row.anilistId);
      return {
        anilistId: row.anilistId,
        score: row.score ?? null,
        title:
          anime?.title?.english ||
          anime?.title?.romaji ||
          `Anime #${row.anilistId}`,
        coverImage: anime?.coverImage?.large ?? null,
        color: anime?.coverImage?.color ?? null,
        year: anime?.seasonYear ?? null,
        format: anime?.format ?? null,
        episodes: anime?.episodes ?? null,
      };
    });

    return json({ items });
  } catch (error: any) {
    console.error("Error no controlado en GET /api/top:", error?.cause ?? error);
    return json({ error: "Error interno al obtener tu Top" }, 500);
  }
};

export const POST: APIRoute = async (ctx) => {
  try {
    const user = await getSessionUser(ctx);
    if (!user) return json({ error: "No autorizado" }, 401);

    const body = await ctx.request.json().catch(() => null);
    if (body === null) return json({ error: "Cuerpo de solicitud inválido" }, 400);

    const validation = idSchema.safeParse(body);
    if (!validation.success) {
      return json({ error: validation.error.errors[0]?.message ?? "Datos inválidos" }, 400);
    }

    const { anilistId } = validation.data;

    const result = await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(userAnime)
        .where(and(eq(userAnime.userId, user.id), eq(userAnime.anilistId, anilistId)))
        .limit(1);

      const record = rows[0];
      if (!record) return { error: "El anime no está en tu lista", status: 404 } as const;
      if (record.status !== "COMPLETED") {
        return { error: "Solo podés agregar animes completados", status: 400 } as const;
      }
      if (record.topPosition != null) {
        return { error: "El anime ya está en tu Top", status: 409 } as const;
      }

      const topRows = await tx
        .select({ topPosition: userAnime.topPosition })
        .from(userAnime)
        .where(and(eq(userAnime.userId, user.id), isNotNull(userAnime.topPosition)));

      const nextPosition =
        topRows.reduce((max, row) => Math.max(max, row.topPosition ?? 0), 0) + 1;

      await tx
        .update(userAnime)
        .set({ topPosition: nextPosition })
        .where(and(eq(userAnime.userId, user.id), eq(userAnime.anilistId, anilistId)));

      return { position: nextPosition } as const;
    });

    if ("error" in result) return json({ error: result.error }, result.status);
    const counts = await getCounts(user.id);
    return json({ success: true, position: result.position, counts });
  } catch (error: any) {
    console.error("Error no controlado en POST /api/top:", error?.cause ?? error);
    return json({ error: "Error interno al agregar al Top" }, 500);
  }
};

export const DELETE: APIRoute = async (ctx) => {
  try {
    const user = await getSessionUser(ctx);
    if (!user) return json({ error: "No autorizado" }, 401);

    const body = await ctx.request.json().catch(() => null);
    if (body === null) return json({ error: "Cuerpo de solicitud inválido" }, 400);

    const validation = idSchema.safeParse(body);
    if (!validation.success) {
      return json({ error: validation.error.errors[0]?.message ?? "Datos inválidos" }, 400);
    }

    const { anilistId } = validation.data;

    await db.transaction(async (tx) => {
      const rows = await tx
        .select({ topPosition: userAnime.topPosition })
        .from(userAnime)
        .where(and(eq(userAnime.userId, user.id), eq(userAnime.anilistId, anilistId)))
        .limit(1);

      if (rows[0]?.topPosition == null) return;

      await tx
        .update(userAnime)
        .set({ topPosition: null })
        .where(and(eq(userAnime.userId, user.id), eq(userAnime.anilistId, anilistId)));
      await compactTopPositions(user.id, tx);
    });

    const counts = await getCounts(user.id);
    return json({ success: true, counts });
  } catch (error: any) {
    console.error("Error no controlado en DELETE /api/top:", error?.cause ?? error);
    return json({ error: "Error interno al quitar del Top" }, 500);
  }
};
