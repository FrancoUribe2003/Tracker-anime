import type { APIRoute } from "astro";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { auth } from "../../../lib/auth";
import { db } from "../../../lib/db";
import { userAnime } from "../../../db/schema";

export const prerender = false;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const reorderSchema = z.object({
  order: z.array(z.number().int().positive().safe()),
});

export const PUT: APIRoute = async (ctx) => {
  try {
    const user =
      ctx.locals.user ?? (await auth.api.getSession({ headers: ctx.request.headers }))?.user ?? null;
    if (!user) return json({ error: "unauthorized" }, 401);

    const body = await ctx.request.json().catch(() => null);
    if (body === null) return json({ error: "invalid_body" }, 400);
    const validation = reorderSchema.safeParse(body);
    if (!validation.success) return json({ error: "invalid_input" }, 400);

    const { order } = validation.data;
    const result = await db.transaction(async (tx) => {
      const current = await tx
        .select({ anilistId: userAnime.anilistId })
        .from(userAnime)
        .where(and(eq(userAnime.userId, user.id), eq(userAnime.status, "PLANNING")));
      const currentIds = new Set(current.map((row) => row.anilistId));
      if (
        new Set(order).size !== order.length ||
        order.some((id) => !currentIds.has(id))
      ) {
        return { error: "order_mismatch" } as const;
      }

      await tx
        .update(userAnime)
        .set({ planningOrder: null })
        .where(and(eq(userAnime.userId, user.id), eq(userAnime.status, "PLANNING")));

      for (let index = 0; index < order.length; index += 1) {
        await tx
          .update(userAnime)
          .set({ planningOrder: index })
          .where(and(
            eq(userAnime.userId, user.id),
            eq(userAnime.status, "PLANNING"),
            eq(userAnime.anilistId, order[index])
          ));
      }
      return { success: true } as const;
    });

    return json(result, "error" in result ? 400 : 200);
  } catch (error: any) {
    console.error("Error no controlado en PUT /api/list/planning-order:", error?.cause ?? error);
    return json({ error: "server_error" }, 500);
  }
};
