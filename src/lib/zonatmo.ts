/**
 * ZonaTMO — integrada con su permiso.
 *
 * En 2026 rehicieron el sitio: cambió el dominio a zonatmo.net y el HTML dio
 * paso a una API JSON (`/wp-api/api`). Todo lo de acá habla con esa API.
 *
 * Cómo se pide:
 *   1. Primero por nuestro servidor (`/api/externo/tmo`). Si su Cloudflare
 *      acepta a Vercel, la fuente funciona también en el navegador.
 *   2. Si el servidor no puede, se reintenta desde el dispositivo por el
 *      puente nativo (Android/Windows), igual que hace Mihon.
 *
 * Las imágenes (portadas y páginas) las carga el navegador directo desde su
 * CDN, así que no dependen de ninguno de los dos puentes.
 *
 * ⚠️ SI CAMBIAN DE DOMINIO: ver CAMBIO-DE-DOMINIO-ZONATMO.txt en la raíz.
 */
export const TMO_WEB = "https://zonatmo.net";
export const TMO_API = `${TMO_WEB}/wp-api/api`;
export const TMO_CDN = "https://cdn.zonatmo.to";
export const TMO_SUBIDAS = `${TMO_WEB}/wp-content/uploads`;
export const TMO_NOMBRE = "ZonaTMO";

import { traerJson, fuenteAndroidDisponible, fuenteNativaDisponible } from "./fuenteNativa";
import { isPlayStoreApp } from "./appVersion";

/** Ahora funciona en cualquier plataforma: el servidor lo intenta primero. */
export function tmoDisponible(): boolean {
  return true;
}

/** True si además hay puente nativo (la app puede reintentar por su cuenta). */
export function tmoPuenteNativo(): boolean {
  return fuenteNativaDisponible();
}

interface Respuesta<T> {
  error?: boolean;
  message?: string;
  data: T;
}

/** Pide una ruta: Android directo; web/Windows conservan servidor primero. */
async function pedir<T>(ruta: string, fresco = false): Promise<T> {
  let errorAndroid: unknown = null;

  // En Android la conexión del teléfono es el camino corto (igual que
  // Mihon). Antes se esperaba primero a Vercel y, con 4G débil, el usuario
  // podía pasar muchos segundos mirando una grilla vacía.
  if (fuenteAndroidDisponible()) {
    try {
      const cuerpo = await traerJson<Respuesta<T>>(`${TMO_API}${ruta}`);
      return cuerpo.data;
    } catch (err) {
      errorAndroid = err;
      // El servidor queda como respaldo si justo falla la ruta directa.
    }
  }

  try {
    const qs = `ruta=${encodeURIComponent(ruta)}${fresco ? "&fresco=1" : ""}`;
    const res = await fetch(`/api/externo/tmo?${qs}`, {
      cache: fresco ? "no-store" : "default",
    });
    if (res.ok) {
      const cuerpo = (await res.json()) as Respuesta<T>;
      if (cuerpo.data !== undefined) return cuerpo.data;
    }
  } catch {
    // sin conexión con nuestro propio servidor: se prueba el puente nativo
  }

  if (!fuenteNativaDisponible()) {
    throw new Error(
      "ZonaTMO no está respondiendo en este momento. Probá de nuevo en un rato, o desde la app de Android o Windows."
    );
  }

  if (errorAndroid) throw errorAndroid;

  const cuerpo = await traerJson<Respuesta<T>>(`${TMO_API}${ruta}`);
  return cuerpo.data;
}

// ── taxonomías (ids reales de su sitio) ─────────────────────────────────

export const TMO_TIPOS = [
  { id: "14", name: "Manga" },
  { id: "87", name: "Manhwa" },
  { id: "31", name: "Manhua" },
  { id: "12312", name: "One shot" },
  { id: "207", name: "Doujinshi" },
  { id: "214", name: "Novela" },
  { id: "976", name: "OEL" },
];

export const TMO_DEMOGRAFIAS = [
  { id: "13", name: "Shounen" },
  { id: "20", name: "Shoujo" },
  { id: "45", name: "Seinen" },
  { id: "55", name: "Josei" },
  { id: "633", name: "Kodomo" },
];

export const TMO_ESTADOS = [
  { id: "12", name: "Publicándose" },
  { id: "12856", name: "En curso" },
  { id: "19", name: "Finalizado" },
  { id: "12874", name: "Completado" },
  { id: "174", name: "Pausado" },
  { id: "198", name: "Cancelado" },
];

export const TMO_GENEROS = [
  { id: "2", name: "Acción" },
  { id: "3", name: "Aventura" },
  { id: "4", name: "Comedia" },
  { id: "5", name: "Fantasía" },
  { id: "6", name: "Magia" },
  { id: "7", name: "Sobrenatural" },
  { id: "8", name: "Harem" },
  { id: "15", name: "Drama" },
  { id: "16", name: "Romance" },
  { id: "21", name: "Ciencia ficción" },
  { id: "22", name: "Girls love" },
  { id: "23", name: "Vida escolar" },
  { id: "26", name: "Artes marciales" },
  { id: "32", name: "Ecchi" },
  { id: "33", name: "Recuentos de la vida" },
  { id: "36", name: "Psicológico" },
  { id: "37", name: "Deporte" },
  { id: "40", name: "Misterio" },
  { id: "46", name: "Tragedia" },
  { id: "49", name: "Thriller" },
  { id: "60", name: "Reencarnación" },
  { id: "82", name: "Horror" },
  { id: "103", name: "Boys love" },
  { id: "112", name: "Supervivencia" },
  { id: "116", name: "Superpoderes" },
  { id: "144", name: "Mecha" },
  { id: "181", name: "Gore" },
  { id: "12868", name: "Sistema de niveles" },
  { id: "12891", name: "Venganza" },
  { id: "12915", name: "Academia" },
];

/** Órdenes que su API respeta de verdad (probados uno por uno). */
export const TMO_ORDENES = [
  { id: "", name: "Recién agregados" },
  { id: "score", name: "Mejor valorados" },
  { id: "vote_count", name: "Más votados" },
  { id: "total_chapters", name: "Más capítulos" },
  { id: "year_start", name: "Más nuevos" },
  { id: "title", name: "Título" },
];

const MAPA_TIPOS = new Map<string, string>([
  ...TMO_TIPOS.map((t) => [t.id, t.name] as [string, string]),
  // duplicados que arrastran de su base vieja: no se ofrecen como filtro,
  // pero aparecen en las fichas y hay que saber nombrarlos
  ["12919", "One shot"],
  ["12920", "Novela"],
]);
const MAPA_GENEROS = new Map(TMO_GENEROS.map((g) => [g.id, g.name]));

// ── modelos ──────────────────────────────────────────────────────────────

export interface FiltrosTmo {
  q?: string;
  tipo?: string;
  demografia?: string;
  estado?: string;
  genero?: string;
  orden?: string;
}

export interface SerieTmo {
  id: string;
  tipo: string;
  slug: string;
  title: string;
  cover_url: string | null;
  url_original: string;
}

interface ItemApi {
  _id: number;
  title: string;
  slug: string;
  cover: string | null;
  overview: string | null;
  types: number[] | null;
  genres: number[] | null;
  status: number[] | null;
  demography: number[] | null;
  years: number[] | null;
  /** Llega como texto ("8.50"), no como número. */
  score: string | number | null;
  is_erotic: number | null;
  total_chapters: number | null;
}

/** El puntaje viene como texto y a veces en cero: se devuelve ya legible. */
function puntaje(valor: string | number | null | undefined): string | null {
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n.toFixed(1);
}

function urlPortada(cover: string | null): string | null {
  if (!cover) return null;
  if (cover.startsWith("http")) return cover;
  return `${TMO_SUBIDAS}/${cover.replace(/^\/+/, "")}`;
}

function nombreTipo(types: number[] | null | undefined): string {
  const primero = types?.[0];
  return (primero ? MAPA_TIPOS.get(String(primero)) : null) ?? "Manga";
}

/** El tipo viaja en la URL de la ficha: sin espacios ni mayúsculas. */
function tipoEnUrl(types: number[] | null | undefined): string {
  return nombreTipo(types).toLowerCase().replace(/\s+/g, "-");
}

/**
 * Sus títulos llegan con entidades HTML sin resolver, así que en pantalla
 * aparecía "Nyanta &amp; Pomeco" en vez del signo. Se resuelve acá y no con
 * el navegador porque esto también corre en el servidor, donde no hay DOM.
 */
export function textoTmo(valor: string | null | undefined): string {
  if (!valor) return "";
  return valor
    .replace(/&(#\d+|#[xX][0-9a-fA-F]+|[a-zA-Z]+);/g, (entera, cuerpo: string) => {
      if (cuerpo.startsWith("#")) {
        const n = cuerpo[1] === "x" || cuerpo[1] === "X"
          ? parseInt(cuerpo.slice(2), 16)
          : parseInt(cuerpo.slice(1), 10);
        return Number.isFinite(n) ? String.fromCodePoint(n) : entera;
      }
      const conocidas: Record<string, string> = {
        amp: "&",
        lt: "<",
        gt: ">",
        quot: '"',
        apos: "'",
        nbsp: " ",
        hellip: "…",
        ndash: "–",
        mdash: "—",
      };
      return conocidas[cuerpo] ?? entera;
    })
    .trim();
}

function aSerie(item: ItemApi): SerieTmo {
  return {
    id: String(item._id),
    tipo: tipoEnUrl(item.types),
    slug: item.slug,
    title: textoTmo(item.title) || "Sin título",
    cover_url: urlPortada(item.cover),
    url_original: `${TMO_WEB}/manga/${item.slug}/`,
  };
}

/** Google Play no puede mostrar ni entregar obras marcadas como eróticas. */
function permitidaEnEstaEdicion(item: Pick<ItemApi, "is_erotic">): boolean {
  return !isPlayStoreApp() || item.is_erotic !== 1;
}

// ── catálogo ─────────────────────────────────────────────────────────────

const POR_PAGINA = 24;

/** Catálogo paginado, con los filtros de su biblioteca. */
export async function catalogoTmo(page: number, filtros: FiltrosTmo = {}, fresco = false) {
  const qs = new URLSearchParams({
    page: String(page),
    postsPerPage: String(POR_PAGINA),
    order: filtros.orden === "title" ? "asc" : "desc",
  });
  if (filtros.orden) qs.set("orderBy", filtros.orden);
  if (filtros.q) qs.set("search", filtros.q);
  if (filtros.tipo) qs.set("type", filtros.tipo);
  if (filtros.demografia) qs.set("demography", filtros.demografia);
  if (filtros.estado) qs.set("status", filtros.estado);
  if (filtros.genero) {
    qs.set("genres", filtros.genero);
    qs.set("genres_mode", "any");
  }

  const data = await pedir<{
    items: ItemApi[];
    pagination: { total: number; total_pages: number; current_page: number };
  }>(`/listing/manga?${qs.toString()}`, fresco);

  const series = (data.items ?? []).filter(permitidaEnEstaEdicion).map(aSerie);
  const totalPaginas = data.pagination?.total_pages ?? page;
  return {
    series,
    page,
    total: data.pagination?.total ?? series.length,
    totalPaginas,
    hayMas: page < totalPaginas,
  };
}

/** Lo más leído de la semana o del mes, tal como lo publican ellos. */
export async function popularesTmo(rango: "week" | "month" = "week") {
  const data = await pedir<ItemApi[]>(`/tops/views/${rango}`);
  return (Array.isArray(data) ? data : []).filter(permitidaEnEstaEdicion).map(aSerie);
}

// ── ficha de la serie ────────────────────────────────────────────────────

export interface CapituloTmo {
  /** Su slug: es lo que identifica al capítulo en la API nueva. */
  id: string;
  numero: string | null;
  titulo: string | null;
  grupo: string | null;
  fecha: string | null;
}

interface CapituloApi {
  id: number;
  chapter_number: string | null;
  title: string | null;
  slug: string;
  release_date: string | null;
  group?: { name?: string } | null;
}

function numeroLegible(n: string | null | undefined): string | null {
  if (!n) return null;
  const v = Number(n);
  return Number.isFinite(v) ? String(v) : n;
}

/**
 * Ficha de una serie con todos sus capítulos.
 *
 * `tipo` e `id` se conservan solo para que sigan andando los enlaces viejos
 * guardados en la biblioteca: la API nueva busca por slug.
 */
export async function serieTmo(tipo: string, id: string, slug: string) {
  const [ficha, capitulos] = await Promise.all([
    pedir<ItemApi>(`/single/manga/${slug}`),
    todosLosCapitulos(slug),
  ]);

  if (!permitidaEnEstaEdicion(ficha)) {
    throw new Error("Este contenido no está disponible en la edición de Google Play");
  }

  const generos = (ficha.genres ?? [])
    .map((g) => MAPA_GENEROS.get(String(g)))
    .filter((g): g is string => Boolean(g));

  return {
    id: String(ficha._id ?? id),
    tipo: tipoEnUrl(ficha.types) || tipo,
    slug: ficha.slug ?? slug,
    title: ficha.title || "Sin título",
    cover_url: urlPortada(ficha.cover),
    description: ficha.overview?.trim() || null,
    generos,
    score: puntaje(ficha.score),
    esAdulto: ficha.is_erotic === 1,
    capitulos,
    url_original: `${TMO_WEB}/manga/${ficha.slug ?? slug}/`,
  };
}

interface PaginaCapitulos {
  items: CapituloApi[];
  pagination?: { total_pages?: number };
}

const paginaCapitulos = (slug: string, page: number) =>
  pedir<PaginaCapitulos>(`/single/manga/${slug}/chapters?page=${page}`);

/**
 * Su lista de capítulos viene de a 25 y no se puede pedir más por vuelta, así
 * que una serie larga son muchas páginas: se piden de a seis en paralelo.
 */
async function todosLosCapitulos(slug: string): Promise<CapituloTmo[]> {
  const primera = await paginaCapitulos(slug, 1);
  // se recorren todas las que diga su paginador: una serie larga tiene que
  // llegar hasta el final. El tope es solo una red por si informa cualquier cosa
  const totalPaginas = Math.min(primera.pagination?.total_pages ?? 1, 400);

  const paginas: PaginaCapitulos[] = [primera];
  for (let desde = 2; desde <= totalPaginas; desde += 6) {
    const lote = [];
    for (let p = desde; p < desde + 6 && p <= totalPaginas; p++) {
      lote.push(paginaCapitulos(slug, p).catch(() => ({ items: [] as CapituloApi[] })));
    }
    paginas.push(...(await Promise.all(lote)));
  }

  const capitulos: CapituloTmo[] = [];
  const vistos = new Set<string>();
  for (const pagina of paginas) {
    for (const c of pagina.items ?? []) {
      if (!c.slug || vistos.has(c.slug)) continue;
      vistos.add(c.slug);
      capitulos.push({
        id: c.slug,
        numero: numeroLegible(c.chapter_number),
        titulo: c.title?.trim() || null,
        grupo: c.group?.name?.trim() || null,
        fecha: c.release_date,
      });
    }
  }

  // los devuelven del más nuevo al más viejo: se ordena para leer en orden
  capitulos.sort((a, b) => Number(a.numero ?? 0) - Number(b.numero ?? 0));
  return capitulos;
}

// ── capítulo ─────────────────────────────────────────────────────────────

interface CapituloDetalleApi {
  manga: ItemApi;
  chapter: {
    id: number;
    jit: string;
    chapter_number: string | null;
    title: string | null;
    reading_direction: string | null;
    images: { image_url: string; page_number: number }[];
    prev: { slug: string; chapter_number: string | null } | null;
    next: { slug: string; chapter_number: string | null } | null;
  };
}

/**
 * Páginas de un capítulo. Las imágenes viven en su CDN bajo un token (`jit`)
 * que viene con cada pedido, así que la URL se arma en el momento.
 */
export async function capituloTmo(slugSerie: string, slugCapitulo: string) {
  const data = await pedir<CapituloDetalleApi>(`/single/manga/${slugSerie}/${slugCapitulo}`);
  if (!permitidaEnEstaEdicion(data.manga)) {
    throw new Error("Este contenido no está disponible en la edición de Google Play");
  }
  const c = data.chapter;

  const paginas = (c.images ?? [])
    .slice()
    .sort((a, b) => a.page_number - b.page_number)
    .map((img) => `${TMO_CDN}/manga/${c.jit}/${img.image_url}`);

  return {
    id: slugCapitulo,
    numero: numeroLegible(c.chapter_number),
    titulo: c.title?.trim() || null,
    derechaAIzquierda: c.reading_direction === "rtl",
    paginas,
    serie: { title: data.manga?.title ?? "", slug: data.manga?.slug ?? slugSerie },
    anterior: c.prev ? { id: c.prev.slug, numero: numeroLegible(c.prev.chapter_number) } : null,
    siguiente: c.next ? { id: c.next.slug, numero: numeroLegible(c.next.chapter_number) } : null,
    url_original: `${TMO_WEB}/manga/${slugSerie}/${slugCapitulo}/`,
  };
}
