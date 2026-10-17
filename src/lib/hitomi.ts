import { createHash } from "crypto";
import { isPlayStoreApp } from "./appVersion";
import {
  HITOMI_NOMBRE,
  HITOMI_WEB,
  HITOMI_LTN,
  HITOMI_TAGINDEX,
  HITOMI_IDIOMAS,
  HITOMI_TIPOS,
  type SerieHitomi,
  type FichaHitomi,
  type CatalogoHitomi,
} from "./hitomiTipos";
export * from "./hitomiTipos";

// -------------------------------------------------------------
// Cachés en memoria para acelerar pedidos sucesivos
// -------------------------------------------------------------
const galleryCache = new Map<string, { info: any; vence: number }>();
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
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error("No se pudo obtener versión del índice de Hitomi");
  const version = (await res.text()).trim();
  indexVersionCache = { version, vence: Date.now() + 30 * 60 * 1000 };
  return version;
}

async function buscarEnBTree(term: string): Promise<number[]> {
  try {
    const version = await getGalleriesIndexVersion();
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
    if (length <= 0 || length > 2_000_000) return [];

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
    for (let pos = 4; pos < bufData.length && ids.length < count; pos += 4) {
      ids.push(bufData.readInt32BE(pos));
    }
    return ids;
  } catch {
    return [];
  }
}

// -------------------------------------------------------------
// Resolución de imágenes y miniaturas con gg.js
// -------------------------------------------------------------
async function obtenerGGFunc(): Promise<any> {
  if (ggCache && ggCache.vence > Date.now()) {
    return ggCache.gg;
  }
  const res = await fetch(`${HITOMI_LTN}/gg.js`, {
    headers: { Referer: HITOMI_WEB },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error("No se pudo obtener gg.js");
  const text = await res.text();
  const gg = new Function("var gg;" + text + "; return gg;")();
  ggCache = { gg, vence: Date.now() + 60 * 60 * 1000 };
  return gg;
}

export function construirUrlMiniatura(hash: string, gg: any): string {
  if (!hash) return "";
  const lastChar = hash.slice(-1);
  const prevTwo = hash.slice(-3, -1);
  const tnPath = `${lastChar}/${prevTwo}/${hash}`;
  const g = parseInt(lastChar + prevTwo, 16);
  const sub = String.fromCharCode(97 + gg.m(g)) + "tn";
  return `https://${sub}.gold-usergeneratedcontent.net/webpbigtn/${tnPath}.webp`;
}

export function construirUrlPagina(hash: string, ext: string, gg: any): string {
  if (!hash) return "";
  const b = 16;
  const match = hash.match(/\/?[0-9a-f]{61}([0-9a-f]{2})([0-9a-f])/);
  let sub = "a";
  if (match) {
    const g = parseInt(match[2] + match[1], b);
    if (!isNaN(g)) {
      sub = "a" + (1 + gg.m(g));
    }
  } else {
    const g = parseInt(hash.slice(-1) + hash.slice(-3, -1), 16);
    if (!isNaN(g)) {
      sub = "a" + (1 + gg.m(g));
    }
  }

  const s = gg.s(hash);
  const fullPath = `${gg.b}${s}/${hash}`;
  return `https://${sub}.gold-usergeneratedcontent.net/${fullPath}.${ext}`;
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
        const prefix = t.female === "1" ? "female:" : t.male === "1" ? "male:" : "";
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
    // Preferir WebP para compatibilidad universal en todas las plataformas y lectores
    const ext = f.haswebp ? "webp" : f.hasavif ? "avif" : f.name?.split(".").pop() || "jpg";
    const u = construirUrlPagina(f.hash, ext, gg);
    if (u) urls.push(u);
  }

  return urls;
}

// -------------------------------------------------------------
// Catálogo y búsqueda de Hitomi
// -------------------------------------------------------------
export async function catalogoHitomi(opciones: {
  busqueda?: string;
  idioma?: string;
  tag?: string;
  tipo?: string;
  pagina?: number;
}): Promise<CatalogoHitomi> {
  if (isPlayStoreApp()) {
    throw new Error("Fuente no disponible en esta edición");
  }

  const { busqueda = "", idioma = "todos", tag = "", tipo = "todos", pagina = 1 } = opciones;
  const numPagina = Math.max(1, pagina);
  const ITEMS_POR_PAGINA = 24;

  let galleryIds: number[] = [];
  let totalResultados = 0;

  const queryLimpia = busqueda.trim().toLowerCase();
  const tagLimpio = tag.trim().toLowerCase();
  const langCode = idioma === "todos" ? "all" : idioma.toLowerCase();

  // Caso 1: Búsqueda por texto (ej. "naruto", "magic", etc.)
  if (queryLimpia) {
    galleryIds = await buscarEnBTree(queryLimpia);
    totalResultados = galleryIds.length;
  }
  // Caso 2: Filtrado por etiqueta específica
  else if (tagLimpio) {
    let tagUrlPart = tagLimpio;
    if (tagLimpio.startsWith("series:")) tagUrlPart = `series/${tagLimpio.replace(/^series:/, "")}`;
    else if (tagLimpio.startsWith("artist:")) tagUrlPart = `artist/${tagLimpio.replace(/^artist:/, "")}`;
    else if (tagLimpio.startsWith("character:")) tagUrlPart = `character/${tagLimpio.replace(/^character:/, "")}`;
    else if (tagLimpio.startsWith("type:")) tagUrlPart = `type/${tagLimpio.replace(/^type:/, "")}`;
    else tagUrlPart = `tag/${tagLimpio}`;

    const nozomiUrl = `${HITOMI_LTN}/n/${encodeURI(tagUrlPart)}-${langCode}.nozomi`;
    try {
      const res = await fetch(nozomiUrl, {
        headers: { Referer: HITOMI_WEB, Range: "bytes=0-39" },
      });
      if (res.ok || res.status === 206) {
        const cr = res.headers.get("content-range");
        if (cr) {
          const totalBytes = parseInt(cr.split("/")[1] || "0", 10);
          totalResultados = Math.floor(totalBytes / 4);
        }

        const startByte = (numPagina - 1) * ITEMS_POR_PAGINA * 4;
        const endByte = startByte + ITEMS_POR_PAGINA * 4 - 1;

        const resPagina = await fetch(nozomiUrl, {
          headers: { Referer: HITOMI_WEB, Range: `bytes=${startByte}-${endByte}` },
        });
        if (resPagina.ok || resPagina.status === 206) {
          const buf = Buffer.from(await resPagina.arrayBuffer());
          for (let i = 0; i < buf.length; i += 4) {
            galleryIds.push(buf.readInt32BE(i));
          }
        }
      }
    } catch {}
  }
  // Caso 3: Navegación general por idioma y tipo
  else {
    let nozomiUrl = `${HITOMI_LTN}/n/index-${langCode}.nozomi`;
    if (tipo !== "todos") {
      nozomiUrl = `${HITOMI_LTN}/n/type/${encodeURI(tipo)}-${langCode}.nozomi`;
    }

    try {
      const res = await fetch(nozomiUrl, {
        headers: { Referer: HITOMI_WEB, Range: "bytes=0-39" },
      });
      if (res.ok || res.status === 206) {
        const cr = res.headers.get("content-range");
        if (cr) {
          const totalBytes = parseInt(cr.split("/")[1] || "0", 10);
          totalResultados = Math.floor(totalBytes / 4);
        }

        const startByte = (numPagina - 1) * ITEMS_POR_PAGINA * 4;
        const endByte = startByte + ITEMS_POR_PAGINA * 4 - 1;

        const resPagina = await fetch(nozomiUrl, {
          headers: { Referer: HITOMI_WEB, Range: `bytes=${startByte}-${endByte}` },
        });
        if (resPagina.ok || resPagina.status === 206) {
          const buf = Buffer.from(await resPagina.arrayBuffer());
          for (let i = 0; i < buf.length; i += 4) {
            galleryIds.push(buf.readInt32BE(i));
          }
        }
      }
    } catch {}
  }

  // Si vinieron IDs de búsqueda por B-tree, paginar en memoria
  let sliceIds = galleryIds;
  if (queryLimpia) {
    const inicio = (numPagina - 1) * ITEMS_POR_PAGINA;
    sliceIds = galleryIds.slice(inicio, inicio + ITEMS_POR_PAGINA);
  }

  // Obtener los metadatos de las galerías en paralelo
  const gg = await obtenerGGFunc().catch(() => null);
  const series: SerieHitomi[] = [];

  const fichas = await Promise.all(
    sliceIds.map(async (id) => {
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
