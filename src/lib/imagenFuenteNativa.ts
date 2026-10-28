/** Imágenes de Ikigai: descarga directa por el dispositivo, nunca un proxy web. */
export function esImagenIkigai(src: string): boolean {
  try {
    const u = new URL(src);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.port &&
      !u.search &&
      !u.hash &&
      src.length <= 4096 &&
      ["image2.ikigaimangas.cloud", "image3.ikigaimangas.cloud"].includes(u.hostname) &&
      /\.(webp|png|jpe?g|gif)$/i.test(u.pathname)
    );
  } catch {
    return false;
  }
}

const HOSTS_IMAGEN_PERMITIDOS =
  /(^|\.)(mangadex\.network|mangadex\.org|hath\.network|ehgt\.org|e-hentai\.org|exhentai\.org|gold-usergeneratedcontent\.net|hitomi\.la|olympusxyz\.com|olympusbiblioteca\.com|olympusscans\.com|olympusv2\.gg|olympusscanlation\.com|zonatmo\.(com|net|to|org)|visortmo\.com|tumangaonline\.(site|me)|leercapitulo\.(com|co|site|net)|t34798ndc\.com|catharsisfood\.com|catharsisworks\.com|dig-it\.info|ikigaimangas\.cloud|ikigaivs\.org|ikigaimangas\.com|storage\.googleapis\.com)$/i;

const IPV4_PUBLICA = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

function esIpv4PublicaValida(host: string): boolean {
  if (!IPV4_PUBLICA.test(host)) return false;
  const p = host.split(".").map((n) => parseInt(n, 10));
  if (p.some((n) => isNaN(n) || n < 0 || n > 255)) return false;
  if (p[0] === 10 || p[0] === 127 || p[0] === 0) return false;
  if (p[0] === 169 && p[1] === 254) return false;
  if (p[0] === 192 && p[1] === 168) return false;
  if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return false;
  return true;
}

/**
 * Si la URL viene envuelta en `/api/externo/imagen?u=<url>`, devuelve la URL
 * real del CDN de la fuente para pedirla directamente desde el puente nativo.
 */
export function extraerUrlSubyacente(src: string): string {
  if (!src) return src;
  try {
    if (src.startsWith("/api/externo/imagen")) {
      const u = new URL(src, "https://mangatotal.local");
      const destino = u.searchParams.get("u");
      if (destino) return destino;
    } else if (src.includes("/api/externo/imagen?")) {
      const u = new URL(src);
      if (u.pathname === "/api/externo/imagen") {
        const destino = u.searchParams.get("u");
        if (destino) return destino;
      }
    }
  } catch {}
  return src;
}

/** Comprueba si la URL pertenece a alguno de los CDNs de fuentes permitidos por el puente nativo. */
export function esImagenNativaSoportada(src: string): boolean {
  const real = extraerUrlSubyacente(src);
  if (esImagenIkigai(real)) return true;
  try {
    const u = new URL(real);
    if (real.length > 4096 || u.username || u.password) return false;
    const host = u.hostname.toLowerCase();
    if (esIpv4PublicaValida(host)) {
      return u.protocol === "https:" || u.protocol === "http:";
    }
    if (!HOSTS_IMAGEN_PERMITIDOS.test(host)) return false;
    return u.protocol === "https:" || (u.protocol === "http:" && host.endsWith(".hath.network"));
  } catch {
    return false;
  }
}

type PuenteNativo = {
  Capacitor?: {
    Plugins?: {
      Fuentes?: {
        traerImagen?: (args: { url: string }) => Promise<{ data: string }>;
      };
    };
  };
  __TAURI__?: {
    core?: {
      invoke: (name: string, args: object) => Promise<ArrayBuffer | number[]>;
    };
  };
};

// Si el binario instalado es anterior a la ampliación del puente y rechaza dominios no-Ikigai,
// se desactiva automáticamente para el resto de la sesión y cae de inmediato al proxy web.
let puenteSoloIkigai = false;

/** Indica si estamos en la app nativa de Android o Windows PC con `traerImagen` disponible. */
export function tienePuenteImagenNativo(): boolean {
  if (typeof window === "undefined") return false;
  const app = window as unknown as PuenteNativo;
  return Boolean(app.Capacitor?.Plugins?.Fuentes?.traerImagen || app.__TAURI__?.core?.invoke);
}

/**
 * Decide si una imagen debe descargarse por el puente nativo de Android/PC en lugar de
 * pasar por `/api/externo/imagen` en Vercel.
 */
export function debeUsarPuenteNativo(src: string): boolean {
  const real = extraerUrlSubyacente(src);
  if (esImagenIkigai(real)) return true;
  if (puenteSoloIkigai || !tienePuenteImagenNativo()) return false;
  if (!esImagenNativaSoportada(real)) return false;
  if (src.startsWith("/api/externo/imagen") || src.includes("/api/externo/imagen?")) {
    return true;
  }
  return /gold-usergeneratedcontent\.net|hitomi\.la|e-hentai\.org\/s\/|exhentai\.org\/s\/|ikigaimangas\.cloud/i.test(
    real
  );
}

let activas = 0;
interface PedidoImagen {
  src: string;
  prioridad: number;
  consumidores: number;
  iniciado: boolean;
  promesa: Promise<Blob>;
  resolver: (blob: Blob) => void;
  rechazar: (error: unknown) => void;
}
const cola: PedidoImagen[] = [];
const pendientes = new Map<string, PedidoImagen>();
// Solo memoria de esta ventana: no descarga una biblioteca entera ni persiste
// páginas. Evita repetir la misma portada al pasar de Explorar a su ficha.
const memoria = new Map<string, { blob: Blob; vence: number }>();
let bytesEnMemoria = 0;
function recordar(src: string, blob: Blob) {
  const previo = memoria.get(src);
  if (previo) bytesEnMemoria -= previo.blob.size;
  memoria.delete(src);
  memoria.set(src, { blob, vence: Date.now() + 10 * 60_000 });
  bytesEnMemoria += blob.size;
  while (bytesEnMemoria > 36 * 1024 * 1024 || memoria.size > 64) {
    const primera = memoria.entries().next().value!;
    bytesEnMemoria -= primera[1].blob.size;
    memoria.delete(primera[0]);
  }
}
const cancelacion = () => Object.assign(new Error("Carga cancelada"), { name: "AbortError" });

function avanzar() {
  cola.sort((a, b) => b.prioridad - a.prioridad);
  while (activas < 6 && cola.length) {
    const pedido = cola.shift()!;
    pedido.iniciado = true;
    activas++;
    descargar(pedido.src)
      .then((blob) => {
        recordar(pedido.src, blob);
        pedido.resolver(blob);
      }, pedido.rechazar)
      .finally(() => {
        activas--;
        pendientes.delete(pedido.src);
        avanzar();
      });
  }
}

function detectarMimeBinario(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  const firma = String.fromCharCode(...bytes.slice(0, 12));
  if (firma.startsWith("RIFF") && firma.slice(8, 12) === "WEBP") return "image/webp";
  if (
    bytes[0] === 137 &&
    firma.slice(1, 4) === "PNG" &&
    bytes[4] === 13 &&
    bytes[5] === 10 &&
    bytes[6] === 26 &&
    bytes[7] === 10
  ) {
    return "image/png";
  }
  if (bytes[0] === 255 && bytes[1] === 216) return "image/jpeg";
  if (firma.startsWith("GIF8")) return "image/gif";
  if (firma.slice(4, 8) === "ftyp") {
    const marca = firma.slice(8, 12);
    if (marca === "avif" || marca === "avis" || marca === "mif1") return "image/avif";
  }
  return null;
}

async function descargar(src: string): Promise<Blob> {
  const urlReal = extraerUrlSubyacente(src);
  const ikigai = esImagenIkigai(urlReal);
  if (!ikigai && !esImagenNativaSoportada(urlReal)) {
    throw new Error("Imagen de fuente no permitida");
  }
  const app = window as unknown as PuenteNativo;
  if (!app.Capacitor?.Plugins?.Fuentes && !app.__TAURI__?.core?.invoke) {
    throw new Error(
      "Ikigai requiere la app de Android o Windows actualizada. La web necesita autorización directa de su servidor de imágenes."
    );
  }
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    const android = app.Capacitor?.Plugins?.Fuentes;
    if (android) {
      if (!android.traerImagen) throw new Error("Puente antiguo");
      const respuesta = await android.traerImagen({ url: urlReal });
      if (typeof respuesta.data !== "string" || respuesta.data.length > 28 * 1024 * 1024) {
        throw new Error("Respuesta inválida");
      }
      bytes = Uint8Array.from(atob(respuesta.data), (c) => c.charCodeAt(0));
    } else if (app.__TAURI__?.core?.invoke) {
      bytes = new Uint8Array(await app.__TAURI__.core.invoke("traer_imagen", { url: urlReal }));
    } else {
      throw new Error("Puente no disponible");
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err ?? "");
    if (!ikigai && msg.includes("Imagen de fuente no permitida")) {
      puenteSoloIkigai = true;
    }
    throw new Error("No se pudo cargar la imagen. Usá la última versión de MangaTotal y reintentá.");
  }
  const tipo = detectarMimeBinario(bytes);
  // El CDN conserva nombres .webp para páginas cuyo contenido real es JPEG.
  // La firma binaria decide el formato; el puente rechaza redirecciones no autorizadas.
  if (!tipo || bytes.length < 12 || bytes.length > 20 * 1024 * 1024) {
    throw new Error(ikigai ? "Ikigai no entregó la imagen original." : "La fuente no entregó una imagen válida.");
  }
  return new Blob([bytes], { type: tipo });
}

/** Seis descargas concurrentes; salir de una vista descarta su trabajo todavía no iniciado. */
export function cargarImagenNativa(
  src: string,
  opciones: { signal?: AbortSignal; prioridad?: number } = {}
): Promise<Blob> {
  const clave = extraerUrlSubyacente(src);
  if (!esImagenIkigai(clave) && !esImagenNativaSoportada(clave)) {
    return Promise.reject(new Error("Imagen de fuente no permitida"));
  }
  if (opciones.signal?.aborted) return Promise.reject(cancelacion());
  const cache = memoria.get(clave);
  if (cache && cache.vence > Date.now()) {
    memoria.delete(clave);
    memoria.set(clave, cache);
    return Promise.resolve(cache.blob);
  }
  if (cache) {
    memoria.delete(clave);
    bytesEnMemoria -= cache.blob.size;
  }
  let pedido = pendientes.get(clave);
  if (!pedido) {
    let resolver!: PedidoImagen["resolver"], rechazar!: PedidoImagen["rechazar"];
    const promesa = new Promise<Blob>((ok, error) => {
      resolver = ok;
      rechazar = error;
    });
    pedido = {
      src: clave,
      promesa,
      resolver,
      rechazar,
      consumidores: 0,
      iniciado: false,
      prioridad: opciones.prioridad ?? 0,
    };
    pendientes.set(clave, pedido);
    cola.push(pedido);
  }
  const compartido = pedido;
  compartido.consumidores++;
  compartido.prioridad = Math.max(compartido.prioridad, opciones.prioridad ?? 0);
  const respuesta = new Promise<Blob>((resolve, reject) => {
    let terminado = false;
    const terminar = () => {
      if (terminado) return false;
      terminado = true;
      compartido.consumidores--;
      opciones.signal?.removeEventListener("abort", cancelar);
      return true;
    };
    const cancelar = () => {
      if (!terminar()) return;
      reject(cancelacion());
      if (!compartido.iniciado && compartido.consumidores === 0) {
        cola.splice(cola.indexOf(compartido), 1);
        pendientes.delete(clave);
        compartido.rechazar(cancelacion());
      }
    };
    opciones.signal?.addEventListener("abort", cancelar, { once: true });
    compartido.promesa.then(
      (blob) => {
        if (terminar()) resolve(blob);
      },
      (error) => {
        if (terminar()) reject(error);
      }
    );
  });
  avanzar();
  return respuesta;
}
