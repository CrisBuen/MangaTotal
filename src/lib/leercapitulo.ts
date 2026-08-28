/**
 * LeerCapítulo — integrada con su permiso.
 *
 * Su sitio es HTML corriente detrás de Cloudflare, así que se lee igual que
 * ZonaTMO: primero por nuestro servidor y, si su Cloudflare rechaza al
 * centro de datos, desde el dispositivo por el puente nativo.
 *
 * Las páginas de cada capítulo no vienen como imágenes en el HTML: van
 * dentro de un <p id="array_data"> en base64 con un alfabeto propio. Ellos
 * dieron permiso para leerlo (es código viejo que ya nadie del equipo
 * conoce). Ver CAMBIO-DE-DOMINIO-LEERCAPITULO.txt.
 */
export const LC_WEB = "https://www.leercapitulo.co";
export const LC_NOMBRE = "LeerCapítulo";

import { traerJson, fuenteNativaDisponible } from "./fuenteNativa";

/**
 * INTERRUPTOR DE LEERCAPÍTULO — poner en true para volver a mostrarla.
 *
 * Está apagada porque su servidor entrega las páginas de cada capítulo en
 * orden aleatorio, distinto en cada carga, y todavía no sabemos rehacer el
 * orden bueno. Con esto encendido, los capítulos se leen desordenados.
 *
 * Lo comprobado hasta ahora está en CAMBIO-DE-DOMINIO-LEERCAPITULO.txt.
 * Cuando el orden se pueda reconstruir, se vuelve a poner en true y listo:
 * el resto de la integración (catálogo, filtros, ficha, lector) funciona.
 */
export const LC_HABILITADA: boolean = false;

/** El servidor lo intenta primero, así que está disponible en todos lados. */
export function lcDisponible(): boolean {
  return LC_HABILITADA;
}

/** Pide una página de su sitio y la devuelve lista para consultar. */
async function pedir(ruta: string, fresco = false): Promise<Document> {
  if (!LC_HABILITADA) {
    throw new Error("LeerCapítulo está fuera de servicio por ahora.");
  }

  let html: string | null = null;

  try {
    const qs = `ruta=${encodeURIComponent(ruta)}${fresco ? "&fresco=1" : ""}`;
    const res = await fetch(`/api/externo/leercapitulo?${qs}`, {
      cache: fresco ? "no-store" : "default",
    });
    if (res.ok) {
      const cuerpo = (await res.json()) as { html?: string };
      if (cuerpo.html) html = cuerpo.html;
    }
  } catch {
    // sin conexión con nuestro servidor: se prueba el puente del dispositivo
  }

  if (html === null) {
    if (!fuenteNativaDisponible()) {
      throw new Error(
        "LeerCapítulo no está respondiendo en este momento. Probá de nuevo en un rato, o desde la app de Android o Windows."
      );
    }
    const cuerpo = await traerJson<{ html: string }>(`${LC_WEB}${ruta}`);
    html = typeof cuerpo === "string" ? cuerpo : cuerpo.html;
  }

  return new DOMParser().parseFromString(html, "text/html");
}

// ── filtros ──────────────────────────────────────────────────────────────

/** Sus géneros en español, tal como los publican. */
export const LC_GENEROS = [
  { id: "accion", name: "Acción" },
  { id: "animacion", name: "Animación" },
  { id: "apocaliptico", name: "Apocalíptico" },
  { id: "artes-marciales", name: "Artes marciales" },
  { id: "aventura", name: "Aventura" },
  { id: "ciberpunk", name: "Ciberpunk" },
  { id: "ciencia-ficcion", name: "Ciencia ficción" },
  { id: "comedia", name: "Comedia" },
  { id: "crimen", name: "Crimen" },
  { id: "demonios", name: "Demonios" },
  { id: "deporte", name: "Deporte" },
  { id: "drama", name: "Drama" },
  { id: "ecchi", name: "Ecchi" },
  { id: "familia", name: "Familia" },
  { id: "fantasia", name: "Fantasía" },
  { id: "genero-bender", name: "Género bender" },
  { id: "gore", name: "Gore" },
  { id: "guerra", name: "Guerra" },
  { id: "harem", name: "Harem" },
  { id: "historia", name: "Historia" },
  { id: "horror", name: "Horror" },
  { id: "isekai", name: "Isekai" },
  { id: "magia", name: "Magia" },
  { id: "mecha", name: "Mecha" },
  { id: "militar", name: "Militar" },
  { id: "misterio", name: "Misterio" },
  { id: "musica", name: "Música" },
  { id: "ninos", name: "Niños" },
  { id: "oeste", name: "Oeste" },
  { id: "parodia", name: "Parodia" },
  { id: "policiaco", name: "Policíaco" },
  { id: "psicologico", name: "Psicológico" },
  { id: "realidad", name: "Realidad" },
  { id: "realidad-virtual", name: "Realidad virtual" },
  { id: "recuentos-de-la-vida", name: "Recuentos de la vida" },
  { id: "reencarnacion", name: "Reencarnación" },
  { id: "romance", name: "Romance" },
  { id: "samurai", name: "Samurái" },
  { id: "sobrenatural", name: "Sobrenatural" },
  { id: "superheroe", name: "Superhéroe" },
  { id: "superpoderes", name: "Superpoderes" },
  { id: "supervivencia", name: "Supervivencia" },
  { id: "telenovela", name: "Telenovela" },
  { id: "thriller", name: "Thriller" },
  { id: "tragedia", name: "Tragedia" },
  { id: "vampiros", name: "Vampiros" },
  { id: "vida-escolar", name: "Vida escolar" },
  { id: "wuxia", name: "Wuxia" },
];

/** Su índice alfabético, para recorrer el catálogo entero. */
export const LC_INICIALES = "abcdefghijklmnopqrstuvwxyz0123456789".split("").map((l) => ({
  id: l,
  name: l.toUpperCase(),
}));

export interface FiltrosLc {
  q?: string;
  genero?: string;
  inicial?: string;
  /** "" = lo último agregado, "tendencias" = su carrusel destacado. */
  lista?: string;
}

/** Las dos listas que publican en su inicio. */
export const LC_LISTAS = [
  { id: "", name: "Últimas actualizaciones" },
  { id: "tendencias", name: "Tendencias" },
];

// ── catálogo ─────────────────────────────────────────────────────────────

export interface SerieLc {
  id: string;
  slug: string;
  title: string;
  cover_url: string | null;
  url_original: string;
}

function urlAbsoluta(u: string | null | undefined): string | null {
  if (!u) return null;
  if (u.startsWith("http")) return u;
  return `${LC_WEB}${u.startsWith("/") ? "" : "/"}${u}`;
}

/** De /manga/{id}/{slug}/ saca las dos piezas que identifican la serie. */
function partesDeSerie(href: string): { id: string; slug: string } | null {
  const partes = href.split("/manga/")[1]?.split("/").filter(Boolean);
  if (!partes || partes.length < 2) return null;
  return { id: partes[0], slug: partes[1] };
}

/**
 * Convierte las tarjetas de una página de listado en series.
 *
 * `dentro` limita la búsqueda a una zona: el inicio trae dos listas a la vez
 * (las tendencias arriba y lo último agregado abajo) y hay que separarlas.
 */
function seriesDelDocumento(doc: Document, dentro?: string): SerieLc[] {
  const series: SerieLc[] = [];
  const vistos = new Set<string>();

  const raiz = dentro ? `${dentro} ` : "";
  for (const a of Array.from(doc.querySelectorAll(`${raiz}a[href*="/manga/"]`))) {
    const href = a.getAttribute("href") ?? "";
    const partes = partesDeSerie(href);
    if (!partes || vistos.has(partes.id)) continue;

    // solo las tarjetas del listado traen portada: así se descartan los
    // enlaces sueltos del menú y del pie
    const img = a.querySelector("img");
    if (!img) continue;
    vistos.add(partes.id);

    series.push({
      ...partes,
      title:
        a.getAttribute("title")?.trim() ||
        img.getAttribute("alt")?.trim() ||
        "Sin título",
      // en el inicio las portadas van con carga diferida: la dirección
      // real está en data-src y el src viene vacío
      cover_url: urlAbsoluta(
        img.getAttribute("data-src") ??
          img.getAttribute("data-original") ??
          img.getAttribute("src")
      ),
      url_original: `${LC_WEB}/manga/${partes.id}/${partes.slug}/`,
    });
  }

  return series;
}

const POR_PAGINA = 30;

/**
 * Catálogo paginado. Sin filtros muestra lo último que actualizaron; con
 * género o inicial recorre esa lista, que es la forma de ver todo el
 * catálogo porque no publican un listado general.
 */
export async function catalogoLc(page: number, filtros: FiltrosLc = {}, fresco = false) {
  let ruta: string;
  let dentro: string | undefined;

  if (filtros.q) {
    ruta = `/?s=${encodeURIComponent(filtros.q)}`;
  } else if (filtros.genero) {
    ruta = `/genre/${filtros.genero}/?page=${page}`;
  } else if (filtros.inicial) {
    ruta = `/initial/${filtros.inicial}/?page=${page}`;
  } else if (filtros.lista === "tendencias") {
    // el inicio trae las tendencias arriba, en su propio carrusel
    ruta = "/";
    dentro = ".hot-manga";
  } else {
    ruta = "/";
    dentro = ".mainpage-manga";
  }

  const doc = await pedir(ruta, fresco);
  let series = seriesDelDocumento(doc, dentro);
  // si su maquetado cambió y la zona no existe, se lee la página entera
  if (series.length === 0 && dentro) series = seriesDelDocumento(doc);

  // su paginador no dice cuántas páginas hay: se avanza mientras la página
  // venga llena
  const paginable = Boolean(filtros.genero || filtros.inicial);
  return {
    series,
    page,
    paginable,
    hayMas: paginable && series.length >= POR_PAGINA,
  };
}

// ── ficha de la serie ────────────────────────────────────────────────────

export interface CapituloLc {
  /** El número tal como aparece en su URL. */
  id: string;
  numero: string | null;
  titulo: string | null;
  url_original: string;
}

/** Lee "Estado: Ongoing" y compañía del bloque de datos de la ficha. */
function campo(texto: string, etiqueta: string): string | null {
  const re = new RegExp(`${etiqueta}\\s*:?\\s*([^\\n]*)`, "i");
  const m = re.exec(texto);
  return m?.[1]?.split(/\s{2,}/)[0]?.trim() || null;
}

/** Ficha de una serie con todos sus capítulos (los publican en una sola página). */
export async function serieLc(id: string, slug: string) {
  const doc = await pedir(`/manga/${id}/${slug}/`);

  const datos = doc.querySelector(".description-update")?.textContent ?? "";

  const capitulos: CapituloLc[] = [];
  const vistos = new Set<string>();
  for (const a of Array.from(doc.querySelectorAll('.chapter a[href*="/leer/"]'))) {
    const href = a.getAttribute("href") ?? "";
    // /leer/{id}/{slug}/{numero}/
    const numero = href.split("/").filter(Boolean).pop();
    if (!numero || vistos.has(numero)) continue;
    vistos.add(numero);

    capitulos.push({
      id: numero,
      numero,
      titulo: a.textContent?.trim() || null,
      url_original: urlAbsoluta(href)!,
    });
  }

  // los listan del más nuevo al más viejo: se ordena para leer en orden
  capitulos.sort((a, b) => Number(a.numero ?? 0) - Number(b.numero ?? 0));

  return {
    id,
    slug,
    title: doc.querySelector("h1.title-manga")?.textContent?.trim() ?? "Sin título",
    cover_url: urlAbsoluta(doc.querySelector(".cover-detail img")?.getAttribute("src")),
    description: doc.querySelector(".manga-collapse")?.textContent?.trim() || null,
    tipo: campo(datos, "Escribe"),
    estado: campo(datos, "Estado"),
    titulosAlternativos: campo(datos, "Títulos Alternativos"),
    generos: Array.from(doc.querySelectorAll('.description-update a[href*="/genre/"]'))
      .map((g) => g.textContent?.trim() ?? "")
      .filter(Boolean),
    capitulos,
    url_original: `${LC_WEB}/manga/${id}/${slug}/`,
  };
}

/** Enlace al capítulo en su propio visor. */
export function urlCapituloLc(id: string, slug: string, numero: string): string {
  return `${LC_WEB}/leer/${id}/${slug}/${numero}/`;
}

// ── páginas de un capítulo ───────────────────────────────────────────────


export interface PaginasLc {
  paginas: string[];
  numero: string;
  anterior: string | null;
  siguiente: string | null;
  url_original: string;
}

/**
 * Páginas de un capítulo, YA EN ORDEN, más sus vecinos.
 *
 * Esto no se resuelve en el dispositivo como el resto de la fuente: su
 * servidor entrega las páginas barajadas, con un barajado distinto en cada
 * carga, y rehacer el orden bueno exige mirar las imágenes. Eso pasa en
 * nuestro servidor (ver src/lib/leercapituloOrden.ts) y por eso acá se pide
 * el capítulo entero de una, sin puente nativo de por medio: un capítulo
 * desordenado es peor que un capítulo que no abre.
 */
export async function paginasLc(id: string, slug: string, numero: string): Promise<PaginasLc> {
  const ruta = `/leer/${id}/${slug}/${numero}/`;
  const res = await fetch(
    `/api/externo/leercapitulo?accion=capitulo&ruta=${encodeURIComponent(ruta)}`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    const cuerpo = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(cuerpo?.error ?? "No se pudo abrir este capítulo");
  }

  const datos = (await res.json()) as PaginasLc;
  if (!datos.paginas?.length) throw new Error("Este capítulo no trae páginas");

  return { ...datos, url_original: urlCapituloLc(id, slug, numero) };
}