import path from "path";

/** Raíz absoluta de la biblioteca de imágenes. */
export const STORAGE_ROOT = path.join(process.cwd(), "storage");

/**
 * Resuelve una ruta relativa dentro de storage/ de forma segura.
 * Devuelve null si la ruta intenta escapar de la raíz (path traversal).
 */
export function resolveStoragePath(relative: string): string | null {
  const abs = path.resolve(STORAGE_ROOT, relative);
  const root = path.resolve(STORAGE_ROOT);
  if (abs !== root && !abs.startsWith(root + path.sep)) return null;
  return abs;
}

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

export function contentTypeFor(filePath: string): string | null {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? null;
}
