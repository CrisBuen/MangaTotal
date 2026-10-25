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
 * Descarga una imagen en su calidad máxima FullHD original con reintentos automáticos.
 * Primero intenta descarga directa del CDN original; si falla por CORS o protección,
 * recurre a /api/externo/imagen que retransmite el flujo binario idéntico sin comprimir.
 */
export async function descargarBlobOriginal(url: string, signal?: AbortSignal): Promise<Blob> {
  let ultimoError: unknown = null;

  for (let intento = 0; intento < 3; intento++) {
    if (signal?.aborted) throw new Error("Descarga cancelada");
    try {
      // 1. Intento directo del cliente (salvo que ya sea ruta proxy local)
      if (intento === 0 && !url.startsWith("/api/externo/imagen")) {
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
          // Bloqueado por CORS o referer: usar canal de streaming proxy
        }
      }

      // 2. Respaldo streaming idéntico (sin compresión ni paso por almacenamiento R2)
      const proxyUrl = url.startsWith("/api/externo/imagen")
        ? url
        : `/api/externo/imagen?u=${encodeURIComponent(url)}`;
      const resProxy = await fetch(proxyUrl, { signal });
      if (resProxy.ok) {
        const blob = await resProxy.blob();
        if (blob.size > 200) return blob;
      }
      ultimoError = new Error(`Error al descargar página (${resProxy.status})`);
    } catch (err) {
      ultimoError = err;
    }

    if (signal?.aborted) throw new Error("Descarga cancelada");
    // Esperar brevemente antes de reintentar si falló una página aislada
    await new Promise((r) => setTimeout(r, 600 * (intento + 1)));
  }

  throw ultimoError instanceof Error ? ultimoError : new Error("No se pudo descargar la página");
}

export interface ProgresoDescarga {
  fase: "conectando" | "descargando" | "guardando" | "completado";
  actual: number;
  total: number;
  porcentaje: number;
}

// Manija de carpeta guardada en memoria durante la sesión en PC para no pedir permiso a cada capítulo
let manijaCarpetaRaiz: FileSystemDirectoryHandle | null = null;

/**
 * En PC (Chrome, Edge), pide la carpeta de destino durante el gesto del usuario
 * para cumplir las reglas de seguridad de File System Access API.
 */
export async function prepararCarpetaDestinoPC(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const w = window as unknown as {
    showDirectoryPicker?: (opciones?: { mode?: string }) => Promise<FileSystemDirectoryHandle>;
  };
  if (typeof w.showDirectoryPicker !== "function") return false;
  if (manijaCarpetaRaiz) return true;

  try {
    manijaCarpetaRaiz = await w.showDirectoryPicker({ mode: "readwrite" });
    return true;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Descarga cancelada por el usuario");
    }
    return false;
  }
}

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
  verificarYPedirPermisosAlmacenamiento?: () => Promise<{
    concedido: boolean;
    abrioAjustes?: boolean;
    ruta?: string;
  }>;
  iniciarDescarga?: (opciones: {
    fuente: string;
    serie: string;
    capitulo: string;
    urls: string[];
  }) => Promise<{ ok: boolean; mensaje?: string }>;
  guardarArchivo?: (opciones: {
    fuente: string;
    serie: string;
    capitulo: string;
    nombre: string;
    dataBase64: string;
  }) => Promise<{ ok: boolean }>;
  guardarCapitulo?: (opciones: {
    fuente: string;
    serie: string;
    capitulo: string;
    archivos: { nombre: string; dataBase64: string }[];
  }) => Promise<{ ok: boolean; guardados: number; ruta: string }>;
  avisarDescargaCompletada?: (opciones: {
    fuente: string;
    serie: string;
    capitulo: string;
    total: number;
  }) => Promise<void>;
  addListener?: (
    eventName: string,
    listenerFunc: (data: any) => void
  ) => Promise<{ remove: () => Promise<void> | void }>;
}

export function pluginFuentesAndroid(): Required<PluginFuentesDescarga> | null {
  if (typeof window === "undefined") return null;
  const c = (window as unknown as {
    Capacitor?: {
      Plugins?: { Fuentes?: PluginFuentesDescarga };
      registerPlugin?: (nombre: string) => PluginFuentesDescarga;
    };
  }).Capacitor;
  if (!c) return null;
  if (c.Plugins?.Fuentes) return c.Plugins.Fuentes as Required<PluginFuentesDescarga>;
  if (typeof c.registerPlugin === "function") {
    try {
      const p = c.registerPlugin("Fuentes");
      if (p) return p as Required<PluginFuentesDescarga>;
    } catch {}
  }
  return null;
}

const CLAVE_DESCARGAS = "mangatotal_descargas_locales_v1";

/** Comprueba si el capítulo ya se descargó localmente en este dispositivo */
export function esCapituloDescargado(fuente: string, serie: string, capitulo: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(CLAVE_DESCARGAS);
    if (!raw) return false;
    const lista = JSON.parse(raw) as string[];
    const id = `${limpiarNombreArchivo(fuente)}::${limpiarNombreArchivo(serie)}::${limpiarNombreArchivo(capitulo)}`;
    return lista.includes(id);
  } catch {
    return false;
  }
}

/** Registra el capítulo descargado para mostrar el estado en la interfaz */
export function marcarCapituloDescargado(fuente: string, serie: string, capitulo: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(CLAVE_DESCARGAS);
    const lista: string[] = raw ? JSON.parse(raw) : [];
    const id = `${limpiarNombreArchivo(fuente)}::${limpiarNombreArchivo(serie)}::${limpiarNombreArchivo(capitulo)}`;
    if (!lista.includes(id)) {
      lista.push(id);
      localStorage.setItem(CLAVE_DESCARGAS, JSON.stringify(lista));
    }
  } catch {}
}

/** En Android, comprueba y pide el permiso de almacenamiento para la carpeta MangaTotal estilo Mihon */
export async function asegurarPermisosAlmacenamientoAndroid(): Promise<boolean> {
  const plugin = pluginFuentesAndroid();
  if (!plugin?.verificarYPedirPermisosAlmacenamiento) return true;
  try {
    const res = await plugin.verificarYPedirPermisosAlmacenamiento();
    if (!res.concedido && res.abrioAjustes) {
      throw new Error("Permiso de almacenamiento necesario: activa 'Acceso a todos los archivos' en Ajustes");
    }
    return res.concedido;
  } catch (err) {
    if (err instanceof Error && err.message.includes("Permiso de almacenamiento")) throw err;
    return true;
  }
}

/**
 * Guarda los archivos en Android a través del puente nativo en:
 * Download/MangaTotal/descargas/{fuente}/{serie}/{capitulo}/{nombre}
 * Procesando archivo por archivo para no saturar memoria RAM ni límites del IPC nativo.
 */
async function guardarConAndroid(
  fuente: string,
  serie: string,
  capitulo: string,
  archivos: { nombre: string; blob: Blob }[],
  onProgreso?: (p: ProgresoDescarga) => void
): Promise<boolean> {
  const plugin = pluginFuentesAndroid();
  if (!plugin) return false;

  const total = archivos.length;

  if (plugin.guardarArchivo) {
    for (let i = 0; i < total; i++) {
      const { nombre, blob } = archivos[i];
      const dataBase64 = await blobABase64(blob);
      await plugin.guardarArchivo({ fuente, serie, capitulo, nombre, dataBase64 });

      onProgreso?.({
        fase: "guardando",
        actual: i + 1,
        total,
        porcentaje: 85 + Math.round(((i + 1) / total) * 15),
      });
    }

    if (plugin.avisarDescargaCompletada) {
      void plugin.avisarDescargaCompletada({ fuente, serie, capitulo, total });
    }
    return true;
  }

  if (plugin.guardarCapitulo) {
    // Si la versión nativa aún solo tiene guardarCapitulo, enviar en micro-lotes de 5 para no saturar
    const LOTE = 5;
    for (let i = 0; i < total; i += LOTE) {
      const lote = archivos.slice(i, i + LOTE);
      const loteB64 = await Promise.all(
        lote.map(async ({ nombre, blob }) => ({
          nombre,
          dataBase64: await blobABase64(blob),
        }))
      );
      await plugin.guardarCapitulo({
        fuente,
        serie,
        capitulo,
        archivos: loteB64,
      });

      onProgreso?.({
        fase: "guardando",
        actual: Math.min(i + LOTE, total),
        total,
        porcentaje: 85 + Math.round((Math.min(i + LOTE, total) / total) * 15),
      });
    }
    return true;
  }

  return false;
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
  if (!manijaCarpetaRaiz) {
    const w = window as unknown as {
      showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
    };
    if (typeof w.showDirectoryPicker !== "function") return false;
    try {
      manijaCarpetaRaiz = await w.showDirectoryPicker();
    } catch {
      return false;
    }
  }

  try {
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
        porcentaje: 85 + Math.round(((i + 1) / total) * 15),
      });
    }

    return true;
  } catch (err: unknown) {
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
    compression: "STORE", // Sin comprimir para velocidad máxima instantánea y cero degradación
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
 * 3. En Android nativo: guarda mediante puente seguro en Download/MangaTotal/descargas/...
 * 4. En PC con File System Access: guarda en la carpeta local elegida por el usuario.
 * 5. Fallback universal: genera el paquete ZIP organizado por carpetas.
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

  // 1. En Android nativo: delegar la descarga al Foreground Service con notificación
  // y WakeLock. Guarda directamente en /storage/emulated/0/MangaTotal/descargas/{fuente}/{serie}/{capitulo}/
  // sin pasar por Vercel, R2 ni proxies intermedios. Funciona 100% en segundo plano.
  const pluginAndroid = pluginFuentesAndroid();
  if (pluginAndroid?.iniciarDescarga) {
    onProgreso?.({
      fase: "descargando",
      actual: 0,
      total: urls.length,
      porcentaje: 2,
    });

    await new Promise<void>(async (resolve, reject) => {
      let terminado = false;
      let handleProgreso: { remove: () => void | Promise<void> } | null = null;
      let handleFin: { remove: () => void | Promise<void> } | null = null;

      const limpiar = () => {
        if (!terminado) {
          terminado = true;
          try { void handleProgreso?.remove(); } catch {}
          try { void handleFin?.remove(); } catch {}
          resolve();
        }
      };

      if (typeof pluginAndroid.addListener === "function") {
        try {
          handleProgreso = await pluginAndroid.addListener("descargaProgreso", (datos: {
            capitulo?: string;
            actual: number;
            total: number;
            porcentaje: number;
          }) => {
            if (datos && (!datos.capitulo || datos.capitulo === capitulo)) {
              onProgreso?.({
                fase: "descargando",
                actual: datos.actual,
                total: datos.total,
                porcentaje: datos.porcentaje,
              });
            }
          });

          handleFin = await pluginAndroid.addListener("descargaCompletada", (datos: {
            capitulo?: string;
            total: number;
          }) => {
            if (datos && (!datos.capitulo || datos.capitulo === capitulo)) {
              marcarCapituloDescargado(fuente, serie, capitulo);
              onProgreso?.({
                fase: "completado",
                actual: datos.total,
                total: datos.total,
                porcentaje: 100,
              });
              limpiar();
            }
          });
        } catch {}
      }

      try {
        await pluginAndroid.iniciarDescarga({
          fuente,
          serie,
          capitulo,
          urls,
        });
        marcarCapituloDescargado(fuente, serie, capitulo);
      } catch (err) {
        limpiar();
        reject(err);
        return;
      }

      // Si el usuario sale o si los eventos IPC no se reciben directamente en la vista web,
      // cerramos tras 3 segundos para dejar libre la UI; el Foreground Service sigue en el sistema.
      setTimeout(() => {
        if (!handleFin) {
          limpiar();
        }
      }, 3000);
    });

    return;
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

  // 1. En Android nativo: guardar directamente en la carpeta de descargas
  let guardado = false;
  try {
    guardado = await guardarConAndroid(fuente, serie, capitulo, archivos, onProgreso);
  } catch (err) {
    console.warn("No se pudo guardar mediante puente nativo de Android:", err);
  }

  // 2. En PC con File System Access API (Chrome, Edge, Opera)
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

  marcarCapituloDescargado(fuente, serie, capitulo);

  onProgreso?.({
    fase: "completado",
    actual: total,
    total,
    porcentaje: 100,
  });
}
