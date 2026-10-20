import { createHash } from "crypto";
import { isPlayStoreApp } from "./appVersion";
import {
  HITOMI_NOMBRE,
  HITOMI_WEB,
  HITOMI_LTN,
  HITOMI_TAGINDEX,
  HITOMI_IDIOMAS,
  HITOMI_TIPOS,
  HITOMI_ORDENES,
  type HitomiOrden,
  type SerieHitomi,
  type FichaHitomi,
  type CatalogoHitomi,
  type HitomiTag,
} from "./hitomiTipos";
export * from "./hitomiTipos";

// -------------------------------------------------------------
// Cachés en memoria para acelerar pedidos sucesivos
// -------------------------------------------------------------
const galleryCache = new Map<string, { info: FichaHitomi; vence: number }>();
let ggCache: { gg: any; vence: number } | null = null;
let indexVersionCache: { version: string; vence: number } | null = null;

function hashTerm(term: string): Uint8Array {
  const h = createHash("sha256").update(term.trim().toLowerCase(), "utf8").digest();
  return new Uint8Array(h.subarray(0, 4));
}

function compareArrayBuffers(a: Uint8Array, b: Uint8Array): number {
  const top = Math.min(a.length, b.length);
  for (let i = 0; i < top; i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return 0;
}

function decodeNode(data: Uint8Array) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let pos = 0;
  const numberOfKeys = view.getInt32(pos, false);
  pos += 4;
  const keys: Uint8Array[] = [];
  for (let i = 0; i < numberOfKeys; i++) {
    const keySize = view.getInt32(pos, false);
    pos += 4;
    keys.push(data.subarray(pos, pos + keySize));
    pos += keySize;
  }
  const numberOfDatas = view.getInt32(pos, false);
  pos += 4;
  const datas: [number, number][] = [];
  for (let i = 0; i < numberOfDatas; i++) {
    // uint64 big endian
    const left = view.getUint32(pos, false);
    const right = view.getUint32(pos + 4, false);
    pos += 8;
    const offset = left * 2 ** 32 + right;
    const length = view.getInt32(pos, false);
    pos += 4;
    datas.push([offset, length]);
  }
  const subnodeAddresses: number[] = [];
  for (let i = 0; i < 17; i++) {
    const left = view.getUint32(pos, false);
    const right = view.getUint32(pos + 4, false);
    pos += 8;
    subnodeAddresses.push(left * 2 ** 32 + right);
  }
  return { keys, datas, subnodeAddresses };
}

async function getGalleriesIndexVersion(): Promise<string> {
  if (indexVersionCache && indexVersionCache.vence > Date.now()) {
    return indexVersionCache.version;
  }
  const res = await fetch(`${HITOMI_LTN}/galleriesindex/version`, {
    headers: { Referer: HITOMI_WEB },
    next: { revalidate: 1800 },
  });
  if (!res.ok) throw new Error("No se pudo obtener versión del índice de Hitomi");
  const version = (await res.text()).trim();
  indexVersionCache = { version, vence: Date.now() + 15 * 60 * 1000 };
  return version;
}

async function buscarTerminoEnBTree(term: string, version: string): Promise<number[]> {
  try {
    const key = hashTerm(term);
    const maxNodeSize = 464;

    async function getNode(address: number) {
      const url = `${HITOMI_LTN}/galleriesindex/galleries.${version}.index`;
      const res = await fetch(url, {
        headers: {
          Referer: HITOMI_WEB,
          Range: `bytes=${address}-${address + maxNodeSize - 1}`,
        },
      });
      if (!res.ok && res.status !== 206) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      return decodeNode(buf);
    }

    async function searchNode(node: ReturnType<typeof decodeNode> | null): Promise<[number, number] | null> {
      if (!node) return null;
      let cmp = -1;
      let i = 0;
      for (i = 0; i < node.keys.length; i++) {
        cmp = compareArrayBuffers(key, node.keys[i]);
        if (cmp <= 0) break;
      }
      if (cmp === 0) {
        return node.datas[i];
      }
      const isLeaf = node.subnodeAddresses.every((a) => a === 0);
      if (isLeaf) return null;
      const nextAddr = node.subnodeAddresses[i];
      if (!nextAddr) return null;
      const next = await getNode(nextAddr);
      return searchNode(next);
    }

    const root = await getNode(0);
    const dataRef = await searchNode(root);
    if (!dataRef) return [];

    const [offset, length] = dataRef;
    if (length <= 0 || length > 4_000_000) return [];

    const dataUrl = `${HITOMI_LTN}/galleriesindex/galleries.${version}.data`;
    const resData = await fetch(dataUrl, {
      headers: {
        Referer: HITOMI_WEB,
        Range: `bytes=${offset}-${offset + length - 1}`,
      },
    });
    if (!resData.ok && resData.status !== 206) return [];
    const bufData = Buffer.from(await resData.arrayBuffer());
    if (bufData.length < 4) return [];

    const count = bufData.readInt32BE(0);
    const ids: number[] = [];
    for (let pos = 4; pos + 4 <= bufData.length && ids.length < count; pos += 4) {
      ids.push(bufData.readInt32BE(pos));
    }
    return ids;
  } catch {
    return [];
  }
}

async function buscarEnBTree(query: string): Promise<number[]> {
  try {
    const palabras = query
      .trim()
      .toLowerCase()
      .replace(/[_/:.-]+/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 2)
      .slice(0, 5);

    if (palabras.length === 0) {
      const unica = query.trim().toLowerCase();
      if (!unica) return [];
      const version = await getGalleriesIndexVersion();
      return buscarTerminoEnBTree(unica, version);
    }

    const version = await getGalleriesIndexVersion();
    const listas = await Promise.all(palabras.map((p) => buscarTerminoEnBTree(p, version)));
    const noVacias = listas.filter((l) => l.length > 0);
    if (noVacias.length === 0) return [];

    // Intersección manteniendo el orden cronológico descendente de la primera lista
    let resultado = noVacias[0];
    for (let i = 1; i < noVacias.length; i++) {
      const conjunto = new Set(noVacias[i]);
      resultado = resultado.filter((id) => conjunto.has(id));
    }
    return resultado;
  } catch {
    return [];
  }
}

// -------------------------------------------------------------
// Resolución de imágenes y miniaturas con gg.js
// -------------------------------------------------------------
export async function obtenerGGFunc(forzar = false): Promise<any> {
  if (!forzar && ggCache && ggCache.vence > Date.now()) {
    return ggCache.gg;
  }
  const res = await fetch(`${HITOMI_LTN}/gg.js`, {
    headers: { Referer: HITOMI_WEB },
    cache: "no-store",
  });
  if (!res.ok) throw new Error("No se pudo obtener gg.js");
  const text = await res.text();
  const gg = new Function("var gg;" + text + "; return gg;")();
  // gg.b rota cada ~60 minutos en Hitomi; conservarlo solo 60 segundos evita tokens vencidos
  ggCache = { gg, vence: Date.now() + 60 * 1000 };
  return gg;
}

export function construirUrlMiniatura(hash: string, gg: any): string {
  if (!hash) return "";
  const lastChar = hash.slice(-1);
  const prevTwo = hash.slice(-3, -1);
  const tnPath = `${lastChar}/${prevTwo}/${hash}`;
  const g = parseInt(lastChar + prevTwo, 16);
  const sub = String.fromCharCode(97 + gg.m(g)) + "tn";
  const rawUrl = `https://${sub}.gold-usergeneratedcontent.net/webpbigtn/${tnPath}.webp`;
  return `/api/externo/imagen?u=${encodeURIComponent(rawUrl)}`;
}

export function construirUrlPagina(hash: string, ext: string, gg: any): string {
  if (!hash) return "";
  // En common.js oficial de Hitomi: dir === "webp" usa subdominio "w" (w1/w2), y "avif" usa "a" (a1/a2)
  const prefijo = ext === "webp" ? "w" : "a";
  const b = 16;
  const match = hash.match(/\/?[0-9a-f]{61}([0-9a-f]{2})([0-9a-f])/);
  let sub = `${prefijo}1`;
  if (match) {
    const g = parseInt(match[2] + match[1], b);
    if (!isNaN(g)) {
      sub = `${prefijo}${1 + gg.m(g)}`;
    }
  } else {
    const g = parseInt(hash.slice(-1) + hash.slice(-3, -1), 16);
    if (!isNaN(g)) {
      sub = `${prefijo}${1 + gg.m(g)}`;
    }
  }

  const s = gg.s(hash);
  const fullPath = `${gg.b}${s}/${hash}`;
  return `https://${sub}.gold-usergeneratedcontent.net/${fullPath}.${ext}`;
}

/**
 * Reconstruye la URL de una página de Hitomi refrescando gg.js cuando el token horario gg.b rotó.
 */
export async function reconstruirUrlPaginaHitomi(hash: string, ext = "webp"): Promise<string> {
  const gg = await obtenerGGFunc(true);
  return construirUrlPagina(hash, ext, gg);
}

// -------------------------------------------------------------
// Autocompletado de etiquetas en tiempo real desde tagindex.hitomi.la
// -------------------------------------------------------------
function codificarCaracterTagIndex(c: string): string {
  if (c === " ") return "_";
  if (c === "/") return "slash";
  if (c === ".") return "dot";
  return encodeURIComponent(c);
}

export async function sugerirTagsHitomi(query: string): Promise<HitomiTag[]> {
  if (isPlayStoreApp()) return [];
  const limpio = query.trim().toLowerCase().replace(/_/g, " ");
  if (!limpio) return [];

  let field = "global";
  let term = limpio;
  if (limpio.includes(":")) {
    const partes = limpio.split(":");
    const ns = partes[0]?.trim();
    if (ns && ["female", "male", "tag", "series", "artist", "character", "group", "type"].includes(ns)) {
      field = ns;
      term = partes.slice(1).join(":").trim();
    } else if (ns === "parody") {
      field = "series";
      term = partes.slice(1).join(":").trim();
    }
  }

  if (!term) return [];
  const chars = term.split("").map(codificarCaracterTagIndex);
  const url = `${HITOMI_TAGINDEX}/${field}/${chars.join("/")}.json`;

  try {
    const res = await fetch(url, {
      headers: { Referer: HITOMI_WEB },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const sugerencias = (await res.json()) as [string, number, string][];
    if (!Array.isArray(sugerencias)) return [];

    return sugerencias.slice(0, 30).map(([nombre, cantidad, ns]) => {
      const tagCompleto = ns === "tag" ? nombre : `${ns}:${nombre}`;
      const categoria: HitomiTag["categoria"] =
        ns === "female"
          ? "femenino"
          : ns === "male"
            ? "masculino"
            : ns === "series"
              ? "serie"
              : "tematica";
      const prefijoLabel =
        ns === "female"
          ? "♀ "
          : ns === "male"
            ? "♂ "
            : ns === "series"
              ? "📚 "
              : ns === "character"
                ? "👤 "
                : ns === "artist"
                  ? "🎨 "
                  : ns === "group"
                    ? "👥 "
                    : "";
      return {
        tag: tagCompleto,
        label: `${prefijoLabel}${nombre} (${Number(cantidad).toLocaleString("es-ES")})`,
        categoria,
        count: Number(cantidad),
      };
    });
  } catch {
    return [];
  }
}

// -------------------------------------------------------------
// Ficha de una galería individual
// -------------------------------------------------------------
export async function fichaHitomi(id: string): Promise<FichaHitomi> {
  if (isPlayStoreApp()) {
    throw new Error("Fuente no disponible en esta edición");
  }

  const idLimpio = String(id).replace(/[^0-9]/g, "");
  if (!idLimpio) throw new Error("ID de galería inválido");

  const enCache = galleryCache.get(idLimpio);
  if (enCache && enCache.vence > Date.now()) {
    return enCache.info;
  }

  const res = await fetch(`${HITOMI_LTN}/galleries/${idLimpio}.js`, {
    headers: { Referer: HITOMI_WEB },
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    throw new Error(`Hitomi respondió ${res.status} al consultar la galería`);
  }

  const text = await res.text();
  const jsonStr = text.replace(/^var\s+galleryinfo\s*=\s*/, "").replace(/;\s*$/, "");
  const info = JSON.parse(jsonStr);
  const gg = await obtenerGGFunc();

  const firstFile = info.files?.[0];
  const thumb = firstFile?.hash ? construirUrlMiniatura(firstFile.hash, gg) : "";

  const tags: string[] = [];
  if (Array.isArray(info.tags)) {
    for (const t of info.tags) {
      if (typeof t === "string") tags.push(t);
      else if (t?.tag) {
        const prefix =
          t.female === 1 || t.female === "1"
            ? "female:"
            : t.male === 1 || t.male === "1"
              ? "male:"
              : "";
        tags.push(`${prefix}${t.tag}`);
      }
    }
  }

  const artists: string[] = Array.isArray(info.artists)
    ? info.artists.map((a: any) => (typeof a === "string" ? a : a?.artist)).filter(Boolean)
    : [];

  const characters: string[] = Array.isArray(info.characters)
    ? info.characters.map((c: any) => (typeof c === "string" ? c : c?.character)).filter(Boolean)
    : [];

  const groups: string[] = Array.isArray(info.groups)
    ? info.groups.map((g: any) => (typeof g === "string" ? g : g?.group)).filter(Boolean)
    : [];

  const parodys: string[] = Array.isArray(info.parodys)
    ? info.parodys.map((p: any) => (typeof p === "string" ? p : p?.parody)).filter(Boolean)
    : [];

  const ficha: FichaHitomi = {
    id: idLimpio,
    title: info.title || `Galería #${idLimpio}`,
    japanese_title: info.japanese_title || undefined,
    language: info.language || "unknown",
    type: info.type || "doujinshi",
    thumb,
    artists,
    characters,
    groups,
    parodys,
    tags,
    filecount: Array.isArray(info.files) ? info.files.length : 0,
    date: info.date || undefined,
    url_original: `${HITOMI_WEB}/galleries/${idLimpio}.html`,
  };

  galleryCache.set(idLimpio, { info: ficha, vence: Date.now() + 2 * 60 * 60 * 1000 });
  return ficha;
}

// -------------------------------------------------------------
// Lista de páginas para el lector y la descarga
// -------------------------------------------------------------
export async function paginasHitomi(id: string): Promise<string[]> {
  if (isPlayStoreApp()) {
    throw new Error("Fuente no disponible en esta edición");
  }

  const idLimpio = String(id).replace(/[^0-9]/g, "");
  if (!idLimpio) throw new Error("ID de galería inválido");

  const res = await fetch(`${HITOMI_LTN}/galleries/${idLimpio}.js`, {
    headers: { Referer: HITOMI_WEB },
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    throw new Error(`Hitomi respondió ${res.status} al solicitar páginas`);
  }

  const text = await res.text();
  const jsonStr = text.replace(/^var\s+galleryinfo\s*=\s*/, "").replace(/;\s*$/, "");
  const info = JSON.parse(jsonStr);
  const gg = await obtenerGGFunc();

  if (!Array.isArray(info.files) || info.files.length === 0) {
    return [];
  }

  const urls: string[] = [];
  for (const f of info.files) {
    if (!f.hash) continue;
    // Igual que reader.js oficial de Hitomi: todas las páginas se sirven en WebP desde w1/w2
    const u = construirUrlPagina(f.hash, "webp", gg);
    if (u) urls.push(u);
  }

  return urls;
}

// -------------------------------------------------------------
// Lectura de archivos .nozomi por rango de bytes en un único pedido
// -------------------------------------------------------------
async function leerNozomiRango(
  nozomiUrl: string,
  numPagina: number,
  itemsPorPagina: number
): Promise<{ ids: number[]; total: number } | null> {
  const startByte = (numPagina - 1) * itemsPorPagina * 4;
  const endByte = startByte + itemsPorPagina * 4 - 1;

  try {
    const res = await fetch(nozomiUrl, {
      headers: {
        Referer: HITOMI_WEB,
        Range: `bytes=${startByte}-${endByte}`,
      },
    });
    if (!res.ok && res.status !== 206) return null;

    const buf = Buffer.from(await res.arrayBuffer());
    const ids: number[] = [];
    for (let i = 0; i + 4 <= buf.length; i += 4) {
      ids.push(buf.readInt32BE(i));
    }

    let total = ids.length;
    const cr = res.headers.get("content-range");
    if (cr) {
      const totalBytes = parseInt(cr.split("/")[1] || "0", 10);
      if (totalBytes > 0) {
        total = Math.floor(totalBytes / 4);
      }
    }
    return { ids, total };
  } catch {
    return null;
  }
}

async function leerNozomiCompleto(nozomiUrl: string): Promise<number[] | null> {
  try {
    const res = await fetch(nozomiUrl, {
      headers: { Referer: HITOMI_WEB },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const ids: number[] = [];
    for (let i = 0; i + 4 <= buf.length; i += 4) {
      ids.push(buf.readInt32BE(i));
    }
    return ids;
  } catch {
    return null;
  }
}

function shuffleArray<T>(arr: T[]): T[] {
  const copia = [...arr];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

function construirUrlsNozomiPorOrden(
  ruta: string | null,
  orden: HitomiOrden,
  codIdioma: string
): string[] {
  const urls: string[] = [];

  if (!ruta) {
    if (orden === "date_added" || orden === "random") {
      urls.push(`${HITOMI_LTN}/n/index-${codIdioma}.nozomi`);
      if (codIdioma !== "all") urls.push(`${HITOMI_LTN}/n/index-all.nozomi`);
    } else if (orden === "published") {
      urls.push(`${HITOMI_LTN}/n/date/published-${codIdioma}.nozomi`);
      if (codIdioma !== "all") urls.push(`${HITOMI_LTN}/n/date/published-all.nozomi`);
    } else {
      urls.push(`${HITOMI_LTN}/n/popular/${orden}-${codIdioma}.nozomi`);
      if (codIdioma !== "all") urls.push(`${HITOMI_LTN}/n/popular/${orden}-all.nozomi`);
    }
    urls.push(`${HITOMI_LTN}/n/index-${codIdioma}.nozomi`);
    return Array.from(new Set(urls));
  }

  const primerSlash = ruta.indexOf("/");
  const area = primerSlash > -1 ? ruta.slice(0, primerSlash) : "tag";
  const item = primerSlash > -1 ? ruta.slice(primerSlash + 1) : ruta;

  if (orden === "date_added" || orden === "random") {
    urls.push(`${HITOMI_LTN}/n/${encodeURI(area)}/${encodeURI(item)}-${codIdioma}.nozomi`);
    if (codIdioma !== "all") urls.push(`${HITOMI_LTN}/n/${encodeURI(area)}/${encodeURI(item)}-all.nozomi`);
  } else if (orden === "published") {
    urls.push(`${HITOMI_LTN}/n/${encodeURI(area)}/date/published/${encodeURI(item)}-${codIdioma}.nozomi`);
    if (codIdioma !== "all") urls.push(`${HITOMI_LTN}/n/${encodeURI(area)}/date/published/${encodeURI(item)}-all.nozomi`);
  } else {
    urls.push(`${HITOMI_LTN}/n/${encodeURI(area)}/popular/${orden}/${encodeURI(item)}-${codIdioma}.nozomi`);
    if (codIdioma !== "all") urls.push(`${HITOMI_LTN}/n/${encodeURI(area)}/popular/${orden}/${encodeURI(item)}-all.nozomi`);
  }

  urls.push(`${HITOMI_LTN}/n/${encodeURI(area)}/${encodeURI(item)}-${codIdioma}.nozomi`);
  if (codIdioma !== "all") urls.push(`${HITOMI_LTN}/n/${encodeURI(area)}/${encodeURI(item)}-all.nozomi`);

  return Array.from(new Set(urls));
}

function construirRutasCandidatasTag(tagLimpio: string): string[] {
  let t = tagLimpio.replace(/_/g, " ").trim();
  t = t
    .replace(/^parody:/i, "series:")
    .replace(/^series:fate\/grand order/i, "series:fate grand order")
    .replace(/^series:honkai: star rail/i, "series:honkai star rail")
    .replace(/^series:sono bisque doll wa koi wo suru/i, "series:sono bisque doll wa koi o suru")
    .replace(/^series:bocchi the rock!/i, "series:bocchi the rock")
    .replace(/^series:nier:automata/i, "series:nier automata");

  if (t.startsWith("series:")) {
    const s = t.replace(/^series:/, "").replace(/[/:]/g, " ").replace(/\s+/g, " ").trim();
    return [`series/${s}`];
  }
  if (t.startsWith("artist:")) return [`artist/${t.replace(/^artist:/, "").trim()}`];
  if (t.startsWith("group:")) return [`group/${t.replace(/^group:/, "").trim()}`];
  if (t.startsWith("character:")) return [`character/${t.replace(/^character:/, "").trim()}`];
  if (t.startsWith("type:")) return [`type/${t.replace(/^type:/, "").trim()}`];
  if (t.startsWith("tag:")) return [`tag/${t.replace(/^tag:/, "").trim()}`];
  if (t.startsWith("female:") || t.startsWith("male:")) return [`tag/${t}`];

  // Si el usuario escribió un tag sin prefijo (ej: "maid", "milf", "full color", "blue archive", "netorare"),
  // probamos en orden: tag general, female:, male:, series/, character/, artist/
  return [
    `tag/${t}`,
    `tag/female:${t}`,
    `tag/male:${t}`,
    `series/${t}`,
    `character/${t}`,
    `artist/${t}`,
    `group/${t}`,
  ];
}

// -------------------------------------------------------------
// Catálogo y búsqueda de Hitomi
// -------------------------------------------------------------
export async function catalogoHitomi(opciones: {
  busqueda?: string;
  idioma?: string;
  tag?: string;
  tipo?: string;
  orden?: HitomiOrden;
  pagina?: number;
}): Promise<CatalogoHitomi> {
  if (isPlayStoreApp()) {
    throw new Error("Fuente no disponible en esta edición");
  }

  const {
    busqueda = "",
    idioma = "todos",
    tag = "",
    tipo = "todos",
    orden = "date_added",
    pagina = 1,
  } = opciones;
  const numPagina = Math.max(1, pagina);
  const ITEMS_POR_PAGINA = 24;

  let galleryIds: number[] = [];
  let totalResultados = 0;
  let yaPaginado = false;

  const queryLimpia = busqueda.trim().toLowerCase();
  const tagLimpio = tag.trim().toLowerCase();
  const langCode = idioma === "todos" ? "all" : idioma.toLowerCase();

  // Caso 1: Búsqueda por texto (ej. "naruto", "blue archive", etc.)
  if (queryLimpia) {
    const candidatosDirectos = construirRutasCandidatasTag(queryLimpia).slice(0, 4);
    for (const ruta of candidatosDirectos) {
      const urls = construirUrlsNozomiPorOrden(ruta, orden, langCode);
      for (const nozomiUrl of urls) {
        if (orden === "random") {
          const todos = await leerNozomiCompleto(nozomiUrl);
          if (todos && todos.length > 0) {
            galleryIds = shuffleArray(todos);
            totalResultados = todos.length;
            yaPaginado = false;
            break;
          }
        } else {
          const resNozomi = await leerNozomiRango(nozomiUrl, numPagina, ITEMS_POR_PAGINA);
          if (resNozomi && resNozomi.ids.length > 0) {
            galleryIds = resNozomi.ids;
            totalResultados = resNozomi.total;
            yaPaginado = true;
            break;
          }
        }
      }
      if (galleryIds.length > 0) break;
    }

    if (galleryIds.length === 0) {
      const encontrados = await buscarEnBTree(queryLimpia);
      if (orden === "random") {
        galleryIds = shuffleArray(encontrados);
      } else {
        galleryIds = encontrados;
      }
      totalResultados = galleryIds.length;
      yaPaginado = false;
    }
  }
  // Caso 2: Filtrado por etiqueta específica
  else if (tagLimpio) {
    const rutasCandidatas = construirRutasCandidatasTag(tagLimpio);
    const idiomasIntento = langCode === "all" ? ["all"] : [langCode, "all"];

    busquedaTag: for (const codIdioma of idiomasIntento) {
      for (const ruta of rutasCandidatas) {
        const urls = construirUrlsNozomiPorOrden(ruta, orden, codIdioma);
        for (const nozomiUrl of urls) {
          if (orden === "random") {
            const todos = await leerNozomiCompleto(nozomiUrl);
            if (todos && todos.length > 0) {
              galleryIds = shuffleArray(todos);
              totalResultados = todos.length;
              yaPaginado = false;
              break busquedaTag;
            }
          } else {
            const resNozomi = await leerNozomiRango(nozomiUrl, numPagina, ITEMS_POR_PAGINA);
            if (resNozomi && resNozomi.ids.length > 0) {
              galleryIds = resNozomi.ids;
              totalResultados = resNozomi.total;
              yaPaginado = true;
              break busquedaTag;
            }
          }
        }
      }
    }

    if (galleryIds.length === 0) {
      const encontrados = await buscarEnBTree(
        tagLimpio.replace(/^(female|male|series|parody|artist|group|character|tag):/, "")
      );
      if (orden === "random") {
        galleryIds = shuffleArray(encontrados);
      } else {
        galleryIds = encontrados;
      }
      totalResultados = galleryIds.length;
      yaPaginado = false;
    }
  }
  // Caso 3: Navegación general por idioma y orden
  else {
    const urls =
      tipo !== "todos"
        ? [`${HITOMI_LTN}/n/type/${encodeURI(tipo)}-${langCode}.nozomi`]
        : construirUrlsNozomiPorOrden(null, orden, langCode);

    for (const nozomiUrl of urls) {
      if (orden === "random" && tipo === "todos") {
        const todos = await leerNozomiCompleto(nozomiUrl);
        if (todos && todos.length > 0) {
          galleryIds = shuffleArray(todos);
          totalResultados = todos.length;
          yaPaginado = false;
          break;
        }
      } else {
        const resNozomi = await leerNozomiRango(nozomiUrl, numPagina, ITEMS_POR_PAGINA);
        if (resNozomi && resNozomi.ids.length > 0) {
          galleryIds = resNozomi.ids;
          totalResultados = resNozomi.total;
          yaPaginado = true;
          break;
        }
      }
    }
  }

  // Si vinieron IDs completos de búsqueda por B-tree, paginar en memoria
  let sliceIds = galleryIds;
  if (!yaPaginado) {
    const inicio = (numPagina - 1) * ITEMS_POR_PAGINA;
    sliceIds = galleryIds.slice(inicio, inicio + ITEMS_POR_PAGINA);
  }

  // Eliminar IDs duplicados conservando el orden
  const idsUnicos = Array.from(new Set(sliceIds));

  // Precalentar gg.js antes de pedir las fichas en paralelo
  await obtenerGGFunc().catch(() => null);
  const series: SerieHitomi[] = [];

  const fichas = await Promise.all(
    idsUnicos.map(async (id) => {
      try {
        return await fichaHitomi(String(id));
      } catch {
        return null;
      }
    })
  );

  for (const f of fichas) {
    if (f) series.push(f);
  }

  const totalPaginas = Math.max(1, Math.ceil(totalResultados / ITEMS_POR_PAGINA));

  return {
    series,
    pagina: numPagina,
    totalPaginas,
    totalResultados,
    hayMas: numPagina < totalPaginas,
  };
}

