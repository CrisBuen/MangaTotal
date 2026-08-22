/** Convierte un título en slug apto para URLs y nombres de carpeta. */
export function slugify(input: string): string {
  return (
    input
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // saca diacríticos
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "serie"
  );
}

/** Nombre de carpeta para un número de capítulo (1 → "1", 1.5 → "1.5"). */
export function chapterFolderName(number: number): string {
  return String(number);
}
