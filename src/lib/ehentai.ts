import { isPlayStoreApp } from "./appVersion";
import { EHENTAI_POPULAR_TAGS } from "./ehentaiTags";

export const EHENTAI_NOMBRE = "E-Hentai";
export const EHENTAI_WEB = "https://e-hentai.org";
export const EHENTAI_API = "https://api.e-hentai.org/api.php";

/**
 * Categorías de E-Hentai y sus máscaras de bits.
 * En la URL de E-Hentai, f_cats contiene las categorías DESHABILITADAS,
 * por lo que el valor a enviar es: 1023 - suma_de_bits_habilitados.
 */
export const EHENTAI_CATEGORIAS: { id: string; label: string; bit: number }[] = [
  { id: "doujinshi", label: "Doujinshi", bit: 2 },
  { id: "manga", label: "Manga", bit: 4 },
  { id: "artistcg", label: "Artist CG", bit: 8 },
  { id: "gamecg", label: "Game CG", bit: 16 },
  { id: "western", label: "Western", bit: 512 },
  { id: "non-h", label: "Non-H", bit: 256 },
  { id: "imageset", label: "Image Set", bit: 32 },
  { id: "cosplay", label: "Cosplay", bit: 64 },
  { id: "asianporn", label: "Asian Porn", bit: 128 },
  { id: "misc", label: "Misc", bit: 1 },
];

/**
 * Idiomas populares para el selector en tiempo real.
 */
export const EHENTAI_IDIOMAS: { id: string; label: string; tag: string }[] = [
  { id: "todos", label: "Todos", tag: "" },
  { id: "spanish", label: "Español", tag: "language:spanish" },
  { id: "english", label: "Inglés", tag: "language:english" },
  { id: "japanese", label: "Japonés", tag: "language:japanese" },
  { id: "chinese", label: "Chino", tag: "language:chinese" },
  { id: "korean", label: "Coreano", tag: "language:korean" },
  { id: "french", label: "Francés", tag: "language:french" },
  { id: "portuguese", label: "Portugués", tag: "language:portuguese" },
  { id: "russian", label: "Ruso", tag: "language:russian" },
  { id: "german", label: "Alemán", tag: "language:german" },
  { id: "italian", label: "Italiano", tag: "language:italian" },
];

export interface SerieEhentai {
  gid: string;
  token: string;
  title: string;
  category: string;
  thumb: string;
  uploader?: string;
  posted?: string;
  filecount: number;
  tags?: string[];
}

export interface FichaEhentai extends SerieEhentai {
  title_jpn?: string;
  rating?: string;
  url_original: string;
}

export interface CatalogoEhentai {
  series: SerieEhentai[];
  pagina: number;
  hayMas: boolean;
  nextCursor?: string | null;
  prevCursor?: string | null;
}

const EH_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** Caché en memoria de servidor para catálogo y fichas de E-Hentai. */
const catalogoEhCache = new Map<string, { data: CatalogoEhentai; vence: number }>();
const fichaEhCache = new Map<string, { data: FichaEhentai; vence: number }>();

/** Namespaces reales del buscador de E-Hentai (incluye "mixed" y "other"). */
const EH_NAMESPACES = new Set([
  "language", "parody", "character", "artist", "group", "cosplayer",
  "female", "male", "mixed", "other", "reclass", "temp",
]);

/** Divide "tag, tag, tag" en etiquetas individuales sin vacíos ni repetidas. */
export function separarEtiquetasEhentai(texto: string): string[] {
  return Array.from(
    new Set(
      texto
        .split(/[,;]+/)
        .map((t) => t.trim().replace(/^"+|"+$/g, "").replace(/\$$/, "").trim())
        .filter(Boolean)
    )
  );
}

/**
 * Convierte una etiqueta a la sintaxis exacta de E-Hentai: namespace:"valor$".
 * Sin las comillas en el valor ni el `$`, E-Hentai la trata como texto libre y
 * con frases de varias palabras (o al paginar con cursor) devuelve "No hits".
 */
export function formatearEtiquetaEhentai(etiqueta: string): string {
  const limpia = etiqueta.trim().toLowerCase().replace(/^"+|"+$/g, "").replace(/\$$/, "").trim();
  const dosPuntos = limpia.indexOf(":");
  if (dosPuntos > 0) {
    let ns = limpia.slice(0, dosPuntos).trim();
    const valor = limpia.slice(dosPuntos + 1).trim().replace(/^"+|"+$/g, "").replace(/\$$/, "");
    if (ns === "series") ns = "parody";
    if (ns === "tag") return `"${valor}$"`;
    if (EH_NAMESPACES.has(ns) && valor) return `${ns}:"${valor}$"`;
  }
  const conocida = EHENTAI_POPULAR_TAGS.find(
    (t) =>
      t.tag.toLowerCase() === limpia ||
      t.label.toLowerCase() === limpia ||
      t.tag.toLowerCase().endsWith(`:${limpia}`)
  );
  if (conocida) {
    const idx = conocida.tag.indexOf(":");
    if (idx > 0) {
      const ns = conocida.tag.slice(0, idx).trim().toLowerCase();
      const val = conocida.tag.slice(idx + 1).trim().toLowerCase();
      if (EH_NAMESPACES.has(ns) && val) return `${ns}:"${val}$"`;
    }
  }
  return `"${limpia}$"`;
}

/**
 * Calcula la máscara f_cats para E-Hentai.
 * Si no hay filtro o es "todos", devuelve 0 (todas habilitadas).
 */
export function calcularFCats(categoriaId?: string): number {
  if (!categoriaId || categoriaId === "todos") return 0;
  const encontrada = EHENTAI_CATEGORIAS.find((c) => c.id.toLowerCase() === categoriaId.toLowerCase());
  if (!encontrada) return 0;
  // f_cats es la máscara de las deshabilitadas
  return 1023 - encontrada.bit;
}

/**
 * Consulta el catálogo o búsqueda de E-Hentai.
 * Respeta estrictamente la exclusión de Play Store.
 */
export async function catalogoEhentai(opciones: {
  busqueda?: string;
  categoria?: string;
  idioma?: string;
  tag?: string;
  pagina?: number;
  next?: string;
  prev?: string;
  fresco?: boolean;
}): Promise<CatalogoEhentai> {
  if (isPlayStoreApp()) {
    throw new Error("Fuente no disponible en esta edición");
  }

  const {
    busqueda = "",
    categoria = "todos",
    idioma = "todos",
    tag = "",
    pagina = 0,
    next,
    prev,
    fresco = false,
  } = opciones;

  const url = new URL(EHENTAI_WEB);
  // E-Hentai usa paginación basada en cursor (next=<gid> / prev=<gid>) en su índice principal.
  if (next) {
    url.searchParams.set("next", next);
  } else if (prev) {
    url.searchParams.set("prev", prev);
  } else if (pagina > 0) {
    url.searchParams.set("page", String(pagina));
  }

  const fCats = calcularFCats(categoria);
  if (fCats > 0) {
    url.searchParams.set("f_cats", String(fCats));
  }

  const partesBusqueda: string[] = [];
  if (busqueda.trim()) {
    const qTexto = busqueda.trim();
    const primerDosPuntos = qTexto.indexOf(":");
    const prefijoPosible = primerDosPuntos > 0 ? qTexto.slice(0, primerDosPuntos).trim().toLowerCase() : "";
    if (qTexto.includes(",") || EH_NAMESPACES.has(prefijoPosible) || prefijoPosible === "series") {
      for (const t of separarEtiquetasEhentai(qTexto)) {
        partesBusqueda.push(formatearEtiquetaEhentai(t));
      }
    } else {
      partesBusqueda.push(qTexto);
    }
  }

  if (tag && tag.trim()) {
    // Varias etiquetas separadas por coma: E-Hentai las combina con AND
    // cuando van juntas en f_search, cada una con su sintaxis exacta.
    for (const t of separarEtiquetasEhentai(tag)) {
      partesBusqueda.push(formatearEtiquetaEhentai(t));
    }
  }

  if (idioma && idioma !== "todos") {
    const idi = EHENTAI_IDIOMAS.find((i) => i.id === idioma);
    if (idi?.tag && !partesBusqueda.some((p) => p.startsWith("language:"))) {
      partesBusqueda.push(formatearEtiquetaEhentai(idi.tag));
    }
  }

  if (partesBusqueda.length > 0) {
    url.searchParams.set("f_search", partesBusqueda.join(" "));
  }

  const urlStr = url.toString();
  const ahora = Date.now();
  if (!fresco) {
    const cached = catalogoEhCache.get(urlStr);
    if (cached && cached.vence > ahora) {
      return cached.data;
    }
  }

  const res = await fetch(urlStr, {
    headers: {
      Cookie: "nw=1",
      "User-Agent": EH_UA,
    },
    ...(fresco ? { cache: "no-store" } : { next: { revalidate: 60 } }),
  });

  if (!res.ok) {
    throw new Error(`E-Hentai respondió ${res.status}`);
  }

  const html = await res.text();
  const series: SerieEhentai[] = [];

  // Recorrer filas de la tabla de galerías
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)];
  for (const row of rows) {
    const text = row[1];
    const linkMatch = text.match(/https:\/\/e-hentai\.org\/g\/(\d+)\/([a-f0-9]+)\//);
    if (!linkMatch) continue;

    const gid = linkMatch[1];
    const token = linkMatch[2];

    const titleMatch = text.match(/class="glink">([^<]+)<\/div>/);
    const catMatch =
      text.match(/class="cn ([^"]+)"[^>]*>([^<]+)<\/div>/) ||
      text.match(/class="cs ([^"]+)"[^>]*>([^<]+)<\/div>/);
    const thumbMatch =
      text.match(/data-src="([^"]+)"/) ||
      text.match(/src="(https:\/\/[^"]*ehgt[^"]+)"/);

    const pagesMatch = text.match(/<div>(\d+)\s+pages<\/div>/i);
    const uploaderMatch = text.match(/\/uploader\/([^"]+)"/);
    const postedMatch = text.match(/id="posted[^>]*>([^<]+)<\/div>/);

    const tagsMatches = [...text.matchAll(/class="gt"[^>]*title="([^"]+)"/g)].map((m) => m[1]);

    series.push({
      gid,
      token,
      title: titleMatch ? titleMatch[1].trim() : `Galería #${gid}`,
      category: catMatch ? catMatch[2].trim() : "Manga",
      thumb: thumbMatch ? (thumbMatch[1] || thumbMatch[0]) : "",
      filecount: pagesMatch ? parseInt(pagesMatch[1], 10) : 0,
      uploader: uploaderMatch ? uploaderMatch[1] : undefined,
      posted: postedMatch ? postedMatch[1] : undefined,
      tags: tagsMatches,
    });
  }

  // Ordenar estrictamente de más nuevo a más viejo por fecha / GID cronológico descendente.
  series.sort((a, b) => {
    const diff = (parseInt(b.gid, 10) || 0) - (parseInt(a.gid, 10) || 0);
    if (diff !== 0) return diff;
    if (a.posted && b.posted) return b.posted.localeCompare(a.posted);
    return 0;
  });

  // Extraer enlaces cursor de la barra de navegación (#unext / #dnext y #uprev / #dprev).
  const nextHref =
    html.match(/<a[^>]*id="[ud]next"[^>]*href="([^"]+)"/i)?.[1] ??
    html.match(/<a[^>]*href="([^"]+)"[^>]*id="[ud]next"/i)?.[1];
  const nextMatch = nextHref ? nextHref.match(/[?&](?:amp;)?next=([^&"]+)/i) : null;
  const nextCursor = nextMatch ? nextMatch[1] : null;

  const prevHref =
    html.match(/<a[^>]*id="[ud]prev"[^>]*href="([^"]+)"/i)?.[1] ??
    html.match(/<a[^>]*href="([^"]+)"[^>]*id="[ud]prev"/i)?.[1];
  const prevMatch = prevHref ? prevHref.match(/[?&](?:amp;)?prev=([^&"]+)/i) : null;
  const prevCursor = prevMatch ? prevMatch[1] : null;

  // Si E-Hentai devolvió 200 OK sin tabla de resultados ni mensaje de "No hits",
  // es una página de bloqueo temporal / anti-flood: lanzar error impide que el
  // cliente guarde un falso "Sin resultados" en caché al volver de leer una serie.
  if (
    series.length === 0 &&
    !html.includes("No hits found") &&
    !html.includes("No unfiltered results") &&
    !html.includes('class="itg')
  ) {
    throw new Error("E-Hentai limitó temporalmente las consultas, reintentá en unos segundos");
  }

  // Solo el cursor real prueba que hay otra página: buscar "page=N" en el HTML
  // daba falsos positivos y la página siguiente salía vacía.
  const hayMas = Boolean(nextCursor);

  const resultado: CatalogoEhentai = {
    series,
    pagina,
    hayMas,
    nextCursor,
    prevCursor,
  };

  if (series.length > 0) {
    if (catalogoEhCache.size >= 150) {
      const k = catalogoEhCache.keys().next().value;
      if (k !== undefined) catalogoEhCache.delete(k);
    }
    catalogoEhCache.set(urlStr, { data: resultado, vence: ahora + 90_000 });
  }

  return resultado;
}

/**
 * Obtiene los detalles completos de una galería usando la API oficial gdata de E-Hentai.
 */
export async function fichaEhentai(gid: string, token: string): Promise<FichaEhentai> {
  if (isPlayStoreApp()) {
    throw new Error("Fuente no disponible en esta edición");
  }

  const clave = `${gid}:${token}`;
  const ahora = Date.now();
  const guardada = fichaEhCache.get(clave);
  if (guardada && guardada.vence > ahora) {
    return guardada.data;
  }

  const apiRes = await fetch(EHENTAI_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      method: "gdata",
      gidlist: [[parseInt(gid, 10), token]],
      namespace: 1,
    }),
    next: { revalidate: 3600 },
  });

  if (!apiRes.ok) {
    throw new Error(`La API de E-Hentai respondió ${apiRes.status}`);
  }

  const json = (await apiRes.json()) as { gmetadata?: any[] };
  const meta = json.gmetadata?.[0];

  if (!meta || meta.error) {
    throw new Error(meta?.error || "Galería no encontrada en E-Hentai");
  }

  const ficha: FichaEhentai = {
    gid,
    token,
    title: meta.title || `Galería #${gid}`,
    title_jpn: meta.title_jpn || undefined,
    category: meta.category || "Doujinshi",
    thumb: meta.thumb || "",
    uploader: meta.uploader || "",
    posted: meta.posted ? new Date(parseInt(meta.posted, 10) * 1000).toISOString() : undefined,
    filecount: parseInt(meta.filecount, 10) || 0,
    rating: meta.rating || undefined,
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    url_original: `${EHENTAI_WEB}/g/${gid}/${token}/`,
  };

  if (fichaEhCache.size >= 300) {
    const first = fichaEhCache.keys().next().value;
    if (first !== undefined) fichaEhCache.delete(first);
  }
  fichaEhCache.set(clave, { data: ficha, vence: ahora + 30 * 60_000 });
  return ficha;
}

// Caché en memoria para las páginas ya resueltas de una galería y visores individuales
const paginasCache = new Map<string, { paginas: string[]; vence: number }>();
const visorImagenCache = new Map<string, { imgUrl: string; vence: number }>();

/**
 * Resuelve la URL de imagen directa (<img id="img" src="...">) a partir de un enlace de visor
 * de E-Hentai (https://e-hentai.org/s/{pageToken}/{gid}-{num}).
 */
export async function resolverImagenVisorEhentai(viewerUrl: string): Promise<string | null> {
  const ahora = Date.now();
  const cached = visorImagenCache.get(viewerUrl);
  if (cached && cached.vence > ahora) {
    return cached.imgUrl;
  }

  try {
    const res = await fetch(viewerUrl, {
      headers: {
        Cookie: "nw=1",
        "User-Agent": EH_UA,
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/<img id="img"[^>]+src="([^"]+)"/);
    if (match && match[1]) {
      if (visorImagenCache.size >= 2500) {
        const first = visorImagenCache.keys().next().value;
        if (first !== undefined) visorImagenCache.delete(first);
      }
      visorImagenCache.set(viewerUrl, {
        imgUrl: match[1],
        vence: ahora + 90 * 60_000,
      });
      return match[1];
    }
  } catch {
    // Error puntual de red
  }
  return null;
}

/**
 * Obtiene las URLs de las imágenes de una galería para el lector y la descarga.
 * Resuelve de inmediato las primeras páginas para que el lector abra en menos de 1 segundo
 * incluso en galerías de 200+ páginas o con mala señal (H+), y delega el resto a resolución
 * bajo demanda en /api/externo/imagen mientras pre-resuelve en segundo plano.
 */
export async function paginasEhentai(gid: string, token: string): Promise<string[]> {
  if (isPlayStoreApp()) {
    throw new Error("Fuente no disponible en esta edición");
  }

  const claveCache = `${gid}:${token}`;
  const enCache = paginasCache.get(claveCache);
  if (enCache && enCache.vence > Date.now()) {
    return enCache.paginas;
  }

  // 1. Obtener la primera página de índice (?p=0) y la ficha en paralelo
  const [ficha, resP0] = await Promise.all([
    fichaEhentai(gid, token),
    fetch(`${EHENTAI_WEB}/g/${gid}/${token}/?p=0`, {
      headers: { Cookie: "nw=1", "User-Agent": EH_UA },
    }),
  ]);

  const totalPaginas = ficha.filecount;
  if (totalPaginas <= 0) return [];

  const htmlP0 = resP0.ok ? await resP0.text() : "";
  const regexVisor = new RegExp(`https:\\/\\/e-hentai\\.org\\/s\\/([a-f0-9]+)\\/${gid}-(\\d+)`, "g");
  const matchesP0 = [...htmlP0.matchAll(regexVisor)].map((m) => ({
    url: m[0],
    num: parseInt(m[2], 10),
  }));

  // E-Hentai muestra 20 o 40 miniaturas por página de índice según su configuración por defecto
  const porPaginaIndice = matchesP0.length > 20 ? 40 : 20;
  const paginasIndice = Math.ceil(totalPaginas / porPaginaIndice);
  const viewerLinks = new Array<string>(totalPaginas);

  for (const item of matchesP0) {
    if (item.num >= 1 && item.num <= totalPaginas) {
      viewerLinks[item.num - 1] = item.url;
    }
  }

  if (paginasIndice > 1) {
    const indicesRestantes = Array.from({ length: paginasIndice - 1 }, (_, i) => i + 1);
    const LOTE_INDICE = 8;
    for (let i = 0; i < indicesRestantes.length; i += LOTE_INDICE) {
      const lote = indicesRestantes.slice(i, i + LOTE_INDICE);
      const resLotes = await Promise.all(
        lote.map(async (indice) => {
          try {
            const url = `${EHENTAI_WEB}/g/${gid}/${token}/?p=${indice}`;
            const res = await fetch(url, {
              headers: { Cookie: "nw=1", "User-Agent": EH_UA },
            });
            if (!res.ok) return [];
            const html = await res.text();
            return [...html.matchAll(regexVisor)].map((m) => ({
              url: m[0],
              num: parseInt(m[2], 10),
            }));
          } catch {
            return [];
          }
        })
      );
      for (const items of resLotes) {
        for (const item of items) {
          if (item.num >= 1 && item.num <= totalPaginas) {
            viewerLinks[item.num - 1] = item.url;
          }
        }
      }
    }
  }

  const linksValidos = viewerLinks.filter(Boolean);
  if (linksValidos.length === 0) {
    throw new Error("No se pudieron obtener las páginas de la galería");
  }

  // 2. Resolver solo las primeras 4 páginas para que el lector abra al instante
  // y delegar el resto a resolución bajo demanda en /api/externo/imagen?u=<viewerUrl>
  // a medida que el usuario hace scroll. Descargar los 200 visores de golpe activaba
  // el límite anti-flood de E-Hentai y hacía fallar el catálogo al volver atrás.
  const EAGER_COUNT = Math.min(4, linksValidos.length);
  const primerasResueltas = await Promise.all(
    linksValidos.slice(0, EAGER_COUNT).map(async (vUrl) => {
      const directa = await resolverImagenVisorEhentai(vUrl);
      return directa || `/api/externo/imagen?u=${encodeURIComponent(vUrl)}`;
    })
  );

  const paginasFinales = linksValidos.map((vUrl, idx) => {
    if (idx < EAGER_COUNT) return primerasResueltas[idx];
    const yaEnCache = visorImagenCache.get(vUrl);
    if (yaEnCache && yaEnCache.vence > Date.now()) return yaEnCache.imgUrl;
    return `/api/externo/imagen?u=${encodeURIComponent(vUrl)}`;
  });

  paginasCache.set(claveCache, {
    paginas: paginasFinales,
    vence: Date.now() + 90 * 60_000,
  });

  return paginasFinales;
}
