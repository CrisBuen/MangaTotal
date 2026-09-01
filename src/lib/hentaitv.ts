/**
 * Adaptador de HentaiTV, integrado con permiso de sus responsables.
 *
 * El catalogo usa la API publica de WordPress y las fichas leen la lista de
 * episodios publicada por la fuente. Al abrir uno se consulta la configuracion
 * efimera de su reproductor y se entrega solamente un manifiesto HLS validado.
 * Ningun token, manifiesto ni direccion de video se guarda en la base de datos.
 */

export const HENTAITV_NOMBRE = "HentaiTV";
export const HENTAITV_WEB = "https://hentaila.tv";

const HENTAITV_API = `${HENTAITV_WEB}/wp-json/wp/v2`;
const HENTAITV_IMAGENES = "https://img.hentaihaven.xxx/";
const HENTAITV_PLAYER_API = "/wp-content/plugins/player-logic/api.php";
const HENTAITV_MANIFEST_HOST = "octopusmanifest.org";
const POR_PAGINA = 24;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 MangaTotal/1.0";

// Estas taxonomias no pueden aparecer aunque se intente llamar la API a mano.
// Se excluyen en WordPress y se vuelven a comprobar en cada respuesta.
const GENEROS_BLOQUEADOS = new Set([178, 364, 69, 8, 92, 262]);
const TEXTO_BLOQUEADO = /(?:^|[^a-z])(sho-?ta|loli(?:con)?|escolares?|jovencita|rape|violaci[oó]n|bestialidad)(?:$|[^a-z])/i;

export const GENEROS_HENTAITV = [
  [245, "BBW"],
  [99, "BDSM"],
  [100, "Bondage"],
  [227, "Ecchi"],
  [345, "FemBoy"],
  [110, "Futanari"],
  [218, "Gay"],
  [246, "Gordas"],
  [68, "Harem"],
  [303, "Hentai 3D"],
  [5, "Sin censura"],
  [6, "Incesto"],
  [7, "Milfs"],
  [71, "Romance"],
  [228, "Softcore"],
  [9, "Tetonas"],
  [72, "Tsundere"],
  [67, "Waifu"],
  [219, "Yaoi"],
  [73, "Yuri"],
] as const;

const GENEROS_PERMITIDOS = new Set<number>(GENEROS_HENTAITV.map(([id]) => id));
const ORDENES = new Set(["date_desc", "date_asc", "modified_desc", "title_asc"]);

export interface SerieHentaitv {
  id: string;
  slug: string;
  title: string;
  cover_url: string | null;
  year: string | null;
  genres: string[];
  url_original: string;
}

export interface EpisodioHentaitv {
  id: string;
  number: string;
  title: string;
  image_url: string | null;
  published_at: string | null;
  url_original: string;
}

export interface FichaHentaitv extends SerieHentaitv {
  description: string | null;
  author: string | null;
  total_episodes: number;
  episodes: EpisodioHentaitv[];
}

export interface CatalogoHentaitv {
  series: SerieHentaitv[];
  page: number;
  lastPage: number;
  total: number;
}

export interface FiltrosHentaitv {
  q?: string;
  page?: number;
  genre?: number | null;
  year?: string | null;
  sort?: string;
}

export interface ReproduccionHentaitv {
  external_id: string;
  slug: string;
  series_title: string;
  cover_url: string | null;
  total_episodes: number;
  episode_id: string;
  episode_number: string;
  episode_title: string;
  poster_url: string | null;
  sources: Array<{ id: "hentaitv"; label: "HentaiTV"; kind: "hls" }>;
  selected_source: "hentaitv";
  playback: { kind: "hls"; manifest: string };
  url_original: string;
}

interface WpRendered {
  rendered?: string;
}

interface WpTerm {
  id?: number;
  name?: string;
  slug?: string;
  taxonomy?: string;
}

interface WpManga {
  id?: number;
  slug?: string;
  link?: string;
  title?: WpRendered;
  content?: WpRendered;
  meta?: { vraven_remote_thumbnail?: string };
  "wp-manga-genre"?: number[];
  "wp-manga-release"?: number[];
  _embedded?: { "wp:term"?: unknown[] };
}

interface ConfiguracionPlayerHentaitv {
  en?: unknown;
  iv?: unknown;
  uri?: unknown;
}

interface RespuestaPlayerHentaitv {
  status?: unknown;
  data?: {
    sources?: Array<{ src?: unknown }>;
  };
}

export class ErrorHentaitv extends Error {
  readonly status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

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

function terminos(item: WpManga): WpTerm[] {
  const grupos = item._embedded?.["wp:term"];
  if (!Array.isArray(grupos)) return [];
  return grupos.flat(3).filter((term): term is WpTerm => Boolean(term && typeof term === "object"));
}

function mangaBloqueado(item: WpManga): boolean {
  if ((item["wp-manga-genre"] ?? []).some((id) => GENEROS_BLOQUEADOS.has(id))) return true;
  const marca = [item.slug, texto(item.title?.rendered), texto(item.content?.rendered)]
    .concat(terminos(item).map((term) => `${term.slug ?? ""} ${term.name ?? ""}`))
    .join(" ");
  return TEXTO_BLOQUEADO.test(marca);
}

function urlOficial(value: string | undefined, slug?: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(decodificarHtml(value), HENTAITV_WEB);
    if (url.protocol !== "https:" || url.origin !== HENTAITV_WEB) return null;
    if (slug && !url.pathname.startsWith(`/ver/${slug}`)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function imagenSegura(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = /^https?:\/\//i.test(value)
      ? new URL(decodificarHtml(value))
      : new URL(value.replace(/^\/+/, ""), HENTAITV_IMAGENES);
    if (url.protocol !== "https:") return null;
    if (!["img.hentaihaven.xxx", "coverlanyvd.org", "hentaila.tv"].includes(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function serieDesdeWp(item: WpManga): SerieHentaitv | null {
  const slug = String(item.slug ?? "").trim();
  const title = texto(item.title?.rendered);
  const original = urlOficial(item.link, slug);
  if (!item.id || !slugValido(slug) || !title || !original || mangaBloqueado(item)) return null;

  const terms = terminos(item);
  return {
    id: String(item.id),
    slug,
    title,
    cover_url: imagenSegura(item.meta?.vraven_remote_thumbnail),
    year: terms.find((term) => term.taxonomy === "wp-manga-release")?.name ?? null,
    genres: terms
      .filter((term) => term.taxonomy === "wp-manga-genre" && GENEROS_PERMITIDOS.has(Number(term.id)))
      .map((term) => String(term.name ?? ""))
      .filter(Boolean),
    url_original: original,
  };
}

export function serieHentaitvDesdePublica(item: unknown): SerieHentaitv | null {
  if (!item || typeof item !== "object") return null;
  return serieDesdeWp(item as WpManga);
}

export function fichaHentaitvDesdePublica(item: unknown): FichaHentaitv | null {
  if (!item || typeof item !== "object") return null;
  const manga = item as WpManga;
  const serie = serieDesdeWp(manga);
  if (!serie) return null;
  const author = terminos(manga).find((term) => term.taxonomy === "wp-manga-author")?.name ?? null;
  return {
    ...serie,
    description: texto(manga.content?.rendered) || null,
    author,
    total_episodes: 0,
    episodes: [],
  };
}

async function pedir(url: URL | string, fresco = false): Promise<Response> {
  const init: RequestInit & { next?: { revalidate: number } } = {
    headers: {
      "User-Agent": UA,
      Accept: "application/json,text/html,application/xhtml+xml",
      "Accept-Language": "es-ES,es;q=0.9",
      Origin: "https://www.mangatotal.com",
      Referer: "https://www.mangatotal.com/",
    },
  };
  if (fresco) init.cache = "no-store";
  else init.next = { revalidate: 300 };
  try {
    return await fetch(url, init);
  } catch {
    throw new ErrorHentaitv("No se pudo contactar con HentaiTV");
  }
}

async function releaseId(year: string): Promise<number | null> {
  if (!/^20\d{2}$|^19\d{2}$/.test(year)) return null;
  const url = new URL(`${HENTAITV_API}/wp-manga-release`);
  url.searchParams.set("slug", year);
  url.searchParams.set("per_page", "1");
  url.searchParams.set("_fields", "id");
  const res = await pedir(url);
  if (!res.ok) throw new ErrorHentaitv(`No se pudieron consultar los años de HentaiTV (${res.status})`, 502);
  const items = (await res.json()) as { id?: number }[];
  return Number(items[0]?.id) || null;
}

export async function catalogoHentaitv(
  filtros: FiltrosHentaitv = {},
  fresco = false
): Promise<CatalogoHentaitv> {
  const page = Math.max(1, Math.min(500, Math.floor(Number(filtros.page) || 1)));
  const sort = ORDENES.has(filtros.sort ?? "") ? filtros.sort! : "date_desc";
  const [orderby, order] = sort.split("_") as [string, "asc" | "desc"];
  const genre = Number(filtros.genre);
  const url = new URL(`${HENTAITV_API}/wp-manga`);
  url.searchParams.set("per_page", String(POR_PAGINA));
  url.searchParams.set("page", String(page));
  url.searchParams.set("orderby", orderby);
  url.searchParams.set("order", order);
  url.searchParams.set("wp-manga-genre_exclude", [...GENEROS_BLOQUEADOS].join(","));
  if (filtros.q?.trim()) url.searchParams.set("search", filtros.q.trim().slice(0, 120));
  if (GENEROS_PERMITIDOS.has(genre)) url.searchParams.set("wp-manga-genre", String(genre));
  if (filtros.year) {
    const id = await releaseId(filtros.year);
    if (id) url.searchParams.set("wp-manga-release", String(id));
  }

  const res = await pedir(url, fresco);
  if (!res.ok) {
    throw new ErrorHentaitv(
      res.status === 400
        ? "La pagina solicitada no existe"
        : `HentaiTV no devolvio el catalogo (${res.status})`,
      res.status === 400 ? 400 : 502
    );
  }
  const items = (await res.json()) as WpManga[];
  const series = items.map(serieDesdeWp).filter((item): item is SerieHentaitv => item !== null);
  return {
    series,
    page,
    lastPage: Math.max(1, Number(res.headers.get("x-wp-totalpages")) || 1),
    total: Math.max(0, Number(res.headers.get("x-wp-total")) || series.length),
  };
}

function atributo(tag: string, name: string): string | undefined {
  return new RegExp(`\\b${name}=["']([^"']+)["']`, "i").exec(tag)?.[1];
}

function escaparRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function episodiosDesdeHtml(html: string, slug: string): EpisodioHentaitv[] {
  const bloques = html.match(/<li\b[^>]*class=["'][^"']*hentai__chapter[^"']*["'][^>]*>[\s\S]*?<\/li>/gi) ?? [];
  const vistos = new Set<string>();
  const episodios: EpisodioHentaitv[] = [];
  for (const bloque of bloques) {
    const abreLi = bloque.match(/^<li\b[^>]*>/i)?.[0] ?? "";
    const enlace = bloque.match(/<a\b[^>]*>[\s\S]*?<\/a>/i)?.[0];
    if (!enlace) continue;
    const href = urlOficial(atributo(enlace, "href"), slug);
    if (!href) continue;
    const ruta = new URL(href).pathname;
    const match = new RegExp(`^/ver/${escaparRegex(slug)}/episodio-([a-z0-9.-]+)/?$`, "i").exec(ruta);
    if (!match || !episodioValido(match[1]) || vistos.has(match[1])) continue;
    vistos.add(match[1]);
    const img = enlace.match(/<img\b[^>]*>/i)?.[0] ?? "";
    const fecha = bloque.match(/chapter-release-date[^>]*>[\s\S]*?<i[^>]*>([\s\S]*?)<\/i>/i)?.[1];
    const titulo = texto(enlace) || `Episodio ${match[1]}`;
    episodios.push({
      id: atributo(abreLi, "data-chapter") ?? `${slug}-${match[1]}`,
      number: match[1],
      title: titulo,
      image_url: imagenSegura(atributo(img, "src")),
      published_at: texto(fecha) || null,
      url_original: href,
    });
  }
  return episodios;
}

export async function fichaHentaitv(slug: string, fresco = false): Promise<FichaHentaitv> {
  if (!slugValido(slug)) throw new ErrorHentaitv("Anime invalido", 400);
  const api = new URL(`${HENTAITV_API}/wp-manga`);
  api.searchParams.set("slug", slug);
  api.searchParams.set("_embed", "1");
  const res = await pedir(api, fresco);
  if (!res.ok) throw new ErrorHentaitv(`No se pudo cargar la ficha de HentaiTV (${res.status})`, 502);
  const item = ((await res.json()) as WpManga[])[0];
  const serie = item ? serieDesdeWp(item) : null;
  if (!item || !serie) throw new ErrorHentaitv("Contenido no disponible", 404);

  const pagina = await pedir(serie.url_original, fresco);
  if (!pagina.ok) throw new ErrorHentaitv(`No se pudieron cargar los episodios (${pagina.status})`, 502);
  const episodes = episodiosDesdeHtml(await pagina.text(), slug);
  const author = terminos(item).find((term) => term.taxonomy === "wp-manga-author")?.name ?? null;
  return {
    ...serie,
    description: texto(item.content?.rendered) || null,
    author,
    total_episodes: episodes.length,
    episodes,
  };
}

function rot13(value: string): string {
  return value.replace(/[a-z]/gi, (char) => {
    const inicio = char <= "Z" ? 65 : 97;
    return String.fromCharCode(inicio + ((char.charCodeAt(0) - inicio + 13) % 26));
  });
}

function decodificarCapaBase64(value: string): string {
  const binario = atob(value);
  const bytes = Uint8Array.from(binario, (char) => char.charCodeAt(0));
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

/**
 * Replica la transformacion publicada por player.js. El valor solo vive en
 * esta llamada: se usa para pedir el manifiesto y se descarta de inmediato.
 */
function configuracionPlayer(token: string): ConfiguracionPlayerHentaitv {
  if (!token.startsWith("sha512-") || token.length > 100_000) {
    throw new ErrorHentaitv("HentaiTV devolvio una configuracion de reproductor invalida");
  }
  let value = token.slice("sha512-".length);
  try {
    for (let capa = 0; capa < 3; capa += 1) {
      value = decodificarCapaBase64(rot13(value));
      if (value.length > 100_000) throw new Error();
    }
    const config = JSON.parse(value) as ConfiguracionPlayerHentaitv;
    if (!config || typeof config !== "object") throw new Error();
    return config;
  } catch {
    throw new ErrorHentaitv("HentaiTV cambio la configuracion de su reproductor");
  }
}

function playerDesdeHtml(html: string, episodioUrl: string): URL {
  for (const tag of html.match(/<iframe\b[^>]*>/gi) ?? []) {
    const src = atributo(tag, "src");
    if (!src) continue;
    try {
      const url = new URL(decodificarHtml(src), episodioUrl);
      if (
        url.origin === HENTAITV_WEB &&
        url.pathname === "/wp-content/plugins/player-logic/player.php" &&
        url.searchParams.has("data")
      ) {
        return url;
      }
    } catch {
      // Un iframe publicitario no debe impedir encontrar el oficial.
    }
  }
  throw new ErrorHentaitv("HentaiTV no devolvio su reproductor oficial");
}

function tokenDesdePlayer(html: string): string {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    if ((atributo(tag, "name") ?? "").toLowerCase() !== "x-secure-token") continue;
    const content = atributo(tag, "content");
    if (content) return decodificarHtml(content);
  }
  throw new ErrorHentaitv("HentaiTV no devolvio la configuracion del video");
}

function urlManifestPermitida(
  value: string,
  base?: URL,
  extensiones = [".m3u8"],
): URL {
  let url: URL;
  try {
    url = new URL(value, base);
  } catch {
    throw new ErrorHentaitv("HentaiTV devolvio un manifiesto invalido");
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== HENTAITV_MANIFEST_HOST ||
    url.port ||
    url.username ||
    url.password ||
    !extensiones.some((extension) => url.pathname.toLowerCase().endsWith(extension))
  ) {
    throw new ErrorHentaitv("HentaiTV devolvio un servidor de video no autorizado");
  }
  return url;
}

function absolutizarManifestMaestro(manifest: string, base: URL): string {
  if (
    manifest.length > 2_000_000 ||
    !manifest.trimStart().startsWith("#EXTM3U") ||
    !manifest.includes("#EXT-X-STREAM-INF") ||
    manifest.includes("#EXTINF")
  ) {
    throw new ErrorHentaitv("HentaiTV devolvio un manifiesto HLS invalido");
  }

  let variantes = 0;
  const salida = manifest.split(/\r?\n/).map((linea) => {
    const limpia = linea.trim();
    if (!limpia) return linea;
    if (!limpia.startsWith("#")) {
      variantes += 1;
      return urlManifestPermitida(limpia, base).toString();
    }
    return linea.replace(/URI=(["'])([^"']+)\1/gi, (_match, comilla: string, uri: string) => {
      const recurso = urlManifestPermitida(uri, base, [".m3u8", ".vtt"]);
      return `URI=${comilla}${recurso.toString()}${comilla}`;
    });
  });
  if (variantes === 0 || variantes > 20) {
    throw new ErrorHentaitv("HentaiTV no devolvio variantes HLS validas");
  }
  return salida.join("\n");
}

async function manifestHentaitv(episodioUrl: string): Promise<string> {
  const episodio = await pedir(episodioUrl, true);
  if (episodio.status === 404) throw new ErrorHentaitv("Episodio no encontrado", 404);
  if (!episodio.ok) throw new ErrorHentaitv(`HentaiTV respondio ${episodio.status}`);
  const playerUrl = playerDesdeHtml(await episodio.text(), episodioUrl);

  let player: Response;
  try {
    player = await fetch(playerUrl, {
      cache: "no-store",
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml",
        Referer: episodioUrl,
      },
    });
  } catch {
    throw new ErrorHentaitv("No se pudo abrir el reproductor de HentaiTV");
  }
  if (!player.ok) throw new ErrorHentaitv(`El reproductor de HentaiTV respondio ${player.status}`);

  const config = configuracionPlayer(tokenDesdePlayer(await player.text()));
  const en = typeof config.en === "string" ? config.en : "";
  const iv = typeof config.iv === "string" ? config.iv : "";
  const uri = typeof config.uri === "string" ? config.uri : "";
  if (!en || !iv || !uri || en.length > 20_000 || iv.length > 20_000 || uri.length > 500) {
    throw new ErrorHentaitv("HentaiTV devolvio datos incompletos del reproductor");
  }

  let apiUrl: URL;
  try {
    const raiz = new URL(uri, playerUrl);
    apiUrl = new URL("api.php", raiz.href.endsWith("/") ? raiz : `${raiz.href}/`);
  } catch {
    throw new ErrorHentaitv("HentaiTV devolvio una API de reproductor invalida");
  }
  if (apiUrl.origin !== HENTAITV_WEB || apiUrl.pathname !== HENTAITV_PLAYER_API) {
    throw new ErrorHentaitv("HentaiTV devolvio una API de reproductor no autorizada");
  }

  let api: Response;
  try {
    api = await fetch(apiUrl, {
      method: "POST",
      cache: "no-store",
      headers: {
        "User-Agent": UA,
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        Origin: HENTAITV_WEB,
        Referer: playerUrl.toString(),
      },
      body: new URLSearchParams({ action: "zarat_get_data_player_ajax", a: en, b: iv }),
    });
  } catch {
    throw new ErrorHentaitv("No se pudo pedir el video a HentaiTV");
  }
  if (!api.ok) throw new ErrorHentaitv(`La API de video de HentaiTV respondio ${api.status}`);

  let respuesta: RespuestaPlayerHentaitv;
  try {
    respuesta = (await api.json()) as RespuestaPlayerHentaitv;
  } catch {
    throw new ErrorHentaitv("HentaiTV devolvio datos de video invalidos");
  }
  const source = respuesta.data?.sources
    ?.map((item) => (typeof item.src === "string" ? item.src : ""))
    .find(Boolean);
  if (!respuesta.status || !source) throw new ErrorHentaitv("HentaiTV no devolvio video para este episodio");
  const manifestUrl = urlManifestPermitida(source);

  let manifest: Response;
  try {
    manifest = await fetch(manifestUrl, {
      cache: "no-store",
      headers: {
        "User-Agent": UA,
        Accept: "application/vnd.apple.mpegurl,application/x-mpegURL,text/plain,*/*",
        Referer: playerUrl.toString(),
      },
    });
  } catch {
    throw new ErrorHentaitv("No se pudo abrir el video HLS de HentaiTV");
  }
  if (!manifest.ok) throw new ErrorHentaitv(`El video HLS de HentaiTV respondio ${manifest.status}`);
  const largo = Number(manifest.headers.get("content-length"));
  if (Number.isFinite(largo) && largo > 2_000_000) {
    throw new ErrorHentaitv("HentaiTV devolvio un manifiesto HLS demasiado grande");
  }
  return absolutizarManifestMaestro(await manifest.text(), manifestUrl);
}

export async function reproduccionHentaitv(
  slug: string,
  episode: string
): Promise<ReproduccionHentaitv> {
  if (!episodioValido(episode)) throw new ErrorHentaitv("Episodio invalido", 400);
  const ficha = await fichaHentaitv(slug, true);
  const episodio = ficha.episodes.find((item) => item.number === episode);
  if (!episodio) throw new ErrorHentaitv("Episodio no encontrado", 404);
  const manifest = await manifestHentaitv(episodio.url_original);
  return {
    external_id: ficha.slug,
    slug: ficha.slug,
    series_title: ficha.title,
    cover_url: ficha.cover_url,
    total_episodes: ficha.total_episodes,
    episode_id: episodio.id,
    episode_number: episodio.number,
    episode_title: episodio.title,
    poster_url: episodio.image_url,
    sources: [{ id: "hentaitv", label: "HentaiTV", kind: "hls" }],
    selected_source: "hentaitv",
    playback: { kind: "hls", manifest },
    url_original: episodio.url_original,
  };
}
