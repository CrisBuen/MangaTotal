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
  if (source === "jkanime") return `/anime/jkanime/${slug ?? externalId}`;
  return "/anime";
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
  updatedAt: Date;
}

export function animeExternoPublico(e: AnimeExternoFila) {
  const source = e.source as FuenteAnimeExterna;
  return {
    source,
    external_id: e.externalId,
    slug: e.slug,
    title: e.title,
    cover_url: e.coverUrl,
    type: e.type,
    status: e.status,
    total_episodes: e.totalEpisodes,
    updated_at: e.updatedAt,
    href: fichaAnimeHref(source, e.externalId, e.slug),
  };
}
