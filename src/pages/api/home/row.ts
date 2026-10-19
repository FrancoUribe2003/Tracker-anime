import type { APIRoute } from "astro";
import { z } from "zod";
import { auth } from "../../../lib/auth";
import { getUserAnimeRow } from "../../../lib/list";

export const prerender = false;

const MAX_LIMIT = 24;

const querySchema = z.object({
  status: z.enum(["CURRENT", "PLANNING", "COMPLETED"]),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(12),
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const GET: APIRoute = async (ctx) => {
  try {
    const user =
      ctx.locals.user ?? (await auth.api.getSession({ headers: ctx.request.headers }))?.user ?? null;
    if (!user) return json({ error: "No autorizado" }, 401);

    const url = new URL(ctx.request.url);
    const validation = querySchema.safeParse({
      status: url.searchParams.get("status") ?? undefined,
      offset: url.searchParams.get("offset") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });

    if (!validation.success) {
      return json({ error: validation.error.errors[0]?.message ?? "Parámetros inválidos" }, 400);
    }

    const { status, offset, limit } = validation.data;
    const items = await getUserAnimeRow(user.id, status, offset, limit);

    return json({ items, offset, limit });
  } catch (error: any) {
    console.error("Error no controlado en GET /api/home/row:", error?.cause ?? error);
    return json({ error: "Error interno al obtener la fila" }, 500);
  }
};
