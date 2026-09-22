/** Cloudflare a veces devuelve la casilla con HTTP 200; no es contenido de la fuente. */
export function esDesafioHtml(contenido: string): boolean {
  // El script /challenge-platform/scripts/jsd/main.js también se inyecta
  // en fichas y capítulos válidos. Su presencia NO significa que haya una
  // casilla: se exigen las marcas de la pantalla de desafío propiamente tal.
  return /<title\b[^>]*>\s*Just a moment(?:\.{3}|…)?\s*<\/title>/i.test(contenido) ||
    /\bwindow\._cf_chl_opt\s*=\s*\{/i.test(contenido);
}
