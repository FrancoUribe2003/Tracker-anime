import { eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { animeCache, animeDetailCache } from "../db/schema";

export interface AniListAnime {
  id: number;
  title: {
    romaji?: string | null;
    english?: string | null;
  };
  episodes?: number | null;
  status?: string | null;
  seasonYear?: number | null;
  format?: string | null;
  nextAiringEpisode?: { episode?: number | null; airingAt?: number | null } | null;
  coverImage?: {
    large?: string | null;
    color?: string | null;
  } | null;
  bannerImage?: string | null;
}

const GRAPHQL_ENDPOINT = "https://graphql.anilist.co";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const ANIME_AIRING_TTL_MS = 6 * 60 * 60 * 1000;
const BATCH_SIZE = 50;

const ANILIST_QUERY = `
  query ($ids: [Int], $page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      media(id_in: $ids, type: ANIME) {
        id
        title {
          romaji
          english
        }
        episodes
        status
        seasonYear
        format
        nextAiringEpisode {
          episode
          airingAt
        }
        coverImage {
          large
          color
        }
        bannerImage
      }
    }
  }
`;

function isAnimeCacheStale(anime: AniListAnime | null, fetchedAt: Date | null): boolean {
  if (!anime || typeof anime !== "object" || !("nextAiringEpisode" in anime)) return true;
  const fetchedTime = fetchedAt ? fetchedAt.getTime() : 0;
  const airing = anime.status === "RELEASING" || anime.nextAiringEpisode != null;
  const ttl = airing ? ANIME_AIRING_TTL_MS : SEVEN_DAYS_MS;
  return Date.now() - fetchedTime > ttl;
}

async function fetchAndCacheChunk(chunk: number[]): Promise<AniListAnime[]> {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: ANILIST_QUERY, variables: { ids: chunk, page: 1, perPage: BATCH_SIZE } }),
  });

  if (!response.ok) return [];

  const json = await response.json();
  const mediaList: AniListAnime[] = json?.data?.Page?.media ?? [];

  // Escritura en caché de forma no bloqueante (fire-and-forget por chunk completo)
  Promise.all(
    mediaList.map((media) =>
      db
        .insert(animeCache)
        .values({ anilistId: media.id, data: JSON.stringify(media), fetchedAt: new Date() })
        .onConflictDoUpdate({
          target: animeCache.anilistId,
          set: { data: JSON.stringify(media), fetchedAt: new Date() },
        })
        .catch((dbError: any) => {
          console.error(`Error upsert animeCache ID ${media.id}:`, dbError?.cause ?? dbError);
        })
    )
  ).catch(() => {});

  return mediaList;
}

export async function getCachedAnime(anilistId: number): Promise<AniListAnime | null> {
  let parsed: AniListAnime | null = null;
  let fetchedAt: Date | null = null;

  try {
    const rows = await db
      .select()
      .from(animeCache)
      .where(eq(animeCache.anilistId, anilistId))
      .limit(1);

    const row = rows[0];
    if (row) {
      fetchedAt = row.fetchedAt ? new Date(row.fetchedAt) : null;
      const raw = row.data;
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    }
  } catch (error: any) {
    console.error(`Error al consultar animeCache para el anime ${anilistId}:`, error?.cause ?? error);
  }

  if (parsed && !isAnimeCacheStale(parsed, fetchedAt)) return parsed;

  const refreshed = await getAnimeByIds([anilistId]);
  return refreshed.get(anilistId) ?? parsed;
}

export async function getAnimeByIds(ids: number[]): Promise<Map<number, AniListAnime>> {
  const resultMap = new Map<number, AniListAnime>();
  const uniqueIds = Array.from(new Set(ids.filter((id) => Number.isInteger(id) && id > 0)));

  if (uniqueIds.length === 0) return resultMap;

  let cachedRecords: (typeof animeCache.$inferSelect)[] = [];
  try {
    cachedRecords = await db
      .select()
      .from(animeCache)
      .where(inArray(animeCache.anilistId, uniqueIds));
  } catch (error: any) {
    console.error("Error al consultar animeCache:", error?.cause ?? error);
  }

  const cachedIds = new Set<number>();
  const idsToFetch: number[] = [];

  for (const record of cachedRecords) {
    cachedIds.add(record.anilistId);
    let parsed: AniListAnime | null = null;
    try {
      parsed = typeof record.data === "string" ? JSON.parse(record.data) : record.data;
    } catch {
      parsed = null;
    }

    if (parsed) resultMap.set(record.anilistId, parsed);

    const fetchedAt = record.fetchedAt ? new Date(record.fetchedAt) : null;
    if (isAnimeCacheStale(parsed, fetchedAt)) {
      idsToFetch.push(record.anilistId);
    }
  }

  for (const id of uniqueIds) {
    if (!cachedIds.has(id)) idsToFetch.push(id);
  }

  if (idsToFetch.length === 0) return resultMap;

  // Todos los chunks en paralelo
  const chunks: number[][] = [];
  for (let i = 0; i < idsToFetch.length; i += BATCH_SIZE) {
    chunks.push(idsToFetch.slice(i, i + BATCH_SIZE));
  }

  const chunkResults = await Promise.allSettled(
    chunks.map((chunk) => fetchAndCacheChunk(chunk).catch((networkError) => {
      console.error("Error de red con AniList GraphQL:", networkError);
      return [] as AniListAnime[];
    }))
  );

  for (const result of chunkResults) {
    if (result.status === "fulfilled") {
      for (const media of result.value) {
        resultMap.set(media.id, media);
      }
    }
  }

  return resultMap;
}

export interface AniListTitle {
  romaji?: string | null;
  english?: string | null;
  native?: string | null;
}

export interface AniListFuzzyDate {
  year?: number | null;
  month?: number | null;
  day?: number | null;
}

export interface AniListCharacterEdge {
  role?: string | null;
  node?: {
    name?: { full?: string | null } | null;
    image?: { large?: string | null } | null;
  } | null;
  voiceActors?: {
    name?: { full?: string | null } | null;
    image?: { large?: string | null } | null;
  }[] | null;
}

export interface AniListRelationEdge {
  relationType?: string | null;
  node?: {
    id: number;
    type?: string | null;
    format?: string | null;
    title?: AniListTitle | null;
    coverImage?: { large?: string | null } | null;
  } | null;
}

export interface AniListRecommendation {
  mediaRecommendation?: {
    id: number;
    title?: AniListTitle | null;
    coverImage?: { large?: string | null } | null;
    averageScore?: number | null;
  } | null;
}

export interface AniListExternalLink {
  id?: number | null;
  url?: string | null;
  site?: string | null;
  type?: string | null;
  language?: string | null;
  color?: string | null;
  icon?: string | null;
  isDisabled?: boolean | null;
}

export interface AniListDetail {
  id: number;
  title: AniListTitle;
  synonyms?: string[] | null;
  description?: string | null;
  format?: string | null;
  status?: string | null;
  episodes?: number | null;
  duration?: number | null;
  season?: string | null;
  seasonYear?: number | null;
  startDate?: AniListFuzzyDate | null;
  endDate?: AniListFuzzyDate | null;
  source?: string | null;
  genres?: string[] | null;
  tags?: { name: string; rank?: number | null; isMediaSpoiler?: boolean | null }[] | null;
  averageScore?: number | null;
  meanScore?: number | null;
  popularity?: number | null;
  favourites?: number | null;
  studios?: {
    edges?: { isMain?: boolean; node?: { name?: string | null } | null }[] | null;
  } | null;
  coverImage?: {
    extraLarge?: string | null;
    large?: string | null;
    color?: string | null;
  } | null;
  bannerImage?: string | null;
  trailer?: { id?: string | null; site?: string | null } | null;
  nextAiringEpisode?: { episode?: number | null; airingAt?: number | null } | null;
  characters?: { edges?: AniListCharacterEdge[] | null } | null;
  relations?: { edges?: AniListRelationEdge[] | null } | null;
  recommendations?: { nodes?: AniListRecommendation[] | null } | null;
  externalLinks?: AniListExternalLink[] | null;
}

export interface AnimeDetailResult {
  detail: AniListDetail | null;
  error: boolean;
}

const DETAIL_TTL_MS = 24 * 60 * 60 * 1000;
const DETAIL_AIRING_TTL_MS = 6 * 60 * 60 * 1000;

const ANILIST_DETAIL_QUERY = `
  query ($id: Int) {
    Media(id: $id, type: ANIME) {
      id
      title {
        romaji
        english
        native
      }
      synonyms
      description(asHtml: false)
      format
      status
      episodes
      duration
      season
      seasonYear
      startDate {
        year
        month
        day
      }
      endDate {
        year
        month
        day
      }
      source
      genres
      tags {
        name
        rank
        isMediaSpoiler
      }
      averageScore
      meanScore
      popularity
      favourites
      studios {
        edges {
          isMain
          node {
            name
          }
        }
      }
      coverImage {
        extraLarge
        large
        color
      }
      bannerImage
      trailer {
        id
        site
      }
      nextAiringEpisode {
        episode
        airingAt
      }
      characters(perPage: 8, sort: [ROLE, RELEVANCE, ID]) {
        edges {
          role
          node {
            name {
              full
            }
            image {
              large
            }
          }
          voiceActors(language: JAPANESE) {
            name {
              full
            }
            image {
              large
            }
          }
        }
      }
      relations {
        edges {
          relationType
          node {
            id
            type
            format
            title {
              romaji
              english
            }
            coverImage {
              large
            }
          }
        }
      }
      recommendations(perPage: 6, sort: RATING_DESC) {
        nodes {
          mediaRecommendation {
            id
            title {
              romaji
              english
            }
            coverImage {
              large
            }
            averageScore
          }
        }
      }
      externalLinks {
        id
        url
        site
        type
        language
        color
        icon
        isDisabled
      }
    }
  }
`;

async function readDetailCache(
  anilistId: number
): Promise<{ data: AniListDetail; fetchedAt: Date | null } | null> {
  try {
    const rows = await db
      .select()
      .from(animeDetailCache)
      .where(eq(animeDetailCache.anilistId, anilistId))
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    const parsed = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
    return { data: parsed as AniListDetail, fetchedAt: row.fetchedAt };
  } catch (error: any) {
    console.error(`Error al consultar animeDetailCache ${anilistId}:`, error?.cause ?? error);
    return null;
  }
}

async function writeDetailCache(anilistId: number, detail: AniListDetail): Promise<void> {
  try {
    await db
      .insert(animeDetailCache)
      .values({ anilistId, data: JSON.stringify(detail), fetchedAt: new Date() })
      .onConflictDoUpdate({
        target: animeDetailCache.anilistId,
        set: { data: JSON.stringify(detail), fetchedAt: new Date() },
      });
  } catch (error: any) {
    console.error(`Error al guardar animeDetailCache ${anilistId}:`, error?.cause ?? error);
  }
}

function isDetailStale(record: { data: AniListDetail; fetchedAt: Date | null }): boolean {
  if (!record.data || !("externalLinks" in record.data)) return true;
  const fetchedTime = record.fetchedAt ? new Date(record.fetchedAt).getTime() : 0;
  const isAiring =
    record.data?.nextAiringEpisode != null || record.data?.status === "RELEASING";
  const ttl = isAiring ? DETAIL_AIRING_TTL_MS : DETAIL_TTL_MS;
  return Date.now() - fetchedTime > ttl;
}

export async function getAnimeDetail(id: number): Promise<AnimeDetailResult> {
  const cached = await readDetailCache(id);
  if (cached && !isDetailStale(cached)) {
    return { detail: cached.data, error: false };
  }

  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: ANILIST_DETAIL_QUERY, variables: { id } }),
    });

    if (response.ok) {
      const json = await response.json();
      const media: AniListDetail | null = json?.data?.Media ?? null;

      if (media) {
        await writeDetailCache(id, media);
        return { detail: media, error: false };
      }

      return { detail: null, error: false };
    }

    console.error(`AniList respondió ${response.status} al obtener el detalle del anime ${id}`);
  } catch (networkError: any) {
    console.error(`Error de red con AniList al obtener el detalle del anime ${id}:`, networkError);
  }

  if (cached) {
    return { detail: cached.data, error: false };
  }

  return { detail: null, error: true };
}

export const CATALOG_MIN_POPULARITY = 5000;
export const CATALOG_PER_PAGE = 24;
const CATALOG_CACHE_TTL_MS = 30 * 60 * 1000;

export type CatalogSort = "puntuacion" | "alfabetico";

export interface CatalogAnime {
  id: number;
  title: { romaji?: string | null; english?: string | null };
  format?: string | null;
  episodes?: number | null;
  seasonYear?: number | null;
  averageScore?: number | null;
  coverImage?: { large?: string | null; color?: string | null } | null;
}

export interface CatalogPage {
  items: CatalogAnime[];
  currentPage: number;
  lastPage: number;
  hasNextPage: boolean;
  total: number;
  error: boolean;
}

interface CatalogPageData {
  items: CatalogAnime[];
  currentPage: number;
  lastPage: number;
  hasNextPage: boolean;
  total: number;
}

const catalogCache = new Map<string, { timestamp: number; data: CatalogPageData }>();

const CATALOG_QUERY = `
  query ($page: Int, $sort: MediaSort, $minPopularity: Int) {
    Page(page: $page, perPage: ${CATALOG_PER_PAGE}) {
      pageInfo {
        total
        currentPage
        lastPage
        hasNextPage
      }
      media(
        type: ANIME
        sort: [$sort]
        isAdult: false
        format_in: [TV, TV_SHORT, MOVIE, OVA, ONA, SPECIAL]
        popularity_greater: $minPopularity
      ) {
        id
        title {
          romaji
          english
        }
        format
        episodes
        seasonYear
        averageScore
        coverImage {
          large
          color
        }
      }
    }
  }
`;

async function fetchCatalogPage(sort: CatalogSort, page: number): Promise<CatalogPageData | null> {
  const sortValue = sort === "alfabetico" ? "TITLE_ROMAJI" : "SCORE_DESC";

  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        query: CATALOG_QUERY,
        variables: { page, sort: sortValue, minPopularity: CATALOG_MIN_POPULARITY },
      }),
    });

    if (!response.ok) {
      console.error(`AniList respondió ${response.status} al obtener el catálogo`);
      return null;
    }

    const json = await response.json();
    const pageData = json?.data?.Page;
    if (!pageData) return null;

    const items: CatalogAnime[] = Array.isArray(pageData.media) ? pageData.media : [];
    const info = pageData.pageInfo ?? {};

    return {
      items,
      currentPage: Number(info.currentPage ?? page),
      lastPage: Math.max(1, Number(info.lastPage ?? 1)),
      hasNextPage: Boolean(info.hasNextPage),
      total: Number(info.total ?? items.length),
    };
  } catch (error: any) {
    console.error("Error al obtener el catálogo de AniList:", error);
    return null;
  }
}

export async function getCatalogPage(params: { sort: CatalogSort; page: number }): Promise<CatalogPage> {
  const sort: CatalogSort = params.sort === "alfabetico" ? "alfabetico" : "puntuacion";
  let page = Number.isInteger(params.page) && params.page >= 1 ? params.page : 1;

  const cached = catalogCache.get(`${sort}:${page}`);
  if (cached && Date.now() - cached.timestamp < CATALOG_CACHE_TTL_MS) {
    return { ...cached.data, error: false };
  }

  let data = await fetchCatalogPage(sort, page);

  if (data && page > data.lastPage) {
    data = await fetchCatalogPage(sort, 1);
    page = 1;
  }

  if (data) {
    catalogCache.set(`${sort}:${page}`, { timestamp: Date.now(), data });
    return { ...data, error: false };
  }

  if (cached) {
    return { ...cached.data, error: false };
  }

  return { items: [], currentPage: 1, lastPage: 1, hasNextPage: false, total: 0, error: true };
}
