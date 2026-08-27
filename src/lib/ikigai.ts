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

// Su biblioteca filtra por tipo y por género (ids propios de su sitio)
export const IKIGAI_TIPOS = [
  { id: "comic", name: "Cómic" },
  { id: "manga", name: "Manga" },
  { id: "novel", name: "Novela" },
];

export const IKIGAI_GENEROS = [
  { id: "906397904327999491", name: "Acción" },
  { id: "906397904061530115", name: "Aventura" },
  { id: "906409351330037763", name: "Boys Love" },
  { id: "906398112851165187", name: "Comedia" },
  { id: "906397903933407235", name: "Drama" },
  { id: "906397894348570627", name: "Fantasía" },
  { id: "906397894527549443", name: "Romance" },
  { id: "906397894408372227", name: "Shoujo" },
  { id: "906409527934582787", name: "Adulto" },
  { id: "906409351272792067", name: "+18" },
];

// Ordenamientos que acepta su biblioteca
export const IKIGAI_ORDENES = [
  { id: "recientes", name: "Recién agregadas" },
  { id: "populares", name: "Populares" },
  { id: "az", name: "A–Z" },
];

export interface FiltrosIkigai {
  q?: string;
  tipo?: string;
  genero?: string;
  orden?: string;
}

export interface SerieIkigai {
  slug: string;
  title: string;
  cover_url: string | null;
  tipo: string | null;
  url_original: string;
}

/** Catálogo paginado (20 obras por página en su biblioteca). */
export async function catalogoIkigai(page: number, filtros: FiltrosIkigai = {}) {
  const qs = new URLSearchParams();
  // su paginador usa "pagina", no "page"
  if (page > 1) qs.set("pagina", String(page));
  if (filtros.q) qs.set("search", filtros.q);
  // sus filtros llegan como listas: tipos[] y generos[]
  if (filtros.tipo) qs.append("tipos[]", filtros.tipo);
  if (filtros.genero) qs.append("generos[]", filtros.genero);
  // su sitio ordena con "ordenar" + "direccion"
  if (filtros.orden === "populares") {
    qs.set("ordenar", "view_count");
    qs.set("direccion", "desc");
  } else if (filtros.orden === "recientes") {
    qs.set("ordenar", "created_at");
    qs.set("direccion", "desc");
  }

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
  fecha: string | null;
}

/**
 * Ficha de una serie con TODOS sus capítulos.
 *
 * Su ficha muestra 24 capítulos por página (con el parámetro "pagina"), así
 * que se recorren todas hasta que dejan de aparecer capítulos nuevos.
 */
export async function serieIkigai(slug: string) {
  const capitulos: CapituloIkigai[] = [];
  const vistos = new Set<string>();
  let primera: Document | null = null;

  // el corte real es la página que no suma capítulos nuevos (más abajo);
  // este número es solo una red por si su sitio empieza a repetirse
  for (let pagina = 1; pagina <= 300; pagina++) {
    const doc = await traerDocumento(
      `${IKIGAI_WEB}/series/${slug}/${pagina > 1 ? `?pagina=${pagina}` : ""}`
    );
    if (!primera) primera = doc;

    const antes = capitulos.length;
    for (const a of Array.from(doc.querySelectorAll('a[href^="/capitulo/"]'))) {
      const id = (a.getAttribute("href") ?? "").split("/capitulo/")[1]?.replace(/\/$/, "");
      if (!id || vistos.has(id)) continue;

      // el número vive en el título de la tarjeta; el texto del enlace
      // completo mezcla los "me gusta", las visitas y la fecha
      const titulo = a.querySelector("h3")?.textContent?.trim() ?? "";
      if (!titulo) continue; // "Primer Capítulo" y "Último Capítulo" no tienen tarjeta

      vistos.add(id);
      capitulos.push({
        id,
        numero: titulo.replace(/^Cap[íi]tulo\s*/i, "").trim() || null,
        fecha: a.querySelector("time")?.textContent?.trim() ?? fechaDelTexto(a.textContent ?? ""),
      });
    }

    // si esta página no sumó nada, ya no quedan capítulos
    if (capitulos.length === antes) break;
  }

  const doc = primera!;
  const titulo = doc.querySelector("h1")?.textContent?.trim() ?? "Sin título";

  // la portada es la imagen cuyo texto alternativo es el título de la serie
  const portada =
    Array.from(doc.querySelectorAll("img")).find(
      (i) => (i.getAttribute("alt") ?? "").trim() === titulo
    )?.getAttribute("src") ?? null;

  const parrafos = Array.from(doc.querySelectorAll("p"))
    .map((x) => x.textContent?.trim() ?? "")
    .sort((a, b) => b.length - a.length);

  return {
    slug,
    title: titulo,
    cover_url: portada,
    description: parrafos[0] && parrafos[0].length > 60 ? parrafos[0] : null,
    generos: Array.from(doc.querySelectorAll('a[href*="generos"]'))
      .map((g) => g.textContent?.trim() ?? "")
      .filter(Boolean)
      .slice(0, 10),
    // vienen del más nuevo al más viejo: se invierte para leer en orden
    capitulos: capitulos.reverse(),
    url_original: `${IKIGAI_WEB}/series/${slug}/`,
  };
}

/** Rescata "hace 7 h" o "12/03/2026" del texto de la tarjeta. */
function fechaDelTexto(texto: string): string | null {
  const limpio = texto.replace(/s+/g, " ");
  return (
    limpio.match(/hace\s+[^,]{2,18}/i)?.[0]?.trim() ??
    limpio.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/)?.[0] ??
    null
  );
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
