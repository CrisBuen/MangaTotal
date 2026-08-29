/**
 * Adaptador de lectura para JKAnime, integrado con permiso de sus creadores.
 *
 * Además del directorio y las fichas, el adaptador reconstruye el selector de
 * fuentes que JKAnime publica en cada episodio. Desu y Magi entregan HLS
 * temporal para el reproductor nativo; las demás conservan el wrapper oficial
 * de JKAnime. Ninguna dirección de reproducción se guarda en la base de datos.
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

export interface FuenteEpisodioJkanime {
  id: string;
  label: string;
  kind: "hls" | "embed";
}

export interface ReproduccionJkanime {
  external_id: string;
  slug: string;
  series_title: string;
  cover_url: string | null;
  total_episodes: number | null;
  episode_id: string;
  episode_number: string;
  episode_title: string;
  poster_url: string | null;
  sources: FuenteEpisodioJkanime[];
  selected_source: string;
  playback: {
    kind: "hls" | "embed";
    url: string;
  };
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

interface FuenteInterna extends FuenteEpisodioJkanime {
  playerUrl?: string;
  remote?: string;
  server?: string;
}

interface ServidorCrudo {
  remote?: string;
  server?: string;
}

/** Igual que jsonAsignado, pero para los arreglos JSON publicados en la ficha. */
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
    } else if (c === "[") {
      profundidad += 1;
    } else if (c === "]") {
      profundidad -= 1;
      if (profundidad === 0) {
        try {
          return JSON.parse(html.slice(inicio, i + 1)) as T[];
        } catch {
          throw new ErrorJkanime("JKAnime devolvió fuentes alternativas inválidas");
        }
      }
    }
  }
  throw new ErrorJkanime("JKAnime devolvió fuentes alternativas incompletas");
}

function atributo(attrs: string, nombre: string): string | null {
  const seguro = nombre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`\\b${seguro}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i").exec(attrs);
  return match ? decodificarHtml(match[2]) : null;
}

function fuentesDeEpisodio(html: string): FuenteInterna[] {
  const etiquetas = new Map<number, string>();
  for (const enlace of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const attrs = enlace[1];
    const clases = atributo(attrs, "class") ?? "";
    if (!/(?:^|\s)servers(?:\s|$)/i.test(clases)) continue;
    const indice = Number(atributo(attrs, "data-id"));
    const label = texto(enlace[2]);
    if (Number.isInteger(indice) && indice >= 0 && label) etiquetas.set(indice, label);
  }

  const playerUrls = new Map<number, string>();
  for (const asignacion of html.matchAll(/\bvideo\[(\d+)\]\s*=\s*'(<iframe[\s\S]*?)';/gi)) {
    const indice = Number(asignacion[1]);
    const src = atributo(asignacion[2], "src");
    if (!src) continue;
    try {
      const url = new URL(src, JKANIME_WEB);
      if (url.origin !== JKANIME_WEB || !url.pathname.startsWith("/jkplayer/")) continue;
      playerUrls.set(indice, url.toString());
    } catch {
      // una fuente rota no debe impedir que carguen las demás
    }
  }

  const fuentes: FuenteInterna[] = [...playerUrls.entries()]
    .sort(([a], [b]) => a - b)
    .map(([indice, playerUrl]) => ({
      id: `base-${indice}`,
      label: etiquetas.get(indice) ?? `Fuente ${indice + 1}`,
      kind: "hls" as const,
      playerUrl,
    }));

  for (const [indice, servidor] of jsonArrayAsignado<ServidorCrudo>(html, "servers").entries()) {
    const remote = String(servidor.remote ?? "").trim();
    const server = texto(servidor.server);
    if (!remote || !server) continue;
    fuentes.push({
      id: `remote-${indice}`,
      label: server,
      kind: "embed",
      remote,
      server,
    });
  }
  return fuentes;
}

async function hlsDePlayer(playerUrl: string, referer: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(playerUrl);
  } catch {
    throw new ErrorJkanime("JKAnime devolvió un reproductor inválido");
  }
  if (url.origin !== JKANIME_WEB || !url.pathname.startsWith("/jkplayer/")) {
    throw new ErrorJkanime("JKAnime devolvió un reproductor no autorizado");
  }

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml",
        Referer: referer,
      },
      cache: "no-store",
    });
  } catch {
    throw new ErrorJkanime("No se pudo abrir el reproductor de JKAnime");
  }
  if (!res.ok) throw new ErrorJkanime(`El reproductor de JKAnime respondió ${res.status}`);
  const html = await res.text();
  const cruda =
    /<source[^>]+src=["']([^"']+\.m3u8[^"']*)["']/i.exec(html)?.[1] ??
    /\burl\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i.exec(html)?.[1] ??
    "";
  const hls = decodificarHtml(cruda);
  try {
    const salida = new URL(hls);
    if (salida.protocol !== "https:") throw new Error();
    return salida.toString();
  } catch {
    throw new ErrorJkanime("JKAnime no entregó video HLS para esta fuente");
  }
}

/**
 * Reconstruye la reproducción publicada por JKAnime para un episodio.
 *
 * Las URLs son efímeras y solo se devuelven en esta respuesta; nunca se
 * persisten ni se descargan desde MangaTotal.
 */
export async function reproduccionJkanime(
  slug: string,
  episodio: string,
  sourceId?: string | null
): Promise<ReproduccionJkanime> {
  const urlOriginal = urlEpisodioJkanime(slug, episodio);
  const res = await pedirHtml(urlOriginal, true);
  if (res.status === 404) throw new ErrorJkanime("Episodio no encontrado", 404);
  if (!res.ok) throw new ErrorJkanime(`JKAnime respondió ${res.status}`);
  const html = await res.text();

  const fuentes = fuentesDeEpisodio(html);
  if (fuentes.length === 0) throw new ErrorJkanime("JKAnime no devolvió fuentes para este episodio");
  let elegida =
    fuentes.find((fuente) => fuente.id === sourceId) ??
    fuentes.find((fuente) => fuente.label.toLowerCase() === "desu") ??
    fuentes[0];

  async function abrir(fuente: FuenteInterna): Promise<ReproduccionJkanime["playback"]> {
    if (fuente.kind === "hls" && fuente.playerUrl) {
      return {
        kind: "hls",
        url: await hlsDePlayer(fuente.playerUrl, urlOriginal),
      };
    }
    if (fuente.kind === "embed" && fuente.remote && fuente.server) {
      const params = new URLSearchParams({
        u: fuente.remote,
        s: fuente.server.toLowerCase(),
      });
      return {
        kind: "embed",
        url: `${JKANIME_WEB}/jkplayer/c1?${params}`,
      };
    }
    throw new ErrorJkanime("La fuente elegida no está disponible");
  }

  let playback: ReproduccionJkanime["playback"] | null = null;
  let ultimoError: unknown;
  const candidatas = sourceId
    ? [elegida]
    : [elegida, ...fuentes.filter((fuente) => fuente.id !== elegida.id)];
  for (const fuente of candidatas) {
    try {
      playback = await abrir(fuente);
      elegida = fuente;
      break;
    } catch (error) {
      ultimoError = error;
    }
  }
  if (!playback) {
    if (ultimoError instanceof ErrorJkanime) throw ultimoError;
    throw new ErrorJkanime("Ninguna fuente respondió para este episodio");
  }

  const externalId = /\/ajax\/episodes\/(\d+)\//i.exec(html)?.[1] ?? "";
  const episodeId =
    /\bid=["']guardar-capitulo["'][^>]+data-capitulo=["']([^"']+)/i.exec(html)?.[1] ??
    episodio;
  const seriesTitle =
    texto(/\bid=["']marcar_visto["'][^>]+data-title=["']([^"']+)/i.exec(html)?.[1]) ||
    texto(/<div class=["'][^"']*video-info[^"']*["'][\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i.exec(html)?.[1]);
  if (!externalId || !seriesTitle) {
    throw new ErrorJkanime("JKAnime cambió los datos de identificación del episodio");
  }

  const cover =
    /<div class=["'][^"']*video-info[^"']*["'][\s\S]*?<img[^>]+src=["']([^"']+)/i.exec(html)?.[1] ??
    null;
  const poster =
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i.exec(html)?.[1] ??
    null;
  const totalMatch =
    /<div class=["'][^"']*video-info[^"']*["'][\s\S]*?<span[^>]*>\s*(\d+)\s+episodios/i.exec(html);
  const episodeTitle =
    texto(/<div class=["']breadcrumb__links["']>[\s\S]*?<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1]) ||
    `Episodio ${episodio} - ${seriesTitle}`;

  return {
    external_id: externalId,
    slug,
    series_title: seriesTitle,
    cover_url: cover?.startsWith("https://") ? decodificarHtml(cover) : null,
    total_episodes: totalMatch ? Number(totalMatch[1]) : null,
    episode_id: episodeId,
    episode_number: episodio,
    episode_title: episodeTitle,
    poster_url: poster?.startsWith("https://") ? decodificarHtml(poster) : null,
    sources: fuentes.map(({ id, label, kind }) => ({ id, label, kind })),
    selected_source: elegida.id,
    playback,
    url_original: urlOriginal,
  };
}
