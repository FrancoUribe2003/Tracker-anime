import type { APIRoute } from "astro";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { auth } from "../../lib/auth";
import { db } from "../../lib/db";
import { userAnime } from "../../db/schema";
import { getCachedAnime } from "../../lib/anilist";
import { compactTopPositions } from "../../lib/top";
import { getCounts } from "../../lib/counts";

export const prerender = false;

const postSchema = z.object({
  anilistId: z.number().int().positive(),
  status: z.enum(["CURRENT", "PLANNING", "COMPLETED"]),
  progress: z.number().int().nonnegative().optional(),
  score: z.number().min(0).max(10).optional().nullable(),
});

const deleteSchema = z.object({
  anilistId: z.number().int().positive(),
});

export const POST: APIRoute = async (ctx) => {
  try {
    const sessionUser = ctx.locals.user ?? (await auth.api.getSession({ headers: ctx.request.headers }))?.user;
    if (!sessionUser) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    let body: unknown;
    try {
      body = await ctx.request.json();
    } catch {
      return new Response(JSON.stringify({ error: "invalid_body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const validation = postSchema.safeParse(body);
    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: "invalid_input" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { anilistId, status, progress, score } = validation.data;

    let knownEpisodes: number | null = null;
    if (status === "COMPLETED") {
      const cached = await getCachedAnime(anilistId);
      if (cached?.status === "FINISHED" && typeof cached.episodes === "number" && cached.episodes > 0) {
        knownEpisodes = cached.episodes;
      }
    }

    let finalProgress = progress ?? 0;
    if (status === "COMPLETED") {
      if (knownEpisodes) {
        finalProgress = knownEpisodes;
      } else {
        finalProgress = progress ?? 0;
      }
    } else if (status === "PLANNING") {
      finalProgress = 0;
    }

    const now = new Date();
    const updateSet: {
      status: "CURRENT" | "PLANNING" | "COMPLETED";
      progress: number;
      updatedAt: Date;
      score?: number | null;
    } = {
      status,
      progress: finalProgress,
      updatedAt: now,
    };

    if (score !== undefined) {
      updateSet.score = score;
    }

    try {
      await db.transaction(async (tx) => {
        const existing = await tx
          .select({ topPosition: userAnime.topPosition })
          .from(userAnime)
          .where(and(eq(userAnime.userId, sessionUser.id), eq(userAnime.anilistId, anilistId)))
          .limit(1);
        const hadTopPosition = existing[0]?.topPosition != null;

        await tx
          .insert(userAnime)
          .values({
            userId: sessionUser.id,
            anilistId,
            status,
            progress: finalProgress,
            score: score ?? null,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [userAnime.userId, userAnime.anilistId],
            set: updateSet,
          });

        if (status !== "COMPLETED" && hadTopPosition) {
          await tx
            .update(userAnime)
            .set({ topPosition: null })
            .where(and(eq(userAnime.userId, sessionUser.id), eq(userAnime.anilistId, anilistId)));
          await compactTopPositions(sessionUser.id, tx);
        }
      });
    } catch (saveError: any) {
      console.error("Error al guardar en userAnime en POST /api/list:", saveError);
      if (saveError?.cause) {
        console.error("Causa de LibSQL (saveError.cause):", saveError.cause);
      }
      return new Response(
        JSON.stringify({ error: "server_error" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const counts = await getCounts(sessionUser.id);

    return new Response(
      JSON.stringify({
        success: true,
        status,
        progress: finalProgress,
        counts,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error no controlado en POST /api/list:", error);
    if (error?.cause) {
      console.error("Causa de LibSQL (error.cause):", error.cause);
    }
    return new Response(
      JSON.stringify({ error: "server_error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};

export const DELETE: APIRoute = async (ctx) => {
  try {
    const sessionUser = ctx.locals.user ?? (await auth.api.getSession({ headers: ctx.request.headers }))?.user;
    if (!sessionUser) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    let body: unknown;
    try {
      body = await ctx.request.json();
    } catch {
      return new Response(JSON.stringify({ error: "invalid_body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const validation = deleteSchema.safeParse(body);
    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: "invalid_input" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { anilistId } = validation.data;

    try {
      await db.transaction(async (tx) => {
        const existing = await tx
          .select({ topPosition: userAnime.topPosition })
          .from(userAnime)
          .where(and(eq(userAnime.userId, sessionUser.id), eq(userAnime.anilistId, anilistId)))
          .limit(1);
        const hadTopPosition = existing[0]?.topPosition != null;

        await tx
          .delete(userAnime)
          .where(
            and(
              eq(userAnime.userId, sessionUser.id),
              eq(userAnime.anilistId, anilistId)
            )
          );

        if (hadTopPosition) {
          await compactTopPositions(sessionUser.id, tx);
        }
      });
    } catch (dbError: any) {
      console.error("Error al eliminar de userAnime en DELETE /api/list:", dbError);
      if (dbError?.cause) {
        console.error("Causa de LibSQL (dbError.cause):", dbError.cause);
      }
      return new Response(
        JSON.stringify({ error: "server_error" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const counts = await getCounts(sessionUser.id);

    return new Response(JSON.stringify({ success: true, counts }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error no controlado en DELETE /api/list:", error);
    if (error?.cause) {
      console.error("Causa de LibSQL (error.cause):", error.cause);
    }
    return new Response(
      JSON.stringify({ error: "server_error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
