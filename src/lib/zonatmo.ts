/**
 * ZonaTMO — integrada con su permiso.
 *
 * A diferencia de MangaDex y Olympus, esta fuente NO se puede leer desde el
 * servidor: Cloudflare bloquea las IPs de centros de datos (403 en todo,
 * incluidas sus imágenes). Comprobado que el bloqueo es solo por IP: desde
 * una conexión hogareña responde con cualquier user agent.
 *
 * Por eso las peticiones salen del dispositivo de la persona, igual que
 * hace Mihon: en Android por el puente nativo de Capacitor y en la app de
 * escritorio por el de Tauri. En el navegador no está disponible, porque no
 * puede leer otro sitio (CORS).
 *
 * ⚠️ SI CAMBIAN DE DOMINIO: ver CAMBIO-DE-DOMINIO-ZONATMO.txt en la raíz.
 */
export const TMO_WEB = "https://zonatmo.org";
export const TMO_NOMBRE = "ZonaTMO";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

interface PuenteNativo {
  get(opciones: { url: string; headers?: Record<string, string> }): Promise<{
    status: number;
    data: string;
  }>;
}

/** Puente disponible según dónde corra la app (Android, escritorio o web). */
function puente(): PuenteNativo | null {
  if (typeof window === "undefined") return null;

  const capacitor = (window as unknown as {
    Capacitor?: { Plugins?: { CapacitorHttp?: PuenteNativo } };
  }).Capacitor;
  if (capacitor?.Plugins?.CapacitorHttp) return capacitor.Plugins.CapacitorHttp;

  const tauri = (window as unknown as {
    __TAURI__?: { http?: { fetch: (url: string, init?: RequestInit) => Promise<Response> } };
  }).__TAURI__;
  if (tauri?.http?.fetch) {
    return {
      async get({ url, headers }) {
        const res = await tauri.http!.fetch(url, { headers });
        return { status: res.status, data: await res.text() };
      },
    };
  }

  return null;
}

/** True si esta plataforma puede leer ZonaTMO. */
export function tmoDisponible(): boolean {
  return puente() !== null;
}

async function traerHtml(ruta: string): Promise<Document> {
  const nativo = puente();
  if (!nativo) {
    throw new Error(
      "ZonaTMO solo está disponible en la app de Android o de Windows, no en el navegador"
    );
  }

  const res = await nativo.get({
    url: ruta.startsWith("http") ? ruta : `${TMO_WEB}${ruta}`,
    headers: { "User-Agent": UA, "Accept-Language": "es-ES,es;q=0.9" },
  });
  if (res.status !== 200) throw new Error(`ZonaTMO respondió ${res.status}`);

  return new DOMParser().parseFromString(res.data, "text/html");
}

export interface SerieTmo {
  id: string;
  tipo: string;
  slug: string;
  title: string;
  cover_url: string | null;
  url_original: string;
}

function serieDesdeEnlace(url: string): { id: string; tipo: string; slug: string } | null {
  // formato: /library/{tipo}/{id}/{slug}
  const partes = url.split("/library/")[1]?.split("/");
  if (!partes || partes.length < 3) return null;
  return { tipo: partes[0], id: partes[1], slug: partes[2] };
}

/** Catálogo paginado (24 series por página en su sitio). */
export async function catalogoTmo(page: number, filtros: { q?: string; orden?: string } = {}) {
  const qs = new URLSearchParams({ page: String(page) });
  if (filtros.q) qs.set("title", filtros.q);
  if (filtros.orden && filtros.orden !== "recientes") qs.set("sort", filtros.orden);

  const doc = await traerHtml(`/biblioteca?${qs.toString()}`);

  const series: SerieTmo[] = [];
  for (const el of Array.from(doc.querySelectorAll("#library-grid .element"))) {
    const enlace = el.querySelector("a[href]")?.getAttribute("href") ?? "";
    const datos = serieDesdeEnlace(enlace);
    if (!datos) continue;

    series.push({
      ...datos,
      title:
        el.querySelector("h4")?.getAttribute("title")?.trim() ||
        el.querySelector("h4")?.textContent?.trim() ||
        "Sin título",
      cover_url: el.querySelector("img")?.getAttribute("src") ?? null,
      url_original: enlace,
    });
  }

  // su paginador no publica el total: se avanza mientras vengan resultados
  return { series, page, hayMas: series.length > 0 };
}

export interface CapituloTmo {
  id: string;
  numero: string | null;
  grupo: string | null;
}

/** Ficha de una serie con su lista de capítulos. */
export async function serieTmo(tipo: string, id: string, slug: string) {
  const doc = await traerHtml(`/library/${tipo}/${id}/${slug}`);

  const capitulos: CapituloTmo[] = [];
  const vistos = new Set<string>();

  for (const a of Array.from(doc.querySelectorAll('a[href*="/view_uploads/"]'))) {
    const href = a.getAttribute("href") ?? "";
    const capId = href.split("/view_uploads/")[1]?.split(/[?#]/)[0];
    if (!capId || vistos.has(capId)) continue;
    vistos.add(capId);

    // el número está en el bloque del capítulo que contiene este enlace
    const bloque = a.closest(".upload-link") ?? a.closest("li") ?? a.parentElement;
    const numero =
      bloque?.querySelector("[data-chapter-number]")?.getAttribute("data-chapter-number") ?? null;
    const grupo =
      bloque?.querySelector(".uploader-name, .badge")?.textContent?.trim() || null;

    capitulos.push({ id: capId, numero, grupo });
  }

  return {
    id,
    tipo,
    slug,
    title: doc.querySelector("h1.element-title")?.textContent?.trim() ?? "Sin título",
    cover_url: doc.querySelector("img.book-thumbnail")?.getAttribute("src") ?? null,
    description: doc.querySelector(".element-description")?.textContent?.trim() ?? null,
    generos: Array.from(doc.querySelectorAll("a.badge"))
      .map((g) => g.textContent?.trim() ?? "")
      .filter((g) => g && g.length < 30)
      .slice(0, 12),
    // vienen del más nuevo al más viejo: se invierte para leer en orden
    capitulos: capitulos.reverse(),
    url_original: `${TMO_WEB}/library/${tipo}/${id}/${slug}`,
  };
}

/** Páginas de un capítulo. */
export async function capituloTmo(chapterId: string) {
  const doc = await traerHtml(`/view_uploads/${chapterId}`);

  const paginas = Array.from(doc.querySelectorAll(".reader-img-wrap img"))
    .map((img) => img.getAttribute("src") ?? img.getAttribute("data-src") ?? "")
    .filter((u) => u.startsWith("http"));

  return {
    id: chapterId,
    titulo: doc.querySelector("title")?.textContent?.split("—")[1]?.trim() ?? null,
    paginas,
    url_original: `${TMO_WEB}/view_uploads/${chapterId}`,
  };
}
