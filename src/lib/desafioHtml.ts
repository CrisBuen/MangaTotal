/** Cloudflare a veces devuelve la casilla con HTTP 200; no es contenido de la fuente. */
export function esDesafioHtml(contenido: string): boolean {
  return /<title>\s*Just a moment(?:\.\.\.)?\s*<\/title>/i.test(contenido) ||
    /\/_cf_chl_opt|cdn-cgi\/challenge-platform|cf-challenge/i.test(contenido);
}
