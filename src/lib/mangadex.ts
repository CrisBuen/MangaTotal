/**
 * Cliente servidor de la API pública de MangaDex (https://api.mangadex.org).
 * Reglas de uso: User-Agent propio, atribución de datos y de grupos de
 * scanlation, imágenes vía sus CDNs oficiales. Sin API key: solo lectura.
 */

const MD_API = "https://api.mangadex.org";
const USER_AGENT = "MangaTotal/1.0 (www.mangatotal.com)";

/** Idiomas que la UI ofrece; "es" incluye español de España y LATAM. */
export const LANG_GROUPS: Record<string, string[]> = {
  es: ["es", "es-la"],
  en: ["en"],
};

export type ContentRating = "safe" | "suggestive" | "erotica" | "pornographic";

export function allowedRatings(seeAdult: boolean): ContentRating[] {
  return seeAdult
    ? ["safe", "suggestive", "erotica", "pornographic"]
    : ["safe", "suggestive"];
}

export async function mdFetch<T>(path: string, revalidateSeconds = 60): Promise<T> {
  const res = await fetch(`${MD_API}${path}`, {
    headers: { "User-Agent": USER_AGENT },
    next: { revalidate: revalidateSeconds },
  });
  if (!res.ok) {
    throw new Error(`MangaDex respondió ${res.status} para ${path}`);
  }
  return (await res.json()) as T;
}

/** Elige el mejor texto de un mapa {idioma: texto} de MangaDex. */
export function pickText(
  map: Record<string, string> | undefined | null,
  prefs: string[] = ["es", "es-la", "en", "ja-ro", "ja"]
): string | null {
  if (!map) return null;
  for (const lang of prefs) {
    if (map[lang]) return map[lang];
  }
  const first = Object.values(map)[0];
  return first ?? null;
}

interface MdRelationship {
  id: string;
  type: string;
  attributes?: Record<string, unknown>;
}

export interface MdManga {
  id: string;
  attributes: {
    title: Record<string, string>;
    altTitles: Record<string, string>[];
    description: Record<string, string>;
    status: string | null;
    year: number | null;
    contentRating: ContentRating;
    tags: { attributes: { name: Record<string, string> } }[];
  };
  relationships: MdRelationship[];
}

export interface MdChapter {
  id: string;
  attributes: {
    chapter: string | null;
    title: string | null;
    pages: number;
    translatedLanguage: string;
    publishAt: string;
    externalUrl: string | null;
  };
  relationships: MdRelationship[];
}

export function coverUrl(manga: MdManga, size: 256 | 512 = 512): string | null {
  const cover = manga.relationships.find((r) => r.type === "cover_art");
  const fileName = cover?.attributes?.fileName;
  if (typeof fileName !== "string") return null;
  return `https://uploads.mangadex.org/covers/${manga.id}/${fileName}.${size}.jpg`;
}

const STATUS_ES: Record<string, string> = {
  ongoing: "En curso",
  completed: "Completada",
  hiatus: "En pausa",
  cancelled: "Cancelada",
};

/** Forma pública que consume el frontend. */
export function publicManga(m: MdManga) {
  return {
    id: m.id,
    title: pickText(m.attributes.title) ?? "Sin título",
    description: pickText(m.attributes.description),
    status: STATUS_ES[m.attributes.status ?? ""] ?? m.attributes.status,
    year: m.attributes.year,
    content_rating: m.attributes.contentRating,
    is_adult:
      m.attributes.contentRating === "erotica" || m.attributes.contentRating === "pornographic",
    tags: m.attributes.tags
      .map((t) => pickText(t.attributes.name))
      .filter((n): n is string => Boolean(n)),
    cover_url: coverUrl(m),
  };
}

export type PublicChapter = ReturnType<typeof publicChapter>;

/** Un número de capítulo con todas las versiones que lo tradujeron. */
export interface ChapterEntry {
  number: string | null;
  /** Versión elegida por defecto (grupo más constante en la serie). */
  chosen: PublicChapter;
  versions: PublicChapter[];
}

/**
 * MangaDex publica el mismo capítulo traducido por varios grupos. Para que
 * la lista sea legible y "siguiente capítulo" nunca caiga en una versión
 * rota, se agrupa por número y se elige una versión por defecto:
 * la del grupo que más capítulos tradujo de esa serie (el más constante),
 * descartando siempre las versiones sin páginas o alojadas fuera.
 */
export function groupChaptersByNumber(chapters: PublicChapter[]): ChapterEntry[] {
  const readable = chapters.filter((c) => !c.external_url && c.pages > 0);

  const groupWeight = new Map<string, number>();
  for (const c of readable) {
    const key = c.group ?? "?";
    groupWeight.set(key, (groupWeight.get(key) ?? 0) + 1);
  }

  const byNumber = new Map<string, PublicChapter[]>();
  for (const c of readable) {
    const key = c.number ?? "?";
    const list = byNumber.get(key);
    if (list) list.push(c);
    else byNumber.set(key, [c]);
  }

  const entries: ChapterEntry[] = [];
  for (const [number, versions] of byNumber) {
    versions.sort((a, b) => {
      const w = (groupWeight.get(b.group ?? "?") ?? 0) - (groupWeight.get(a.group ?? "?") ?? 0);
      if (w !== 0) return w;
      // a igual constancia, la versión más completa
      if (b.pages !== a.pages) return b.pages - a.pages;
      return b.published_at.localeCompare(a.published_at);
    });
    entries.push({ number: number === "?" ? null : number, chosen: versions[0], versions });
  }

  entries.sort((a, b) => {
    const na = parseFloat(a.number ?? "");
    const nb = parseFloat(b.number ?? "");
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    if (Number.isFinite(na)) return -1;
    if (Number.isFinite(nb)) return 1;
    return 0;
  });

  return entries;
}

export function publicChapter(c: MdChapter) {
  const group = c.relationships.find((r) => r.type === "scanlation_group");
  return {
    id: c.id,
    number: c.attributes.chapter,
    title: c.attributes.title,
    pages: c.attributes.pages,
    lang: c.attributes.translatedLanguage,
    published_at: c.attributes.publishAt,
    // capítulos alojados fuera de MangaDex (no se pueden leer acá)
    external_url: c.attributes.externalUrl,
    group: typeof group?.attributes?.name === "string" ? group.attributes.name : null,
  };
}
