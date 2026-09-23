export const FUENTES_BIBLIOTECA = [
  { id: "olympus", nombre: "Olympus Scanlation" },
  { id: "ikigai", nombre: "Ikigai Mangas" },
  { id: "leercapitulo", nombre: "LeerCapítulo" },
  { id: "tmo", nombre: "ZonaTMO" },
  { id: "catharsis", nombre: "Catharsis World" },
  { id: "mangadex", nombre: "MangaDex" },
] as const;

export function regresoFuente(fuente: string | null): string | null {
  return FUENTES_BIBLIOTECA.some(f => f.id === fuente)
    ? `/fuentes?fuente=${fuente}` : null;
}
