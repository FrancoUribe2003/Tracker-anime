import type { APIRoute } from "astro";
import { auth } from "../../lib/auth";
import { getCounts } from "../../lib/counts";

export const prerender = false;

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
    if (!user) return json({ error: "unauthorized" }, 401);

    const counts = await getCounts(user.id);
    return json(counts);
  } catch (error: any) {
    console.error("Error no controlado en GET /api/counts:", error?.cause ?? error);
    return json({ error: "server_error" }, 500);
  }
};
