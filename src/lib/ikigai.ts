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
import {
  enviarJsonNativo,
  fuenteNativaDisponible,
  traerDocumento,
  traerTexto,
} from "./fuenteNativa";
import { isPlayStoreApp } from "./appVersion";

export const IKIGAI_WEB = "https://visorikigai.gettocaboca.com";
const IKIGAI_IMAGENES = "https://image2.ikigaimangas.cloud";
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

const IKIGAI_GENEROS_ADULTOS = new Set([
  "906409527934582787",
  "906409351272792067",
]);

function textoMarcaContenidoAdulto(texto: string): boolean {
  return /(?:^|\s)(?:adulto|adult|\+18)(?:\s|$)/iu.test(texto.replace(/\s+/g, " "));
}

function contenidoNoDisponible(): never {
  throw new Error("Este contenido no está disponible en la edición de Google Play");
}

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

interface SerieIndiceIkigai {
  id?: string | number;
  name?: string;
  other_names?: string | string[] | null;
  slug?: string;
  cover?: string | null;
  chapter_count?: number;
  type?: string | null;
  format?: string | null;
  is_mature?: boolean;
  view_count?: number;
  status?: string | null;
}

interface RespuestaQwik {
  _entry: string;
  _objs: unknown[];
}

let indiceCompleto: Promise<SerieIndiceIkigai[]> | null = null;

function referenciaQwik(valor: string, total: number): number | null {
  if (!/^[0-9a-z]+$/.test(valor)) return null;
  const indice = Number.parseInt(valor, 36);
  return Number.isInteger(indice) && indice >= 0 && indice < total ? indice : null;
}

/**
 * Qwik guarda cada valor una sola vez y luego usa índices en base 36.
 * Se reconstruye únicamente la respuesta de su propio buscador.
 */
function decodificarQwik(respuesta: RespuestaQwik): unknown {
  const objetos = respuesta._objs;
  const cache = new Map<number, unknown>();

  const resolverIndice = (indice: number): unknown => {
    if (cache.has(indice)) return cache.get(indice);
    const crudo = objetos[indice];

    // Se registra antes de bajar para tolerar referencias compartidas.
    if (Array.isArray(crudo)) {
      const salida: unknown[] = [];
      cache.set(indice, salida);
      for (const valor of crudo) salida.push(resolverValor(valor));
      return salida;
    }
    if (crudo && typeof crudo === "object") {
      const salida: Record<string, unknown> = {};
      cache.set(indice, salida);
      for (const [clave, valor] of Object.entries(crudo)) {
        salida[clave] = resolverValor(valor);
      }
      return salida;
    }

    // Un string almacenado en _objs es un valor real, no otra referencia.
    cache.set(indice, crudo);
    return crudo;
  };

  const resolverValor = (valor: unknown): unknown => {
    if (typeof valor !== "string") return valor;
    const indice = referenciaQwik(valor, objetos.length);
    return indice === null ? valor : resolverIndice(indice);
  };

  return resolverValor(respuesta._entry);
}

function escaparRegex(valor: string): string {
  return valor.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
}

/**
 * El nombre del módulo Qwik cambia en cada despliegue de Ikigai. Se descubre
 * desde el botón Buscar y desde sus imports, en vez de dejar un hash fijo que
 * volvería a romper la lupa al próximo despliegue.
 */
async function descriptorBusquedaIkigai() {
  const doc = await traerDocumento(IKIGAI_WEB + "/series/");
  const evento = doc
    .querySelector('button[aria-label="Buscar"]')
    ?.getAttribute("on:click");
  const moduloBusqueda = evento?.split("#")[0];
  if (!moduloBusqueda || !/^[A-Za-z0-9_-]+\.js$/.test(moduloBusqueda)) {
    throw new Error("Ikigai cambió la entrada de su buscador");
  }

  const codigoBusqueda = await traerTexto(IKIGAI_WEB + "/build/" + moduloBusqueda);
  const dependencia = codigoBusqueda.match(
    /import\{g as [A-Za-z_$][\w$]*\}from"\.\/([^"]+\.js)"/
  )?.[1];
  if (!dependencia || !/^[A-Za-z0-9_-]+\.js$/.test(dependencia)) {
    throw new Error("Ikigai cambió el módulo de su buscador");
  }

  const codigoDatos = await traerTexto(IKIGAI_WEB + "/build/" + dependencia);
  const nombreLocal = codigoDatos.match(/([A-Za-z_$][\w$]*) as g(?:,|})/)?.[1];
  if (!nombreLocal) throw new Error("Ikigai cambió la exportación de su buscador");

  const simbolo = codigoDatos.match(
    new RegExp(
      "(?:const\\s+|,)" +
        escaparRegex(nombreLocal) +
        "=\\w+\\(\\w+\\(\"([^\"]+)\"\\)\\)"
    )
  )?.[1];
  if (!simbolo) throw new Error("Ikigai cambió la función de su buscador");

  const qrl = simbolo.split("_").pop();
  if (!qrl || !/^[A-Za-z0-9_-]+$/.test(qrl)) {
    throw new Error("Ikigai devolvió un identificador de búsqueda inválido");
  }
  return { dependencia, simbolo, qrl };
}

async function cargarIndiceCompleto(): Promise<SerieIndiceIkigai[]> {
  const { dependencia, simbolo, qrl } = await descriptorBusquedaIkigai();
  const body = JSON.stringify({
    _entry: "1",
    _objs: ["\u0002" + dependencia + "#" + simbolo, ["0"]],
  });
  const texto = await enviarJsonNativo(
    IKIGAI_WEB + "/series/?qfunc=" + encodeURIComponent(qrl),
    body,
    qrl
  );
  const respuesta = JSON.parse(texto) as RespuestaQwik;
  if (!respuesta || !Array.isArray(respuesta._objs)) {
    throw new Error("Ikigai devolvió una búsqueda inválida");
  }
  const series = decodificarQwik(respuesta);
  if (!Array.isArray(series)) throw new Error("Ikigai cambió el formato de su buscador");
  return series.filter(
    (serie): serie is SerieIndiceIkigai =>
      Boolean(serie && typeof serie === "object" && "slug" in serie && "name" in serie)
  );
}

function indiceIkigai(): Promise<SerieIndiceIkigai[]> {
  if (!indiceCompleto) {
    indiceCompleto = cargarIndiceCompleto().catch((error) => {
      indiceCompleto = null;
      throw error;
    });
  }
  return indiceCompleto;
}

function normalizarBusqueda(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function buscarIkigai(
  consulta: string,
  page: number,
  filtros: FiltrosIkigai
) {
  const palabras = normalizarBusqueda(consulta).split(/\s+/).filter(Boolean);
  const todas = await indiceIkigai();
  const resultados = todas
    .filter((serie) => {
      if (isPlayStoreApp() && serie.is_mature === true) return false;
      const nombres = [
        serie.name ?? "",
        ...(Array.isArray(serie.other_names)
          ? serie.other_names
          : serie.other_names
            ? [serie.other_names]
            : []),
      ];
      const texto = normalizarBusqueda(nombres.join(" "));
      const tipo = (serie.format || serie.type || "").toLocaleLowerCase("es");
      return (
        palabras.every((palabra) => texto.includes(palabra)) &&
        (!filtros.tipo || tipo === filtros.tipo.toLocaleLowerCase("es"))
      );
    })
    .sort((a, b) => {
      const aEmpieza = normalizarBusqueda(a.name ?? "").startsWith(palabras[0] ?? "") ? 1 : 0;
      const bEmpieza = normalizarBusqueda(b.name ?? "").startsWith(palabras[0] ?? "") ? 1 : 0;
      return bEmpieza - aEmpieza || (b.view_count ?? 0) - (a.view_count ?? 0);
    });

  const porPagina = 50;
  const inicio = Math.max(0, page - 1) * porPagina;
  const pagina = resultados.slice(inicio, inicio + porPagina);
  const series: SerieIkigai[] = pagina.map((serie) => {
    const slug = String(serie.slug);
    // El índice global entrega rutas del proxy de imágenes, no rutas del
    // catálogo. Resolverlas contra IKIGAI_WEB producía carátulas 404.
    const portada = serie.cover
      ? new URL(serie.cover, IKIGAI_IMAGENES).toString()
      : null;
    return {
      slug,
      title: String(serie.name || "Sin título"),
      cover_url: portada,
      tipo: serie.format || serie.type || null,
      url_original: IKIGAI_WEB + "/series/" + slug + "/",
    };
  });
  return { series, page, hayMas: inicio + porPagina < resultados.length };
}

/** Catálogo paginado (20 obras por página en su biblioteca). */
export async function catalogoIkigai(page: number, filtros: FiltrosIkigai = {}) {
  if (isPlayStoreApp() && filtros.genero && IKIGAI_GENEROS_ADULTOS.has(filtros.genero)) {
    return { series: [] as SerieIkigai[], page, hayMas: false };
  }
  if (filtros.q?.trim()) {
    return buscarIkigai(filtros.q.trim(), page, filtros);
  }

  const qs = new URLSearchParams();
  // su paginador usa "pagina", no "page"
  if (page > 1) qs.set("pagina", String(page));
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
    if (isPlayStoreApp() && textoMarcaContenidoAdulto(a.textContent ?? "")) continue;
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
  const generos = Array.from(doc.querySelectorAll('a[href*="generos"]'))
    .map((g) => g.textContent?.trim() ?? "")
    .filter(Boolean)
    .slice(0, 10);

  if (isPlayStoreApp() && generos.some(textoMarcaContenidoAdulto)) {
    contenidoNoDisponible();
  }

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
    generos,
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

  // Es una segunda barrera para enlaces profundos. La ficha sigue siendo la
  // fuente principal de la clasificación, pero Qwik suele serializarla también
  // dentro del documento del visor.
  if (isPlayStoreApp()) {
    const html = doc.documentElement?.innerHTML ?? "";
    if (
      /["']is_mature["']\s*:\s*true/i.test(html) ||
      Array.from(IKIGAI_GENEROS_ADULTOS).some((id) => html.includes(id))
    ) {
      contenidoNoDisponible();
    }
  }

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
