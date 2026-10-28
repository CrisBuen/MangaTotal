import {
  cargarImagenNativa,
  esImagenNativaSoportada,
  tienePuenteImagenNativo,
} from "@/lib/imagenFuenteNativa";

/**
 * Si una página externa no carga directamente en el navegador (extensiones, escudos,
 * Referer o DNS), en Android y PC intenta primero traerla directo del CDN de la fuente
 * por el puente nativo (0 bytes en Vercel), y como último respaldo usa /api/externo/imagen.
 */
export function retryThroughProxy(img: HTMLImageElement): void {
  if (img.dataset.proxied === "1") return;
  const src = img.getAttribute("src") || img.currentSrc || img.src;
  if (!src || src.startsWith("blob:") || src.startsWith(window.location.origin)) return;

  if (
    img.dataset.nativeTried !== "1" &&
    tienePuenteImagenNativo() &&
    esImagenNativaSoportada(src)
  ) {
    img.dataset.nativeTried = "1";
    void cargarImagenNativa(src, { prioridad: 1 })
      .then((blob) => {
        const objUrl = URL.createObjectURL(blob);
        img.addEventListener("load", () => URL.revokeObjectURL(objUrl), { once: true });
        img.src = objUrl;
      })
      .catch(() => {
        if (img.dataset.proxied === "1") return;
        img.dataset.proxied = "1";
        img.src = `/api/externo/imagen?u=${encodeURIComponent(src)}`;
      });
    return;
  }

  img.dataset.proxied = "1";
  img.src = `/api/externo/imagen?u=${encodeURIComponent(src)}`;
}
