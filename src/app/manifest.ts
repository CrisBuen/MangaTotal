import type { MetadataRoute } from "next";

/**
 * Manifiesto de la PWA: permite instalar MangaTotal como app en Windows
 * (Chrome/Edge) y en Android, con su propio ícono y ventana sin navegador.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MangaTotal",
    short_name: "MangaTotal",
    description: "Biblioteca de manga, manhwa, manhua y anime",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0a0a0f",
    theme_color: "#0a0a0f",
    lang: "es-ES",
    categories: ["books", "entertainment"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Biblioteca", url: "/biblioteca" },
      { name: "Explorar", url: "/explorar" },
      { name: "Anime", url: "/anime" },
    ],
  };
}
