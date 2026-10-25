import JSZip from "jszip";

/**
 * Limpia caracteres inválidos para nombres de archivos y carpetas en Windows/Android.
 * Windows y la API File System Access de Chromium rechazan carpetas que terminan en punto (".")
 * o espacio (" "), nombres reservados de DOS o rutas que superen MAX_PATH (260 caracteres).
 */
export function limpiarNombreArchivo(nombre: string): string {
  const limpio = nombre
    .replace(/[\u0000-\u001f\u007f-\u009f\\/:*?"<>|~]/g, "_")
    .replace(/\.+/g, ".")
    .replace(/\s+/g, " ")
    .replace(/^[.\s_]+|[.\s_]+$/g, "")
    .slice(0, 64)
    .replace(/^[.\s_]+|[.\s_]+$/g, "")
    .trim();

  if (!limpio || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i.test(limpio)) {
    return "Capitulo";
  }
  return limpio;
}

/**
 * Nombre ASCII de respaldo por si el sistema de archivos de Windows rechaza
 * algún carácter especial Unicode o combinación particular del título.
 */
function nombreCarpetaRespaldoAscii(nombre: string, porDefecto: string): string {
  const ascii = nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 _-]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/^[_\s-]+|[_\s-]+$/g, "")
    .slice(0, 48)
    .replace(/^[_\s-]+|[_\s-]+$/g, "")
    .trim();
  if (!ascii || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(ascii)) {
    return porDefecto;
  }
  return ascii;
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
    const pathname = new URL(url, "https://mangatotal.local").pathname;
    const match = pathname.match(/\.(webp|png|jpe?g|gif|avif)$/i);
    if (match) return match[1].toLowerCase() === "jpeg" ? "jpg" : match[1].toLowerCase();
  } catch {}

  return "jpg";
}

/** Dominios cuyos CDN exigen Referer propio y bloquean fetch CORS directo desde el navegador. */
const REQUIERE_PROXY_REFERER =
  /gold-usergeneratedcontent\.net|hitomi\.la|e-hentai\.org|exhentai\.org|hath\.network|leercapitulo|zonatmo|visortmo|tumangaonline|ikigai/i;

/**
 * Descarga una imagen en su calidad máxima FullHD original con reintentos automáticos.
 * Primero intenta descarga directa del CDN original (si soporta CORS sin Referer);
 * si requiere Referer o falla por CORS, recurre a /api/externo/imagen que retransmite
 * el flujo binario idéntico sin comprimir.
 */
export async function descargarBlobOriginal(url: string, signal?: AbortSignal): Promise<Blob> {
  let ultimoError: unknown = null;
  const usarProxyDirecto =
    url.startsWith("/api/externo/imagen") || REQUIERE_PROXY_REFERER.test(url);

  for (let intento = 0; intento < 3; intento++) {
    if (signal?.aborted) throw new Error("Descarga cancelada");
    try {
      // 1. Intento directo del cliente solo si el CDN no bloquea por Referer/CORS
      if (intento === 0 && !usarProxyDirecto) {
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

      // 2. Canal de streaming idéntico (sin compresión ni paso por almacenamiento R2)
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
    await new Promise((r) => setTimeout(r, 500 * (intento + 1)));
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

  if (manijaCarpetaRaiz) {
    try {
      const mh = manijaCarpetaRaiz as unknown as {
        queryPermission?: (desc?: { mode?: string }) => Promise<string>;
        requestPermission?: (desc?: { mode?: string }) => Promise<string>;
      };
      if (typeof mh.queryPermission === "function") {
        const estado = await mh.queryPermission({ mode: "readwrite" });
        if (estado === "granted") return true;
        if (typeof mh.requestPermission === "function") {
          const nuevo = await mh.requestPermission({ mode: "readwrite" });
          if (nuevo === "granted") return true;
        }
      } else {
        return true;
      }
    } catch {
      manijaCarpetaRaiz = null;
    }
  }

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
 * Abre o crea un subdirectorio dentro de `padre`, con fallback automático a nombre ASCII
 * si Windows/Chromium rechaza el nombre original por longitud o caracteres especiales.
 */
async function obtenerSubcarpetaSegura(
  padre: FileSystemDirectoryHandle,
  nombreDeseado: string,
  porDefectoAscii: string
): Promise<FileSystemDirectoryHandle> {
  const limpio = limpiarNombreArchivo(nombreDeseado);
  try {
    return await padre.getDirectoryHandle(limpio, { create: true });
  } catch {
    try {
      const respaldo = nombreCarpetaRespaldoAscii(nombreDeseado, porDefectoAscii);
      return await padre.getDirectoryHandle(respaldo, { create: true });
    } catch {
      const corto =
        nombreCarpetaRespaldoAscii(nombreDeseado, porDefectoAscii)
          .slice(0, 20)
          .replace(/[_\s-]+$/g, "") || porDefectoAscii;
      return await padre.getDirectoryHandle(corto, { create: true });
    }
  }
}

/**
 * Resuelve y crea inmediatamente la carpeta del capítulo en PC:
 * MangaTotal/descargas/{fuente}/{serie}/{capitulo}
 * Detecta si el usuario seleccionó directamente MangaTotal, descargas o la carpeta de la fuente
 * para no duplicar niveles.
 */
async function obtenerCarpetaCapituloPC(
  fuente: string,
  serie: string,
  capitulo: string
): Promise<FileSystemDirectoryHandle | null> {
  if (!manijaCarpetaRaiz) return null;

  try {
    const nombreRaiz = manijaCarpetaRaiz.name.trim().toLowerCase();
    const fuenteLimpia = limpiarNombreArchivo(fuente);
    let dFuente: FileSystemDirectoryHandle;

    if (nombreRaiz === fuenteLimpia.toLowerCase()) {
      dFuente = manijaCarpetaRaiz;
    } else if (nombreRaiz === "descargas") {
      dFuente = await obtenerSubcarpetaSegura(manijaCarpetaRaiz, fuente, "Fuente");
    } else {
      let dRaiz = manijaCarpetaRaiz;
      if (nombreRaiz !== "mangatotal") {
        try {
          dRaiz = await manijaCarpetaRaiz.getDirectoryHandle("MangaTotal", { create: true });
        } catch {
          dRaiz = manijaCarpetaRaiz;
        }
      }
      const dDescargas = await dRaiz.getDirectoryHandle("descargas", { create: true });
      dFuente = await obtenerSubcarpetaSegura(dDescargas, fuente, "Fuente");
    }

    const dSerie = await obtenerSubcarpetaSegura(dFuente, serie, "Obra");
    const dCapitulo = await obtenerSubcarpetaSegura(dSerie, capitulo, "Capitulo_Completo");
    return dCapitulo;
  } catch (err: unknown) {
    manijaCarpetaRaiz = null;
    if (err instanceof Error && err.name === "AbortError") {
      throw err;
    }
    return null;
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

const CLAVE_DESCARGAS = "mangatotal_descargas_locales_v2";

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

/** En Android, prepara las carpetas base sin bloquear ni abrir Ajustes forzosamente */
export async function asegurarPermisosAlmacenamientoAndroid(): Promise<boolean> {
  return true;
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

  const fuenteLimpia = limpiarNombreArchivo(fuente);
  const serieLimpia = limpiarNombreArchivo(serie);
  const capituloLimpio = limpiarNombreArchivo(capitulo);
  const pendientes = archivos.filter(Boolean);
  const total = pendientes.length;
  if (total === 0) return true;

  if (plugin.guardarArchivo) {
    let guardados = 0;
    for (let i = 0; i < total; i++) {
      const { nombre, blob } = pendientes[i];
      const dataBase64 = await blobABase64(blob);
      const res = await plugin.guardarArchivo({
        fuente: fuenteLimpia,
        serie: serieLimpia,
        capitulo: capituloLimpio,
        nombre,
        dataBase64,
      });
      if (res && res.ok === false) {
        return false;
      }
      guardados++;

      onProgreso?.({
        fase: "guardando",
        actual: guardados,
        total,
        porcentaje: 85 + Math.round((guardados / total) * 15),
      });
    }

    if (plugin.avisarDescargaCompletada) {
      try {
        await plugin.avisarDescargaCompletada({
          fuente: fuenteLimpia,
          serie: serieLimpia,
          capitulo: capituloLimpio,
          total: guardados,
        });
      } catch {}
    }
    return guardados === total;
  }

  if (plugin.guardarCapitulo) {
    const LOTE = 5;
    for (let i = 0; i < total; i += LOTE) {
      const lote = pendientes.slice(i, i + LOTE);
      const loteB64 = await Promise.all(
        lote.map(async ({ nombre, blob }) => ({
          nombre,
          dataBase64: await blobABase64(blob),
        }))
      );
      await plugin.guardarCapitulo({
        fuente: fuenteLimpia,
        serie: serieLimpia,
        capitulo: capituloLimpio,
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
  onProgreso?: (p: ProgresoDescarga) => void,
  carpetaYaCreada?: FileSystemDirectoryHandle | null
): Promise<boolean> {
  const dCapitulo = carpetaYaCreada ?? (await obtenerCarpetaCapituloPC(fuente, serie, capitulo));
  if (!dCapitulo) return false;

  try {
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
 * 2. En PC con File System Access: crea la carpeta del capítulo desde el inicio y escribe
 *    cada imagen al disco a medida que se descarga, evitando que la carpeta quede vacía.
 * 3. En Android nativo: guarda mediante puente seguro en Download/MangaTotal/descargas/...
 * 4. Fallback universal: genera el paquete ZIP organizado por carpetas.
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

  // Crear la estructura de carpetas en PC de inmediato mientras la activación de usuario está fresca
  const carpetaCapituloPC = await obtenerCarpetaCapituloPC(fuente, serie, capitulo);

  const urls = await obtenerPaginas();
  if (!urls || urls.length === 0) {
    throw new Error("No se encontraron páginas para este capítulo");
  }

  const pluginAndroid = pluginFuentesAndroid();
  const fuenteLimpia = limpiarNombreArchivo(fuente);
  const serieLimpia = limpiarNombreArchivo(serie);
  const capituloLimpio = limpiarNombreArchivo(capitulo);

  const total = urls.length;
  onProgreso?.({
    fase: "descargando",
    actual: 0,
    total,
    porcentaje: 2,
  });

  const archivos: { nombre: string; blob: Blob }[] = new Array(total);
  let descargadas = 0;
  let escritosDirectoEnPC = 0;
  let escritosDirectoEnAndroid = 0;
  let colaEscrituraAndroid: Promise<void> = Promise.resolve();

  // Lotes concurrentes de 4 imágenes para descarga rápida y estable en PC y Android
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

      if (carpetaCapituloPC) {
        try {
          const archivoHandle = await carpetaCapituloPC.getFileHandle(nombre, { create: true });
          const writable = await archivoHandle.createWritable();
          await writable.write(blob);
          await writable.close();
          escritosDirectoEnPC++;
        } catch {
          archivos[idx] = { nombre, blob };
        }
      } else if (pluginAndroid?.guardarArchivo) {
        try {
          const tareaEscritura = colaEscrituraAndroid.then(async () => {
            const dataBase64 = await blobABase64(blob);
            const res = await pluginAndroid.guardarArchivo({
              fuente: fuenteLimpia,
              serie: serieLimpia,
              capitulo: capituloLimpio,
              nombre,
              dataBase64,
            });
            if (res && res.ok === false) {
              throw new Error("No se pudo escribir el archivo en Android");
            }
          });
          colaEscrituraAndroid = tareaEscritura.catch(() => {});
          await tareaEscritura;
          escritosDirectoEnAndroid++;
        } catch {
          archivos[idx] = { nombre, blob };
        }
      } else {
        archivos[idx] = { nombre, blob };
      }

      descargadas++;

      onProgreso?.({
        fase: "descargando",
        actual: descargadas,
        total,
        porcentaje:
          carpetaCapituloPC || pluginAndroid?.guardarArchivo
            ? Math.round((descargadas / total) * 100)
            : Math.round((descargadas / total) * 85),
      });
    }
  }

  const trabajadores = Array.from({ length: Math.min(CONCURRENCIA, total) }, () => trabajador());
  await Promise.all(trabajadores);

  if (signal?.aborted) throw new Error("Descarga cancelada");

  let guardado =
    (carpetaCapituloPC !== null && escritosDirectoEnPC === total) ||
    (Boolean(pluginAndroid?.guardarArchivo) && escritosDirectoEnAndroid === total);

  if (Boolean(pluginAndroid?.guardarArchivo) && escritosDirectoEnAndroid === total) {
    if (pluginAndroid?.avisarDescargaCompletada) {
      try {
        await pluginAndroid.avisarDescargaCompletada({
          fuente: fuenteLimpia,
          serie: serieLimpia,
          capitulo: capituloLimpio,
          total,
        });
      } catch {}
    }
  }

  if (!guardado) {
    onProgreso?.({
      fase: "guardando",
      actual: total,
      total,
      porcentaje: 85,
    });

    // 1. En Android nativo: guardar directamente en la carpeta de descargas
    try {
      guardado = await guardarConAndroid(fuente, serie, capitulo, archivos, onProgreso);
    } catch (err) {
      console.warn("No se pudo guardar mediante puente nativo de Android:", err);
    }

    // 2. En PC con File System Access API (si alguna página quedó pendiente)
    if (!guardado) {
      try {
        guardado = await guardarConFileSystemAccess(
          fuente,
          serie,
          capitulo,
          archivos.filter(Boolean),
          onProgreso,
          carpetaCapituloPC
        );
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          throw new Error("Descarga cancelada por el usuario");
        }
      }
    }

    // 3. Fallback universal (móvil web, Firefox, Safari): descarga como archivo ZIP estructurado
    if (!guardado) {
      await guardarComoZip(fuente, serie, capitulo, archivos.filter(Boolean), onProgreso);
    }
  }

  marcarCapituloDescargado(fuente, serie, capitulo);

  onProgreso?.({
    fase: "completado",
    actual: total,
    total,
    porcentaje: 100,
  });
}
