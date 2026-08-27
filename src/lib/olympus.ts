/**
 * Cliente de la API de Olympus Scanlation, integrada con su permiso.
 *
 * ⚠️ SI CAMBIAN DE DOMINIO: los tres valores de abajo son lo único que hay
 * que tocar. Ver CAMBIO-DE-DOMINIO-OLYMPUS.txt en la raíz del proyecto.
 */
export const OLYMPUS_WEB = "https://olympusxyz.com";
export const OLYMPUS_PANEL = "https://panel.olympusxyz.com";
/** Nombre del grupo, visible en cada serie y capítulo. */
export const OLYMPUS_NOMBRE = "Olympus Scanlation";


// ── Catálogos de filtros que acepta su API ────────────────────────────────
// Su API no publica la lista de géneros: estos ids se recopilaron de las
// fichas del catálogo. Para regenerarla, ver CAMBIO-DE-DOMINIO-OLYMPUS.txt.
export const OLYMPUS_GENEROS = [
  { id: 1, name: "Acción" }, { id: 3, name: "Apocalíptico" }, { id: 4, name: "Artes marciales" },
  { id: 5, name: "Aventura" }, { id: 6, name: "Ciencia ficción" }, { id: 7, name: "Comedia" },
  { id: 8, name: "Crimen" }, { id: 9, name: "Cultivación" }, { id: 10, name: "Deportes" },
  { id: 12, name: "Ecchi" }, { id: 13, name: "Familia" }, { id: 14, name: "Fantasía" },
  { id: 15, name: "Guerra" }, { id: 16, name: "Harem" }, { id: 17, name: "Histórico" },
  { id: 18, name: "Juego" }, { id: 19, name: "Magia" }, { id: 20, name: "Misterio" },
  { id: 21, name: "Murim" }, { id: 23, name: "Realidad virtual" }, { id: 24, name: "Recuentos de la vida" },
  { id: 25, name: "Reencarnación" }, { id: 26, name: "Romance" }, { id: 27, name: "Seinen" },
  { id: 28, name: "Shonen" }, { id: 29, name: "Shoujo" }, { id: 30, name: "Sistema" },
  { id: 31, name: "Sobrenatural" }, { id: 33, name: "Superpoderes" }, { id: 34, name: "Supervivencia" },
  { id: 36, name: "Terror" }, { id: 37, name: "Tragedia" }, { id: 38, name: "Vida escolar" },
  { id: 40, name: "Retornado" }, { id: 41, name: "Médico" }, { id: 42, name: "Isekai" },
  { id: 43, name: "Drama" }, { id: 44, name: "Demonios" }, { id: 48, name: "Venganza" },
  { id: 49, name: "Mafia" }, { id: 59, name: "Monstruos" }, { id: 60, name: "Bestias" },
  { id: 61, name: "Evolución" }, { id: 68, name: "Antihéroe" }, { id: 71, name: "Transmigración" },
];

export const OLYMPUS_ESTADOS = [
  { id: 1, name: "Activo" },
  { id: 4, name: "Finalizado" },
  { id: 3, name: "En pausa" },
  { id: 5, name: "Cancelado" },
  { id: 7, name: "Abandonado por el scan" },
];

export const OLYMPUS_TIPOS = [
  { id: "comic", name: "Cómic" },
  { id: "novel", name: "Novela" },
];

/** Ordenamientos: su API no ordena, así que se hace acá con el índice. */
export const OLYMPUS_ORDENES = [
  { id: "novedades", name: "Nuevos lanzamientos" },
  { id: "populares", name: "Populares" },
  { id: "az", name: "A–Z" },
  { id: "vistas", name: "Más vistas" },
  { id: "capitulos", name: "Más capítulos" },
];

export interface FiltrosOlympus {
  genero?: number;
  estado?: number;
  tipo?: string;
  orden?: string;
  q?: string;
}

const UA = "MangaTotal/1.0 (+https://manga-total.vercel.app)";

/** Capítulos con acceso anticipado: Olympus los reserva a quienes los apoyan. */
const PREFIJO_PROTEGIDO = "/cp/";

async function olympusFetch<T>(url: string, revalidate: number): Promise<T> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    next: { revalidate },
  });
  if (!res.ok) throw new Error(`Olympus respondió ${res.status} en ${url}`);
  return (await res.json()) as T;
}

// ── formas que devuelve su API ────────────────────────────────────────────
interface OlySerieLista {
  id: number;
  name: string;
  slug: string;
  status: { id: number; name: string } | null;
  cover: string | null;
  chapter_count?: number;
  type: string;
  total_views?: number;
  monthly_views?: number;
}

interface OlySerieDetalle extends OlySerieLista {
  summary: string | null;
  genres: { id: number; name: string }[];
  team: { id: number; name: string; cover: string | null } | null;
  first_chapter: { id: number; name: string } | null;
  rating?: number;
}

interface OlyCapitulo {
  id: number;
  name: string;
  published_at: string;
  team: { name: string } | null;
}

/** Enlace a la ficha de la serie en el sitio de Olympus. */
export function urlSerieEnOlympus(tipo: string, slug: string): string {
  return `${OLYMPUS_WEB}/series/${tipo}-${slug}`;
}

/** Enlace al capítulo en el sitio de Olympus. */
export function urlCapituloEnOlympus(id: number, tipo: string, slug: string): string {
  return `${OLYMPUS_WEB}/capitulo/${id}/${tipo}-${slug}`;
}

export function serieResumen(s: OlySerieLista) {
  return {
    id: s.id,
    slug: s.slug,
    title: s.name,
    cover_url: s.cover,
    status: s.status?.name ?? null,
    chapter_count: typeof s.chapter_count === "number" ? s.chapter_count : null,
    type: s.type,
    total_views: s.total_views ?? 0,
    monthly_views: s.monthly_views ?? 0,
    url_original: urlSerieEnOlympus(s.type, s.slug),
  };
}

/**
 * Catálogo con filtros. Su API filtra por género, estado y tipo, pero no
 * ordena ni busca por texto: para eso se arma el índice completo (58
 * páginas, cacheado una hora) y se resuelve acá.
 */
export async function catalogo(page: number, filtros: FiltrosOlympus = {}) {
  // "Nuevos lanzamientos" y "Populares" los publica Olympus en su portada,
  // con el mismo criterio que usa su sitio.
  const sinFiltros = !filtros.q && !filtros.genero && !filtros.estado && !filtros.tipo;
  if (sinFiltros && filtros.orden === "novedades") {
    // todo el catálogo ordenado por lo último publicado, paginado como el suyo
    return await novedades(page);
  }
  if (sinFiltros && filtros.orden === "populares") {
    const home = await portada();
    return { series: home.populares, page: 1, last_page: 1, total: home.populares.length };
  }

  const necesitaIndice = Boolean(filtros.q) || (filtros.orden && filtros.orden !== "az");

  if (necesitaIndice) {
    const todas = await indiceCompleto(filtros);
    const ordenadas = ordenar(todas, filtros.orden);
    const porPagina = 24;
    const inicio = (page - 1) * porPagina;
    return {
      series: ordenadas.slice(inicio, inicio + porPagina),
      page,
      last_page: Math.max(1, Math.ceil(ordenadas.length / porPagina)),
      total: ordenadas.length,
    };
  }

  const data = await olympusFetch<{
    data: { series: { current_page: number; last_page: number; total: number; data: OlySerieLista[] } };
  }>(`${OLYMPUS_WEB}/api/series?${parametros(page, filtros)}`, 600);

  const s = data.data.series;
  return {
    series: s.data.map(serieResumen),
    page: s.current_page,
    last_page: s.last_page,
    total: s.total,
  };
}

/** Arma la query con los filtros que su API sí entiende. */
function parametros(page: number, f: FiltrosOlympus): string {
  const qs = new URLSearchParams({ page: String(page) });
  // sus filtros aceptan un solo valor por campo
  if (f.genero) qs.set("genres", String(f.genero));
  if (f.estado) qs.set("status", String(f.estado));
  if (f.tipo) qs.set("type", f.tipo);
  return qs.toString();
}

/** Todas las series que cumplen los filtros (para buscar y ordenar). */
async function indiceCompleto(filtros: FiltrosOlympus) {
  const primera = await olympusFetch<{
    data: { series: { last_page: number; data: OlySerieLista[] } };
  }>(`${OLYMPUS_WEB}/api/series?${parametros(1, filtros)}`, 3600);

  const todas = primera.data.series.data.map(serieResumen);
  const restantes = Array.from({ length: primera.data.series.last_page - 1 }, (_, i) => i + 2);

  const LOTE = 6;
  for (let i = 0; i < restantes.length; i += LOTE) {
    const grupo = await Promise.all(
      restantes.slice(i, i + LOTE).map((p) =>
        olympusFetch<{ data: { series: { data: OlySerieLista[] } } }>(
          `${OLYMPUS_WEB}/api/series?${parametros(p, filtros)}`,
          3600
        ).catch(() => null)
      )
    );
    for (const r of grupo) if (r) todas.push(...r.data.series.data.map(serieResumen));
  }

  if (!filtros.q) return todas;
  const buscado = normalizar(filtros.q);
  return todas.filter((s) => normalizar(s.title).includes(buscado));
}

type SerieResumen = ReturnType<typeof serieResumen>;

function ordenar(series: SerieResumen[], orden?: string): SerieResumen[] {
  const copia = [...series];
  if (orden === "vistas") return copia.sort((a, b) => b.total_views - a.total_views);
  if (orden === "populares") return copia.sort((a, b) => b.monthly_views - a.monthly_views);
  if (orden === "capitulos")
    return copia.sort((a, b) => (b.chapter_count ?? 0) - (a.chapter_count ?? 0));
  return copia.sort((a, b) => a.title.localeCompare(b.title, "es"));
}

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export async function serie(slug: string) {
  const data = await olympusFetch<{ data: OlySerieDetalle }>(
    `${OLYMPUS_WEB}/api/series/${encodeURIComponent(slug)}`,
    600
  );
  const d = data.data;
  return {
    ...serieResumen(d),
    summary: d.summary,
    genres: (d.genres ?? []).map((g) => g.name),
    team: d.team?.name ?? OLYMPUS_NOMBRE,
    rating: d.rating ?? null,
    first_chapter: d.first_chapter,
  };
}

interface PaginaCapitulos {
  data: OlyCapitulo[];
  meta: { current_page: number; last_page: number; total: number };
}

const paginaDeCapitulos = (slug: string, page: number) =>
  olympusFetch<PaginaCapitulos>(
    `${OLYMPUS_PANEL}/api/series/${encodeURIComponent(slug)}/chapters?page=${page}`,
    600
  );

const aCapitulo = (c: OlyCapitulo) => ({
  id: c.id,
  name: c.name,
  published_at: c.published_at,
  team: c.team?.name ?? OLYMPUS_NOMBRE,
});

/**
 * Todos los capítulos de una serie.
 *
 * Su API los manda de a 40, así que una serie larga son muchas páginas: se
 * piden de a seis en paralelo. Devuelve la lista entera, sin cortes.
 */
export async function capitulos(slug: string) {
  const primera = await paginaDeCapitulos(slug, 1);
  const total = primera.meta.last_page;

  const paginas: PaginaCapitulos[] = [primera];
  const LOTE = 6;
  for (let desde = 2; desde <= total; desde += LOTE) {
    const lote = [];
    for (let p = desde; p < desde + LOTE && p <= total; p++) {
      lote.push(paginaDeCapitulos(slug, p).catch(() => null));
    }
    for (const r of await Promise.all(lote)) if (r) paginas.push(r);
  }

  const chapters = paginas.flatMap((p) => p.data.map(aCapitulo));
  return { chapters, total: primera.meta.total };
}

/**
 * Páginas de un capítulo, desde su API.
 *
 * OJO: el HTML del lector devuelve marcadores de posición (/cp/cp-N.jpg)
 * en vez de las imágenes reales; hay que usar este endpoint.
 */
export async function paginas(chapterId: number, tipo: string, slug: string) {
  interface RespuestaCapitulo {
    chapter: { id: number; name: string; title: string | null; pages: string[] };
    prev_chapter: { id: number; name: string } | null;
    next_chapter: { id: number; name: string } | null;
  }

  // esta respuesta llega en la raíz, sin el envoltorio "data" del resto
  const data = await olympusFetch<RespuestaCapitulo & { data?: RespuestaCapitulo }>(
    `${OLYMPUS_WEB}/api/capitulo/${tipo}-${encodeURIComponent(slug)}/${chapterId}`,
    600
  );

  const d = data.data ?? data;
  if (!d?.chapter) throw new Error("Olympus no devolvió el capítulo");
  return {
    id: d.chapter.id,
    name: d.chapter.name,
    title: d.chapter.title,
    pages: (d.chapter.pages ?? []).filter((u) => u.startsWith("http")),
    prev: d.prev_chapter ? { id: d.prev_chapter.id, name: d.prev_chapter.name } : null,
    next: d.next_chapter ? { id: d.next_chapter.id, name: d.next_chapter.name } : null,
    url_original: urlCapituloEnOlympus(chapterId, tipo, slug),
  };
}

/**
 * Portada de la home de Olympus: sus series populares y los últimos
 * capítulos publicados, tal como los ordena su propio sitio.
 */
export async function portada() {
  const data = await olympusFetch<{
    data: {
      popular_comics: string | OlySerieLista[];
      novels: OlySerieLista[];
      new_chapters: (OlySerieLista & {
        last_chapters: { id: number; name: string; published_at: string }[];
      })[];
    };
  }>(`${OLYMPUS_WEB}/api/homepage`, 300);

  const d = data.data;
  // popular_comics a veces llega como JSON dentro de un string
  const populares: OlySerieLista[] =
    typeof d.popular_comics === "string" ? JSON.parse(d.popular_comics) : (d.popular_comics ?? []);

  return {
    populares: populares.map(serieResumen),
    novelas: (d.novels ?? []).map(serieResumen),
    novedades: (d.new_chapters ?? []).map((s) => ({
      ...serieResumen(s),
      ultimos: (s.last_chapters ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        published_at: c.published_at,
      })),
    })),
  };
}


/**
 * Últimos lanzamientos paginados (las 58 páginas de su sección "Capítulos").
 *
 * Su API tiene el endpoint /api/last-chapters pero exige autenticación, así
 * que se lee la página que ya viene renderizada desde su servidor. El
 * payload de Nuxt es un array plano: cada valor puede ser un índice que
 * apunta a otra posición del mismo array.
 */
export async function novedades(page: number) {
  const res = await fetch(`${OLYMPUS_WEB}/capitulos?page=${page}`, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; MangaTotal/1.0)" },
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`Olympus respondió ${res.status} en sus novedades`);

  const html = await res.text();
  // el payload va dentro de <script ...__NUXT_DATA__...>[ ... ]</script>
  const marca = html.indexOf("__NUXT_DATA__");
  const abre = marca >= 0 ? html.indexOf(">", marca) + 1 : -1;
  const cierra = abre > 0 ? html.indexOf("</script>", abre) : -1;
  if (abre <= 0 || cierra <= abre) {
    throw new Error("La sección de capítulos de Olympus cambió de formato");
  }

  const plano = JSON.parse(html.slice(abre, cierra)) as unknown[];
  const raiz = plano[3] as Record<string, number>;
  const nodo = plano[raiz[Object.keys(raiz)[0]]] as Record<string, number>;

  /**
   * En este formato TODOS los valores son índices dentro del mismo array:
   * se desreferencia una vez y, si lo que hay es un objeto o un array, sus
   * miembros vuelven a ser índices. (Desreferenciar de más rompía los ids,
   * porque un id numérico se volvía a buscar como si fuera un índice.)
   */
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

  const items =
    (resolver(nodo.data) as (OlySerieLista & {
      last_chapters?: ({ id: number; name: string; published_at: string } | null)[];
    })[]) ?? [];

  return {
    series: items.filter(Boolean).map((s) => ({
      ...serieResumen(s),
      // en esta vista el estado viene como texto, no como objeto
      status: typeof s.status === "string" ? s.status : (s.status?.name ?? null),
      ultimos: (s.last_chapters ?? [])
        .filter((c): c is { id: number; name: string; published_at: string } => Boolean(c))
        .map((c) => ({ id: c.id, name: c.name, published_at: c.published_at })),
    })),
    page: (resolver(nodo.current_page) as number) ?? page,
    last_page: (resolver(nodo.last_page) as number) ?? 1,
    total: (resolver(nodo.total) as number) ?? items.length,
  };
}

/** Catálogo completo en una sola consulta (id, nombre, slug, portada, tipo). */
export async function listaCompleta() {
  const data = await olympusFetch<{ data: OlySerieLista[] }>(
    `${OLYMPUS_WEB}/api/series/list`,
    3600
  );
  return data.data;
}
