/**
 * Cliente servidor de la API pública de AniList (GraphQL).
 * Datos de anime: catálogo, temporada, ficha y enlaces oficiales de
 * streaming. Sin API key para lectura; los datos son de AniList y de sus
 * fuentes, y las series se ven en las plataformas con licencia.
 */

const ANILIST_API = "https://graphql.anilist.co";

export interface AniMedia {
  id: number;
  title: { romaji: string | null; english: string | null; native: string | null };
  description: string | null;
  episodes: number | null;
  duration: number | null;
  status: string | null;
  format: string | null;
  season: string | null;
  seasonYear: number | null;
  averageScore: number | null;
  popularity: number | null;
  genres: string[];
  isAdult: boolean;
  coverImage: { large: string | null; extraLarge: string | null } | null;
  bannerImage: string | null;
  studios?: { nodes: { name: string }[] };
  externalLinks?: { site: string; url: string; type: string | null; language: string | null }[];
  trailer?: { id: string | null; site: string | null } | null;
  nextAiringEpisode?: { episode: number; airingAt: number } | null;
  relations?: {
    edges: { relationType: string; node: AniMedia }[];
  };
}

export interface AniPage {
  pageInfo: { total: number; currentPage: number; lastPage: number; hasNextPage: boolean };
  media: AniMedia[];
}

export async function aniFetch<T>(
  query: string,
  variables: Record<string, unknown>,
  revalidateSeconds = 300
): Promise<T> {
  const res = await fetch(ANILIST_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "MangaTotal/1.0 (manga-total.vercel.app)",
    },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: revalidateSeconds },
  });

  if (!res.ok) throw new Error(`AniList respondió ${res.status}`);
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors[0].message);
  if (!json.data) throw new Error("AniList no devolvió datos");
  return json.data;
}

export const STATUS_ES: Record<string, string> = {
  FINISHED: "Finalizado",
  RELEASING: "En emisión",
  NOT_YET_RELEASED: "Próximamente",
  CANCELLED: "Cancelado",
  HIATUS: "En pausa",
};

export const FORMAT_ES: Record<string, string> = {
  TV: "Serie TV",
  TV_SHORT: "Serie corta",
  MOVIE: "Película",
  SPECIAL: "Especial",
  OVA: "OVA",
  ONA: "ONA",
  MUSIC: "Musical",
};

export const SEASON_ES: Record<string, string> = {
  WINTER: "Invierno",
  SPRING: "Primavera",
  SUMMER: "Verano",
  FALL: "Otoño",
};

/** Temporada de emisión que corresponde a una fecha. */
export function currentSeason(date = new Date()): { season: string; year: number } {
  const month = date.getUTCMonth();
  const season =
    month <= 1 || month === 11 ? "WINTER" : month <= 4 ? "SPRING" : month <= 7 ? "SUMMER" : "FALL";
  // diciembre pertenece al invierno del año siguiente
  const year = month === 11 ? date.getUTCFullYear() + 1 : date.getUTCFullYear();
  return { season, year };
}

/** Limpia el HTML ligero que AniList mete en las sinopsis. */
export function cleanDescription(html: string | null): string | null {
  if (!html) return null;
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function aniTitle(media: AniMedia): string {
  return media.title.english || media.title.romaji || media.title.native || "Sin título";
}

/** Forma pública para las tarjetas del catálogo. */
export function publicAnimeCard(m: AniMedia) {
  return {
    id: m.id,
    title: aniTitle(m),
    cover_url: m.coverImage?.extraLarge ?? m.coverImage?.large ?? null,
    format: m.format ? (FORMAT_ES[m.format] ?? m.format) : null,
    status: m.status ? (STATUS_ES[m.status] ?? m.status) : null,
    episodes: m.episodes,
    score: m.averageScore,
    year: m.seasonYear,
    genres: m.genres?.slice(0, 3) ?? [],
    is_adult: m.isAdult,
  };
}

/** Forma pública para la ficha completa. */
export function publicAnimeDetail(m: AniMedia) {
  const streaming = (m.externalLinks ?? [])
    .filter((l) => l.type === "STREAMING")
    .map((l) => ({ site: l.site, url: l.url, language: l.language }));

  return {
    ...publicAnimeCard(m),
    description: cleanDescription(m.description),
    native_title: m.title.native,
    romaji_title: m.title.romaji,
    banner_url: m.bannerImage,
    duration: m.duration,
    season:
      m.season && m.seasonYear ? `${SEASON_ES[m.season] ?? m.season} ${m.seasonYear}` : null,
    all_genres: m.genres ?? [],
    studios: m.studios?.nodes.map((s) => s.name) ?? [],
    streaming,
    trailer:
      m.trailer?.site === "youtube" && m.trailer.id
        ? `https://www.youtube.com/watch?v=${m.trailer.id}`
        : null,
    next_episode: m.nextAiringEpisode
      ? { episode: m.nextAiringEpisode.episode, airing_at: m.nextAiringEpisode.airingAt }
      : null,
    relations: (m.relations?.edges ?? [])
      .filter((e) => ["SEQUEL", "PREQUEL", "SIDE_STORY", "ALTERNATIVE"].includes(e.relationType))
      .map((e) => ({ relation: e.relationType, ...publicAnimeCard(e.node) })),
  };
}

export const MEDIA_CARD_FIELDS = `
  id
  title { romaji english native }
  episodes
  status
  format
  season
  seasonYear
  averageScore
  popularity
  genres
  isAdult
  coverImage { large extraLarge }
`;
