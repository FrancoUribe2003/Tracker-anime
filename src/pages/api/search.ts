import type { APIRoute } from "astro";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { auth } from "../../lib/auth";
import { db } from "../../lib/db";
import { animeCache, userAnime } from "../../db/schema";

export const prerender = false;

interface CacheEntry {
  timestamp: number;
  data: any[];
}

const searchCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

const searchSchema = z.object({
  q: z.string().trim().min(2),
});

const ANILIST_SEARCH_QUERY = `
  query ($search: String) {
    Page(page: 1, perPage: 8) {
      media(search: $search, type: ANIME, sort: SEARCH_MATCH, isAdult: false) {
        id
        title {
          romaji
          english
        }
        episodes
        seasonYear
        format
        coverImage {
          large
          color
        }
      }
    }
  }
`;

export const GET: APIRoute = async (ctx) => {
  try {
    const sessionUser = ctx.locals.user ?? (await auth.api.getSession({ headers: ctx.request.headers }))?.user;
    if (!sessionUser) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const url = new URL(ctx.request.url);
    const qParam = url.searchParams.get("q") ?? "";

    const validation = searchSchema.safeParse({ q: qParam });
    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: "invalid_input" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const queryTerm = validation.data.q;
    const cacheKey = queryTerm.toLowerCase();

    let mediaList: any[] = [];
    const cached = searchCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      mediaList = cached.data;
    } else {
      try {
        const response = await fetch("https://graphql.anilist.co", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            query: ANILIST_SEARCH_QUERY,
            variables: { search: queryTerm },
          }),
        });

        if (response.ok) {
          const json = await response.json();
          mediaList = json?.data?.Page?.media ?? [];
          searchCache.set(cacheKey, {
            timestamp: Date.now(),
            data: mediaList,
          });
        }
      } catch (fetchErr) {
        console.error("Error al conectar con AniList API en /api/search:", fetchErr);
        mediaList = [];
      }
    }

    // Upsert en animeCache de forma no bloqueante (no espera a que termine para responder)
    const now = new Date();
    Promise.all(
      mediaList.map((media: any) =>
        db
          .insert(animeCache)
          .values({ anilistId: media.id, data: JSON.stringify(media), fetchedAt: now })
          .onConflictDoUpdate({
            target: animeCache.anilistId,
            set: { data: JSON.stringify(media), fetchedAt: now },
          })
          .catch((dbError: any) => {
            console.error(`Error en upsert animeCache para id ${media.id}:`, dbError?.cause ?? dbError);
          })
      )
    ).catch(() => {});

    const mediaIds = mediaList.map((m: any) => m.id);
    const userMap = new Map<number, typeof userAnime.$inferSelect>();

    if (mediaIds.length > 0) {
      try {
        const userRecords = await db
          .select()
          .from(userAnime)
          .where(
            and(
              eq(userAnime.userId, sessionUser.id),
              inArray(userAnime.anilistId, mediaIds)
            )
          );

        for (const record of userRecords) {
          userMap.set(record.anilistId, record);
        }
      } catch (dbError: any) {
        console.error("Error al consultar userAnime en /api/search:", dbError);
        if (dbError?.cause) {
          console.error("Causa de LibSQL (dbError.cause):", dbError.cause);
        }
      }
    }

    const results = mediaList.map((media: any) => {
      const userEntry = userMap.get(media.id);
      return {
        id: media.id,
        title: media.title,
        episodes: media.episodes,
        seasonYear: media.seasonYear,
        format: media.format,
        coverImage: media.coverImage,
        userStatus: userEntry?.status ?? null,
        userProgress: userEntry?.progress ?? null,
        userScore: userEntry?.score ?? null,
      };
    });

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error no controlado en GET /api/search:", error?.cause ?? error);
    return new Response(JSON.stringify({ error: "server_error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
