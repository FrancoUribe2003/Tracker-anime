import type { APIRoute } from "astro";
import { z } from "zod";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { auth } from "../../../lib/auth";
import { db } from "../../../lib/db";
import { userAnime } from "../../../db/schema";
import { getCounts } from "../../../lib/counts";

export const prerender = false;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const reorderSchema = z.object({
  order: z.array(z.number().int().positive()).min(1),
});

export const PUT: APIRoute = async (ctx) => {
  try {
    const user =
      ctx.locals.user ?? (await auth.api.getSession({ headers: ctx.request.headers }))?.user ?? null;
    if (!user) return json({ error: "unauthorized" }, 401);

    const body = await ctx.request.json().catch(() => null);
    if (body === null) return json({ error: "invalid_body" }, 400);

    const validation = reorderSchema.safeParse(body);
    if (!validation.success) {
      return json({ error: "invalid_input" }, 400);
    }

    const { order } = validation.data;

    const result = await db.transaction(async (tx) => {
      const current = await tx
        .select({ anilistId: userAnime.anilistId })
        .from(userAnime)
        .where(and(eq(userAnime.userId, user.id), isNotNull(userAnime.topPosition)))
        .orderBy(asc(userAnime.topPosition));

      const currentIds = current.map((row) => row.anilistId);
      const currentSet = new Set(currentIds);
      const requestedSet = new Set(order);

      if (
        order.length !== currentIds.length ||
        requestedSet.size !== order.length ||
        order.some((id) => !currentSet.has(id))
      ) {
        return { error: "order_mismatch", status: 400 } as const;
      }

      for (let index = 0; index < order.length; index += 1) {
        await tx
          .update(userAnime)
          .set({ topPosition: index + 1 })
          .where(and(eq(userAnime.userId, user.id), eq(userAnime.anilistId, order[index])));
      }

      return { success: true } as const;
    });

    if ("error" in result) return json({ error: result.error }, result.status);
    const counts = await getCounts(user.id);
    return json({ success: true, counts });
  } catch (error: any) {
    console.error("Error no controlado en PUT /api/top/reorder:", error?.cause ?? error);
    return json({ error: "server_error" }, 500);
  }
};
