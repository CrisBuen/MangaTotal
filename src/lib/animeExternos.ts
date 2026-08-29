/**
 * Fuentes externas de anime guardables en la biblioteca animada.
 *
 * Se mantiene separado de externas.ts porque una lectura y un anime tienen
 * progreso distinto. Sumar TioAnime más adelante será agregar su nombre y
 * su ruta acá, sin tocar la biblioteca de manga ni las filas de AniList.
 */

export const FUENTES_ANIME_EXTERNAS = ["jkanime"] as const;

export type FuenteAnimeExterna = (typeof FUENTES_ANIME_EXTERNAS)[number];

export function esFuenteAnimeExterna(valor: unknown): valor is FuenteAnimeExterna {
  return FUENTES_ANIME_EXTERNAS.includes(valor as FuenteAnimeExterna);
}

export function fichaAnimeHref(source: FuenteAnimeExterna, externalId: string, slug: string | null) {
  if (source === "jkanime") return `/explorar/jkanime/${slug ?? externalId}`;
  return "/explorar?seccion=animada";
}

export interface AnimeExternoFila {
  source: string;
  externalId: string;
  slug: string | null;
  title: string;
  coverUrl: string | null;
  type: string | null;
  status: string | null;
  totalEpisodes: number | null;
  isAdult: boolean;
  saved: boolean;
  lastEpisodeId: string | null;
  lastEpisodeNumber: string | null;
  lastEpisodeTitle: string | null;
  lastWatchedAt: Date | null;
  updatedAt: Date;
  episodeProgress?: {
    positionSeconds: number;
    durationSeconds: number;
    completed: boolean;
  }[];
}

export function animeExternoPublico(e: AnimeExternoFila) {
  const source = e.source as FuenteAnimeExterna;
  const ultimo = e.episodeProgress?.[0] ?? null;
  return {
    source,
    external_id: e.externalId,
    slug: e.slug,
    title: e.title,
    cover_url: e.coverUrl,
    type: e.type,
    status: e.status,
    total_episodes: e.totalEpisodes,
    last_episode_id: e.lastEpisodeId,
    last_episode_number: e.lastEpisodeNumber,
    last_episode_title: e.lastEpisodeTitle,
    last_position_seconds: ultimo?.positionSeconds ?? 0,
    last_duration_seconds: ultimo?.durationSeconds ?? 0,
    completed: ultimo?.completed ?? false,
    last_watched_at: e.lastWatchedAt,
    updated_at: e.updatedAt,
    href: fichaAnimeHref(source, e.externalId, e.slug),
    resume_href:
      e.slug && e.lastEpisodeNumber
        ? `/explorar/${source}/${e.slug}/${e.lastEpisodeNumber}`
        : null,
  };
}
