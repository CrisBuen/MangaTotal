/**
 * Catharsis World, del lado del servidor (Catharsis v3).
 *
 * El sitio migró a su nueva API (Catharsis v3 en newcatharsis.dig-it.info),
 * con desafíos Cap PoW, pases de lectura de sesión y páginas divididas en
 * mosaicos de 8x8 con clave de reordenamiento y ofuscación XOR.
 *
 * Para garantizar compatibilidad retroactiva 100% con las series guardadas
 * por los usuarios antes del cambio, este módulo conserva el mapeo directo
 * entre los UUID de carpeta heredados de Directus y los identificadores v3.
 */

import crypto from "crypto";
import sharp from "sharp";

export const CW_API_V3 = "https://newcatharsis.dig-it.info/api";
export const CW_DIRECTUS = "https://direct-new-catha.catharsisfood.com";
export const CARPETA_MANGAS = "cf1f897d-9735-49f7-a96c-77a8c72d2124";

const VIDA_CATALOGO_MS = 30 * 60 * 1000;
const VIDA_NOVEDADES_MS = 5 * 60 * 1000;
const VIDA_PASES_MS = 5 * 60 * 60 * 1000;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export const CW_HEADERS: Record<string, string> = {
  "User-Agent": UA,
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "es-419,es;q=0.9,en;q=0.8",
  System: "catharsis",
  "X-FK-Sistema": "3",
  Referer: "https://newcatharsis.dig-it.info/",
  "Sec-CH-UA": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  "Sec-CH-UA-Mobile": "?0",
  "Sec-CH-UA-Platform": '"Windows"',
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
};

export interface CarpetaCw {
  id: string;
  name: string;
  parent: string | null;
}

export interface SerieCatalogoCw {
  id: string;
  nombre: string;
  portada: string | null;
  capitulos: number;
  slug?: string;
  v3Id?: number;
}

export interface CapituloCw {
  id: string;
  numero: number;
  etiqueta: string;
  name?: string;
  fecha?: string | null;
  published_at?: string | null;
}

export interface FichaCw {
  id: string;
  nombre: string;
  portada: string | null;
  capitulos: CapituloCw[];
  descripcion?: string | null;
  estado?: string | null;
  tipo?: string | null;
  generos?: string[];
  v3Id?: number;
  slug?: string;
}

interface MangaV3Raw {
  id: number;
  slug?: string;
  nombre: string;
  nombre_alt_1?: string | null;
  nombre_alt_2?: string | null;
  descripcion?: string | null;
  portada_url?: string | null;
  estado?: string | null;
  tipo?: string | null;
  n_capitulos?: number;
  n_visitas?: number;
  fecha_ultimo_capitulo?: string | null;
  nsfw?: boolean;
  requires_login?: boolean;
  fk_generos?: Array<{ generos_id?: { id: number; nombre: string } }>;
  capitulos?: Array<{
    id: number;
    numero: number | string;
    titulo?: string | null;
    n_paginas?: number;
    estado?: string | null;
    date_created?: string | null;
    fecha_publicacion?: string | null;
  }>;
}

/** Sin tildes ni signos: para buscar y para casar la portada con su serie. */
export function normalizarCw(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** El primer número que aparece en un texto: "Capítulo 12.5" da 12.5 */
export function numeroCw(texto: string): number {
  const m = texto.match(/\d+(?:[.,]\d+)?/);
  return m ? Number(m[0].replace(",", ".")) : 0;
}

export async function pedirCw<T>(ruta: string, revalidar: number): Promise<T> {
  const res = await fetch(`${CW_DIRECTUS}${ruta}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    ...(revalidar > 0 ? { next: { revalidate: revalidar } } : { cache: "no-store" as const }),
  });
  if (!res.ok) throw new Error(`Catharsis Directus respondió ${res.status}`);
  return (await res.json()) as T;
}

// ── Caché de mapeo entre UUID antiguo de Directus y objeto v3 ───────────────
let mapaUuidHecho = 0;
let mapaUuidToV3 = new Map<string, MangaV3Raw>();
let mapaNormToUuid = new Map<string, string>();
let catalogoCache: { hecho: number; series: SerieCatalogoCw[] } | null = null;
let todosV3Cache: { hecho: number; mangas: MangaV3Raw[] } | null = null;
let novedadesCache: { hecho: number; series: SerieCatalogoCw[] } | null = null;

async function cargarTodosV3(fresco = false): Promise<MangaV3Raw[]> {
  if (!fresco && todosV3Cache && Date.now() - todosV3Cache.hecho < VIDA_CATALOGO_MS) {
    return todosV3Cache.mangas;
  }
  const url = `${CW_API_V3}/mangas?page=1&limit=3000&sort=nombre&include_nsfw=true`;
  const res = await fetch(url, {
    headers: CW_HEADERS,
    ...(fresco ? { cache: "no-store" as const } : { next: { revalidate: 1800 } }),
  });
  if (!res.ok) throw new Error(`Catharsis v3 catálogo respondió ${res.status}`);
  const json = (await res.json()) as { data?: MangaV3Raw[] };
  const mangas = Array.isArray(json?.data) ? json.data : [];
  todosV3Cache = { hecho: Date.now(), mangas };
  return mangas;
}

async function asegurarMapeoUuidDirectus(mangasV3: MangaV3Raw[]): Promise<void> {
  if (mapaUuidToV3.size > 0 && Date.now() - mapaUuidHecho < VIDA_CATALOGO_MS) {
    return;
  }
  try {
    const carpetas = await pedirCw<{ data: CarpetaCw[] }>(
      `/folders?filter[parent][_eq]=${CARPETA_MANGAS}&fields=id,name&limit=-1`,
      3600
    );
    if (!Array.isArray(carpetas?.data)) return;

    const porNormV3 = new Map<string, MangaV3Raw>();
    const porAssetV3 = new Map<string, MangaV3Raw>();
    for (const m of mangasV3) {
      if (m.nombre) porNormV3.set(normalizarCw(m.nombre), m);
      if (m.slug) porNormV3.set(normalizarCw(m.slug), m);
      if (m.nombre_alt_1) porNormV3.set(normalizarCw(m.nombre_alt_1), m);
      if (m.nombre_alt_2) porNormV3.set(normalizarCw(m.nombre_alt_2), m);
      if (m.portada_url) porAssetV3.set(m.portada_url.toLowerCase(), m);
    }

    const nuevoUuidToV3 = new Map<string, MangaV3Raw>();
    const nuevoNormToUuid = new Map<string, string>();

    for (const c of carpetas.data) {
      const nombreNorm = normalizarCw(c.name);
      const coincidencia = porNormV3.get(nombreNorm);
      if (coincidencia) {
        nuevoUuidToV3.set(c.id, coincidencia);
        nuevoNormToUuid.set(normalizarCw(coincidencia.nombre), c.id);
        if (coincidencia.slug) nuevoNormToUuid.set(normalizarCw(coincidencia.slug), c.id);
      }
    }

    mapaUuidToV3 = nuevoUuidToV3;
    mapaNormToUuid = nuevoNormToUuid;
    mapaUuidHecho = Date.now();
  } catch {
    // Si Directus no contesta en este momento, se conservan los mapeos previos
  }
}

/**
 * Resuelve cualquier identificador (UUID antiguo de Directus, slug de v3, o ID numérico de v3)
 * al manga correspondiente en Catharsis v3.
 */
export async function resolverMangaV3(
  idOrSlugOrUuid: string,
  tituloHint?: string | null
): Promise<{ v3Manga: MangaV3Raw; uuidHeredado: string | null }> {
  const clave = idOrSlugOrUuid.trim();
  const todos = await cargarTodosV3();
  await asegurarMapeoUuidDirectus(todos);

  // 1. Coincidencia directa por UUID heredado en memoria
  if (mapaUuidToV3.has(clave)) {
    return { v3Manga: mapaUuidToV3.get(clave)!, uuidHeredado: clave };
  }

  // 2. Coincidencia por ID numérico de v3
  if (/^\d+$/.test(clave)) {
    const numId = Number(clave);
    const m = todos.find((x) => x.id === numId);
    if (m) {
      const uuid = mapaNormToUuid.get(normalizarCw(m.nombre)) ?? null;
      return { v3Manga: m, uuidHeredado: uuid };
    }
  }

  // 3. Coincidencia por slug de v3
  const porSlug = todos.find((x) => x.slug === clave || normalizarCw(x.slug ?? "") === normalizarCw(clave));
  if (porSlug) {
    const uuid = mapaNormToUuid.get(normalizarCw(porSlug.nombre)) ?? null;
    return { v3Manga: porSlug, uuidHeredado: uuid };
  }

  // 4. Coincidencia por nombre normalizado
  const normClave = normalizarCw(clave);
  const porNombre = todos.find(
    (x) =>
      normalizarCw(x.nombre) === normClave ||
      normalizarCw(x.nombre_alt_1 ?? "") === normClave ||
      normalizarCw(x.nombre_alt_2 ?? "") === normClave
  );
  if (porNombre) {
    const uuid = mapaNormToUuid.get(normalizarCw(porNombre.nombre)) ?? null;
    return { v3Manga: porNombre, uuidHeredado: uuid };
  }

  // 5. Si es un UUID pero aún no estaba en el mapa, intentar consultar la carpeta en Directus
  const esUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clave);
  if (esUuid) {
    try {
      const f = await pedirCw<{ data: CarpetaCw }>(`/folders/${clave}`, 3600);
      if (f?.data?.name) {
        const normCarpeta = normalizarCw(f.data.name);
        const match = todos.find(
          (x) =>
            normalizarCw(x.nombre) === normCarpeta ||
            normalizarCw(x.slug ?? "") === normCarpeta ||
            normalizarCw(x.nombre_alt_1 ?? "") === normCarpeta
        );
        if (match) {
          mapaUuidToV3.set(clave, match);
          return { v3Manga: match, uuidHeredado: clave };
        }
      }
    } catch {}
  }

  // 6. Si se proporcionó pista de título (ej. desde ExternalSeries o historial), casar por título
  if (tituloHint) {
    const normTitulo = normalizarCw(tituloHint);
    const match = todos.find(
      (x) =>
        normalizarCw(x.nombre) === normTitulo ||
        normalizarCw(x.nombre_alt_1 ?? "") === normTitulo ||
        normalizarCw(x.nombre_alt_2 ?? "") === normTitulo ||
        normalizarCw(x.nombre).includes(normTitulo) ||
        normTitulo.includes(normalizarCw(x.nombre))
    );
    if (match) {
      if (esUuid) mapaUuidToV3.set(clave, match);
      return { v3Manga: match, uuidHeredado: esUuid ? clave : null };
    }
  }

  // 7. Fallback: pedir detalle individual a la API de v3
  try {
    const res = await fetch(`${CW_API_V3}/mangas/${encodeURIComponent(clave)}`, { headers: CW_HEADERS });
    if (res.ok) {
      const m = (await res.json()) as MangaV3Raw;
      if (m?.id && m.nombre) {
        return { v3Manga: m, uuidHeredado: esUuid ? clave : null };
      }
    }
  } catch {}

  throw new Error(`Serie de Catharsis no encontrada: ${idOrSlugOrUuid}`);
}

export async function catalogoCwServidor(fresco = false): Promise<SerieCatalogoCw[]> {
  if (!fresco && catalogoCache && Date.now() - catalogoCache.hecho < VIDA_CATALOGO_MS) {
    return catalogoCache.series;
  }

  const mangas = await cargarTodosV3(fresco);
  await asegurarMapeoUuidDirectus(mangas);

  const series: SerieCatalogoCw[] = mangas
    .filter((m) => (m.n_capitulos ?? 0) > 0)
    .map((m) => {
      const uuid = mapaNormToUuid.get(normalizarCw(m.nombre));
      return {
        // Si la serie tiene UUID heredado en la biblioteca previa, se conserva para
        // que "▣ En biblioteca" y las tarjetas coincidan exactamente con la base.
        id: uuid ?? m.slug ?? String(m.id),
        nombre: m.nombre.trim(),
        portada: m.portada_url ?? null,
        capitulos: m.n_capitulos ?? 0,
        slug: m.slug,
        v3Id: m.id,
      };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  catalogoCache = { hecho: Date.now(), series };
  return series;
}

export async function novedadesCwServidor(fresco = false): Promise<SerieCatalogoCw[]> {
  if (!fresco && novedadesCache && Date.now() - novedadesCache.hecho < VIDA_NOVEDADES_MS) {
    return novedadesCache.series;
  }

  const url = `${CW_API_V3}/mangas?page=1&limit=100&sort=-fecha_ultimo_capitulo&include_nsfw=true`;
  const res = await fetch(url, {
    headers: CW_HEADERS,
    ...(fresco ? { cache: "no-store" as const } : { next: { revalidate: 300 } }),
  });

  if (!res.ok) {
    // Si la llamada rápida de novedades falla, recurrir al catálogo general
    return catalogoCwServidor(fresco);
  }

  const json = (await res.json()) as { data?: MangaV3Raw[] };
  const rawList = Array.isArray(json?.data) ? json.data : [];
  const todos = await cargarTodosV3();
  await asegurarMapeoUuidDirectus(todos);

  const series: SerieCatalogoCw[] = rawList
    .filter((m) => (m.n_capitulos ?? 0) > 0)
    .map((m) => {
      const uuid = mapaNormToUuid.get(normalizarCw(m.nombre));
      return {
        id: uuid ?? m.slug ?? String(m.id),
        nombre: m.nombre.trim(),
        portada: m.portada_url ?? null,
        capitulos: m.n_capitulos ?? 0,
        slug: m.slug,
        v3Id: m.id,
      };
    });

  novedadesCache = { hecho: Date.now(), series };
  return series;
}

export async function serieCwServidor(
  idOrSlugOrUuid: string,
  fresco = false,
  tituloHint?: string | null
): Promise<FichaCw> {
  const { v3Manga, uuidHeredado } = await resolverMangaV3(idOrSlugOrUuid, tituloHint);

  // Pedir ficha completa con capítulos desde v3
  const res = await fetch(`${CW_API_V3}/mangas/${v3Manga.id}`, {
    headers: CW_HEADERS,
    ...(fresco ? { cache: "no-store" as const } : { next: { revalidate: 300 } }),
  });
  if (!res.ok) throw new Error(`Catharsis respondió ${res.status} al consultar serie`);
  const detalle = (await res.json()) as MangaV3Raw;

  const rawCapitulos = Array.isArray(detalle.capitulos) ? detalle.capitulos : [];
  const capitulos: CapituloCw[] = rawCapitulos
    .filter((c) => !c.estado || c.estado === "publicado")
    .map((c) => {
      const numFloat = typeof c.numero === "number" ? c.numero : parseFloat(String(c.numero));
      const numStr = String(c.numero).replace(/\.0$/, "");
      const fecha = c.date_created || c.fecha_publicacion || null;
      return {
        id: `${v3Manga.id}-cap-${numStr}`,
        numero: Number.isFinite(numFloat) ? numFloat : 0,
        etiqueta: numStr,
        name: numStr,
        fecha,
        published_at: fecha,
      };
    })
    .sort((a, b) => a.numero - b.numero);

  const generos = (detalle.fk_generos ?? [])
    .map((g) => g.generos_id?.nombre)
    .filter((n): n is string => Boolean(n));

  return {
    // Si se pidió con el UUID guardado de la biblioteca, se devuelve con ese mismo ID
    // para que la coincidencia de series guardadas y bookmarks sea 100% idéntica.
    id: uuidHeredado ?? idOrSlugOrUuid,
    nombre: detalle.nombre.trim(),
    portada: detalle.portada_url ?? null,
    capitulos,
    descripcion: detalle.descripcion ?? null,
    estado: detalle.estado ?? null,
    tipo: detalle.tipo ?? null,
    generos,
    v3Id: v3Manga.id,
    slug: v3Manga.slug,
  };
}

// ── Protocolo de lectura v3 (Cap PoW, Reader Pass, Page Ticket, Descramble) ─

let passCache: { pass: string; vence: number } | null = null;

function capPrng(seed: string, length: number): string {
  let state = -0x7ee3623b | 0;
  for (let i = 0; i < seed.length; i++) {
    state = Math.imul(state ^ seed.charCodeAt(i), 0x01000193);
  }
  let out = "";
  while (out.length < length) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    out += (state >>> 0).toString(16).padStart(8, "0");
  }
  return out.slice(0, length);
}

function solveCap(salt: string, target: string): number {
  for (let n = 0; ; n++) {
    const hex = crypto.createHash("sha256").update(`${salt}${n}`).digest("hex");
    if (hex.startsWith(target)) return n;
  }
}

export async function obtenerReaderPassCw(fresco = false): Promise<string> {
  if (!fresco && passCache && Date.now() < passCache.vence) {
    return passCache.pass;
  }

  const sysRes = await fetch(`${CW_API_V3}/system`, { headers: CW_HEADERS });
  if (!sysRes.ok) throw new Error("No se pudo obtener la configuración de Catharsis World");
  const sys = (await sysRes.json()) as { cap_sitekey: string; cap_api_endpoint: string };

  const capBase = sys.cap_api_endpoint.endsWith("/") ? sys.cap_api_endpoint : `${sys.cap_api_endpoint}/`;
  const chalRes = await fetch(`${capBase}challenge`, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      Origin: "https://newcatharsis.dig-it.info",
      Referer: "https://newcatharsis.dig-it.info/",
      "Sec-Fetch-Site": "cross-site",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Dest": "empty",
    },
  });
  if (!chalRes.ok) throw new Error("No se pudo iniciar la verificación de Catharsis World");
  const chal = (await chalRes.json()) as { challenge: { c: number; s: number; d: number }; token: string };

  const solutions: number[] = [];
  for (let i = 1; i <= chal.challenge.c; i++) {
    const salt = capPrng(`${chal.token}${i}`, chal.challenge.s);
    const target = capPrng(`${chal.token}${i}d`, chal.challenge.d);
    solutions.push(solveCap(salt, target));
  }

  const redeemRes = await fetch(`${capBase}redeem`, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/json",
      Origin: "https://newcatharsis.dig-it.info",
      Referer: "https://newcatharsis.dig-it.info/",
      "Sec-Fetch-Site": "cross-site",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Dest": "empty",
    },
    body: JSON.stringify({ token: chal.token, solutions }),
  });
  if (!redeemRes.ok) throw new Error("No se pudo validar la verificación de Catharsis World");
  const redeemed = (await redeemRes.json()) as { success: boolean; token: string };

  const passRes = await fetch(`${CW_API_V3}/mangas/reader-pass`, {
    method: "POST",
    headers: {
      ...CW_HEADERS,
      "Content-Type": "application/json",
      Origin: "https://newcatharsis.dig-it.info",
    },
    body: JSON.stringify({ token: redeemed.token, sitekey: sys.cap_sitekey }),
  });
  if (!passRes.ok) throw new Error("Catharsis rechazó el pase de lectura");
  const passDto = (await passRes.json()) as { pass: string; expiresAt?: number };

  const vence = passDto.expiresAt ? passDto.expiresAt - 60_000 : Date.now() + VIDA_PASES_MS;
  passCache = { pass: passDto.pass, vence };
  return passDto.pass;
}

interface ChapterSessionCache {
  sessionToken: string;
  cid: number;
  paginas: Array<{ index: number; pageId: string }>;
  vence: number;
}
const chapterSessions = new Map<string, ChapterSessionCache>();

export async function abrirCapituloCw(
  mangaId: number | string,
  capNum: string | number
): Promise<ChapterSessionCache> {
  const clave = `${mangaId}/${capNum}`;
  const enCache = chapterSessions.get(clave);
  if (enCache && Date.now() < enCache.vence) return enCache;

  let pass = await obtenerReaderPassCw();
  const capReferer = `https://newcatharsis.dig-it.info/manga/${mangaId}/chapter/${capNum}`;

  let res = await fetch(`${CW_API_V3}/mangas/${mangaId}/${capNum}`, {
    headers: {
      ...CW_HEADERS,
      "X-Catharsis-Reader-Pass": pass,
      Referer: capReferer,
    },
  });

  if (res.status === 403) {
    const cuerpo = (await res.json().catch(() => null)) as { code?: string; message?: string } | null;
    if (cuerpo?.code === "EARLY_ACCESS") {
      throw new Error(cuerpo.message || "Este capítulo está en acceso anticipado en Catharsis World.");
    }
    if (cuerpo?.code === "READER_PASS_REQUIRED") {
      passCache = null;
      pass = await obtenerReaderPassCw(true);
      res = await fetch(`${CW_API_V3}/mangas/${mangaId}/${capNum}`, {
        headers: {
          ...CW_HEADERS,
          "X-Catharsis-Reader-Pass": pass,
          Referer: capReferer,
        },
      });
    }
  }

  if (res.status === 401) {
    throw new Error("Este capítulo requiere iniciar sesión en Catharsis World.");
  }
  if (!res.ok) {
    throw new Error(`No se pudo abrir el capítulo en Catharsis World (${res.status})`);
  }

  const dto = (await res.json()) as {
    paginas?: Array<{ index: number; pageId: string }>;
    chapterSessionToken?: string;
  };

  if (!dto.chapterSessionToken) {
    throw new Error("Catharsis no entregó la clave de sesión del capítulo");
  }

  const payload = JSON.parse(
    Buffer.from(dto.chapterSessionToken.split(".")[0], "base64url").toString("utf8")
  ) as { cid: number; exp?: number };

  const sessionData: ChapterSessionCache = {
    sessionToken: dto.chapterSessionToken,
    cid: payload.cid,
    paginas: Array.isArray(dto.paginas) ? dto.paginas : [],
    vence: payload.exp ? payload.exp * 1000 - 60_000 : Date.now() + 30 * 60 * 1000,
  };
  chapterSessions.set(clave, sessionData);
  return sessionData;
}

export interface TicketPaginaCw {
  signedToken: string;
  scrambleKey: string | null;
  xorByte: number;
}

export async function obtenerTicketPaginaCw(
  mangaId: number | string,
  capNum: string | number,
  pageIndex: number
): Promise<TicketPaginaCw> {
  const capReferer = `https://newcatharsis.dig-it.info/manga/${mangaId}/chapter/${capNum}`;
  let session = await abrirCapituloCw(mangaId, capNum);

  for (let intento = 0; intento < 3; intento++) {
    const res = await fetch(`${CW_API_V3}/mangas/chapters/${session.cid}/page-ticket`, {
      method: "POST",
      headers: {
        ...CW_HEADERS,
        "Content-Type": "application/json",
        Origin: "https://newcatharsis.dig-it.info",
        Referer: capReferer,
      },
      body: JSON.stringify({ pageIndex, sessionToken: session.sessionToken }),
    });

    if (res.status === 429) {
      const waitDto = (await res.json().catch(() => null)) as { retryAfterMs?: number } | null;
      const ms = waitDto?.retryAfterMs ? waitDto.retryAfterMs + 200 : 2000;
      await new Promise((r) => setTimeout(r, ms));
      continue;
    }

    if (res.status === 401) {
      chapterSessions.delete(`${mangaId}/${capNum}`);
      session = await abrirCapituloCw(mangaId, capNum);
      continue;
    }

    if (!res.ok) {
      throw new Error(`No se pudo obtener el permiso de página (${res.status})`);
    }

    return (await res.json()) as TicketPaginaCw;
  }
  throw new Error("Límite de lectura de Catharsis alcanzado. Reintentá en unos segundos.");
}

function seededRandom(key: string): () => number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (Math.imul(hash, 31) + key.charCodeAt(i)) | 0;
  let state = hash | 0;
  return function () {
    state = (state + 1831565813) | 0;
    let y = state;
    y = Math.imul(y ^ (y >>> 15), y | 1);
    y = y ^ ((y + Math.imul(y ^ (y >>> 7), y | 61)) | 0);
    return ((y ^ (y >>> 14)) >>> 0) / 4294967296.0;
  };
}

/** Descifra en memoria los bloques 8x8 reordenados usando sharp en alto rendimiento. */
export async function descrambleBuffer(inputBuffer: Buffer, key: string): Promise<Buffer> {
  const { data, info } = await sharp(inputBuffer).raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels } = info;
  if (w < 200 || h < 200) return inputBuffer;

  const rand = seededRandom(key);
  const cols = 8;
  const rows = 8;

  const colBounds = new Int32Array(cols + 1);
  colBounds[0] = 0;
  colBounds[cols] = w;
  const baseColW = Math.floor(w / cols);
  let x = 0;
  for (let i = 0; i < cols - 1; i++) {
    let cw = baseColW + Math.round((rand() * 0.7 - 0.35) * baseColW);
    const remaining = cols - 1 - i;
    const maxW = w - x - remaining * 16;
    cw = Math.max(16, Math.min(Math.max(16, maxW), cw));
    x += cw;
    colBounds[i + 1] = x;
  }

  const rowBounds = new Int32Array(rows + 1);
  rowBounds[0] = 0;
  rowBounds[rows] = h;
  const baseRowH = Math.floor(h / rows);
  let yy = 0;
  for (let i = 0; i < rows - 1; i++) {
    let rh = baseRowH + Math.round((rand() * 0.7 - 0.35) * baseRowH);
    const remaining = rows - 1 - i;
    const maxH = h - yy - remaining * 16;
    rh = Math.max(16, Math.min(Math.max(16, maxH), rh));
    yy += rh;
    rowBounds[i + 1] = yy;
  }

  const colPerm = new Int32Array(cols);
  for (let i = 0; i < cols; i++) colPerm[i] = i;
  for (let i = cols - 1; i >= 1; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = colPerm[i];
    colPerm[i] = colPerm[j];
    colPerm[j] = tmp;
  }

  const rowPerm = new Int32Array(rows);
  for (let i = 0; i < rows; i++) rowPerm[i] = i;
  for (let i = rows - 1; i >= 1; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = rowPerm[i];
    rowPerm[i] = rowPerm[j];
    rowPerm[j] = tmp;
  }

  const invCol = new Int32Array(cols);
  for (let i = 0; i < cols; i++) invCol[colPerm[i]] = i;
  const invRow = new Int32Array(rows);
  for (let i = 0; i < rows; i++) invRow[rowPerm[i]] = i;

  const shuffledColPos = new Int32Array(cols + 1);
  shuffledColPos[0] = 0;
  for (let i = 0; i < cols; i++) {
    const shuffledIdx = colPerm[i];
    shuffledColPos[i + 1] = shuffledColPos[i] + (colBounds[shuffledIdx + 1] - colBounds[shuffledIdx]);
  }

  const shuffledRowPos = new Int32Array(rows + 1);
  shuffledRowPos[0] = 0;
  for (let i = 0; i < rows; i++) {
    const shuffledIdx = rowPerm[i];
    shuffledRowPos[i + 1] = shuffledRowPos[i] + (rowBounds[shuffledIdx + 1] - rowBounds[shuffledIdx]);
  }

  const out = Buffer.alloc(data.length);
  const rowStride = w * channels;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const dx = colBounds[col];
      const dy = rowBounds[row];
      const dw = colBounds[col + 1] - colBounds[col];
      const dh = rowBounds[row + 1] - rowBounds[row];
      const sx = shuffledColPos[invCol[col]];
      const sy = shuffledRowPos[invRow[row]];

      const copyBytesPerRow = dw * channels;
      for (let r = 0; r < dh; r++) {
        const srcOffset = (sy + r) * rowStride + sx * channels;
        const dstOffset = (dy + r) * rowStride + dx * channels;
        data.copy(out, dstOffset, srcOffset, srcOffset + copyBytesPerRow);
      }
    }
  }

  return sharp(out, { raw: { width: w, height: h, channels } }).webp({ quality: 90 }).toBuffer();
}

export async function obtenerImagenPaginaCw(
  mangaId: number | string,
  capNum: string | number,
  pageIndex: number
): Promise<{ buffer: Buffer; contentType: string }> {
  const ticket = await obtenerTicketPaginaCw(mangaId, capNum, pageIndex);
  const capReferer = `https://newcatharsis.dig-it.info/manga/${mangaId}/chapter/${capNum}`;

  const imgRes = await fetch(`${CW_API_V3}/mangas/pages/${ticket.signedToken}`, {
    headers: {
      "User-Agent": UA,
      Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      "X-Catharsis-Reader": "1",
      Referer: capReferer,
      "Sec-CH-UA": CW_HEADERS["Sec-CH-UA"],
      "Sec-CH-UA-Mobile": "?0",
      "Sec-CH-UA-Platform": '"Windows"',
      "Sec-Fetch-Site": "same-origin",
      "Sec-Fetch-Mode": "no-cors",
      "Sec-Fetch-Dest": "image",
    },
  });

  if (!imgRes.ok) {
    throw new Error(`Catharsis rechazó la descarga de la página (${imgRes.status})`);
  }

  let buf: Buffer = Buffer.from(await imgRes.arrayBuffer());
  if (ticket.xorByte) {
    for (let i = 0; i < buf.length; i++) buf[i] ^= ticket.xorByte;
  }

  if (ticket.scrambleKey) {
    buf = await descrambleBuffer(buf, ticket.scrambleKey);
  }

  return { buffer: buf, contentType: "image/webp" };
}
