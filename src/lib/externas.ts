/**
 * Series de fuentes externas: nombres de fuente y armado de enlaces.
 *
 * Vive acá y no en una ruta porque lo usan varias: la biblioteca y el
 * historial devuelven las mismas series, solo que separadas por si la
 * persona llegó a guardarlas.
 */

export const FUENTES_EXTERNAS = [
  "mangadex",
  "olympus",
  "tmo",
  "ikigai",
  "leercapitulo",
  "catharsis",
] as const;

export type FuenteExterna = (typeof FUENTES_EXTERNAS)[number];

export function esFuenteExterna(valor: unknown): valor is FuenteExterna {
  return FUENTES_EXTERNAS.includes(valor as FuenteExterna);
}

/** La ficha de la serie dentro de MangaTotal. */
export function fichaHref(source: string, externalId: string, slug: string | null): string {
  if (source === "olympus") return `/externo/olympus/${slug ?? externalId}`;
  if (source === "ikigai") return `/externo/ikigai/${externalId}`;
  if (source === "tmo") return `/externo/tmo/${externalId}`;
  if (source === "leercapitulo") return `/externo/leercapitulo/${externalId}`;
  if (source === "catharsis") return `/externo/catharsis/${externalId}`;
  return `/externo/${externalId}`;
}

/**
 * El lector, en el capítulo y la página donde quedó.
 *
 * Cada fuente identifica sus capítulos a su manera y el lector necesita
 * saber de qué serie viene, así que el enlace se arma acá una sola vez.
 */
export function capituloHref(
  source: string,
  externalId: string,
  slug: string | null,
  type: string | null,
  chapterId: string,
  page: number | null
): string {
  const pagina = page && page > 1 ? `page=${page}` : "";
  const con = (base: string, extra = "") => {
    const qs = [extra, pagina].filter(Boolean).join("&");
    return qs ? `${base}?${qs}` : base;
  };

  if (source === "olympus") {
    return con(
      `/leer-externo/olympus/${chapterId}`,
      `slug=${slug ?? externalId}&tipo=${type ?? "comic"}`
    );
  }
  if (source === "ikigai") {
    return con(`/leer-externo/ikigai/${chapterId}`, `slug=${externalId}`);
  }
  if (source === "tmo") {
    // el identificador guardado es "tipo/id/slug"
    const [tipo = "manga", id = "", s = ""] = externalId.split("/");
    return con(`/leer-externo/tmo/${chapterId}`, `tipo=${tipo}&id=${id}&slug=${s}`);
  }
  if (source === "leercapitulo") {
    // el identificador guardado es "id/slug"
    const [id = "", s = ""] = externalId.split("/");
    return con(`/leer-externo/leercapitulo/${chapterId}`, `serie=${id}&slug=${s}`);
  }
  if (source === "catharsis") {
    // Catharsis identifica serie y capítulo con el mismo tipo de código
    return con(`/leer-externo/catharsis/${chapterId}`, `serie=${externalId}`);
  }
  return con(`/leer-externo/${chapterId}`);
}

/** Fila de la base tal como la devuelven la biblioteca y el historial. */
export interface SerieExternaFila {
  source: string;
  externalId: string;
  slug: string | null;
  title: string;
  coverUrl: string | null;
  type: string | null;
  lastChapterId: string | null;
  lastChapterName: string | null;
  lastPageNumber: number | null;
  saved: boolean;
  updatedAt: Date;
}

/** La forma en que se le entrega una serie externa a la web. */
export function publico(e: SerieExternaFila) {
  const href = fichaHref(e.source, e.externalId, e.slug);
  return {
    source: e.source,
    external_id: e.externalId,
    slug: e.slug,
    title: e.title,
    cover_url: e.coverUrl,
    type: e.type,
    last_chapter_id: e.lastChapterId,
    last_chapter_name: e.lastChapterName,
    last_page_number: e.lastPageNumber,
    saved: e.saved,
    updated_at: e.updatedAt,
    // a dónde lleva la tarjeta dentro de MangaTotal
    href,
    // retomar la lectura exactamente donde quedó, si ya empezó
    href_continuar: e.lastChapterId
      ? capituloHref(e.source, e.externalId, e.slug, e.type, e.lastChapterId, e.lastPageNumber)
      : href,
  };
}
