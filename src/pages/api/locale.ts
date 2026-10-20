import type { APIRoute } from "astro";
import { z } from "zod";

export const prerender = false;

const localeSchema = z.object({
  locale: z.enum(["es", "en"]),
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const body = await request.json().catch(() => null);
  const validation = localeSchema.safeParse(body);

  if (!validation.success) {
    return json({ error: "invalid_input" }, 400);
  }

  cookies.set("lang", validation.data.locale, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: false,
    secure: import.meta.env.PROD,
  });

  return json({ ok: true });
};
