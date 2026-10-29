import { fuenteNativaDisponible, traerJson, traerTexto, DesafioPendiente } from "./fuenteNativa";
import { OLYMPUS_WEB, type FiltrosOlympus } from "./olympus";

export interface SerieOlympus {
  id: number;
  slug: string;
  title: string;
  cover_url: string | null;
  status: string | null;
  chapter_count: number | null;
  type: string;
  url_original: string;
  ultimos?: { id: number; name: string; published_at: string }[];
}

export interface CapituloOlympus {
  id: number;
  name: string;
  published_at: string;
  team: string;
}

export interface CapituloDataOlympus {
  id: number;
  name: string;
  title: string | null;
  pages: string[];
  prev: { id: number; name: string } | null;
  next: { id: number; name: string } | null;
  url_original: string;
  slug?: string;
}

/** Desempaqueta el payload __NUXT_DATA__ de la sección /capitulos de Olympus. */
function parsearNovedadesNuxt(html: string, page: number): {
  series: SerieOlympus[];
  page: number;
  last_page: number;
  total: number;
} {
  const marca = html.indexOf("__NUXT_DATA__");
  const abre = marca >= 0 ? html.indexOf(">", marca) + 1 : -1;
  const cierra = abre > 0 ? html.indexOf("</script>", abre) : -1;
  if (abre <= 0 || cierra <= abre) {
    throw new Error("Formato Nuxt no encontrado");
  }

  const plano = JSON.parse(html.slice(abre, cierra)) as unknown[];
  const raiz = plano[3] as Record<string, number>;
  const nodo = plano[raiz[Object.keys(raiz)[0]]] as Record<string, number>;

  const resolver = (indice: unknown, nivel = 0): unknown => {
    if (typeof indice !== "number" || nivel > 8) return null;
    const v = plano[indice];
    if (Array.isArray(v)) return v.map((i) => resolver(i, nivel + 1));
    if (v && typeof v === "object") {
      const salida: Record<string, unknown> = {};
      for (const [k, i] of Object.entries(v)) salida[k] = resolver(i, nivel + 1);
      return salida;
    }
    return v ?? null;
  };

  const rawItems = resolver(nodo.data);
  const items: unknown[] = Array.isArray(rawItems) ? rawItems : [];

  return {
    series: items
      .filter((s): s is Record<string, unknown> => typeof s === "object" && s !== null)
      .map((s) => ({
        id: Number(s.id),
        slug: String(s.slug ?? ""),
        title: String(s.name ?? ""),
        cover_url: typeof s.cover === "string" ? s.cover : null,
        status:
          typeof s.status === "string"
            ? s.status
            : s.status && typeof s.status === "object"
              ? String((s.status as Record<string, unknown>).name ?? "")
              : null,
        chapter_count: typeof s.chapter_count === "number" ? s.chapter_count : null,
        type: String(s.type || "comic"),
        url_original: `${OLYMPUS_WEB}/series/${s.type || "comic"}-${s.slug}`,
        ultimos: Array.isArray(s.last_chapters)
          ? s.last_chapters
              .filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null)
              .map((c) => ({
                id: Number(c.id),
                name: String(c.name ?? ""),
                published_at: String(c.published_at ?? ""),
              }))
          : undefined,
      })),
    page: (resolver(nodo.current_page) as number) ?? page,
    last_page: (resolver(nodo.last_page) as number) ?? 1,
    total: (resolver(nodo.total) as number) ?? items.length,
  };
}

/** Consulta directa mediante el puente nativo de Android o Windows PC. */
async function catalogoNativoDirecto(
  page: number,
  filtros: FiltrosOlympus
): Promise<{
  series: SerieOlympus[];
  page: number;
  last_page: number;
  total: number;
}> {
  const sinFiltros = !filtros.q && !filtros.genero && !filtros.estado && !filtros.tipo;
  if (sinFiltros && (filtros.orden === "novedades" || !filtros.orden)) {
    try {
      const html = await traerTexto(`${OLYMPUS_WEB}/capitulos?page=${page}`);
      return parsearNovedadesNuxt(html, page);
    } catch {
      // Si falla la extracción de Nuxt, cae al catálogo estándar
    }
  }

  const qs = new URLSearchParams({ page: String(page) });
  if (filtros.genero) qs.set("genres", String(filtros.genero));
  if (filtros.estado) qs.set("status", String(filtros.estado));
  if (filtros.tipo) qs.set("type", filtros.tipo);

  const res = await traerJson<{
    data: {
      series: {
        current_page: number;
        last_page: number;
        total: number;
        data: Record<string, unknown>[];
      };
    };
  }>(`${OLYMPUS_WEB}/api/series?${qs.toString()}`);

  const s = res.data.series;
  let series: SerieOlympus[] = (s.data ?? []).map((item) => ({
    id: Number(item.id),
    slug: String(item.slug ?? ""),
    title: String(item.name ?? ""),
    cover_url: typeof item.cover === "string" ? item.cover : null,
    status:
      item.status && typeof item.status === "object"
        ? String((item.status as Record<string, unknown>).name ?? "")
        : null,
    chapter_count: typeof item.chapter_count === "number" ? item.chapter_count : null,
    type: String(item.type || "comic"),
    url_original: `${OLYMPUS_WEB}/series/${item.type || "comic"}-${item.slug}`,
  }));

  if (filtros.q?.trim()) {
    const qNorm = filtros.q.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    series = series.filter((item) =>
      item.title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(qNorm)
    );
  }

  return {
    series,
    page: s.current_page,
    last_page: s.last_page,
    total: s.total,
  };
}

/** Consulta de la ficha y lista completa de capítulos mediante el puente nativo. */
async function serieNativaDirecta(slug: string): Promise<{
  serie: SerieOlympus & {
    summary: string | null;
    genres: string[];
    team: string;
    rating?: number | null;
  };
  chapters: CapituloOlympus[];
}> {
  const sDetalle = await traerJson<{ data: Record<string, unknown> }>(
    `${OLYMPUS_WEB}/api/series/${encodeURIComponent(slug)}`
  );
  const d = sDetalle.data;
  const serie = {
    id: Number(d.id),
    slug: String(d.slug ?? slug),
    title: String(d.name ?? ""),
    cover_url: typeof d.cover === "string" ? d.cover : null,
    status:
      d.status && typeof d.status === "object"
        ? String((d.status as Record<string, unknown>).name ?? "")
        : null,
    chapter_count: typeof d.chapter_count === "number" ? d.chapter_count : null,
    type: String(d.type || "comic"),
    url_original: `${OLYMPUS_WEB}/series/${d.type || "comic"}-${d.slug}`,
    summary: typeof d.summary === "string" ? d.summary : null,
    genres: Array.isArray(d.genres)
      ? d.genres
          .filter((g): g is Record<string, unknown> => typeof g === "object" && g !== null)
          .map((g) => String(g.name ?? ""))
      : [],
    team:
      d.team && typeof d.team === "object"
        ? String((d.team as Record<string, unknown>).name ?? "Olympus Scanlation")
        : "Olympus Scanlation",
    rating: typeof d.rating === "number" ? d.rating : null,
  };

  const rCaps = await traerJson<{
    data: Record<string, unknown>[];
    meta?: { current_page: number; last_page: number; total: number };
  }>(`${OLYMPUS_WEB}/api/series/${encodeURIComponent(slug)}/chapters?page=1`);

  const chapters: CapituloOlympus[] = (rCaps.data ?? []).map((c) => ({
    id: Number(c.id),
    name: String(c.name ?? ""),
    published_at: String(c.published_at ?? ""),
    team:
      c.team && typeof c.team === "object"
        ? String((c.team as Record<string, unknown>).name ?? "Olympus Scanlation")
        : "Olympus Scanlation",
  }));

  const totalPaginas = rCaps.meta?.last_page ?? 1;
  if (totalPaginas > 1) {
    const paginasRestantes = Array.from({ length: totalPaginas - 1 }, (_, i) => i + 2);
    for (const p of paginasRestantes) {
      try {
        const masCaps = await traerJson<{ data: Record<string, unknown>[] }>(
          `${OLYMPUS_WEB}/api/series/${encodeURIComponent(slug)}/chapters?page=${p}`
        );
        for (const c of masCaps.data ?? []) {
          chapters.push({
            id: Number(c.id),
            name: String(c.name ?? ""),
            published_at: String(c.published_at ?? ""),
            team:
              c.team && typeof c.team === "object"
                ? String((c.team as Record<string, unknown>).name ?? "Olympus Scanlation")
                : "Olympus Scanlation",
          });
        }
      } catch {}
    }
  }

  return { serie, chapters };
}

/** Consulta de páginas de un capítulo mediante el puente nativo. */
async function capituloNativoDirecto(
  id: number,
  slug: string,
  tipo: string = "comic"
): Promise<CapituloDataOlympus> {
  const slugLimpio = slug.replace(/^(comic|novel)-/, "").trim();

  // 1. Probar por nombre de capítulo si tenemos slug
  if (slugLimpio) {
    try {
      const caps = await traerJson<{ data: Record<string, unknown>[] }>(
        `${OLYMPUS_WEB}/api/series/${encodeURIComponent(slugLimpio)}/chapters?page=1`
      );
      const cEncontrado = caps.data?.find((c) => Number(c.id) === id);
      if (cEncontrado?.name) {
        const nombreStr = String(cEncontrado.name).trim();
        const r = await traerJson<Record<string, unknown>>(
          `${OLYMPUS_WEB}/api/capitulo/${encodeURIComponent(slugLimpio)}/${encodeURIComponent(nombreStr)}?type=${tipo === "novel" ? "novel" : "comic"}`
        );
        const d = (r.data ?? r) as Record<string, unknown>;
        const ch = d.chapter as Record<string, unknown> | undefined;
        if (ch) {
          const rawPages = Array.isArray(ch.pages) ? ch.pages : [];
          const prev = d.prev_chapter as Record<string, unknown> | null;
          const next = d.next_chapter as Record<string, unknown> | null;
          const comic = d.comic as Record<string, unknown> | null;
          return {
            id: Number(ch.id),
            name: String(ch.name ?? ""),
            title: typeof ch.title === "string" ? ch.title : null,
            pages: rawPages.filter((u): u is string => typeof u === "string" && u.startsWith("http")),
            prev: prev ? { id: Number(prev.id), name: String(prev.name ?? "") } : null,
            next: next ? { id: Number(next.id), name: String(next.name ?? "") } : null,
            url_original: `${OLYMPUS_WEB}/series/${tipo === "novel" ? "novela" : tipo}-${slugLimpio}/capitulo/${encodeURIComponent(String(ch.name ?? "").trim())}`,
            slug: comic?.slug ? String(comic.slug) : slugLimpio,
          };
        }
      }
    } catch {}
  }

  // 2. Respaldo por ID
  const r = await traerJson<Record<string, unknown>>(
    `${OLYMPUS_WEB}/api/capitulo/${tipo}-${encodeURIComponent(slugLimpio || "serie")}/${id}`
  );
  const d = (r.data ?? r) as Record<string, unknown>;
  const ch = d.chapter as Record<string, unknown> | undefined;
  if (!ch) throw new Error("Olympus no devolvió el capítulo");

  const rawPages = Array.isArray(ch.pages) ? ch.pages : [];
  const prev = d.prev_chapter as Record<string, unknown> | null;
  const next = d.next_chapter as Record<string, unknown> | null;
  const comic = d.comic as Record<string, unknown> | null;
  return {
    id: Number(ch.id),
    name: String(ch.name ?? ""),
    title: typeof ch.title === "string" ? ch.title : null,
    pages: rawPages.filter((u): u is string => typeof u === "string" && u.startsWith("http")),
    prev: prev ? { id: Number(prev.id), name: String(prev.name ?? "") } : null,
    next: next ? { id: Number(next.id), name: String(next.name ?? "") } : null,
    url_original: `${OLYMPUS_WEB}/series/${tipo === "novel" ? "novela" : tipo}-${comic?.slug || slugLimpio}/capitulo/${encodeURIComponent(String(ch.name ?? "").trim())}`,
    slug: comic?.slug ? String(comic.slug) : slugLimpio,
  };
}

/**
 * Consulta del catálogo con fallback transparente:
 * 1. Intenta la API de MangaTotal en Vercel.
 * 2. Si falla y la app tiene puente nativo (Android o Windows PC), consulta directo a Olympus.
 */
export async function pedirCatalogoOlympus(
  page: number,
  filtros: FiltrosOlympus,
  fresco = false,
  signal?: AbortSignal
): Promise<{
  series: SerieOlympus[];
  page: number;
  last_page: number;
  total: number;
}> {
  const params = new URLSearchParams({ page: String(page) });
  if (filtros.orden) params.set("orden", filtros.orden);
  if (filtros.q?.trim()) params.set("q", filtros.q.trim());
  if (filtros.genero) params.set("genero", String(filtros.genero));
  if (filtros.estado) params.set("estado", String(filtros.estado));
  if (filtros.tipo) params.set("tipo", filtros.tipo);

  try {
    const res = await fetch(`/api/externo/olympus/series?${params.toString()}`, {
      cache: fresco ? "no-store" : "default",
      signal,
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.series)) return data;
    }
  } catch (err) {
    if (signal?.aborted) throw err;
  }

  if (fuenteNativaDisponible()) {
    try {
      return await catalogoNativoDirecto(page, filtros);
    } catch (err) {
      if (err instanceof DesafioPendiente) throw err;
      throw err;
    }
  }

  throw new Error("No se pudo conectar con el catálogo de Olympus");
}

/**
 * Consulta de la ficha de una serie con fallback transparente:
 * 1. Intenta la API de MangaTotal en Vercel.
 * 2. Si falla y la app tiene puente nativo, consulta directo a Olympus.
 */
export async function pedirSerieOlympus(
  slug: string,
  fresco = false,
  signal?: AbortSignal
): Promise<{
  serie: SerieOlympus & {
    summary: string | null;
    genres: string[];
    team: string;
    rating?: number | null;
  };
  chapters: CapituloOlympus[];
}> {
  try {
    const res = await fetch(
      `/api/externo/olympus/series/${encodeURIComponent(slug)}${fresco ? "?fresco=1" : ""}`,
      {
        cache: fresco ? "no-store" : "default",
        signal,
      }
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.serie) return data;
    }
  } catch (err) {
    if (signal?.aborted) throw err;
  }

  if (fuenteNativaDisponible()) {
    try {
      return await serieNativaDirecta(slug);
    } catch (err) {
      if (err instanceof DesafioPendiente) throw err;
      throw err;
    }
  }

  throw new Error("No se pudo cargar la serie de Olympus");
}

/**
 * Consulta de páginas de un capítulo con fallback transparente:
 * 1. Intenta la API de MangaTotal en Vercel.
 * 2. Si falla y la app tiene puente nativo, consulta directo a Olympus.
 */
export async function pedirCapituloOlympus(
  id: number,
  slug: string,
  tipo: string = "comic",
  signal?: AbortSignal
): Promise<CapituloDataOlympus> {
  const qs = new URLSearchParams({
    tipo,
    ...(slug ? { slug } : {}),
  });

  try {
    const res = await fetch(`/api/externo/olympus/capitulo/${id}?${qs.toString()}`, { signal });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.pages) && data.pages.length > 0) return data;
    }
  } catch (err) {
    if (signal?.aborted) throw err;
  }

  if (fuenteNativaDisponible()) {
    try {
      return await capituloNativoDirecto(id, slug, tipo);
    } catch (err) {
      if (err instanceof DesafioPendiente) throw err;
      throw err;
    }
  }

  throw new Error("No se pudo cargar el capítulo de Olympus");
}
