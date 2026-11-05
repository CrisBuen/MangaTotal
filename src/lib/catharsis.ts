/**
 * Catharsis World, integrada con su permiso.
 *
 * Con Catharsis v3, el catálogo y las novedades se procesan desde su API
 * REST pública. Las imágenes de portada provienen de su CDN optimizado, y
 * las páginas de los capítulos se cargan y descifran mediante tickets de lectura
 * firmados y decodificación de cuadrícula de 8x8.
 */

export const CW_NOMBRE = "Catharsis World";
export const CW_WEB = "https://newcatharsis.dig-it.info";

/** De donde salen las portadas e imágenes de assets. Acepta recortes. */
const CW_ASSETS = "https://direct-new-catha.catharsisfood.com/assets";

export interface SerieCw {
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

export interface PaginaCw {
  numero: number;
  id: string;
  ancho: number;
  alto: number;
}

export type OrdenCw = "nombre" | "novedades" | "capitulos";

/**
 * La dirección de una imagen, al tamaño que se va a ver.
 *
 * Para portadas (UUID), utiliza el almacén directo con redimensión WebP.
 * Para páginas de lectura ("mangaId/capNum/pageIndex"), apunta al endpoint
 * de entrega optimizado o al decodificador nativo.
 */
export function imagenCw(id: string, ancho?: number): string {
  if (!id) return "";
  if (id.startsWith("http://") || id.startsWith("https://")) return id;
  // Si es un UUID de portada o asset en Directus:
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    if (!ancho) return `${CW_ASSETS}/${id}`;
    return `${CW_ASSETS}/${id}?width=${ancho}&quality=72&format=webp`;
  }
  // Si es un descriptor de página:
  return `/api/externo/catharsis?accion=imagen&p=${encodeURIComponent(id)}`;
}

async function pedir<T>(consulta: string, fresco: boolean): Promise<T> {
  const res = await fetch(`/api/externo/catharsis?${consulta}${fresco ? "&fresco=1" : ""}`, {
    ...(fresco ? { cache: "no-store" as const } : {}),
  });

  if (!res.ok) {
    const cuerpo = await res.json().catch(() => null);
    throw new Error(
      (cuerpo as { error?: string } | null)?.error ?? `${CW_NOMBRE} respondió ${res.status}`
    );
  }
  return (await res.json()) as T;
}

/** Una página del catálogo, ya filtrada y ordenada por el servidor. */
export async function catalogoCw(opciones: {
  busqueda?: string;
  pagina?: number;
  orden?: OrdenCw;
  fresco?: boolean;
}): Promise<{ series: SerieCw[]; total: number; paginas: number }> {
  const q = new URLSearchParams({
    accion: "catalogo",
    orden: opciones.orden ?? "nombre",
    pagina: String(opciones.pagina ?? 1),
  });
  if (opciones.busqueda?.trim()) q.set("q", opciones.busqueda.trim());

  return pedir(q.toString(), opciones.fresco === true);
}

/** La ficha de una serie con todos sus capítulos, sin límite. */
export async function serieCw(id: string, fresco = false, tituloHint?: string | null): Promise<FichaCw> {
  const qs = new URLSearchParams({
    accion: "serie",
    id,
  });
  if (tituloHint?.trim()) qs.set("titulo", tituloHint.trim());
  return pedir(qs.toString(), fresco);
}

/** Las páginas de un capítulo, en orden. */
export async function paginasCw(
  id: string,
  fresco = false,
  serieId?: string | null
): Promise<{ paginas: PaginaCw[] }> {
  const qs = new URLSearchParams({
    accion: "capitulo",
    id,
  });
  if (serieId?.trim()) qs.set("serie", serieId.trim());
  return pedir(qs.toString(), fresco);
}

// ── Decodificador de lienzo (Canvas) en el dispositivo del usuario ─────────

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

function esFirmaImagen(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return true; // JPEG
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return true; // PNG
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return true; // WEBP
  }
  return false;
}

/**
 * Reensambla una página desordenada de Catharsis World en un lienzo acelerado por GPU
 * sin necesidad de procesamiento en el servidor.
 */
export async function descrambleCanvas(
  rawBytes: Uint8Array,
  scrambleKey?: string | null,
  xorByte?: number | null
): Promise<Blob> {
  const bytes = new Uint8Array(rawBytes);
  if (xorByte && !esFirmaImagen(bytes)) {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] ^= xorByte;
    }
  }

  const plainBlob = new Blob([bytes], { type: "image/webp" });
  if (!scrambleKey || typeof window === "undefined" || typeof createImageBitmap === "undefined") {
    return plainBlob;
  }

  try {
    const bitmap = await createImageBitmap(plainBlob);
    const w = bitmap.width;
    const h = bitmap.height;
    if (w < 200 || h < 200) {
      bitmap.close();
      return plainBlob;
    }

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: false });
    if (!ctx) {
      bitmap.close();
      return plainBlob;
    }

    ctx.imageSmoothingEnabled = false;

    const rand = seededRandom(scrambleKey);
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

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const dx = colBounds[col];
        const dy = rowBounds[row];
        const dw = colBounds[col + 1] - colBounds[col];
        const dh = rowBounds[row + 1] - rowBounds[row];
        const sx = shuffledColPos[invCol[col]];
        const sy = shuffledRowPos[invRow[row]];
        ctx.drawImage(bitmap, sx, sy, dw, dh, dx, dy, dw, dh);
      }
    }

    bitmap.close();

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob || plainBlob), "image/webp", 0.95);
    });
  } catch {
    return plainBlob;
  }
}
