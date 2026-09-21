import { type ResultadoBiblioteca, type TareaBiblioteca, type TipoCola, tareaValida } from "./colaBiblioteca";
import { isPlayStoreApp } from "./appVersion";

interface Capitulo { numero?: string | number | null; number?: string | number | null; name?: string | null; fecha?: string | null; published_at?: string | null; }
export function resumirCapitulos(lista: Capitulo[], leido: string | null, estado?: string | null): ResultadoBiblioteca {
  const numeros = [...new Set(lista.map(c => c.numero ?? c.number ?? c.name).filter(n => n !== null && n !== undefined && String(n).trim() !== "").map(Number).filter(Number.isFinite))];
  const fechas = lista.map(c => c.published_at ?? c.fecha).filter((f): f is string => !!f && /^\d{4}-\d{2}-\d{2}/.test(f)).map(Date.parse).filter(Number.isFinite);
  const punto = leido !== null && leido.trim() !== "" ? Number(leido) : -1;
  return { ultimo: numeros.length ? String(Math.max(...numeros)) : null, total: numeros.length || lista.length,
    ...(numeros.length <= 10000 ? { numeros } : {}),
    sinLeer: Number.isFinite(punto) ? numeros.filter(n => n > punto).length : 0,
    estado, publicado: fechas.length ? Math.max(...fechas) : null, comprobado: Date.now(), obtenido: Date.now() };
}
async function json(url: string, signal: AbortSignal) {
  const r = await fetch(url, { cache: "no-store", signal });
  if (!r.ok) throw new Error(`La fuente no pudo comprobarse (${r.status})`);
  return r.json();
}

/** Reutiliza los adaptadores y sus permisos. Solo consulta fichas, nunca páginas o vídeo. */
export async function consultarBiblioteca(tipo: TipoCola, t: TareaBiblioteca, signal: AbortSignal): Promise<ResultadoBiblioteca> {
  if (!tareaValida(t)) throw new Error("Referencia de biblioteca inválida");
  if (tipo === "animelist") {
    if (t.source !== "anilist") throw new Error("Fuente inválida");
    const anilist = await json("/api/anime/novedades", signal);
    return { ultimo: null, sinLeer: 0, comprobado: Date.now(), obtenido: Date.now(), anilist };
  }
  if (tipo === "anime") {
    if (!["jkanime", "tioanime", "hentaitv"].includes(t.source) || (t.source === "hentaitv" && isPlayStoreApp())) throw new Error("Fuente no disponible en esta edición");
    const base = `/api/anime/${t.source}/${encodeURIComponent(t.slug || t.external_id)}`;
    const ficha = await json(base, signal);
    let episodios: Capitulo[] = ficha.episodes ?? [];
    // La última página aporta episodios recientes sin descargar todas las listas.
    if (Number.isInteger(ficha.last_page) && ficha.last_page > 1 && ficha.last_page < 10000) {
      const final = await json(`${base}?page=${ficha.last_page}`, signal);
      episodios = [...episodios, ...(final.episodes ?? [])];
    }
    const r = resumirCapitulos(episodios, t.last_chapter_name, ficha.status);
    const total = Number(ficha.total_episodes);
    if (!Number.isInteger(total) || total < 0 || !Array.isArray(ficha.episodes)) throw new Error("La fuente no informó episodios válidos");
    return { ...r, total, sinLeer: Math.max(0, total - Math.max(0, Number(t.last_chapter_name) || 0)) };
  }
  if (t.source === "ikigai") {
    const { serieIkigai } = await import("./ikigai");
    return resumirCapitulos((await serieIkigai(t.external_id)).capitulos, t.last_chapter_name);
  }
  if (t.source === "leercapitulo") {
    const { serieLc } = await import("./leercapitulo");
    const [id, slug] = t.external_id.split("/");
    const f = await serieLc(id, slug);
    return resumirCapitulos(f.capitulos, t.last_chapter_name, f.estado);
  }
  if (t.source === "tmo") {
    const { serieTmo } = await import("./zonatmo");
    const [tipo, id, slug] = t.external_id.split("/");
    return resumirCapitulos((await serieTmo(tipo, id, slug)).capitulos, t.last_chapter_name);
  }
  if (t.source === "catharsis") {
    const { serieCw } = await import("./catharsis");
    return resumirCapitulos((await serieCw(t.external_id, true)).capitulos, t.last_chapter_name);
  }
  if (t.source === "olympus" || t.source === "mangadex") {
    const url = t.source === "olympus" ? `/api/externo/olympus/series/${encodeURIComponent(t.slug || t.external_id)}` : `/api/externo/series/${encodeURIComponent(t.external_id)}?lang=es`;
    const f = await json(url, signal);
    if (!Array.isArray(f.chapters)) throw new Error("La fuente no informó capítulos válidos");
    return resumirCapitulos(f.chapters, t.last_chapter_name, f.serie?.status ?? f.series?.status ?? f.status);
  }
  throw new Error("Fuente no disponible");
}
