import JSZip from "jszip";

/**
 * Limpia caracteres inválidos para nombres de archivos y carpetas en Windows/Android.
 */
export function limpiarNombreArchivo(nombre: string): string {
  return nombre
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

/**
 * Determina la extensión correcta de archivo a partir de la URL o el Content-Type del blob.
 */
function extensionDesdeBlob(blob: Blob, url: string): string {
  const mime = blob.type.toLowerCase();
  if (mime.includes("webp")) return "webp";
  if (mime.includes("png")) return "png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("avif")) return "avif";

  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\.(webp|png|jpe?g|gif|avif)$/i);
    if (match) return match[1].toLowerCase() === "jpeg" ? "jpg" : match[1].toLowerCase();
  } catch {}

  return "jpg";
}

/**
 * Descarga una imagen en su calidad máxima FullHD original.
 * Primero intenta descarga directa del CDN original; si el navegador la bloquea por CORS,
 * recurre a /api/externo/imagen que retransmite el flujo binario idéntico sin comprimir.
 */
export async function descargarBlobOriginal(url: string, signal?: AbortSignal): Promise<Blob> {
  // 1. Intento directo cliente -> servidor de la fuente
  try {
    const resDirecta = await fetch(url, {
      mode: "cors",
      signal,
    });
    if (resDirecta.ok) {
      const blob = await resDirecta.blob();
      if (blob.size > 1000) return blob;
    }
  } catch {
    // Si CORS o escudos bloquean la petición directa, pasa al canal de respaldo
  }

  // 2. Respaldo streaming idéntico (sin compresión ni paso por almacenamiento R2)
  const proxyUrl = `/api/externo/imagen?u=${encodeURIComponent(url)}`;
  const resProxy = await fetch(proxyUrl, { signal });
  if (!resProxy.ok) {
    throw new Error(`No se pudo descargar la página (${resProxy.status})`);
  }
  return resProxy.blob();
}

export interface ProgresoDescarga {
  fase: "conectando" | "descargando" | "guardando" | "completado";
  actual: number;
  total: number;
  porcentaje: number;
}

// Manija de carpeta guardada en memoria durante la sesión para no pedir permisos a cada capítulo
let manijaCarpetaRaiz: FileSystemDirectoryHandle | null = null;

/**
 * Convierte un Blob en base64 para enviarlo a través del puente nativo de Capacitor en Android.
 */
function blobABase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = reader.result as string;
      const base64 = res.substring(res.indexOf(",") + 1);
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Error al procesar la imagen para guardar"));
    reader.readAsDataURL(blob);
  });
}

interface PluginFuentesDescarga {
  guardarCapitulo?: (opciones: {
    fuente: string;
    serie: string;
    capitulo: string;
    archivos: { nombre: string; dataBase64: string }[];
  }) => Promise<{ ok: boolean; guardados: number; ruta: string }>;
}

function pluginFuentesAndroid(): Required<PluginFuentesDescarga> | null {
  if (typeof window === "undefined") return null;
  const c = (window as unknown as {
    Capacitor?: {
      Plugins?: { Fuentes?: PluginFuentesDescarga };
      registerPlugin?: (nombre: string) => PluginFuentesDescarga;
    };
  }).Capacitor;
  if (!c) return null;
  if (c.Plugins?.Fuentes?.guardarCapitulo) return c.Plugins.Fuentes as Required<PluginFuentesDescarga>;
  if (typeof c.registerPlugin === "function") {
    try {
      const p = c.registerPlugin("Fuentes");
      if (p?.guardarCapitulo) return p as Required<PluginFuentesDescarga>;
    } catch {}
  }
  return null;
}

/**
 * Guarda los archivos en Android a través del puente nativo en:
 * Download/MangaTotal/descargas/{fuente}/{serie}/{capitulo}/{nombre}
 */
async function guardarConAndroid(
  fuente: string,
  serie: string,
  capitulo: string,
  archivos: { nombre: string; blob: Blob }[],
  onProgreso?: (p: ProgresoDescarga) => void
): Promise<boolean> {
  const plugin = pluginFuentesAndroid();
  if (!plugin?.guardarCapitulo) return false;

  const total = archivos.length;
  const archivosB64: { nombre: string; dataBase64: string }[] = [];

  for (let i = 0; i < total; i++) {
    const { nombre, blob } = archivos[i];
    const dataBase64 = await blobABase64(blob);
    archivosB64.push({ nombre, dataBase64 });

    onProgreso?.({
      fase: "guardando",
      actual: i + 1,
      total,
      porcentaje: 85 + Math.round(((i + 1) / total) * 15),
    });
  }

  await plugin.guardarCapitulo({
    fuente,
    serie,
    capitulo,
    archivos: archivosB64,
  });

  return true;
}

/**
 * Guarda los archivos directamente en el sistema de archivos del usuario si el navegador
 * soporta la API File System Access (Chrome, Edge, Opera en PC).
 * Crea la estructura: MangaTotal/descargas/{fuente}/{serie}/{capitulo}/{001.ext}
 */
async function guardarConFileSystemAccess(
  fuente: string,
  serie: string,
  capitulo: string,
  archivos: { nombre: string; blob: Blob }[],
  onProgreso?: (p: ProgresoDescarga) => void
): Promise<boolean> {
  const w = window as unknown as {
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
  };
  if (typeof w.showDirectoryPicker !== "function") {
    return false;
  }

  try {
    if (!manijaCarpetaRaiz) {
      manijaCarpetaRaiz = await w.showDirectoryPicker();
    }

    let dRaiz = manijaCarpetaRaiz;
    if (dRaiz.name.toLowerCase() !== "mangatotal") {
      try {
        dRaiz = await manijaCarpetaRaiz.getDirectoryHandle("MangaTotal", { create: true });
      } catch {
        dRaiz = manijaCarpetaRaiz;
      }
    }
    const dDescargas = await dRaiz.getDirectoryHandle("descargas", { create: true });
    const dFuente = await dDescargas.getDirectoryHandle(limpiarNombreArchivo(fuente), { create: true });
    const dSerie = await dFuente.getDirectoryHandle(limpiarNombreArchivo(serie), { create: true });
    const dCapitulo = await dSerie.getDirectoryHandle(limpiarNombreArchivo(capitulo), { create: true });

    const total = archivos.length;
    for (let i = 0; i < total; i++) {
      const { nombre, blob } = archivos[i];
      const archivoHandle = await dCapitulo.getFileHandle(nombre, { create: true });
      const writable = await archivoHandle.createWritable();
      await writable.write(blob);
      await writable.close();

      onProgreso?.({
        fase: "guardando",
        actual: i + 1,
        total,
        porcentaje: Math.round(((i + 1) / total) * 100),
      });
    }

    return true;
  } catch (err: unknown) {
    // Si el usuario canceló el selector de carpetas o revocó permisos, limpiar caché y devolver false
    manijaCarpetaRaiz = null;
    if (err instanceof Error && err.name === "AbortError") {
      throw err;
    }
    return false;
  }
}

/**
 * Descarga el capítulo como paquete ZIP con la estructura de carpetas interna:
 * MangaTotal/descargas/{fuente}/{serie}/{capitulo}/{001.ext}
 * Compatible con Android, Firefox, Safari y navegadores sin File System Access.
 */
async function guardarComoZip(
  fuente: string,
  serie: string,
  capitulo: string,
  archivos: { nombre: string; blob: Blob }[],
  onProgreso?: (p: ProgresoDescarga) => void
): Promise<void> {
  const zip = new JSZip();
  const rutaBase = `MangaTotal/descargas/${limpiarNombreArchivo(fuente)}/${limpiarNombreArchivo(serie)}/${limpiarNombreArchivo(capitulo)}`;

  const carpeta = zip.folder(rutaBase) || zip;
  for (const { nombre, blob } of archivos) {
    carpeta.file(nombre, blob);
  }

  onProgreso?.({
    fase: "guardando",
    actual: archivos.length,
    total: archivos.length,
    porcentaje: 95,
  });

  const contenido = await zip.generateAsync({
    type: "blob",
    compression: "STORE", // Sin comprimir para conservar calidad máxima FullHD instantánea
  });

  const url = URL.createObjectURL(contenido);
  const nombreZip = `[${limpiarNombreArchivo(fuente)}] ${limpiarNombreArchivo(serie)} - ${limpiarNombreArchivo(capitulo)}.zip`;

  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreZip;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);

  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Flujo completo de descarga local de un capítulo:
 * 1. Pide la lista de URLs de las páginas a la fuente.
 * 2. Descarga todas las imágenes en paralelo con calidad completa FullHD.
 * 3. En PC con File System Access: pide permiso de carpeta y guarda los archivos en
 *    MangaTotal/descargas/{fuente}/{serie}/{capítulo}/...
 * 4. En Android o fallback: descarga el archivo organizado respetando las carpetas.
 */
export async function descargarCapituloLocal(opciones: {
  fuente: string;
  serie: string;
  capitulo: string;
  obtenerPaginas: () => Promise<string[]>;
  onProgreso?: (p: ProgresoDescarga) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const { fuente, serie, capitulo, obtenerPaginas, onProgreso, signal } = opciones;

  onProgreso?.({
    fase: "conectando",
    actual: 0,
    total: 0,
    porcentaje: 0,
  });

  const urls = await obtenerPaginas();
  if (!urls || urls.length === 0) {
    throw new Error("No se encontraron páginas para este capítulo");
  }

  const total = urls.length;
  const archivos: { nombre: string; blob: Blob }[] = new Array(total);
  let descargadas = 0;

  // Lotes concurrentes de 4 imágenes para descarga rápida y estable
  const CONCURRENCIA = 4;
  let cursor = 0;

  async function trabajador() {
    while (cursor < total) {
      if (signal?.aborted) throw new Error("Descarga cancelada");
      const idx = cursor++;
      const url = urls[idx];
      const blob = await descargarBlobOriginal(url, signal);

      const ext = extensionDesdeBlob(blob, url);
      const numeroPadded = String(idx + 1).padStart(3, "0");
      const nombre = `${numeroPadded}.${ext}`;

      archivos[idx] = { nombre, blob };
      descargadas++;

      onProgreso?.({
        fase: "descargando",
        actual: descargadas,
        total,
        porcentaje: Math.round((descargadas / total) * 85),
      });
    }
  }

  const trabajadores = Array.from({ length: Math.min(CONCURRENCIA, total) }, () => trabajador());
  await Promise.all(trabajadores);

  if (signal?.aborted) throw new Error("Descarga cancelada");

  onProgreso?.({
    fase: "guardando",
    actual: total,
    total,
    porcentaje: 85,
  });

  // 1. En Android nativo: guardar directamente en la carpeta pública de descargas
  let guardado = false;
  try {
    guardado = await guardarConAndroid(fuente, serie, capitulo, archivos, onProgreso);
  } catch (err) {
    console.warn("No se pudo guardar mediante puente nativo de Android:", err);
  }

  // 2. En PC con File System Access API (Chrome, Edge, Opera): selector de carpeta directo
  if (!guardado) {
    try {
      guardado = await guardarConFileSystemAccess(fuente, serie, capitulo, archivos, onProgreso);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error("Descarga cancelada por el usuario");
      }
    }
  }

  // 3. Fallback universal (móvil web, Firefox, Safari): descarga como archivo ZIP estructurado
  if (!guardado) {
    await guardarComoZip(fuente, serie, capitulo, archivos, onProgreso);
  }

  onProgreso?.({
    fase: "completado",
    actual: total,
    total,
    porcentaje: 100,
  });
}
