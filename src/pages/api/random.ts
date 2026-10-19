import type { APIRoute } from "astro";
import { z } from "zod";
import { and, eq, ne, sql } from "drizzle-orm";
import { auth } from "../../lib/auth";
import { db } from "../../lib/db";
import { userAnime } from "../../db/schema";
import { getAnimeDetail } from "../../lib/anilist";

export const prerender = false;

const querySchema = z.object({
  status: z.enum(["CURRENT", "PLANNING"], {
    errorMap: () => ({ message: "El estado debe ser CURRENT o PLANNING" }),
  }),
  exclude: z.coerce.number().int().positive().optional(),
});

export const GET: APIRoute = async (ctx) => {
  try {
    const sessionUser =
      ctx.locals.user ?? (await auth.api.getSession({ headers: ctx.request.headers }))?.user;

    if (!sessionUser) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const url = new URL(ctx.request.url);
    const validation = querySchema.safeParse({
      status: url.searchParams.get("status") ?? "",
      exclude: url.searchParams.get("exclude") ?? undefined,
    });

    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: validation.error.errors[0]?.message ?? "Parámetros inválidos" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { status, exclude } = validation.data;

    const conditions = [eq(userAnime.userId, sessionUser.id), eq(userAnime.status, status)];
    if (exclude !== undefined) {
      conditions.push(ne(userAnime.anilistId, exclude));
    }

    let row: typeof userAnime.$inferSelect | undefined;
    try {
      const rows = await db
        .select()
        .from(userAnime)
        .where(and(...conditions))
        .orderBy(sql`random()`)
        .limit(1);
      row = rows[0];
    } catch (dbError: any) {
      console.error("Error al seleccionar anime aleatorio:", dbError?.cause ?? dbError);
      return new Response(JSON.stringify({ error: "Error al consultar tu lista" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!row) {
      return new Response(JSON.stringify({ error: "No hay animes disponibles" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { detail } = await getAnimeDetail(row.anilistId);

    return new Response(
      JSON.stringify({
        id: row.anilistId,
        status: row.status,
        progress: row.progress ?? 0,
        title: {
          romaji: detail?.title?.romaji ?? null,
          english: detail?.title?.english ?? null,
        },
        coverImage: detail?.coverImage ?? null,
        bannerImage: detail?.bannerImage ?? null,
        seasonYear: detail?.seasonYear ?? null,
        format: detail?.format ?? null,
        episodes: detail?.episodes ?? null,
        genres: detail?.genres ?? [],
        averageScore: detail?.averageScore ?? null,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error no controlado en GET /api/random:", error?.cause ?? error);
    return new Response(JSON.stringify({ error: "Error interno al obtener un anime" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
