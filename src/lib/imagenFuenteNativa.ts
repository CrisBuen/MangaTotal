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
const cola: (() => void)[] = [];
const pendientes = new Map<string, Promise<Blob>>();
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
/** Tres descargas simultáneas; los pedidos repetidos en curso comparten bytes. */
export function cargarImagenNativa(src: string): Promise<Blob> {
  const actual = pendientes.get(src);
  if (actual) return actual;
  const pedido = (async () => {
    await new Promise<void>((resolve) => {
      const iniciar = () => { activas++; resolve(); };
      if (activas < 3) iniciar(); else cola.push(iniciar);
    });
    try { return await descargar(src); }
    finally { activas--; cola.shift()?.(); pendientes.delete(src); }
  })();
  pendientes.set(src, pedido);
  return pedido;
}
