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

/** Namespaces reales del buscador de E-Hentai (incluye "mixed", "other" y "location"). */
const EH_NAMESPACES = new Set([
  "language", "parody", "character", "artist", "group", "cosplayer",
  "female", "male", "mixed", "other", "reclass", "temp", "location",
]);

/**
 * Abreviaturas que E-Hentai acepta en su buscador (f:, m:, x:...). Sin esto,
 * "f:maid" se mandaba como texto libre y no coincidía con ninguna etiqueta.
 */
const EH_ABREVIATURAS: Record<string, string> = {
  l: "language", lang: "language", p: "parody", series: "parody",
  c: "character", char: "character", a: "artist", g: "group", circle: "group",
  cos: "cosplayer", f: "female", m: "male", x: "mixed", o: "other",
  r: "reclass", loc: "location",
};

function normalizarComparable(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function capitalizarEtiqueta(nombre: string): string {
  return nombre.replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

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
    const valor = limpia.slice(dosPuntos + 1).trim().replace(/^"+|"+$/g, "").replace(/\$$/, "").trim();
    ns = EH_ABREVIATURAS[ns] ?? ns;
    if (ns === "tag" || ns === "temp") return `"${valor}$"`;
    if (EH_NAMESPACES.has(ns) && valor) return `${ns}:"${valor}$"`;
  }
  const comp = normalizarComparable(limpia);
  const conocida = EHENTAI_POPULAR_TAGS.find(
    (t) =>
      t.tag.toLowerCase() === limpia ||
      normalizarComparable(t.label) === comp ||
      t.tag.toLowerCase().endsWith(`:${limpia}`) ||
      t.aliases?.some((a) => normalizarComparable(a) === comp)
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

function extraerSeriesDeHtmlEhentai(html: string): SerieEhentai[] {
  const series: SerieEhentai[] = [];
  const vistos = new Set<string>();

  const bloquesTr = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => m[1]);
  // Respaldo defensivo si algún nodo sirve vista de miniaturas (<div class="gl1t">...)
  const bloques =
    bloquesTr.some((b) => /https:\/\/e-hentai\.org\/g\/\d+\/[a-f0-9]+\//.test(b))
      ? bloquesTr
      : html.split(/<div\s+class="gl1t">/i).slice(1);

  for (const text of bloques) {
    const linkMatch = text.match(/https:\/\/e-hentai\.org\/g\/(\d+)\/([a-f0-9]+)\//);
    if (!linkMatch) continue;

    const gid = linkMatch[1];
    const token = linkMatch[2];
    if (vistos.has(gid)) continue;
    vistos.add(gid);

    const titleMatch = text.match(/class="[^"]*\bglink\b[^"]*">([^<]+)<\/div>/);
    const catMatch =
      text.match(/class="cn ([^"]+)"[^>]*>([^<]+)<\/div>/) ||
      text.match(/class="cs ([^"]+)"[^>]*>([^<]+)<\/div>/);
    const thumbMatch =
      text.match(/data-src="([^"]+)"/) ||
      text.match(/src="(https:\/\/[^"]*(?:ehgt|exhentai)[^"]+)"/);

    const pagesMatch = text.match(/<div>(\d+)\s+pages?<\/div>/i);
    const uploaderTextMatch = text.match(/\/uploader\/[^"]+">([^<]+)<\/a>/);
    const uploaderHrefMatch = text.match(/\/uploader\/([^"]+)"/);
    let uploader: string | undefined;
    if (uploaderTextMatch?.[1]) {
      uploader = uploaderTextMatch[1].trim();
    } else if (uploaderHrefMatch?.[1]) {
      try {
        uploader = decodeURIComponent(uploaderHrefMatch[1]);
      } catch {
        uploader = uploaderHrefMatch[1];
      }
    }
    const postedMatch = text.match(/id="posted[^>]*>([^<]+)<\/div>/);

    // En E-Hentai las etiquetas sólidas llevan class="gt", las punteadas "gtl" y las débiles "gtw".
    const tagsMatches = [...text.matchAll(/class="gt[lw]?"[^>]*title="([^"]+)"/g)]
      .map((m) => m[1].trim())
      .filter(Boolean);

    series.push({
      gid,
      token,
      title: titleMatch ? titleMatch[1].trim() : `Galería #${gid}`,
      category: catMatch ? catMatch[2].trim() : "Manga",
      thumb: thumbMatch ? (thumbMatch[1] || thumbMatch[0]) : "",
      filecount: pagesMatch ? parseInt(pagesMatch[1], 10) : 0,
      uploader,
      posted: postedMatch ? postedMatch[1] : undefined,
      tags: tagsMatches,
    });
  }

  return series;
}

/**
 * Construye el enlace directo `/tag/{ns}:{valor}` que usa E-Hentai en sus fichas
 * cuando se filtra por una única etiqueta sin categoría ni texto adicional.
 * Ese índice B-tree evita el enfriamiento por IP de Sphinx (`/?f_search=`).
 */
function construirUrlTagDirecto(
  etiquetaCruda: string,
  opciones: { next?: string; prev?: string; pagina?: number }
): string | null {
  const limpia = etiquetaCruda.trim().toLowerCase().replace(/^"+|"+$/g, "").replace(/\$$/, "").trim();
  const dp = limpia.indexOf(":");
  let ns = "temp";
  let valor = limpia;
  if (dp > 0) {
    ns = EH_ABREVIATURAS[limpia.slice(0, dp).trim()] ?? limpia.slice(0, dp).trim();
    valor = limpia.slice(dp + 1).trim().replace(/^"+|"+$/g, "").replace(/\$$/, "").trim();
  }
  if (!valor || (!EH_NAMESPACES.has(ns) && ns !== "tag")) return null;
  if (ns === "tag") ns = "temp";
  const slugTag = `${ns}:${encodeURIComponent(valor).replace(/%20/g, "+")}`;
  const u = new URL(`${EHENTAI_WEB}/tag/${slugTag}`);
  if (opciones.next) u.searchParams.set("next", opciones.next);
  else if (opciones.prev) u.searchParams.set("prev", opciones.prev);
  else if (opciones.pagina && opciones.pagina > 0) u.searchParams.set("page", String(opciones.pagina));
  return u.toString();
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

  const etiquetasPedidas = tag && tag.trim() ? separarEtiquetasEhentai(tag) : [];
  const partesBusqueda: string[] = [];
  if (busqueda.trim()) {
    const qTexto = busqueda.trim();
    const primerDosPuntos = qTexto.indexOf(":");
    const prefijoPosible = primerDosPuntos > 0 ? qTexto.slice(0, primerDosPuntos).trim().toLowerCase() : "";
    if (
      qTexto.includes(",") ||
      EH_NAMESPACES.has(prefijoPosible) ||
      Object.hasOwn(EH_ABREVIATURAS, prefijoPosible) ||
      prefijoPosible === "tag"
    ) {
      for (const t of separarEtiquetasEhentai(qTexto)) {
        partesBusqueda.push(formatearEtiquetaEhentai(t));
      }
    } else {
      partesBusqueda.push(qTexto);
    }
  }

  for (const t of etiquetasPedidas) {
    partesBusqueda.push(formatearEtiquetaEhentai(t));
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

  // En servidores de EE. UU. / centros de datos, E-Hentai aplica filtros por omisión
  // para invitados (excluyendo p. ej. `other:ai generated` o `female:lolicon`) y
  // responde "No unfiltered results" con lista vacía. `advsearch=1` + `f_sfl/f_sfu/f_sft=on`
  // desactiva explícitamente los filtros por defecto de idioma, uploader y etiquetas.
  if (partesBusqueda.length > 0 || fCats > 0) {
    url.searchParams.set("advsearch", "1");
    url.searchParams.set("f_sfl", "on");
    url.searchParams.set("f_sfu", "on");
    url.searchParams.set("f_sft", "on");
  }

  const urlStr = url.toString();
  const ahora = Date.now();
  if (!fresco) {
    const cached = catalogoEhCache.get(urlStr);
    if (cached && cached.vence > ahora) {
      return cached.data;
    }
  }

  // `nw=1` salta la advertencia +18 y `sl=dm_2` fuerza la tabla extendida (`<tr>`),
  // evitando que E-Hentai sirva el modo de cuadrícula (`gld`) sin filas `<tr>`.
  const pedirHtml = async (destino: string) => {
    const res = await fetch(destino, {
      headers: {
        Cookie: "nw=1; sl=dm_2",
        "User-Agent": EH_UA,
        "Accept-Language": "en-US,en;q=0.9",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`E-Hentai respondió ${res.status}`);
    }
    return res.text();
  };

  let html = await pedirHtml(urlStr);
  let series = extraerSeriesDeHtmlEhentai(html);

  // Si la consulta por etiqueta volvió vacía (sea por enfriamiento de `f_search` en IP
  // compartida, por un alias/slave tag como "dragon maid" -> "parody:kobayashi-san-chi...",
  // o por un término parcial escrito en el buscador de etiquetas), probamos en orden:
  //   1. Índice directo `/tag/{ns}:{valor}` si es una sola etiqueta sin otros filtros.
  //   2. Resolución del tag maestro canónico mediante la API oficial `tagsuggest`.
  //   3. Variantes sin el ancla exacta `$` (búsqueda por prefijo / frase libre).
  if (series.length === 0 && partesBusqueda.length > 0) {
    // 1. Índice directo `/tag/...` cuando hay 1 sola etiqueta y sin categoría ni texto libre
    if (etiquetasPedidas.length === 1 && !busqueda.trim() && fCats === 0 && idioma === "todos") {
      const urlTag = construirUrlTagDirecto(etiquetasPedidas[0], { next, prev, pagina });
      if (urlTag) {
        const intentoTag = await pedirHtml(urlTag).catch(() => null);
        if (intentoTag) {
          const extraidas = extraerSeriesDeHtmlEhentai(intentoTag);
          if (extraidas.length > 0) {
            html = intentoTag;
            series = extraidas;
          }
        }
      }
    }

    // 2. Resolver alias/slave tags o nombres parciales vía `tagsuggest` (ej: "rin tohsaka" -> "character:rin tosaka",
    // "furina" -> "character:focalors", "kobayashi" -> "parody:kobayashi-san-chi no maid dragon")
    if (series.length === 0 && etiquetasPedidas.length > 0) {
      const resueltas = await Promise.all(
        etiquetasPedidas.map(async (cruda) => {
          const sugs = await sugerirEtiquetasEhentai(cruda).catch(() => []);
          if (sugs.length === 0) return formatearEtiquetaEhentai(cruda);
          const limpia = cruda.trim().toLowerCase().replace(/^"+|"+$/g, "").replace(/\$$/, "").trim();
          const sinNs = limpia.includes(":") ? limpia.slice(limpia.indexOf(":") + 1).trim() : limpia;
          const exacta =
            sugs.find((s) => s.tag.toLowerCase() === limpia) ??
            sugs.find((s) => s.nombre.toLowerCase() === sinNs) ??
            sugs[0];
          return formatearEtiquetaEhentai(exacta.tag);
        })
      );
      const partesCanonicas: string[] = [];
      if (busqueda.trim()) partesCanonicas.push(busqueda.trim());
      partesCanonicas.push(...resueltas);
      if (idioma && idioma !== "todos") {
        const idi = EHENTAI_IDIOMAS.find((i) => i.id === idioma);
        if (idi?.tag && !partesCanonicas.some((p) => p.startsWith("language:"))) {
          partesCanonicas.push(formatearEtiquetaEhentai(idi.tag));
        }
      }
      const nuevaQuery = partesCanonicas.join(" ");
      if (nuevaQuery !== partesBusqueda.join(" ")) {
        const alterna = new URL(urlStr);
        alterna.searchParams.set("f_search", nuevaQuery);
        const intento = await pedirHtml(alterna.toString()).catch(() => null);
        if (intento) {
          const extraidas = extraerSeriesDeHtmlEhentai(intento);
          if (extraidas.length > 0) {
            html = intento;
            series = extraidas;
          }
        }
      }
    }

    // 3. Reintento sin `$` (y como frase/palabras libres si no tenía namespace)
    if (series.length === 0 && html.includes("No hits found")) {
      const sinDolar = partesBusqueda.map((p) => p.replace(/\$"/g, '"'));
      const comoTextoLibre = partesBusqueda.map((p) =>
        p.startsWith('"') ? p.replace(/^"+|(?:\$)?\"+$/g, "") : p.replace(/\$"/g, '"')
      );
      for (const variante of [sinDolar, comoTextoLibre]) {
        const qVar = variante.join(" ").trim();
        if (!qVar || qVar === partesBusqueda.join(" ")) continue;
        const alterna = new URL(urlStr);
        alterna.searchParams.set("f_search", qVar);
        const intento = await pedirHtml(alterna.toString()).catch(() => null);
        if (intento) {
          const extraidas = extraerSeriesDeHtmlEhentai(intento);
          if (extraidas.length > 0) {
            html = intento;
            series = extraidas;
            break;
          }
        }
      }
    }
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

  // Si E-Hentai devolvió un mensaje de enfriamiento, baneo temporal de IP compartida
  // o HTML sin estructura de resultados ni "No hits", lanzar error evita mostrar un
  // falso "Sin resultados" cuando en realidad hubo límite temporal.
  const bloqueadoPorFlood =
    /Please wait a moment|automated queries|temporarily banned|too many requests|slow down/i.test(html);
  if (
    series.length === 0 &&
    (bloqueadoPorFlood ||
      (!html.includes("No hits found") &&
        !html.includes("No unfiltered results") &&
        !html.includes('class="itg')))
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

export interface SugerenciaTagEhentai {
  tag: string;
  label: string;
  ns: string;
  nombre: string;
}

const PRIORIDAD_NS: Record<string, number> = {
  parody: 1,
  character: 2,
  female: 3,
  male: 4,
  mixed: 5,
  other: 6,
  language: 7,
  artist: 8,
  group: 9,
  cosplayer: 10,
  location: 11,
  reclass: 12,
  temp: 13,
};

/**
 * Sugerencias de etiquetas en tiempo real desde la base completa de E-Hentai
 * (método oficial `tagsuggest` de `api.e-hentai.org`).
 *
 * Resuelve automáticamente etiquetas alias/slave (`mns`/`mtn`) hacia la etiqueta
 * canónica real (p. ej. "dragon maid" -> `parody:kobayashi-san-chi no maid dragon`,
 * "furina" -> `character:focalors`, "rin tohsaka" -> `character:rin tosaka`), y
 * cuando no se filtra por namespace consulta también `parody:`, `character:` y
 * `female:` en paralelo para que los cientos de miles de `artist:`/`group:` no
 * oculten series, personajes o géneros.
 */
const sugerenciasCache = new Map<string, { data: SugerenciaTagEhentai[]; vence: number }>();

interface EntradaRawTagSuggest {
  ns?: string;
  tn?: string;
  mns?: string;
  mtn?: string;
}

async function pedirTagSuggestRaw(consulta: string): Promise<EntradaRawTagSuggest[]> {
  const res = await fetch(EHENTAI_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": EH_UA },
    body: JSON.stringify({ method: "tagsuggest", text: consulta }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`E-Hentai respondió ${res.status}`);
  const json = (await res.json()) as { tags?: Record<string, EntradaRawTagSuggest> | unknown[] };
  return json.tags && !Array.isArray(json.tags) ? Object.values(json.tags) : [];
}

export async function sugerirEtiquetasEhentai(
  texto: string,
  nsForzado = ""
): Promise<SugerenciaTagEhentai[]> {
  if (isPlayStoreApp()) return [];
  let limpio = texto.trim().toLowerCase().replace(/^"+|"+$/g, "").replace(/\$$/, "").trim();
  let nsFiltro = nsForzado && nsForzado !== "todos" ? (EH_ABREVIATURAS[nsForzado] ?? nsForzado) : "";

  const dp = limpio.indexOf(":");
  if (dp > 0) {
    const pref = limpio.slice(0, dp).trim();
    const mapeado = EH_ABREVIATURAS[pref] ?? pref;
    if (EH_NAMESPACES.has(mapeado)) {
      nsFiltro = mapeado;
      limpio = limpio.slice(dp + 1).trim();
    }
  }
  if (limpio.length < 2) return [];

  const clave = `${nsFiltro}:${limpio}`;
  const guardada = sugerenciasCache.get(clave);
  if (guardada && guardada.vence > Date.now()) return guardada.data;

  const consultas = nsFiltro
    ? [`${nsFiltro}:${limpio}`]
    : [limpio, `parody:${limpio}`, `character:${limpio}`, `female:${limpio}`];

  const lotes = await Promise.all(
    consultas.map((q) => pedirTagSuggestRaw(q).catch(() => [] as EntradaRawTagSuggest[]))
  );

  const mapa = new Map<string, SugerenciaTagEhentai & { exacto: boolean }>();
  for (const lista of lotes) {
    for (const item of lista) {
      const nsReal = (item.mns || item.ns || "").trim().toLowerCase();
      const tnReal = (item.mtn || item.tn || "").trim().toLowerCase();
      if (!nsReal || !tnReal) continue;
      if (nsFiltro && nsReal !== nsFiltro) continue;

      const tagCanonico = `${nsReal}:${tnReal}`;
      const aliasOriginal = item.tn?.trim().toLowerCase() ?? "";
      const esExacto = tnReal === limpio || aliasOriginal === limpio;
      const baseLabel = capitalizarEtiqueta(tnReal);
      const label =
        item.mtn && aliasOriginal && aliasOriginal !== tnReal
          ? `${baseLabel} (${aliasOriginal})`
          : baseLabel;

      const previo = mapa.get(tagCanonico);
      if (!previo || (esExacto && !previo.exacto)) {
        mapa.set(tagCanonico, {
          tag: tagCanonico,
          label,
          ns: nsReal,
          nombre: tnReal,
          exacto: esExacto,
        });
      }
    }
  }

  const ordenadas = Array.from(mapa.values())
    .sort((a, b) => {
      if (a.exacto !== b.exacto) return a.exacto ? -1 : 1;
      const aEmpieza = a.nombre.startsWith(limpio);
      const bEmpieza = b.nombre.startsWith(limpio);
      if (aEmpieza !== bEmpieza) return aEmpieza ? -1 : 1;
      const pa = PRIORIDAD_NS[a.ns] ?? 99;
      const pb = PRIORIDAD_NS[b.ns] ?? 99;
      if (pa !== pb) return pa - pb;
      return a.nombre.localeCompare(b.nombre);
    })
    .slice(0, 30)
    .map(({ tag, label, ns, nombre }) => ({ tag, label, ns, nombre }));

  if (sugerenciasCache.size >= 400) {
    const k = sugerenciasCache.keys().next().value;
    if (k !== undefined) sugerenciasCache.delete(k);
  }
  sugerenciasCache.set(clave, { data: ordenadas, vence: Date.now() + 30 * 60_000 });
  return ordenadas;
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
