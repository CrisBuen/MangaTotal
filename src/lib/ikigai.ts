/**
 * Ikigai Mangas — integrada con su permiso.
 *
 * Igual que ZonaTMO, su servidor no acepta peticiones de centros de datos,
 * así que se lee desde el dispositivo de cada persona (ver el puente
 * nativo en src/lib/fuenteNativa.ts).
 *
 * Su sitio tiene dos particularidades propias:
 *  · Los capítulos viven en OTRO dominio: /capitulo/<id> redirige a su
 *    visor. El puente sigue la redirección solo.
 *  · El visor está hecho con Qwik: las páginas del capítulo no son <img>,
 *    están en el atributo `q:key` de cada bloque.
 *
 * ⚠️ SI CAMBIAN DE DOMINIO: ver CAMBIO-DE-DOMINIO-IKIGAI.txt en la raíz.
 */
import { traerDocumento, fuenteNativaDisponible } from "./fuenteNativa";

export const IKIGAI_WEB = "https://visorikigai.gettocaboca.com";
export const IKIGAI_NOMBRE = "Ikigai Mangas";

export function ikigaiDisponible(): boolean {
  return fuenteNativaDisponible();
}

export interface SerieIkigai {
  slug: string;
  title: string;
  cover_url: string | null;
  tipo: string | null;
  url_original: string;
}

/** Catálogo paginado (20 obras por página en su biblioteca). */
export async function catalogoIkigai(page: number, filtros: { q?: string } = {}) {
  const qs = new URLSearchParams();
  if (page > 1) qs.set("page", String(page));
  if (filtros.q) qs.set("search", filtros.q);

  const doc = await traerDocumento(`${IKIGAI_WEB}/series/${qs.toString() ? `?${qs}` : ""}`);

  // su biblioteca es la grilla más grande de la página
  const grillas = Array.from(doc.querySelectorAll("[class*=grid]")).filter(
    (g) => g.querySelectorAll('a[href^="/series/"]').length >= 10
  );
  const grilla = grillas[grillas.length - 1];

  const series: SerieIkigai[] = [];
  const vistos = new Set<string>();

  for (const a of Array.from(grilla?.querySelectorAll('a[href^="/series/"]') ?? [])) {
    const href = a.getAttribute("href") ?? "";
    const slug = href.split("/series/")[1]?.replace(/\/$/, "");
    if (!slug || vistos.has(slug)) continue;
    vistos.add(slug);

    // el texto de la tarjeta viene como "TipoTítuloGénero1Género2"
    const img = a.querySelector("img");
    series.push({
      slug,
      title: img?.getAttribute("alt")?.trim() || textoTitulo(a.textContent ?? ""),
      cover_url: img?.getAttribute("src") ?? null,
      tipo: a.querySelector("span,div")?.textContent?.trim() || null,
      url_original: `${IKIGAI_WEB}/series/${slug}/`,
    });
  }

  return { series, page, hayMas: series.length >= 20 };
}

/** Quita el tipo pegado al principio ("CómicTítulo" → "Título"). */
function textoTitulo(texto: string): string {
  const limpio = texto.replace(/\s+/g, " ").trim();
  return limpio.replace(/^(Cómic|Manga|Novela|Manhwa|Manhua)\s*/i, "").slice(0, 90) || "Sin título";
}

export interface CapituloIkigai {
  id: string;
  numero: string | null;
}

/** Ficha de una serie con sus capítulos, del más viejo al más nuevo. */
export async function serieIkigai(slug: string) {
  const doc = await traerDocumento(`${IKIGAI_WEB}/series/${slug}/`);

  const capitulos: CapituloIkigai[] = [];
  const vistos = new Set<string>();

  for (const a of Array.from(doc.querySelectorAll('a[href^="/capitulo/"]'))) {
    const id = (a.getAttribute("href") ?? "").split("/capitulo/")[1]?.replace(/\/$/, "");
    if (!id || vistos.has(id)) continue;

    const texto = (a.textContent ?? "").replace(/\s+/g, " ").trim();
    // los accesos rápidos "Primer/Último Capítulo" repiten capítulos de la lista
    if (/^(Primer|Último)\s+Cap/i.test(texto)) continue;
    vistos.add(id);

    capitulos.push({ id, numero: texto.match(/Cap[íi]tulo\s+([\d.,]+)/i)?.[1] ?? null });
  }

  const portada = Array.from(doc.querySelectorAll("img"))
    .map((i) => i.getAttribute("src") ?? "")
    .find((u) => u.includes("ikigaimangas"));

  const parrafos = Array.from(doc.querySelectorAll("p"))
    .map((p) => p.textContent?.trim() ?? "")
    .sort((a, b) => b.length - a.length);

  return {
    slug,
    title: doc.querySelector("h1")?.textContent?.trim() ?? "Sin título",
    cover_url: portada ?? null,
    description: parrafos[0] && parrafos[0].length > 60 ? parrafos[0] : null,
    generos: Array.from(doc.querySelectorAll('a[href*="generos"]'))
      .map((g) => g.textContent?.trim() ?? "")
      .filter(Boolean)
      .slice(0, 10),
    capitulos: capitulos.reverse(),
    url_original: `${IKIGAI_WEB}/series/${slug}/`,
  };
}

/** Páginas de un capítulo (su visor las marca con el atributo q:key). */
export async function capituloIkigai(chapterId: string) {
  // /capitulo/<id> redirige al visor, en otro dominio
  const doc = await traerDocumento(`${IKIGAI_WEB}/capitulo/${chapterId}/`);

  const paginas: string[] = [];
  for (const el of Array.from(doc.querySelectorAll("*"))) {
    const clave = el.getAttribute("q:key");
    if (!clave || paginas.includes(clave)) continue;
    if (/^https?:\/\/.+\.(webp|jpg|jpeg|png)$/i.test(clave)) paginas.push(clave);
  }

  return {
    id: chapterId,
    titulo: doc.querySelector("title")?.textContent?.split("-")[0]?.trim() ?? null,
    paginas,
    url_original: `${IKIGAI_WEB}/capitulo/${chapterId}/`,
  };
}
