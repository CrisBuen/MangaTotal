/** Imágenes de Ikigai: descarga directa por el dispositivo, nunca un proxy web. */
export function esImagenIkigai(src: string): boolean {
  try {
    const u = new URL(src);
    return u.protocol === "https:" && !u.username && !u.password && !u.port &&
      !u.search && !u.hash && src.length <= 4096 &&
      ["image2.ikigaimangas.cloud", "image3.ikigaimangas.cloud"].includes(u.hostname) &&
      /\.(webp|png|jpe?g|gif)$/i.test(u.pathname);
  } catch { return false; }
}
let activas = 0;
interface PedidoImagen {
  src: string; prioridad: number; consumidores: number; iniciado: boolean;
  promesa: Promise<Blob>; resolver: (blob: Blob) => void; rechazar: (error: unknown) => void;
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
  memoria.set(src, { blob, vence: Date.now() + 90_000 }); bytesEnMemoria += blob.size;
  while (bytesEnMemoria > 24 * 1024 * 1024 || memoria.size > 32) {
    const primera = memoria.entries().next().value!;
    bytesEnMemoria -= primera[1].blob.size; memoria.delete(primera[0]);
  }
}
const cancelacion = () => Object.assign(new Error("Carga cancelada"), { name: "AbortError" });

function avanzar() {
  cola.sort((a, b) => b.prioridad - a.prioridad);
  while (activas < 3 && cola.length) {
    const pedido = cola.shift()!;
    pedido.iniciado = true; activas++;
    descargar(pedido.src).then(blob => {
      recordar(pedido.src, blob); pedido.resolver(blob);
    }, pedido.rechazar).finally(() => {
      activas--; pendientes.delete(pedido.src); avanzar();
    });
  }
}
async function descargar(src: string): Promise<Blob> {
  if (!esImagenIkigai(src)) throw new Error("Imagen de fuente no permitida");
  type Nativo = {
    Capacitor?: { Plugins?: { Fuentes?: { traerImagen?: (args: { url: string }) => Promise<{ data: string }> } } };
    __TAURI__?: { core?: { invoke: (name: string, args: object) => Promise<ArrayBuffer | number[]> } };
  };
  const app = window as unknown as Nativo;
  if (!app.Capacitor?.Plugins?.Fuentes && !app.__TAURI__?.core?.invoke) {
    throw new Error("Ikigai requiere la app de Android o Windows actualizada. La web necesita autorización directa de su servidor de imágenes.");
  }
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    const android = app.Capacitor?.Plugins?.Fuentes;
    if (android) {
      if (!android.traerImagen) throw new Error("Puente antiguo");
      const respuesta = await android.traerImagen({ url: src });
      if (typeof respuesta.data !== "string" || respuesta.data.length > 28 * 1024 * 1024) throw new Error("Respuesta inválida");
      bytes = Uint8Array.from(atob(respuesta.data), (c) => c.charCodeAt(0));
    } else if (app.__TAURI__?.core?.invoke) {
      bytes = new Uint8Array(await app.__TAURI__.core.invoke("traer_imagen", { url: src }));
    } else { throw new Error("Puente no disponible"); }
  } catch {
    throw new Error("No se pudo cargar la imagen. Usá la última versión de MangaTotal y reintentá.");
  }
  const firma = String.fromCharCode(...bytes.slice(0, 12));
  const tipo = firma.startsWith("RIFF") && firma.slice(8) === "WEBP" ? "image/webp"
    : bytes[0] === 137 && firma.slice(1, 4) === "PNG" && bytes[4] === 13 && bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10 ? "image/png"
    : bytes[0] === 255 && bytes[1] === 216 ? "image/jpeg"
    : firma.startsWith("GIF8") ? "image/gif" : null;
  // El CDN conserva nombres .webp para páginas cuyo contenido real es JPEG.
  // La firma binaria decide el formato; el puente rechaza redirecciones.
  if (!tipo || bytes.length < 12 || bytes.length > 20 * 1024 * 1024) {
    throw new Error("Ikigai no entregó la imagen original.");
  }
  return new Blob([bytes], { type: tipo });
}
/** Tres descargas; salir de una vista descarta su trabajo todavía no iniciado. */
export function cargarImagenNativa(src: string, opciones: { signal?: AbortSignal; prioridad?: number } = {}): Promise<Blob> {
  if (!esImagenIkigai(src)) return Promise.reject(new Error("Imagen de fuente no permitida"));
  if (opciones.signal?.aborted) return Promise.reject(cancelacion());
  const cache = memoria.get(src);
  if (cache && cache.vence > Date.now()) {
    memoria.delete(src); memoria.set(src, cache);
    return Promise.resolve(cache.blob);
  }
  if (cache) { memoria.delete(src); bytesEnMemoria -= cache.blob.size; }
  let pedido = pendientes.get(src);
  if (!pedido) {
    let resolver!: PedidoImagen["resolver"], rechazar!: PedidoImagen["rechazar"];
    const promesa = new Promise<Blob>((ok, error) => { resolver = ok; rechazar = error; });
    pedido = { src, promesa, resolver, rechazar, consumidores: 0, iniciado: false, prioridad: opciones.prioridad ?? 0 };
    pendientes.set(src, pedido); cola.push(pedido);
  }
  const compartido = pedido;
  compartido.consumidores++;
  compartido.prioridad = Math.max(compartido.prioridad, opciones.prioridad ?? 0);
  const respuesta = new Promise<Blob>((resolve, reject) => {
    let terminado = false;
    const terminar = () => {
      if (terminado) return false;
      terminado = true; compartido.consumidores--;
      opciones.signal?.removeEventListener("abort", cancelar);
      return true;
    };
    const cancelar = () => {
      if (!terminar()) return;
      reject(cancelacion());
      if (!compartido.iniciado && compartido.consumidores === 0) {
        cola.splice(cola.indexOf(compartido), 1); pendientes.delete(src);
        compartido.rechazar(cancelacion());
      }
    };
    opciones.signal?.addEventListener("abort", cancelar, { once: true });
    compartido.promesa.then(blob => { if (terminar()) resolve(blob); }, error => { if (terminar()) reject(error); });
  });
  avanzar();
  return respuesta;
}
