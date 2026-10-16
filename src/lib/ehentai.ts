import { isPlayStoreApp } from "./appVersion";

export const EHENTAI_NOMBRE = "E-Hentai";
export const EHENTAI_WEB = "https://e-hentai.org";
export const EHENTAI_API = "https://api.e-hentai.org/api.php";

/**
 * Categorías de E-Hentai y sus máscaras de bits.
 * En la URL de E-Hentai, f_cats contiene las categorías DESHABILITADAS,
 * por lo que el valor a enviar es: 1023 - suma_de_bits_habilitados.
 */
export const EHENTAI_CATEGORIAS: { id: string; label: string; bit: number }[] = [
  { id: "doujinshi", label: "Doujinshi", bit: 2 },
  { id: "manga", label: "Manga", bit: 4 },
  { id: "artistcg", label: "Artist CG", bit: 8 },
  { id: "gamecg", label: "Game CG", bit: 16 },
  { id: "western", label: "Western", bit: 512 },
  { id: "non-h", label: "Non-H", bit: 256 },
  { id: "imageset", label: "Image Set", bit: 32 },
  { id: "cosplay", label: "Cosplay", bit: 64 },
  { id: "asianporn", label: "Asian Porn", bit: 128 },
  { id: "misc", label: "Misc", bit: 1 },
];

/**
 * Idiomas populares para el selector en tiempo real.
 */
export const EHENTAI_IDIOMAS: { id: string; label: string; tag: string }[] = [
  { id: "todos", label: "Todos", tag: "" },
  { id: "spanish", label: "Español", tag: "language:spanish" },
  { id: "english", label: "Inglés", tag: "language:english" },
  { id: "japanese", label: "Japonés", tag: "language:japanese" },
  { id: "chinese", label: "Chino", tag: "language:chinese" },
  { id: "korean", label: "Coreano", tag: "language:korean" },
  { id: "french", label: "Francés", tag: "language:french" },
  { id: "portuguese", label: "Portugués", tag: "language:portuguese" },
  { id: "russian", label: "Ruso", tag: "language:russian" },
  { id: "german", label: "Alemán", tag: "language:german" },
  { id: "italian", label: "Italiano", tag: "language:italian" },
];

export interface SerieEhentai {
  gid: string;
  token: string;
  title: string;
  category: string;
  thumb: string;
  uploader?: string;
  posted?: string;
  filecount: number;
  tags?: string[];
}

export interface FichaEhentai extends SerieEhentai {
  title_jpn?: string;
  rating?: string;
  url_original: string;
}

export interface CatalogoEhentai {
  series: SerieEhentai[];
  pagina: number;
  hayMas: boolean;
}

/**
 * Calcula la máscara f_cats para E-Hentai.
 * Si no hay filtro o es "todos", devuelve 0 (todas habilitadas).
 */
export function calcularFCats(categoriaId?: string): number {
  if (!categoriaId || categoriaId === "todos") return 0;
  const encontrada = EHENTAI_CATEGORIAS.find((c) => c.id.toLowerCase() === categoriaId.toLowerCase());
  if (!encontrada) return 0;
  // f_cats es la máscara de las deshabilitadas
  return 1023 - encontrada.bit;
}

/**
 * Consulta el catálogo o búsqueda de E-Hentai.
 * Respeta estrictamente la exclusión de Play Store.
 */
export async function catalogoEhentai(opciones: {
  busqueda?: string;
  categoria?: string;
  idioma?: string;
  tag?: string;
  pagina?: number;
}): Promise<CatalogoEhentai> {
  if (isPlayStoreApp()) {
    throw new Error("Fuente no disponible en esta edición");
  }

  const { busqueda = "", categoria = "todos", idioma = "todos", tag = "", pagina = 0 } = opciones;

  const url = new URL(EHENTAI_WEB);
  if (pagina > 0) {
    url.searchParams.set("page", String(pagina));
  }

  const fCats = calcularFCats(categoria);
  if (fCats > 0) {
    url.searchParams.set("f_cats", String(fCats));
  }

  const partesBusqueda: string[] = [];
  if (busqueda.trim()) {
    partesBusqueda.push(busqueda.trim());
  }

  if (tag && tag.trim()) {
    const tagLimpio = tag.trim().includes(" ") ? `"${tag.trim()}$"` : `${tag.trim()}$`;
    partesBusqueda.push(tagLimpio);
  }

  if (idioma && idioma !== "todos") {
    const idi = EHENTAI_IDIOMAS.find((i) => i.id === idioma);
    if (idi?.tag) {
      partesBusqueda.push(idi.tag);
    }
  }

  if (partesBusqueda.length > 0) {
    url.searchParams.set("f_search", partesBusqueda.join(" "));
  }

  const res = await fetch(url.toString(), {
    headers: {
      Cookie: "nw=1",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    },
    next: { revalidate: 120 },
  });

  if (!res.ok) {
    throw new Error(`E-Hentai respondió ${res.status}`);
  }

  const html = await res.text();
  const series: SerieEhentai[] = [];

  // Recorrer filas de la tabla de galerías
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)];
  for (const row of rows) {
    const text = row[1];
    const linkMatch = text.match(/https:\/\/e-hentai\.org\/g\/(\d+)\/([a-f0-9]+)\//);
    if (!linkMatch) continue;

    const gid = linkMatch[1];
    const token = linkMatch[2];

    const titleMatch = text.match(/class="glink">([^<]+)<\/div>/);
    const catMatch =
      text.match(/class="cn ([^"]+)"[^>]*>([^<]+)<\/div>/) ||
      text.match(/class="cs ([^"]+)"[^>]*>([^<]+)<\/div>/);
    const thumbMatch =
      text.match(/data-src="([^"]+)"/) ||
      text.match(/src="(https:\/\/[^"]*ehgt[^"]+)"/);

    const pagesMatch = text.match(/<div>(\d+)\s+pages<\/div>/i);
    const uploaderMatch = text.match(/\/uploader\/([^"]+)"/);
    const postedMatch = text.match(/id="posted[^>]*>([^<]+)<\/div>/);

    const tagsMatches = [...text.matchAll(/class="gt"[^>]*title="([^"]+)"/g)].map((m) => m[1]);

    series.push({
      gid,
      token,
      title: titleMatch ? titleMatch[1].trim() : `Galería #${gid}`,
      category: catMatch ? catMatch[2].trim() : "Manga",
      thumb: thumbMatch ? (thumbMatch[1] || thumbMatch[0]) : "",
      filecount: pagesMatch ? parseInt(pagesMatch[1], 10) : 0,
      uploader: uploaderMatch ? uploaderMatch[1] : undefined,
      posted: postedMatch ? postedMatch[1] : undefined,
      tags: tagsMatches,
    });
  }

  // Detectar si hay más páginas mediante la barra de paginación
  const hayMas = html.includes(`page=${pagina + 1}`) || html.includes(`onclick="return false">`);

  return {
    series,
    pagina,
    hayMas,
  };
}

/**
 * Obtiene los detalles completos de una galería usando la API oficial gdata de E-Hentai.
 */
export async function fichaEhentai(gid: string, token: string): Promise<FichaEhentai> {
  if (isPlayStoreApp()) {
    throw new Error("Fuente no disponible en esta edición");
  }

  const apiRes = await fetch(EHENTAI_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      method: "gdata",
      gidlist: [[parseInt(gid, 10), token]],
      namespace: 1,
    }),
    next: { revalidate: 3600 },
  });

  if (!apiRes.ok) {
    throw new Error(`La API de E-Hentai respondió ${apiRes.status}`);
  }

  const json = (await apiRes.json()) as { gmetadata?: any[] };
  const meta = json.gmetadata?.[0];

  if (!meta || meta.error) {
    throw new Error(meta?.error || "Galería no encontrada en E-Hentai");
  }

  return {
    gid,
    token,
    title: meta.title || `Galería #${gid}`,
    title_jpn: meta.title_jpn || undefined,
    category: meta.category || "Doujinshi",
    thumb: meta.thumb || "",
    uploader: meta.uploader || "",
    posted: meta.posted ? new Date(parseInt(meta.posted, 10) * 1000).toISOString() : undefined,
    filecount: parseInt(meta.filecount, 10) || 0,
    rating: meta.rating || undefined,
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    url_original: `${EHENTAI_WEB}/g/${gid}/${token}/`,
  };
}

// Caché en memoria para las páginas ya resueltas de una galería
const paginasCache = new Map<string, { paginas: string[]; vence: number }>();

/**
 * Obtiene todas las URLs directas de las imágenes de una galería para el lector y la descarga.
 * Resuelve las páginas mediante la API o raspado de los enlaces de visualización.
 */
export async function paginasEhentai(gid: string, token: string): Promise<string[]> {
  if (isPlayStoreApp()) {
    throw new Error("Fuente no disponible en esta edición");
  }

  const claveCache = `${gid}:${token}`;
  const enCache = paginasCache.get(claveCache);
  if (enCache && enCache.vence > Date.now()) {
    return enCache.paginas;
  }

  // 1. Obtener la ficha para saber el total de páginas
  const ficha = await fichaEhentai(gid, token);
  const totalPaginas = ficha.filecount;
  if (totalPaginas <= 0) return [];

  // 2. Extraer todos los viewer links recorriendo las subpáginas de la galería (?p=0, ?p=1...)
  // Cada subpágina contiene normalmente 20 enlaces (o 40).
  const viewerLinks: string[] = [];
  const paginasIndice = Math.ceil(totalPaginas / 20);

  // Pedir subpáginas en lotes de 3 concurrentes
  for (let p = 0; p < paginasIndice; p += 3) {
    const lotes = [p, p + 1, p + 2].filter((i) => i < paginasIndice);
    const resultados = await Promise.all(
      lotes.map(async (indice) => {
        const url = `${EHENTAI_WEB}/g/${gid}/${token}/?p=${indice}`;
        const res = await fetch(url, {
          headers: {
            Cookie: "nw=1",
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          },
        });
        if (!res.ok) return [];
        const html = await res.text();
        const matches = [
          ...html.matchAll(
            new RegExp(`https:\\/\\/e-hentai\\.org\\/s\\/([a-f0-9]+)\\/${gid}-(\\d+)`, "g")
          ),
        ];
        return matches.map((m) => ({ url: m[0], num: parseInt(m[2], 10) }));
      })
    );

    for (const res of resultados) {
      for (const item of res) {
        viewerLinks[item.num - 1] = item.url;
      }
    }
  }

  const linksValidos = viewerLinks.filter(Boolean);
  if (linksValidos.length === 0) {
    throw new Error("No se pudieron obtener las páginas de la galería");
  }

  // 3. Resolver las imágenes finales desde los enlaces de visualización
  // Se ejecutan con concurrencia controlada (máximo 8 simultáneas) para rapidez extrema sin saturar
  const imagenesResueltas = new Array<string>(linksValidos.length);
  const limite = 8;
  let cursor = 0;

  async function procesarSiguiente(): Promise<void> {
    while (cursor < linksValidos.length) {
      const idx = cursor++;
      const vUrl = linksValidos[idx];
      try {
        const res = await fetch(vUrl, {
          headers: {
            Cookie: "nw=1",
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          },
        });
        if (res.ok) {
          const html = await res.text();
          const match = html.match(/<img id="img"[^>]+src="([^"]+)"/);
          if (match && match[1]) {
            imagenesResueltas[idx] = match[1];
          }
        }
      } catch {
        // En caso de fallo en una página aislada
      }
    }
  }

  const trabajadores = Array.from({ length: Math.min(limite, linksValidos.length) }, () =>
    procesarSiguiente()
  );
  await Promise.all(trabajadores);

  const paginasFinales = imagenesResueltas.filter(Boolean);
  if (paginasFinales.length > 0) {
    paginasCache.set(claveCache, {
      paginas: paginasFinales,
      vence: Date.now() + 60 * 60 * 1000, // 1 hora
    });
  }

  return paginasFinales;
}
