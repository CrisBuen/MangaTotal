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
  { id: "az", name: "A–Z" },
  { id: "populares", name: "Populares" },
  { id: "tendencia", name: "En tendencia" },
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
  chapter_count: number;
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
    chapter_count: s.chapter_count,
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
  if (orden === "populares") return copia.sort((a, b) => b.total_views - a.total_views);
  if (orden === "tendencia") return copia.sort((a, b) => b.monthly_views - a.monthly_views);
  if (orden === "capitulos") return copia.sort((a, b) => b.chapter_count - a.chapter_count);
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

/** Lista de capítulos (40 por página en su API). */
export async function capitulos(slug: string, page: number) {
  const data = await olympusFetch<{
    data: OlyCapitulo[];
    meta: { current_page: number; last_page: number; total: number };
  }>(`${OLYMPUS_PANEL}/api/series/${encodeURIComponent(slug)}/chapters?page=${page}`, 600);

  return {
    chapters: data.data.map((c) => ({
      id: c.id,
      name: c.name,
      published_at: c.published_at,
      team: c.team?.name ?? OLYMPUS_NOMBRE,
    })),
    page: data.meta.current_page,
    last_page: data.meta.last_page,
    total: data.meta.total,
  };
}

/**
 * Páginas de un capítulo. Vienen en el HTML del lector de Olympus, dentro
 * del payload de Nuxt: un array plano donde cada valor puede ser un índice
 * que apunta a otra posición del mismo array.
 */
export async function paginas(chapterId: number, tipo: string, slug: string) {
  const url = urlCapituloEnOlympus(chapterId, tipo, slug);
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    next: { revalidate: 600 },
  });
  if (!res.ok) throw new Error(`Olympus respondió ${res.status} al abrir el capítulo`);

  const html = await res.text();
  const bloque = html.match(/__NUXT_DATA__[^>]*>(\[[\s\S]*?\])<\/script>/);
  if (!bloque) throw new Error("El lector de Olympus cambió de formato");

  const plano = JSON.parse(bloque[1]) as unknown[];
  const raiz = plano[3] as Record<string, number>;
  const clave = Object.keys(raiz)[0];
  const nodo = plano[raiz[clave]] as { chapter?: number; prev_chapter?: number; next_chapter?: number };
  if (nodo?.chapter === undefined) throw new Error("Capítulo no encontrado en Olympus");

  const cap = plano[nodo.chapter] as Record<string, number>;
  const lista = plano[cap.pages];
  const urls = Array.isArray(lista)
    ? lista.map((i) => (typeof i === "number" ? (plano[i] as string) : (i as string)))
    : [];

  // acceso anticipado: no se muestran, se enlaza a Olympus
  const protegido = urls.length > 0 && urls.every((u) => u.startsWith(PREFIJO_PROTEGIDO));

  const vecino = (indice?: number) => {
    if (indice === undefined) return null;
    const v = plano[indice] as Record<string, number> | null;
    if (!v || typeof v !== "object") return null;
    return { id: plano[v.id] as number, name: String(plano[v.name] ?? "") };
  };

  return {
    id: chapterId,
    name: String(plano[cap.name] ?? ""),
    pages: protegido ? [] : urls.filter((u) => u.startsWith("http")),
    protegido,
    prev: vecino(nodo.prev_chapter),
    next: vecino(nodo.next_chapter),
    url_original: url,
  };
}
