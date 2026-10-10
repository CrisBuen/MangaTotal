/** Destinos de la única barra de lectura; las colecciones conservan sus rutas. */
export const READING_TABS = [
  { id: "inicio", label: "Inicio", href: "/lectura" },
  { id: "descubrir", label: "Descubrir", href: "/lectura/descubrir" },
  { id: "catalogo", label: "Todos los títulos", href: "/explorar" },
  { id: "biblioteca", label: "Mi biblioteca", href: "/biblioteca?f=normal" },
  { id: "favoritos", label: "Favoritos", href: "/biblioteca?f=favoritos" },
  { id: "anilist", label: "AniList", href: "/anime" },
  { id: "noticias", label: "Noticias", href: "/noticias" },
  { id: "aleatorio", label: "Aleatorio", href: "/aleatorio" },
] as const;

export function readingTab(path: string, params: Pick<URLSearchParams, "get">): string | null {
  if (path === "/lectura") return "inicio";
  if (path === "/lectura/descubrir") return "descubrir";
  if (path === "/biblioteca") return params.get("f") === "favoritos" && !["animadas", "animelist"].includes(params.get("s") ?? "") ? "favoritos" : "biblioteca";
  if ((path === "/explorar" && params.get("seccion") !== "animada") || path.startsWith("/externo/")) return "catalogo";
  if (path === "/anime" || /^\/anime\/(\d+|mi-lista)(\/|$)/.test(path)) return "anilist";
  if (path === "/noticias" || path.startsWith("/noticias/")) return "noticias";
  if (path === "/aleatorio") return "aleatorio";
  return null;
}
