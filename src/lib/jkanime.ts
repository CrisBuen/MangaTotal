/**
 * Adaptador de lectura para JKAnime, integrado con permiso de sus creadores.
 *
 * Acá solo se leen el directorio, las fichas y la lista pública de episodios.
 * Los servidores de video no se extraen ni se guardan: el episodio se abre
 * mediante la página oficial de JKAnime, que conserva su reproductor y su
 * selector de fuentes.
 */

export const JKANIME_NOMBRE = "JKAnime";
export const JKANIME_WEB = "https://jkanime.net";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export interface SerieJkanime {
  id: number | null;
  slug: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  type: string | null;
  status: string | null;
  url_original: string;
}

export interface EpisodioJkanime {
  id: number;
  number: string;
  title: string;
  image_url: string | null;
  published_at: string | null;
}

export interface FichaJkanime {
  id: number;
  slug: string;
  title: string;
  alternative_title: string | null;
  description: string | null;
  cover_url: string | null;
  type: string | null;
  status: string | null;
  genres: string[];
  category: string | null;
  studios: string[];
  season: string | null;
  languages: string | null;
  duration: string | null;
  aired_at: string | null;
  quality: string | null;
  total_episodes: number;
  episodes: EpisodioJkanime[];
  page: number;
  last_page: number;
  url_original: string;
}

export interface FiltrosJkanime {
  q?: string;
  page?: number;
  sort?: string;
  genre?: string;
  letter?: string;
  demographic?: string;
  category?: string;
  type?: string;
  status?: string;
  year?: string;
  season?: string;
  order?: string;
}

export class ErrorJkanime extends Error {
  constructor(message: string, public readonly status = 502) {
    super(message);
  }
}

interface CatalogoCrudo {
  current_page: number;
  last_page: number;
  total: number;
  data: {
    id?: number;
    title?: string;
    synopsis?: string;
    image?: string;
    slug?: string;
    type?: string;
    status?: string;
    estado?: string;
    tipo?: string;
  }[];
}

interface PaginaEpisodiosCruda {
  total: number;
  data: {
    id: number;
    number: number | string;
    title?: string;
    image?: string;
    timestamp?: string;
  }[];
}

const OPCIONES: Record<Exclude<keyof FiltrosJkanime, "q" | "page" | "year" | "letter">, Set<string>> = {
  sort: new Set(["", "nombre", "popularidad"]),
  genre: new Set([
    "accion", "aventura", "autos", "comedia", "dementia", "demonios", "misterio",
    "drama", "ecchi", "fantasia", "juegos", "hentai", "historico", "terror", "nios",
    "magia", "artes-marciales", "mecha", "musica", "parodia", "samurai", "romance",
    "colegial", "sci-fi", "shoujo", "shoujo-ai", "shounen", "shounen-ai", "space",
    "deportes", "super-poderes", "vampiros", "yaoi", "yuri", "harem",
    "cosas-de-la-vida", "sobrenatural", "militar", "policial", "psicologico",
    "thriller", "seinen", "josei", "latino", "isekai",
  ]),
  demographic: new Set(["", "nios", "shoujo", "shounen", "seinen", "josei"]),
  category: new Set(["", "donghua", "latino"]),
  type: new Set(["", "animes", "peliculas", "especiales", "ovas", "onas"]),
  status: new Set(["", "emision", "finalizados", "estrenos"]),
  season: new Set(["", "invierno", "primavera", "verano", "otoño"]),
  order: new Set(["", "asc"]),
};

function slugValido(value: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,159}$/i.test(value);
}

function episodioValido(value: string): boolean {
  return /^[a-z0-9][a-z0-9.-]{0,39}$/i.test(value);
}

export function urlEpisodioJkanime(slug: string, episodio: string): string {
  if (!slugValido(slug) || !episodioValido(episodio)) {
    throw new ErrorJkanime("Dirección de episodio inválida", 400);
  }
  return `${JKANIME_WEB}/${slug}/${episodio}/`;
}

function decodificarHtml(value: string): string {
  const nombres: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
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

/** Saca un objeto JSON asignado por JS sin cortar si un texto contiene llaves. */
function jsonAsignado<T>(html: string, nombre: string): T {
  const marca = new RegExp(`\\bvar\\s+${nombre}\\s*=\\s*`).exec(html);
  if (!marca) throw new ErrorJkanime("JKAnime cambió el formato de su directorio");
  const inicio = html.indexOf("{", marca.index + marca[0].length);
  if (inicio < 0) throw new ErrorJkanime("JKAnime no devolvió su catálogo");

  let profundidad = 0;
  let enTexto = false;
  let escapado = false;
  for (let i = inicio; i < html.length; i += 1) {
    const c = html[i];
    if (enTexto) {
      if (escapado) escapado = false;
      else if (c === "\\") escapado = true;
      else if (c === '"') enTexto = false;
      continue;
    }
    if (c === '"') enTexto = true;
    else if (c === "{") profundidad += 1;
    else if (c === "}") {
      profundidad -= 1;
      if (profundidad === 0) {
        try {
          return JSON.parse(html.slice(inicio, i + 1)) as T;
        } catch {
          throw new ErrorJkanime("JKAnime devolvió un catálogo inválido");
        }
      }
    }
  }
  throw new ErrorJkanime("JKAnime devolvió un catálogo incompleto");
}

function normalizarSerie(s: CatalogoCrudo["data"][number]): SerieJkanime | null {
  const slug = String(s.slug ?? "").trim();
  const title = texto(s.title);
  if (!slugValido(slug) || !title) return null;
  return {
    id: Number.isInteger(s.id) ? Number(s.id) : null,
    slug,
    title,
    description: texto(s.synopsis) || null,
    cover_url: typeof s.image === "string" && s.image.startsWith("https://") ? s.image : null,
    type: texto(s.tipo ?? s.type) || null,
    status: texto(s.estado ?? s.status) || null,
    url_original: `${JKANIME_WEB}/${slug}/`,
  };
}

/** La búsqueda de JKAnime usa tarjetas HTML en vez del JSON del directorio. */
function resultadosBusqueda(html: string): SerieJkanime[] {
  const partes = html.split(/<div class="col-lg-2 col-md-6 col-sm-6" data-g="/i).slice(1);
  const vistos = new Set<string>();
  const salida: SerieJkanime[] = [];
  for (const bloque of partes) {
    const slug = /href="https:\/\/jkanime\.net\/([^"/?]+)\/?"/i.exec(bloque)?.[1] ?? "";
    const title = texto(/<h5>\s*<a[^>]*>([\s\S]*?)<\/a>/i.exec(bloque)?.[1]);
    if (!slugValido(slug) || !title || vistos.has(slug)) continue;
    vistos.add(slug);

    const id64 = /^([^"]+)"/.exec(bloque)?.[1] ?? "";
    let id: number | null = null;
    try {
      const decoded = Buffer.from(id64, "base64").toString("utf8");
      id = /^\d+$/.test(decoded) ? Number(decoded) : null;
    } catch {
      id = null;
    }
    salida.push({
      id,
      slug,
      title,
      description: null,
      cover_url: /data-setbg="(https:\/\/[^"]+)"/i.exec(bloque)?.[1] ?? null,
      status: texto(/<div class="anime__item__text">\s*<ul>\s*<li>([\s\S]*?)<\/li>/i.exec(bloque)?.[1]) || null,
      type: texto(/<li class="anime">([\s\S]*?)<\/li>/i.exec(bloque)?.[1]) || null,
      url_original: `${JKANIME_WEB}/${slug}/`,
    });
  }
  return salida;
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
    throw new ErrorJkanime("No se pudo contactar con JKAnime");
  }
}

/** Controla accesos directos a episodios cuando +18 está apagado. */
export async function esAdultoJkanime(slug: string): Promise<boolean> {
  if (!slugValido(slug)) throw new ErrorJkanime("Anime inválido", 400);
  const res = await pedirHtml(`${JKANIME_WEB}/${slug}/`);
  if (res.status === 404) throw new ErrorJkanime("Anime no encontrado", 404);
  if (!res.ok) throw new ErrorJkanime(`JKAnime respondió ${res.status}`);
  const html = await res.text();
  return /\/genero\/hentai\/?["']/i.test(html);
}

export async function catalogoJkanime(filtros: FiltrosJkanime = {}, fresco = false) {
  const page = Math.min(Math.max(Number(filtros.page) || 1, 1), 200);
  const q = filtros.q?.trim().slice(0, 100);

  if (q) {
    const res = await pedirHtml(`${JKANIME_WEB}/buscar?q=${encodeURIComponent(q)}`, fresco);
    if (!res.ok) throw new ErrorJkanime(`JKAnime respondió ${res.status}`);
    return { series: resultadosBusqueda(await res.text()), page: 1, lastPage: 1, total: null };
  }

  const params = new URLSearchParams();
  params.set("p", String(page));
  const pares: [keyof typeof OPCIONES, string | undefined, string][] = [
    ["sort", filtros.sort, "filtro"],
    ["genre", filtros.genre, "genero"],
    ["demographic", filtros.demographic, "demografia"],
    ["category", filtros.category, "categoria"],
    ["type", filtros.type, "tipo"],
    ["status", filtros.status, "estado"],
    ["season", filtros.season, "temporada"],
    ["order", filtros.order, "orden"],
  ];
  for (const [clave, valor, parametro] of pares) {
    if (valor && OPCIONES[clave].has(valor)) params.set(parametro, valor);
  }
  if (filtros.letter && /^[a-z0-9]$/i.test(filtros.letter)) {
    params.set("letra", filtros.letter.toLowerCase());
  }
  if (filtros.year && /^\d{4}$/.test(filtros.year)) params.set("fecha", filtros.year);

  const res = await pedirHtml(`${JKANIME_WEB}/directorio?${params}`, fresco);
  if (!res.ok) throw new ErrorJkanime(`JKAnime respondió ${res.status}`);
  const catalogo = jsonAsignado<CatalogoCrudo>(await res.text(), "animes");
  return {
    series: (catalogo.data ?? []).map(normalizarSerie).filter((s): s is SerieJkanime => Boolean(s)),
    page: Number(catalogo.current_page) || page,
    lastPage: Math.max(1, Number(catalogo.last_page) || 1),
    total: Number(catalogo.total) || 0,
  };
}

function datoDe(html: string, etiqueta: string): string | null {
  const patron = new RegExp(
    `<li[^>]*>\\s*<span>\\s*${etiqueta}\\s*:?\\s*</span>([\\s\\S]*?)<\\/li>`,
    "i"
  );
  return texto(patron.exec(html)?.[1]) || null;
}

function cookiesDe(res: Response): string {
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  const crudas = headers.getSetCookie?.() ??
    (headers.get("set-cookie") ? [headers.get("set-cookie") as string] : []);
  return crudas.map((cookie) => cookie.split(";")[0]).filter(Boolean).join("; ");
}

export async function fichaJkanime(slug: string, requestedPage = 1): Promise<FichaJkanime> {
  if (!slugValido(slug)) throw new ErrorJkanime("Anime inválido", 400);
  const page = Math.min(Math.max(Number(requestedPage) || 1, 1), 500);
  const url = `${JKANIME_WEB}/${slug}/`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "es-ES,es;q=0.9",
      },
      cache: "no-store",
    });
  } catch {
    throw new ErrorJkanime("No se pudo contactar con JKAnime");
  }
  if (res.status === 404) throw new ErrorJkanime("Anime no encontrado", 404);
  if (!res.ok) throw new ErrorJkanime(`JKAnime respondió ${res.status}`);

  const cookies = cookiesDe(res);
  const html = await res.text();
  const id = Number(/\/ajax\/episodes\/(\d+)\//i.exec(html)?.[1] ?? 0);
  const token =
    /<meta[^>]+name=["']csrf-token["'][^>]+content=["']([^"']+)["']/i.exec(html)?.[1] ??
    /\bvar\s+token\s*=\s*["']([^"']+)["']/i.exec(html)?.[1] ??
    "";
  if (!id || !token) throw new ErrorJkanime("JKAnime cambió el acceso a sus episodios");

  let episodiosRes: Response;
  try {
    episodiosRes = await fetch(`${JKANIME_WEB}/ajax/episodes/${id}/${page}`, {
      method: "POST",
      headers: {
        "User-Agent": UA,
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        Referer: url,
        ...(cookies ? { Cookie: cookies } : {}),
      },
      body: new URLSearchParams({ _token: token }),
      cache: "no-store",
    });
  } catch {
    throw new ErrorJkanime("No se pudo pedir la lista de episodios a JKAnime");
  }
  if (!episodiosRes.ok) {
    throw new ErrorJkanime(`JKAnime no entregó sus episodios (${episodiosRes.status})`);
  }

  let pagina: PaginaEpisodiosCruda;
  try {
    pagina = (await episodiosRes.json()) as PaginaEpisodiosCruda;
  } catch {
    throw new ErrorJkanime("JKAnime devolvió episodios inválidos");
  }

  const cover =
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i.exec(html)?.[1] ??
    /<div class="anime_pic[^"]*"[^>]*>\s*<img[^>]+src=["']([^"']+)["']/i.exec(html)?.[1] ??
    null;
  const thumbBase = cover
    ? cover.replace("/animes/image/", "/animes/video/image_thumb/").split("/").slice(0, -1).join("/") + "/"
    : null;
  const title =
    texto(/<div class="anime_info">[\s\S]*?<h3>([\s\S]*?)<\/h3>/i.exec(html)?.[1]) ||
    texto(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i.exec(html)?.[1]);
  if (!title) throw new ErrorJkanime("JKAnime no devolvió la ficha del anime");

  const generosHtml =
    /<li[^>]*>\s*<span>\s*Generos\s*:\s*<\/span>([\s\S]*?)<\/li>/i.exec(html)?.[1] ?? "";
  const genres = [...generosHtml.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((m) => texto(m[1]))
    .filter(Boolean);
  const total = Math.max(0, Number(pagina.total) || 0);

  return {
    id,
    slug,
    title,
    alternative_title:
      texto(/<div class="anime_info">[\s\S]*?<h3>[\s\S]*?<\/h3>\s*<span>([\s\S]*?)<\/span>/i.exec(html)?.[1]) ||
      null,
    description: texto(/<p class="scroll">([\s\S]*?)<\/p>/i.exec(html)?.[1]) || null,
    cover_url: cover,
    type: datoDe(html, "Tipo"),
    status: datoDe(html, "Estado"),
    genres,
    category: datoDe(html, "Categoria"),
    studios: (datoDe(html, "Studios") ?? "").split(",").map((v) => v.trim()).filter(Boolean),
    season: datoDe(html, "Temporada"),
    languages: datoDe(html, "Idiomas"),
    duration: datoDe(html, "Duracion"),
    aired_at: datoDe(html, "Emitido"),
    quality: datoDe(html, "Calidad"),
    total_episodes: total,
    episodes: (pagina.data ?? []).map((ep) => ({
      id: Number(ep.id) || 0,
      number: String(ep.number),
      title: texto(ep.title) || `Episodio ${ep.number}`,
      image_url:
        typeof ep.image === "string" && ep.image.length > 10
          ? ep.image.startsWith("http")
            ? ep.image
            : thumbBase
              ? thumbBase + ep.image
              : null
          : null,
      published_at: typeof ep.timestamp === "string" ? ep.timestamp : null,
    })),
    page,
    last_page: Math.max(1, Math.ceil(total / 16)),
    url_original: url,
  };
}
