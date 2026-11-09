/**
 * Adaptador de MundoDonghua (animes y animaciones chinas - Donghua).
 *
 * Sigue el mismo contrato de JKAnime y TioAnime:
 * - Catálogo público (/lista-donghuas, /lista-donghuas-emision, etc.) y búsqueda (/busquedas/{q}).
 * - Ficha (/donghua/{slug}) con sinopsis, portada, géneros y lista de episodios.
 * - Reproductor (/ver/{slug}/{episodio}) extrayendo los iframes oficiales de VOE, Filemoon,
 *   VidHide y StreamWish mediante desempaquetado de scripts de Dean Edwards.
 * - Sin descargar ni retransmitir video en Vercel para preservar cuotas de CPU.
 * - Reproductor embebido con sandbox estricto para evitar ventanas emergentes, redirecciones y bloqueos.
 */

export const MUNDODONGHUA_NOMBRE = "MundoDonghua";
export const MUNDODONGHUA_WEB = "https://www.mundodonghua.com";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 MangaTotal/1.0";
const EPISODIOS_POR_PAGINA = 30;

export interface SerieMundodonghua {
  slug: string;
  title: string;
  cover_url: string | null;
  type: string | null;
  status: string | null;
  url_original: string;
}

export interface EpisodioMundodonghua {
  id: string;
  number: string;
  title: string;
  image_url: string | null;
  published_at: string | null;
}

export interface FichaMundodonghua {
  id: string;
  slug: string;
  title: string;
  alternative_title: string | null;
  description: string | null;
  cover_url: string | null;
  type: string | null;
  status: string | null;
  genres: string[];
  total_episodes: number;
  episodes: EpisodioMundodonghua[];
  page: number;
  last_page: number;
  url_original: string;
}

export interface FuenteEpisodioMundodonghua {
  id: "voe" | "filemoon" | "vidhide" | "streamwish";
  label: "VOE" | "Filemoon" | "VidHide" | "StreamWish";
  kind: "embed";
}

export interface ReproduccionMundodonghua {
  external_id: string;
  slug: string;
  series_title: string;
  cover_url: string | null;
  total_episodes: number;
  episode_id: string;
  episode_number: string;
  episode_title: string;
  poster_url: string | null;
  sources: FuenteEpisodioMundodonghua[];
  selected_source: string;
  playback: { kind: "embed"; url: string };
  url_original: string;
}

export interface FiltrosMundodonghua {
  q?: string;
  page?: number;
  status?: string; // "emision" | "finalizados" | "recopilados" | "todos"
  genero?: string;
}

export class ErrorMundodonghua extends Error {
  readonly status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

export const GENEROS_MUNDODONGHUA: [string, string][] = [
  ["Acción", "Acción"],
  ["Artes Marciales", "Artes Marciales"],
  ["Aventura", "Aventura"],
  ["Ciencia Ficción", "Ciencia Ficción"],
  ["Comedia", "Comedia"],
  ["Cultivación", "Cultivación"],
  ["Demonios", "Demonios"],
  ["Drama", "Drama"],
  ["Fantasía", "Fantasía"],
  ["Harem", "Harem"],
  ["Histórico", "Histórico"],
  ["Magia", "Magia"],
  ["Misterio", "Misterio"],
  ["Reencarnación", "Reencarnación"],
  ["Romance", "Romance"],
  ["Sobrenatural", "Sobrenatural"],
  ["Viaje en el Tiempo", "Viaje en el Tiempo"],
];

function urlAbsoluta(rutaOUrl: string): string {
  if (!rutaOUrl) return "";
  if (rutaOUrl.startsWith("http://") || rutaOUrl.startsWith("https://")) {
    return rutaOUrl;
  }
  return `${MUNDODONGHUA_WEB}${rutaOUrl.startsWith("/") ? "" : "/"}${rutaOUrl}`;
}

/** Limpia entidades HTML frecuentes (&#039;, &quot;, &amp;, etc.). */
export function decodificarEntidades(texto: string): string {
  if (!texto) return "";
  return texto
    .replace(/&#0*39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, dec) => {
      try {
        return String.fromCharCode(Number(dec));
      } catch {
        return "";
      }
    });
}

/** Desempaqueta bloques protegidos con el compresor Dean Edwards Packer. */
export function desempaquetarDeanEdwards(texto: string): string[] {
  const bloques: string[] = [];
  const regex =
    /eval\s*\(\s*function\s*\(\s*p\s*,\s*a\s*,\s*c\s*,\s*k\s*,\s*e\s*,\s*[rd]\s*\)[\s\S]*?\.split\s*\(\s*['"]\|['"]\s*\)\s*,\s*0\s*,\s*\{?\s*\}?\s*\)\s*\)/g;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(texto)) !== null) {
    const codigo = match[0];
    try {
      // Reemplazamos el 'eval(' inicial por '(' para que la función anónima retorne 'p'
      // como cadena de texto en vez de ejecutarla en el entorno global.
      const invocacion = codigo.replace(/^eval\s*\(/, "(");
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const ejecutor = new Function("return " + invocacion);
      const decodificado = ejecutor();
      if (typeof decodificado === "string") {
        bloques.push(decodificado);
      }
    } catch {
      // Si un bloque individual falla al desempaquetarse se ignora para no cortar los demás.
    }
  }
  return bloques;
}

/**
 * Consulta el catálogo público de MundoDonghua.
 */
export async function catalogoMundodonghua(
  filtros: FiltrosMundodonghua = {},
  fresco = false
): Promise<{
  series: SerieMundodonghua[];
  page: number;
  lastPage: number;
  total: number | null;
}> {
  const page = Math.max(1, Math.floor(Number(filtros.page) || 1));
  const query = filtros.q?.trim() || "";
  const genero = filtros.genero?.trim() || "";
  const status = filtros.status?.trim() || "";

  let urlRemota = "";
  if (query) {
    // La búsqueda oficial de MundoDonghua se procesa por ruta /busquedas/{texto}
    urlRemota = `${MUNDODONGHUA_WEB}/busquedas/${encodeURIComponent(query)}`;
  } else if (genero) {
    // Filtrado por género oficial /genero/{genero}
    urlRemota = `${MUNDODONGHUA_WEB}/genero/${encodeURIComponent(genero)}`;
  } else if (status === "emision") {
    urlRemota =
      page > 1
        ? `${MUNDODONGHUA_WEB}/lista-donghuas-emision/${page}`
        : `${MUNDODONGHUA_WEB}/lista-donghuas-emision`;
  } else if (status === "finalizados") {
    urlRemota =
      page > 1
        ? `${MUNDODONGHUA_WEB}/lista-donghuas-finalizados/${page}`
        : `${MUNDODONGHUA_WEB}/lista-donghuas-finalizados`;
  } else if (status === "recopilados") {
    urlRemota =
      page > 1
        ? `${MUNDODONGHUA_WEB}/lista-donghuas-recopilados/${page}`
        : `${MUNDODONGHUA_WEB}/lista-donghuas-recopilados`;
  } else {
    urlRemota =
      page > 1
        ? `${MUNDODONGHUA_WEB}/lista-donghuas/${page}`
        : `${MUNDODONGHUA_WEB}/lista-donghuas`;
  }

  const res = await fetch(urlRemota, {
    headers: { "User-Agent": UA },
    cache: fresco ? "no-store" : "default",
    next: fresco ? undefined : { revalidate: 300 },
  });

  if (!res.ok) {
    throw new ErrorMundodonghua(
      `MundoDonghua respondió ${res.status}`,
      res.status === 404 ? 404 : 502
    );
  }

  const html = await res.text();

  // Extracción de tarjetas .md-card
  const series: SerieMundodonghua[] = [];
  const cardRegex =
    /<div class="md-card">[\s\S]*?<a[^>]*href=["'](?:https?:\/\/www\.mundodonghua\.com)?\/donghua\/([a-zA-Z0-9-]+)["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/div>/gi;

  let match: RegExpExecArray | null;
  const slugsVistos = new Set<string>();

  while ((match = cardRegex.exec(html)) !== null) {
    const slug = match[1];
    if (slugsVistos.has(slug)) continue;
    slugsVistos.add(slug);

    const cuerpo = match[2];
    const imgMatch = cuerpo.match(/<img[^>]*src=["']([^"']+)["']/i);
    const titleMatch =
      cuerpo.match(/<h[1-6][^>]*class=["'][^"']*md-card-title[^"']*["'][^>]*>([^<]+)<\/h[1-6]>/i) ||
      cuerpo.match(/<img[^>]*alt=["']([^"']+)["']/i);
    const badgeMatch = cuerpo.match(/<span[^>]*class=["'][^"']*md-card-badge[^"']*["'][^>]*>([^<]+)<\/span>/i);

    const title = titleMatch ? decodificarEntidades(titleMatch[1].trim()) : slug;
    const cover_url = imgMatch ? urlAbsoluta(imgMatch[1]) : null;
    const type = badgeMatch ? badgeMatch[1].trim() : "Donghua";

    series.push({
      slug,
      title,
      cover_url,
      type,
      status: null,
      url_original: `${MUNDODONGHUA_WEB}/donghua/${slug}`,
    });
  }

  // Si fue búsqueda o género y hay muchas tarjetas, paginamos en memoria si la página remota no ofrece paginador
  let lastPage = 1;
  const paginadorMatch = html.match(/<nav class="md-pagination">([\s\S]*?)<\/nav>/i);
  if (paginadorMatch) {
    const nums = [...paginadorMatch[1].matchAll(/\/(\d+)["']/g)].map((m) => Number(m[1]));
    if (nums.length > 0) {
      lastPage = Math.max(1, ...nums);
    }
  }

  // Para búsquedas o filtros que traen toda la lista de golpe, paginamos en bloques de 24
  let seriesPaginadas = series;
  if (!paginadorMatch && series.length > 24) {
    lastPage = Math.ceil(series.length / 24);
    const inicio = (page - 1) * 24;
    seriesPaginadas = series.slice(inicio, inicio + 24);
  }

  return {
    series: seriesPaginadas,
    page,
    lastPage,
    total: series.length,
  };
}

/**
 * Obtiene la ficha completa de un donghua y su listado de episodios.
 */
export async function fichaMundodonghua(
  slug: string,
  page = 1
): Promise<FichaMundodonghua> {
  const limpio = slug.trim().toLowerCase();
  if (!/^[a-z0-9-]+$/.test(limpio)) {
    throw new ErrorMundodonghua("Identificador de donghua inválido", 400);
  }

  const url = `${MUNDODONGHUA_WEB}/donghua/${limpio}`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    next: { revalidate: 600 },
  });

  if (res.status === 404) {
    throw new ErrorMundodonghua("Donghua no encontrado en MundoDonghua", 404);
  }
  if (!res.ok) {
    throw new ErrorMundodonghua(`MundoDonghua respondió ${res.status}`, 502);
  }

  const html = await res.text();

  // Título
  const titleMatch =
    html.match(/<h1[^>]*class=["'][^"']*md-detail-title[^"']*["'][^>]*>([^<]+)<\/h1>/i) ||
    html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  const title = titleMatch ? decodificarEntidades(titleMatch[1].trim()) : limpio;

  // Portada
  const posterMatch =
    html.match(/<div class="md-detail-poster">[\s\S]*?<img[^>]*src=["']([^"']+)["']/i) ||
    html.match(/<img[^>]*src=["']([^"']+)["'][^>]*alt=["'][^"']*["']/i);
  const cover_url = posterMatch ? urlAbsoluta(posterMatch[1]) : null;

  // Sinopsis
  const synMatch = html.match(/<p class="md-detail-synopsis">([\s\S]*?)<\/p>/i);
  const description = synMatch
    ? decodificarEntidades(
        synMatch[1]
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<[^>]+>/g, "")
          .trim()
      )
    : null;

  // Estado y tipo
  const emisionMatch = html.match(/<span class="md-emision-badge"[^>]*>([^<]+)<\/span>/i);
  const status = emisionMatch ? emisionMatch[1].trim() : "En Emisión";

  const typeMatch = html.match(/<span class="md-card-badge[^"]*">([^<]+)<\/span>/i);
  const type = typeMatch ? typeMatch[1].trim() : "Donghua";

  // Géneros
  const genres: string[] = [];
  const genreMatches = [
    ...html.matchAll(/<a[^>]*class=["'][^"']*md-genre-tag[^"']*["'][^>]*>([^<]+)<\/a>/gi),
  ];
  for (const g of genreMatches) {
    const nombre = g[1].trim();
    if (nombre && !genres.includes(nombre)) {
      genres.push(nombre);
    }
  }

  // Lista de episodios
  // Formato: <li class="md-episode-item" data-ep="165"><a href="/ver/renegade-immortal/165" class="md-ep-link">...
  const allEpisodes: EpisodioMundodonghua[] = [];
  const epRegex =
    /<li[^>]*class=["'][^"']*md-episode-item[^"']*["'][^>]*data-ep=["']([^"']+)["'][\s\S]*?<a[^>]*href=["']([^"']+)["'][\s\S]*?<img[^>]*src=["']([^"']+)["'][\s\S]*?<h[1-6][^>]*>([^<]+)<\/h[1-6]>/gi;

  let epMatch: RegExpExecArray | null;
  const epsVistos = new Set<string>();

  while ((epMatch = epRegex.exec(html)) !== null) {
    const num = epMatch[1].trim();
    if (epsVistos.has(num)) continue;
    epsVistos.add(num);

    const href = epMatch[2].trim();
    const imgSrc = epMatch[3].trim();
    const epTitle = epMatch[4].trim();

    allEpisodes.push({
      id: num,
      number: num,
      title: epTitle || `Episodio ${num}`,
      image_url: imgSrc ? urlAbsoluta(imgSrc) : null,
      published_at: null,
    });
  }

  // Si la regex estricta no encontró episodios, probamos búsqueda flexible de enlaces /ver/{slug}/{num}
  if (allEpisodes.length === 0) {
    const simpleEpRegex =
      /href=["'](?:https?:\/\/www\.mundodonghua\.com)?\/ver\/[a-zA-Z0-9-]+\/(\d+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
    let sMatch: RegExpExecArray | null;
    while ((sMatch = simpleEpRegex.exec(html)) !== null) {
      const num = sMatch[1];
      if (epsVistos.has(num)) continue;
      epsVistos.add(num);

      const epTitle = sMatch[2].replace(/<[^>]+>/g, " ").trim();
      allEpisodes.push({
        id: num,
        number: num,
        title: epTitle || `Episodio ${num}`,
        image_url: cover_url,
        published_at: null,
      });
    }
  }

  // Orden descendente por número de episodio (más reciente primero, similar a TioAnime)
  allEpisodes.sort((a, b) => Number(b.number) - Number(a.number));

  const total = allEpisodes.length;
  const last_page = Math.max(1, Math.ceil(total / EPISODIOS_POR_PAGINA));
  const currentPage = Math.min(Math.max(1, page), last_page);
  const inicio = (currentPage - 1) * EPISODIOS_POR_PAGINA;
  const paginados = allEpisodes.slice(inicio, inicio + EPISODIOS_POR_PAGINA);

  return {
    id: limpio,
    slug: limpio,
    title,
    alternative_title: null,
    description,
    cover_url,
    type,
    status,
    genres,
    total_episodes: total,
    episodes: paginados,
    page: currentPage,
    last_page,
    url_original: url,
  };
}

/**
 * Resuelve la reproducción oficial de un episodio de MundoDonghua.
 * Desempaqueta los scripts de Dean Edwards y extrae los servidores permitidos (VOE, Filemoon, VidHide, StreamWish).
 */
export async function reproduccionMundodonghua(
  slug: string,
  episode: string,
  sourceId?: string | null
): Promise<ReproduccionMundodonghua> {
  const limpioSlug = slug.trim().toLowerCase();
  const limpioEp = episode.trim();

  if (!/^[a-z0-9-]+$/.test(limpioSlug) || !/^\d+$/.test(limpioEp)) {
    throw new ErrorMundodonghua("Parámetros de reproducción inválidos", 400);
  }

  const url = `${MUNDODONGHUA_WEB}/ver/${limpioSlug}/${limpioEp}`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    cache: "no-store",
  });

  if (res.status === 404) {
    throw new ErrorMundodonghua("Episodio no encontrado en MundoDonghua", 404);
  }
  if (!res.ok) {
    throw new ErrorMundodonghua(`MundoDonghua respondió ${res.status}`, 502);
  }

  const html = await res.text();

  // Título de la serie y episodio
  const titleMatch =
    html.match(/<h1[^>]*class=["'][^"']*md-player-episode-title[^"']*["'][^>]*>([^<]+)<\/h1>/i) ||
    html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  const episode_title = titleMatch ? decodificarEntidades(titleMatch[1].trim()) : `Episodio ${limpioEp}`;

  const seriesLinkMatch = html.match(/<a[^>]*class=["'][^"']*md-player-back[^"']*["'][^>]*>[\s\S]*?<span>([^<]+)<\/span>/i);
  const series_title = seriesLinkMatch ? decodificarEntidades(seriesLinkMatch[1].trim()) : limpioSlug;

  // Desempaquetado de scripts para extraer reproductores si se usan funciones dinámicas
  const bloquesDesempaquetados = desempaquetarDeanEdwards(html);

  // Mapeo de servidores soportados
  const servidoresEncontrados: { id: FuenteEpisodioMundodonghua["id"]; label: FuenteEpisodioMundodonghua["label"]; url: string }[] = [];

  // Analizamos tanto el HTML directo como los bloques de código desempaquetados
  const textosParaAnalizar = [html, ...bloquesDesempaquetados];

  for (const texto of textosParaAnalizar) {
    // VOE
    const voeMatch = texto.match(/https?:\/\/(?:[a-zA-Z0-9-]+\.)?voe\.sx\/e\/[a-zA-Z0-9_-]+/i);
    if (voeMatch && !servidoresEncontrados.some((s) => s.id === "voe")) {
      servidoresEncontrados.push({ id: "voe", label: "VOE", url: voeMatch[0] });
    }

    // Filemoon (bysekoze.com o filemoon.sx/to)
    const fmoonMatch =
      texto.match(/https?:\/\/(?:[a-zA-Z0-9-]+\.)?bysekoze\.com\/e\/[a-zA-Z0-9_-]+/i) ||
      texto.match(/https?:\/\/(?:[a-zA-Z0-9-]+\.)?filemoon\.[a-z]{2,4}\/e\/[a-zA-Z0-9_-]+/i);
    if (fmoonMatch && !servidoresEncontrados.some((s) => s.id === "filemoon")) {
      servidoresEncontrados.push({ id: "filemoon", label: "Filemoon", url: fmoonMatch[0] });
    }

    // VidHide (vidhidepro.com o vidhide.com)
    const vhideMatch = texto.match(/https?:\/\/(?:[a-zA-Z0-9-]+\.)?vidhide[a-z0-9-]*\.[a-z]{2,4}\/v\/[a-zA-Z0-9_-]+/i);
    if (vhideMatch && !servidoresEncontrados.some((s) => s.id === "vidhide")) {
      servidoresEncontrados.push({ id: "vidhide", label: "VidHide", url: vhideMatch[0] });
    }

    // StreamWish (embedwish.com o streamwish.to)
    const swishMatch =
      texto.match(/https?:\/\/(?:[a-zA-Z0-9-]+\.)?embedwish\.com\/e\/[a-zA-Z0-9_-]+/i) ||
      texto.match(/https?:\/\/(?:[a-zA-Z0-9-]+\.)?streamwish\.[a-z]{2,4}\/e\/[a-zA-Z0-9_-]+/i);
    if (swishMatch && !servidoresEncontrados.some((s) => s.id === "streamwish")) {
      servidoresEncontrados.push({ id: "streamwish", label: "StreamWish", url: swishMatch[0] });
    }
  }

  if (servidoresEncontrados.length === 0) {
    throw new ErrorMundodonghua("No se encontraron servidores de video compatibles para este episodio", 502);
  }

  // Prioridad por defecto: VOE (muy estable y fluido) > Filemoon > VidHide > StreamWish
  const prioridad: FuenteEpisodioMundodonghua["id"][] = ["voe", "filemoon", "vidhide", "streamwish"];
  servidoresEncontrados.sort((a, b) => prioridad.indexOf(a.id) - prioridad.indexOf(b.id));

  // Selección de fuente
  const seleccionada =
    (sourceId && servidoresEncontrados.find((s) => s.id === sourceId)) ||
    servidoresEncontrados[0];

  const sources: FuenteEpisodioMundodonghua[] = servidoresEncontrados.map((s) => ({
    id: s.id,
    label: s.label,
    kind: "embed",
  }));

  return {
    external_id: limpioSlug,
    slug: limpioSlug,
    series_title,
    cover_url: null,
    total_episodes: 0,
    episode_id: limpioEp,
    episode_number: limpioEp,
    episode_title,
    poster_url: null,
    sources,
    selected_source: seleccionada.id,
    playback: {
      kind: "embed",
      url: (() => {
        if (seleccionada.id === "filemoon") {
          const codeMatch = seleccionada.url.match(/\/e\/([a-zA-Z0-9_-]+)/i);
          if (codeMatch) {
            return `/api/anime/mundodonghua/embed/filemoon/${codeMatch[1]}`;
          }
        }
        return seleccionada.url;
      })(),
    },
    url_original: url,
  };
}

/** Comprueba si el donghua está clasificado como adulto (por defecto falso para animación china pública). */
export async function esAdultoMundodonghua(_slug: string): Promise<boolean> {
  return false;
}
