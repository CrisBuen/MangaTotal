/**
 * Cliente de la API de Olympus Scanlation, integrada con su permiso.
 *
 * ⚠️ SI CAMBIAN DE DOMINIO: los tres valores de abajo son lo único que hay
 * que tocar. Ver CAMBIO-DE-DOMINIO-OLYMPUS.txt en la raíz del proyecto.
 */
export const OLYMPUS_WEB = "https://olympusxyz.com";
export const OLYMPUS_PANEL = "https://panel.olympusxyz.com";
/** Nombre del grupo, visible en cada serie y capítulo. */
export const OLYMPUS_NOMBRE = "Olympus Scanlation";

const UA = "MangaTotal/1.0 (+https://manga-total.vercel.app)";

/** Capítulos con acceso anticipado: Olympus los reserva a quienes los apoyan. */
const PREFIJO_PROTEGIDO = "/cp/";

async function olympusFetch<T>(url: string, revalidate: number): Promise<T> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    next: { revalidate },
  });
  if (!res.ok) throw new Error(`Olympus respondió ${res.status} en ${url}`);
  return (await res.json()) as T;
}

// ── formas que devuelve su API ────────────────────────────────────────────
interface OlySerieLista {
  id: number;
  name: string;
  slug: string;
  status: { id: number; name: string } | null;
  cover: string | null;
  chapter_count: number;
  type: string;
  total_views?: number;
}

interface OlySerieDetalle extends OlySerieLista {
  summary: string | null;
  genres: { id: number; name: string }[];
  team: { id: number; name: string; cover: string | null } | null;
  first_chapter: { id: number; name: string } | null;
  rating?: number;
}

interface OlyCapitulo {
  id: number;
  name: string;
  published_at: string;
  team: { name: string } | null;
}

/** Enlace a la ficha de la serie en el sitio de Olympus. */
export function urlSerieEnOlympus(tipo: string, slug: string): string {
  return `${OLYMPUS_WEB}/series/${tipo}-${slug}`;
}

/** Enlace al capítulo en el sitio de Olympus. */
export function urlCapituloEnOlympus(id: number, tipo: string, slug: string): string {
  return `${OLYMPUS_WEB}/capitulo/${id}/${tipo}-${slug}`;
}

export function serieResumen(s: OlySerieLista) {
  return {
    id: s.id,
    slug: s.slug,
    title: s.name,
    cover_url: s.cover,
    status: s.status?.name ?? null,
    chapter_count: s.chapter_count,
    type: s.type,
    url_original: urlSerieEnOlympus(s.type, s.slug),
  };
}

/** Catálogo paginado (15 por página en su API). */
export async function catalogo(page: number) {
  const data = await olympusFetch<{
    data: { series: { current_page: number; last_page: number; total: number; data: OlySerieLista[] } };
  }>(`${OLYMPUS_WEB}/api/series?page=${page}`, 600);

  const s = data.data.series;
  return {
    series: s.data.map(serieResumen),
    page: s.current_page,
    last_page: s.last_page,
    total: s.total,
  };
}

/**
 * Su API no tiene buscador, así que para buscar se arma el índice completo
 * (58 páginas) una vez por hora y se filtra acá.
 */
export async function buscar(termino: string) {
  const primera = await catalogo(1);
  const paginas = Array.from({ length: primera.last_page - 1 }, (_, i) => i + 2);

  const todas = [...primera.series];
  const LOTE = 6;
  for (let i = 0; i < paginas.length; i += LOTE) {
    const grupo = await Promise.all(
      paginas.slice(i, i + LOTE).map((p) =>
        olympusFetch<{ data: { series: { data: OlySerieLista[] } } }>(
          `${OLYMPUS_WEB}/api/series?page=${p}`,
          3600
        ).catch(() => null)
      )
    );
    for (const r of grupo) {
      if (r) todas.push(...r.data.series.data.map(serieResumen));
    }
  }

  const buscado = normalizar(termino);
  return todas.filter((s) => normalizar(s.title).includes(buscado));
}

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export async function serie(slug: string) {
  const data = await olympusFetch<{ data: OlySerieDetalle }>(
    `${OLYMPUS_WEB}/api/series/${encodeURIComponent(slug)}`,
    600
  );
  const d = data.data;
  return {
    ...serieResumen(d),
    summary: d.summary,
    genres: (d.genres ?? []).map((g) => g.name),
    team: d.team?.name ?? OLYMPUS_NOMBRE,
    rating: d.rating ?? null,
    first_chapter: d.first_chapter,
  };
}

/** Lista de capítulos (40 por página en su API). */
export async function capitulos(slug: string, page: number) {
  const data = await olympusFetch<{
    data: OlyCapitulo[];
    meta: { current_page: number; last_page: number; total: number };
  }>(`${OLYMPUS_PANEL}/api/series/${encodeURIComponent(slug)}/chapters?page=${page}`, 600);

  return {
    chapters: data.data.map((c) => ({
      id: c.id,
      name: c.name,
      published_at: c.published_at,
      team: c.team?.name ?? OLYMPUS_NOMBRE,
    })),
    page: data.meta.current_page,
    last_page: data.meta.last_page,
    total: data.meta.total,
  };
}

/**
 * Páginas de un capítulo. Vienen en el HTML del lector de Olympus, dentro
 * del payload de Nuxt: un array plano donde cada valor puede ser un índice
 * que apunta a otra posición del mismo array.
 */
export async function paginas(chapterId: number, tipo: string, slug: string) {
  const url = urlCapituloEnOlympus(chapterId, tipo, slug);
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    next: { revalidate: 600 },
  });
  if (!res.ok) throw new Error(`Olympus respondió ${res.status} al abrir el capítulo`);

  const html = await res.text();
  const bloque = html.match(/__NUXT_DATA__[^>]*>(\[[\s\S]*?\])<\/script>/);
  if (!bloque) throw new Error("El lector de Olympus cambió de formato");

  const plano = JSON.parse(bloque[1]) as unknown[];
  const raiz = plano[3] as Record<string, number>;
  const clave = Object.keys(raiz)[0];
  const nodo = plano[raiz[clave]] as { chapter?: number; prev_chapter?: number; next_chapter?: number };
  if (nodo?.chapter === undefined) throw new Error("Capítulo no encontrado en Olympus");

  const cap = plano[nodo.chapter] as Record<string, number>;
  const lista = plano[cap.pages];
  const urls = Array.isArray(lista)
    ? lista.map((i) => (typeof i === "number" ? (plano[i] as string) : (i as string)))
    : [];

  // acceso anticipado: no se muestran, se enlaza a Olympus
  const protegido = urls.length > 0 && urls.every((u) => u.startsWith(PREFIJO_PROTEGIDO));

  const vecino = (indice?: number) => {
    if (indice === undefined) return null;
    const v = plano[indice] as Record<string, number> | null;
    if (!v || typeof v !== "object") return null;
    return { id: plano[v.id] as number, name: String(plano[v.name] ?? "") };
  };

  return {
    id: chapterId,
    name: String(plano[cap.name] ?? ""),
    pages: protegido ? [] : urls.filter((u) => u.startsWith("http")),
    protegido,
    prev: vecino(nodo.prev_chapter),
    next: vecino(nodo.next_chapter),
    url_original: url,
  };
}
