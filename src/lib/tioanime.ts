/**
 * Adaptador de TioAnime, integrado con permiso de sus responsables.
 *
 * Solo se leen el directorio, las fichas, los episodios y las tres fuentes
 * acordadas. Las direcciones de reproduccion se obtienen otra vez al abrir un
 * episodio y nunca se guardan en la base de datos.
 */

export const TIOANIME_NOMBRE = "TioAnime";
export const TIOANIME_WEB = "https://tioanime.com";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 MangaTotal/1.0";
const EPISODIOS_POR_PAGINA = 24;

export interface SerieTioanime {
  slug: string;
  title: string;
  cover_url: string | null;
  type: string | null;
  status: string | null;
  url_original: string;
}

export interface EpisodioTioanime {
  id: string;
  number: string;
  title: string;
  image_url: string | null;
  published_at: string | null;
}

export interface FichaTioanime {
  id: string;
  slug: string;
  title: string;
  alternative_title: string | null;
  description: string | null;
  cover_url: string | null;
  type: string | null;
  status: string | null;
  genres: string[];
  season: string | null;
  year: string | null;
  total_episodes: number;
  episodes: EpisodioTioanime[];
  page: number;
  last_page: number;
  url_original: string;
}

export interface FuenteEpisodioTioanime {
  id: "yourupload" | "mega" | "voe";
  label: "YourUpload" | "Mega" | "VOE";
  kind: "embed";
}

export interface ReproduccionTioanime {
  external_id: string;
  slug: string;
  series_title: string;
  cover_url: string | null;
  total_episodes: number;
  episode_id: string;
  episode_number: string;
  episode_title: string;
  poster_url: string | null;
  sources: FuenteEpisodioTioanime[];
  selected_source: string;
  playback: { kind: "embed"; url: string };
  url_original: string;
}

export interface FiltrosTioanime {
  q?: string;
  page?: number;
  types?: string[];
  genres?: string[];
  yearFrom?: string;
  yearTo?: string;
  status?: string;
  sort?: string;
}

export class ErrorTioanime extends Error {
  readonly status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

const TIPOS = new Set(["0", "1", "2", "3"]);
const ESTADOS = new Set(["1", "2", "3"]);
const ORDENES = new Set(["recent", "-recent"]);
export const GENEROS_TIOANIME = [
  ["accion", "Acción"],
  ["artes-marciales", "Artes marciales"],
  ["aventura", "Aventuras"],
  ["carreras", "Carreras"],
  ["ciencia-ficcion", "Ciencia ficción"],
  ["comedia", "Comedia"],
  ["demencia", "Demencia"],
  ["demonios", "Demonios"],
  ["deportes", "Deportes"],
  ["drama", "Drama"],
  ["ecchi", "Ecchi"],
  ["escolares", "Escolares"],
  ["espacial", "Espacial"],
  ["fantasia", "Fantasía"],
  ["harem", "Harem"],
  ["historico", "Histórico"],
  ["infantil", "Infantil"],
  ["josei", "Josei"],
  ["juegos", "Juegos"],
  ["magia", "Magia"],
  ["mecha", "Mecha"],
  ["militar", "Militar"],
  ["misterio", "Misterio"],
  ["musica", "Música"],
  ["parodia", "Parodia"],
  ["policia", "Policía"],
  ["psicologico", "Psicológico"],
  ["recuentos-de-la-vida", "Recuentos de la vida"],
  ["romance", "Romance"],
  ["samurai", "Samurai"],
  ["seinen", "Seinen"],
  ["shoujo", "Shoujo"],
  ["shounen", "Shounen"],
  ["sobrenatural", "Sobrenatural"],
  ["superpoderes", "Superpoderes"],
  ["suspenso", "Suspenso"],
  ["terror", "Terror"],
  ["vampiros", "Vampiros"],
  ["yaoi", "Yaoi"],
  ["yuri", "Yuri"],
] as const;
const GENEROS = new Set<string>(GENEROS_TIOANIME.map(([id]) => id));

function slugValido(value: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,159}$/i.test(value);
}

function episodioValido(value: string): boolean {
  return /^[a-z0-9][a-z0-9.-]{0,39}$/i.test(value);
}

function decodificarHtml(value: string): string {
  const nombres: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
    aacute: "á",
    eacute: "é",
    iacute: "í",
    oacute: "ó",
    uacute: "ú",
    ntilde: "ñ",
    uuml: "ü",
  };
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&([a-z]+);/gi, (entidad, nombre: string) => nombres[nombre.toLowerCase()] ?? entidad);
}

function texto(value: string | undefined): string {
  if (!value) return "";
  return decodificarHtml(
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function absolutoSeguro(value: string | undefined, rutas: string[] = []): string | null {
  if (!value) return null;
  try {
    const url = new URL(decodificarHtml(value), TIOANIME_WEB);
    if (url.protocol !== "https:" || url.origin !== TIOANIME_WEB) return null;
    if (rutas.length > 0 && !rutas.some((ruta) => url.pathname.startsWith(ruta))) return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function pedirHtml(url: string, fresco = false): Promise<Response> {
  const init: RequestInit & { next?: { revalidate: number } } = {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "es-ES,es;q=0.9",
    },
  };
  if (fresco) init.cache = "no-store";
  else init.next = { revalidate: 300 };
  try {
    return await fetch(url, init);
  } catch {
    throw new ErrorTioanime("No se pudo contactar con TioAnime");
  }
}

/** Extrae un arreglo JSON asignado a una variable sin ejecutar JavaScript remoto. */
function jsonArrayAsignado<T>(html: string, nombre: string): T[] {
  const marca = new RegExp(`\\bvar\\s+${nombre}\\s*=\\s*`).exec(html);
  if (!marca) return [];
  const inicio = html.indexOf("[", marca.index + marca[0].length);
  if (inicio < 0) return [];

  let profundidad = 0;
  let enTexto = false;
  let comilla = "";
  let escapado = false;
  for (let i = inicio; i < html.length; i += 1) {
    const c = html[i];
    if (enTexto) {
      if (escapado) escapado = false;
      else if (c === "\\") escapado = true;
      else if (c === comilla) enTexto = false;
      continue;
    }
    if (c === '"' || c === "'") {
      enTexto = true;
      comilla = c;
    } else if (c === "[") profundidad += 1;
    else if (c === "]") {
      profundidad -= 1;
      if (profundidad === 0) {
        try {
          return JSON.parse(html.slice(inicio, i + 1)) as T[];
        } catch {
          throw new ErrorTioanime(`TioAnime devolvio ${nombre} invalido`);
        }
      }
    }
  }
  throw new ErrorTioanime(`TioAnime devolvio ${nombre} incompleto`);
}

function tarjetasDirectorio(html: string): SerieTioanime[] {
  const salida: SerieTioanime[] = [];
  const vistos = new Set<string>();
  for (const match of html.matchAll(/<article\s+class=["']anime["']>([\s\S]*?)<\/article>/gi)) {
    const bloque = match[1];
    const slug = /href=["']\/anime\/([^"'?/]+)["']/i.exec(bloque)?.[1] ?? "";
    const title = texto(/<h3\s+class=["']title["']>([\s\S]*?)<\/h3>/i.exec(bloque)?.[1]);
    if (!slugValido(slug) || !title || vistos.has(slug)) continue;
    vistos.add(slug);
    salida.push({
      slug,
      title,
      cover_url: absolutoSeguro(/<img[^>]+src=["']([^"']+)["']/i.exec(bloque)?.[1], ["/uploads/portadas/"]),
      type: null,
      status: null,
      url_original: `${TIOANIME_WEB}/anime/${slug}`,
    });
  }
  return salida;
}

function ultimaPagina(html: string, actual: number): number {
  let ultima = actual;
  for (const match of html.matchAll(/href=["'][^"']*[?&]p=(\d+)[^"']*["']/gi)) {
    ultima = Math.max(ultima, Number(match[1]) || 1);
  }
  return ultima;
}

export async function catalogoTioanime(filtros: FiltrosTioanime = {}, fresco = false) {
  const page = Math.min(Math.max(Number(filtros.page) || 1, 1), 500);
  const params = new URLSearchParams({ p: String(page) });
  const q = filtros.q?.trim().slice(0, 100);
  if (q) params.set("q", q);

  for (const type of [...new Set(filtros.types ?? [])].slice(0, TIPOS.size)) {
    if (TIPOS.has(type)) params.append("type[]", type);
  }
  for (const genre of [...new Set(filtros.genres ?? [])].slice(0, 8)) {
    if (GENEROS.has(genre)) params.append("genero[]", genre);
  }
  if (filtros.status && ESTADOS.has(filtros.status)) params.set("status", filtros.status);
  if (filtros.sort && ORDENES.has(filtros.sort)) params.set("sort", filtros.sort);

  const yearFrom = Number(filtros.yearFrom);
  const yearTo = Number(filtros.yearTo);
  const currentYear = new Date().getFullYear();
  if (
    Number.isInteger(yearFrom) &&
    Number.isInteger(yearTo) &&
    yearFrom >= 1950 &&
    yearTo <= currentYear &&
    yearFrom <= yearTo
  ) {
    // El slider de TioAnime usa el limite inferior como borde exclusivo.
    params.set("year", `${Math.max(1949, yearFrom - 1)},${yearTo}`);
  }

  const res = await pedirHtml(`${TIOANIME_WEB}/directorio?${params}`, fresco);
  if (res.status === 404) throw new ErrorTioanime("Catalogo no encontrado", 404);
  if (!res.ok) throw new ErrorTioanime(`TioAnime respondio ${res.status}`);
  const html = await res.text();
  return {
    series: tarjetasDirectorio(html),
    page,
    lastPage: ultimaPagina(html, page),
    total: null,
  };
}

export async function fichaTioanime(slug: string, requestedPage = 1): Promise<FichaTioanime> {
  if (!slugValido(slug)) throw new ErrorTioanime("Anime invalido", 400);
  const page = Math.min(Math.max(Number(requestedPage) || 1, 1), 500);
  const url = `${TIOANIME_WEB}/anime/${slug}`;
  const res = await pedirHtml(url);
  if (res.status === 404) throw new ErrorTioanime("Anime no encontrado", 404);
  if (!res.ok) throw new ErrorTioanime(`TioAnime respondio ${res.status}`);
  const html = await res.text();

  const info = jsonArrayAsignado<unknown>(html, "anime_info");
  const id = String(info[0] ?? "").trim();
  const slugPublicado = String(info[1] ?? "").trim();
  const title = texto(String(info[2] ?? "")) || texto(/<h1\s+class=["']title["']>([\s\S]*?)<\/h1>/i.exec(html)?.[1]);
  if (!/^\d{1,12}$/.test(id) || slugPublicado !== slug || !title) {
    throw new ErrorTioanime("TioAnime cambio el formato de su ficha");
  }

  const numeros = jsonArrayAsignado<number | string>(html, "episodes").map(String);
  const detalles = jsonArrayAsignado<string>(html, "episodes_details");
  const total = numeros.length;
  const lastPage = Math.max(1, Math.ceil(total / EPISODIOS_POR_PAGINA));
  const safePage = Math.min(page, lastPage);
  const inicio = (safePage - 1) * EPISODIOS_POR_PAGINA;
  const thumb = absolutoSeguro(`/uploads/thumbs/${id}.jpg`, ["/uploads/thumbs/"]);

  const generosHtml = /<p\s+class=["']genres["']>([\s\S]*?)<\/p>/i.exec(html)?.[1] ?? "";
  const genres = [...generosHtml.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => texto(match[1]))
    .filter(Boolean);

  return {
    id,
    slug,
    title,
    alternative_title: null,
    description: texto(/<p\s+class=["']sinopsis["']>([\s\S]*?)<\/p>/i.exec(html)?.[1]) || null,
    cover_url: absolutoSeguro(/<div\s+class=["']thumb["']>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i.exec(html)?.[1], ["/uploads/portadas/"]),
    type: texto(/<span\s+class=["']anime-type-[^"']+["']>([\s\S]*?)<\/span>/i.exec(html)?.[1]) || null,
    status: texto(/<a[^>]+class=["'][^"']*\bstatus\b[^"']*["'][^>]*>([\s\S]*?)<\/a>/i.exec(html)?.[1]) || null,
    genres,
    season: texto(/<span\s+class=["']fa-[^"']+["']>([\s\S]*?)<\/span>/i.exec(html)?.[1]) || null,
    year: texto(/<span\s+class=["']year["']>([\s\S]*?)<\/span>/i.exec(html)?.[1]) || null,
    total_episodes: total,
    episodes: numeros.slice(inicio, inicio + EPISODIOS_POR_PAGINA).map((number, offset) => ({
      id: `${id}:${number}`,
      number,
      title: `${title} - ${number}`,
      image_url: thumb,
      published_at: typeof detalles[inicio + offset] === "string" ? detalles[inicio + offset] : null,
    })),
    page: safePage,
    last_page: lastPage,
    url_original: url,
  };
}

export async function esAdultoTioanime(slug: string): Promise<boolean> {
  const ficha = await fichaTioanime(slug, 1);
  return ficha.genres.some((genre) => genre.toLowerCase() === "hentai");
}

interface FuenteInterna extends FuenteEpisodioTioanime {
  url: string;
}

function fuentePermitida(labelCrudo: unknown, urlCruda: unknown): FuenteInterna | null {
  const label = texto(String(labelCrudo ?? "")).toLowerCase();
  let id: FuenteEpisodioTioanime["id"];
  let nombre: FuenteEpisodioTioanime["label"];
  if (label === "yourupload") {
    id = "yourupload";
    nombre = "YourUpload";
  } else if (label === "mega") {
    id = "mega";
    nombre = "Mega";
  } else if (label === "voe") {
    id = "voe";
    nombre = "VOE";
  } else return null;

  try {
    const url = new URL(decodificarHtml(String(urlCruda ?? "")));
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    const valida =
      (id === "yourupload" && (host === "yourupload.com" || host === "www.yourupload.com") && url.pathname.startsWith("/embed/")) ||
      (id === "mega" && host === "mega.nz" && url.pathname.startsWith("/embed/")) ||
      (id === "voe" && (host === "voe.sx" || host.endsWith(".voe.sx")) && url.pathname.startsWith("/e/"));
    if (!valida) return null;
    return { id, label: nombre, kind: "embed", url: url.toString() };
  } catch {
    return null;
  }
}

/** Obtiene de nuevo las fuentes publicadas para cada apertura del episodio. */
export async function reproduccionTioanime(
  slug: string,
  episodio: string,
  fuenteElegida?: string | null
): Promise<ReproduccionTioanime> {
  if (!slugValido(slug) || !episodioValido(episodio)) {
    throw new ErrorTioanime("Direccion de episodio invalida", 400);
  }
  const ficha = await fichaTioanime(slug, 1);
  const urlOriginal = `${TIOANIME_WEB}/ver/${slug}-${episodio}`;
  const res = await pedirHtml(urlOriginal, true);
  if (res.status === 404) throw new ErrorTioanime("Episodio no encontrado", 404);
  if (!res.ok) throw new ErrorTioanime(`TioAnime respondio ${res.status}`);
  const html = await res.text();

  const fuentes = jsonArrayAsignado<unknown[]>(html, "videos")
    .map((item) => fuentePermitida(item?.[0], item?.[1]))
    .filter((item): item is FuenteInterna => Boolean(item));
  const prioridades = new Map<FuenteEpisodioTioanime["id"], number>([
    ["yourupload", 0],
    ["mega", 1],
    ["voe", 2],
  ]);
  fuentes.sort((a, b) => (prioridades.get(a.id) ?? 9) - (prioridades.get(b.id) ?? 9));
  if (fuentes.length === 0) {
    throw new ErrorTioanime("TioAnime no devolvio YourUpload, Mega ni VOE para este episodio");
  }

  const elegida = fuentes.find((fuente) => fuente.id === fuenteElegida) ?? fuentes[0];
  const playback: ReproduccionTioanime["playback"] = { kind: "embed", url: elegida.url };
  const poster = absolutoSeguro(`/uploads/thumbs/${ficha.id}.jpg`, ["/uploads/thumbs/"]);

  const episodeTitle =
    texto(/<h1\s+class=["']anime-title[^"']*["']>([\s\S]*?)<\/h1>/i.exec(html)?.[1]) ||
    `${ficha.title} ${episodio}`;
  return {
    external_id: ficha.slug,
    slug: ficha.slug,
    series_title: ficha.title,
    cover_url: ficha.cover_url,
    total_episodes: ficha.total_episodes,
    episode_id: `${ficha.id}:${episodio}`,
    episode_number: episodio,
    episode_title: episodeTitle,
    poster_url: poster,
    sources: fuentes.map(({ id, label, kind }) => ({ id, label, kind })),
    selected_source: elegida.id,
    playback,
    url_original: urlOriginal,
  };
}
