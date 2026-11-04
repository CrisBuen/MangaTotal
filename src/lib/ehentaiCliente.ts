/**
 * Cliente de E-Hentai con prioridad de puente nativo en Android y Windows PC.
 *
 * En las apps nativas, todas las consultas (catálogo, autocompletado de tags,
 * fichas `gdata` e índice de páginas del lector/descargas) salen directo desde
 * la conexión del dispositivo hacia `e-hentai.org` y `api.e-hentai.org`, con
 * 0 invocaciones y 0 ancho de banda en Vercel / R2, y sin restricciones por IP
 * compartida de centro de datos.
 *
 * En navegador web —o si la persona todavía no actualizó el binario nativo—
 * cae de forma transparente a `/api/externo/ehentai` sin romper nada.
 */

import { isPlayStoreApp } from "./appVersion";
import {
  EHENTAI_API,
  EHENTAI_WEB,
  armarConsultaCatalogoEhentai,
  ejecutarCatalogoEhentaiConTransporte,
  ejecutarSugerenciasEhentaiConTransporte,
  extraerImgDirectaVisorEhentai,
  extraerLinksVisorGaleriaEhentai,
  normalizarFichaGdataEhentai,
  type CatalogoEhentai,
  type EntradaRawTagSuggest,
  type FichaEhentai,
  type OpcionesCatalogoEhentai,
  type SugerenciaTagEhentai,
} from "./ehentai";
import {
  DesafioPendiente,
  fuenteNativaDisponible,
  postJsonNativo,
  traerTexto,
} from "./fuenteNativa";

// Si el binario nativo instalado es anterior a la incorporación de e-hentai.org
// en la lista blanca de páginas/JSON, se desactiva para el resto de la sesión y
// usa la ruta web sin demorar cada pedido.
let puenteEhSoportado = true;

const catalogoClienteCache = new Map<string, { data: CatalogoEhentai; vence: number }>();
const sugerenciasClienteCache = new Map<string, { data: SugerenciaTagEhentai[]; vence: number }>();
const fichaClienteCache = new Map<string, { data: FichaEhentai; vence: number }>();
const paginasClienteCache = new Map<string, { data: string[]; vence: number }>();

function marcarSiPuenteAntiguo(err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (
    msg.includes("no permitida") ||
    msg.includes("Identificador de búsqueda inválido") ||
    msg.includes("Actualizá MangaTotal")
  ) {
    puenteEhSoportado = false;
  }
}

function puedeUsarPuenteEh(): boolean {
  return puenteEhSoportado && fuenteNativaDisponible();
}

async function pedirTagSuggestRawNativo(consulta: string): Promise<EntradaRawTagSuggest[]> {
  const json = await postJsonNativo<{ tags?: Record<string, EntradaRawTagSuggest> | unknown[] }>(
    EHENTAI_API,
    { method: "tagsuggest", text: consulta }
  );
  return json?.tags && !Array.isArray(json.tags) ? Object.values(json.tags) : [];
}

/**
 * Autocompletado de etiquetas en tiempo real desde la base completa de E-Hentai.
 * Prioriza `postJsonNativo` directo a `api.e-hentai.org` en Android y Windows PC.
 */
export async function pedirSugerenciasEhentai(
  texto: string,
  nsForzado = "",
  signal?: AbortSignal
): Promise<SugerenciaTagEhentai[]> {
  if (isPlayStoreApp()) return [];
  const q = texto.trim();
  if (q.length < 2) return [];

  const claveMem = `${nsForzado || "todos"}:${q.toLowerCase()}`;
  const guardada = sugerenciasClienteCache.get(claveMem);
  if (guardada && guardada.vence > Date.now()) {
    return guardada.data;
  }

  if (puedeUsarPuenteEh()) {
    try {
      const res = await ejecutarSugerenciasEhentaiConTransporte(
        q,
        nsForzado,
        pedirTagSuggestRawNativo
      );
      const tags = res?.ordenadas ?? [];
      if (sugerenciasClienteCache.size >= 200) {
        const k = sugerenciasClienteCache.keys().next().value;
        if (k !== undefined) sugerenciasClienteCache.delete(k);
      }
      sugerenciasClienteCache.set(claveMem, { data: tags, vence: Date.now() + 20 * 60_000 });
      return tags;
    } catch (err) {
      if (err instanceof DesafioPendiente) throw err;
      marcarSiPuenteAntiguo(err);
    }
  }

  if (signal?.aborted) return [];
  const nsParam = nsForzado && nsForzado !== "todos" ? `&ns=${encodeURIComponent(nsForzado)}` : "";
  const res = await fetch(`/api/externo/ehentai?suggest=${encodeURIComponent(q)}${nsParam}`, {
    signal,
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { tags?: SugerenciaTagEhentai[] };
  const tags = Array.isArray(data.tags) ? data.tags : [];
  sugerenciasClienteCache.set(claveMem, { data: tags, vence: Date.now() + 20 * 60_000 });
  return tags;
}

/**
 * Catálogo y búsqueda por etiquetas de E-Hentai sin exclusiones de invitado.
 * En Android y Windows PC consulta directo a `e-hentai.org` sin tocar Vercel.
 */
export async function pedirCatalogoEhentai(
  opciones: OpcionesCatalogoEhentai & { signal?: AbortSignal }
): Promise<CatalogoEhentai> {
  if (isPlayStoreApp()) {
    throw new Error("Fuente no disponible en esta edición");
  }

  const { signal, ...opts } = opciones;
  const { urlStr } = armarConsultaCatalogoEhentai(opts);
  const ahora = Date.now();
  if (!opts.fresco) {
    const cached = catalogoClienteCache.get(urlStr);
    if (cached && cached.vence > ahora) {
      return cached.data;
    }
  }

  if (puedeUsarPuenteEh()) {
    try {
      const { resultado } = await ejecutarCatalogoEhentaiConTransporte(
        opts,
        traerTexto,
        (t) => pedirSugerenciasEhentai(t)
      );
      if (resultado.series.length > 0) {
        if (catalogoClienteCache.size >= 80) {
          const k = catalogoClienteCache.keys().next().value;
          if (k !== undefined) catalogoClienteCache.delete(k);
        }
        catalogoClienteCache.set(urlStr, { data: resultado, vence: Date.now() + 90_000 });
      }
      return resultado;
    } catch (err) {
      if (err instanceof DesafioPendiente) throw err;
      marcarSiPuenteAntiguo(err);
    }
  }

  const params = new URLSearchParams();
  if (opts.busqueda?.trim()) params.set("q", opts.busqueda.trim());
  if (opts.categoria && opts.categoria !== "todos") params.set("cat", opts.categoria);
  if (opts.idioma && opts.idioma !== "todos") params.set("lang", opts.idioma);
  if (opts.tag?.trim()) params.set("tag", opts.tag.trim());
  if (opts.next) params.set("next", opts.next);
  else if (opts.prev) params.set("prev", opts.prev);
  else if (opts.pagina && opts.pagina > 0) params.set("page", String(opts.pagina));
  if (opts.fresco) params.set("fresco", "1");

  const res = await fetch(`/api/externo/ehentai?${params.toString()}`, {
    signal,
    cache: opts.fresco ? "no-store" : "default",
  });
  if (!res.ok) {
    if (res.status === 403) {
      throw new Error("Contenido +18 no disponible. Podés activarlo en Más → Ajustes → Seguridad.");
    }
    throw new Error(`No se pudo cargar el catálogo de E-Hentai (${res.status})`);
  }
  const data = (await res.json()) as CatalogoEhentai;
  if (data.series?.length > 0) {
    catalogoClienteCache.set(urlStr, { data, vence: Date.now() + 90_000 });
  }
  return data;
}

/**
 * Ficha de una galería mediante `gdata` directo por el puente nativo en Android/PC,
 * con respaldo transparente a `/api/externo/ehentai/[gid]/[token]` en web.
 */
export async function pedirFichaEhentai(
  gid: string,
  token: string,
  signal?: AbortSignal
): Promise<FichaEhentai> {
  if (isPlayStoreApp()) {
    throw new Error("Fuente no disponible en esta edición");
  }

  const clave = `${gid}:${token}`;
  const guardada = fichaClienteCache.get(clave);
  if (guardada && guardada.vence > Date.now()) {
    return guardada.data;
  }

  if (puedeUsarPuenteEh()) {
    try {
      const json = await postJsonNativo<{ gmetadata?: Record<string, unknown>[] }>(EHENTAI_API, {
        method: "gdata",
        gidlist: [[parseInt(gid, 10), token]],
        namespace: 1,
      });
      const ficha = normalizarFichaGdataEhentai(gid, token, json);
      if (fichaClienteCache.size >= 150) {
        const k = fichaClienteCache.keys().next().value;
        if (k !== undefined) fichaClienteCache.delete(k);
      }
      fichaClienteCache.set(clave, { data: ficha, vence: Date.now() + 30 * 60_000 });
      return ficha;
    } catch (err) {
      if (err instanceof DesafioPendiente) throw err;
      marcarSiPuenteAntiguo(err);
    }
  }

  const res = await fetch(`/api/externo/ehentai/${gid}/${token}`, { signal });
  if (!res.ok) {
    if (res.status === 403) {
      throw new Error("Contenido +18 no disponible. Podés activarlo en Más → Ajustes → Seguridad.");
    }
    throw new Error(`No se pudo cargar la galería (${res.status})`);
  }
  const ficha = (await res.json()) as FichaEhentai;
  fichaClienteCache.set(clave, { data: ficha, vence: Date.now() + 30 * 60_000 });
  return ficha;
}

/**
 * Lista de páginas de una galería de E-Hentai para el lector y para descargas.
 * En Android y Windows PC obtiene el índice directo desde `e-hentai.org` y
 * devuelve enlaces nativos (`https://e-hentai.org/s/...`) que `traerImagen` /
 * `traer_imagen` resuelven directo al CDN Hath con 0 paso por Vercel ni R2.
 */
export async function pedirPaginasEhentai(
  gid: string,
  token: string,
  signal?: AbortSignal
): Promise<string[]> {
  if (isPlayStoreApp()) {
    throw new Error("Fuente no disponible en esta edición");
  }

  const clave = `${gid}:${token}`;
  const guardada = paginasClienteCache.get(clave);
  if (guardada && guardada.vence > Date.now()) {
    return guardada.data;
  }

  if (puedeUsarPuenteEh()) {
    try {
      const [ficha, htmlP0] = await Promise.all([
        pedirFichaEhentai(gid, token, signal),
        traerTexto(`${EHENTAI_WEB}/g/${gid}/${token}/?p=0`),
      ]);

      const totalPaginas = ficha.filecount;
      if (totalPaginas <= 0) return [];

      const matchesP0 = extraerLinksVisorGaleriaEhentai(gid, htmlP0);
      const porPaginaIndice = matchesP0.length > 20 ? 40 : 20;
      const paginasIndice = Math.ceil(totalPaginas / porPaginaIndice);
      const viewerLinks = new Array<string>(totalPaginas);

      for (const item of matchesP0) {
        if (item.num >= 1 && item.num <= totalPaginas) {
          viewerLinks[item.num - 1] = item.url;
        }
      }

      if (paginasIndice > 1) {
        const indicesRestantes = Array.from({ length: paginasIndice - 1 }, (_, i) => i + 1);
        const LOTE_INDICE = 6;
        for (let i = 0; i < indicesRestantes.length; i += LOTE_INDICE) {
          const lote = indicesRestantes.slice(i, i + LOTE_INDICE);
          const resLotes = await Promise.all(
            lote.map(async (indice) => {
              try {
                const html = await traerTexto(`${EHENTAI_WEB}/g/${gid}/${token}/?p=${indice}`);
                return extraerLinksVisorGaleriaEhentai(gid, html);
              } catch {
                return [];
              }
            })
          );
          for (const items of resLotes) {
            for (const item of items) {
              if (item.num >= 1 && item.num <= totalPaginas) {
                viewerLinks[item.num - 1] = item.url;
              }
            }
          }
        }
      }

      const linksValidos = viewerLinks.filter(Boolean);
      if (linksValidos.length > 0) {
        // Pre-resolver las primeras 4 páginas para apertura instantánea en el lector,
        // dejando el resto en `https://e-hentai.org/s/...` para que el puente nativo de
        // imágenes (`traerImagen` / `traer_imagen`) las resuelva a demanda directo del CDN.
        const eagerCount = Math.min(4, linksValidos.length);
        const primeras = await Promise.all(
          linksValidos.slice(0, eagerCount).map(async (vUrl) => {
            try {
              const htmlVisor = await traerTexto(vUrl);
              return extraerImgDirectaVisorEhentai(htmlVisor) ?? vUrl;
            } catch {
              return vUrl;
            }
          })
        );

        const paginas = linksValidos.map((vUrl, idx) =>
          idx < eagerCount ? primeras[idx] : vUrl
        );
        paginasClienteCache.set(clave, { data: paginas, vence: Date.now() + 60 * 60_000 });
        return paginas;
      }
    } catch (err) {
      if (err instanceof DesafioPendiente) throw err;
      marcarSiPuenteAntiguo(err);
    }
  }

  const res = await fetch(`/api/externo/ehentai/${gid}/${token}/paginas`, { signal });
  if (!res.ok) {
    throw new Error("No se pudieron cargar las páginas de la galería");
  }
  const data = (await res.json()) as { paginas?: string[] };
  const paginas = Array.isArray(data.paginas) ? data.paginas : [];
  if (paginas.length > 0) {
    paginasClienteCache.set(clave, { data: paginas, vence: Date.now() + 60 * 60_000 });
  }
  return paginas;
}
