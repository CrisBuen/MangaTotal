/**
 * Si una página externa no carga en el navegador (extensiones, escudos o
 * DNS que bloquean el CDN de MangaDex), se reintenta una sola vez por
 * /api/externo/imagen, que la trae desde el servidor.
 */
export function retryThroughProxy(img: HTMLImageElement): void {
  if (img.dataset.proxied === "1") return;
  const src = img.currentSrc || img.src;
  if (!src || src.startsWith(window.location.origin)) return;
  img.dataset.proxied = "1";
  img.src = `/api/externo/imagen?u=${encodeURIComponent(src)}`;
}
