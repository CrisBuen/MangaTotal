import { type ResultadoBiblioteca, type TareaBiblioteca, type TipoCola, tareaValida } from "./colaBiblioteca";
import { isPlayStoreApp } from "./appVersion";

interface Capitulo {
  numero?: string | number | null;
  number?: string | number | null;
  name?: string | number | null;
  fecha?: string | number | null;
  published_at?: string | number | null;
  release_date?: string | number | null;
  chosen?: { published_at?: string | number | null };
}

export function parsearFechaCapitulo(f?: string | number | null): number | null {
  if (f === null || f === undefined) return null;
  if (typeof f === "number") {
    return Number.isFinite(f) && f > 0 ? f : null;
  }
  const texto = String(f).trim();
  if (!texto) return null;

  if (/^\d{12,14}$/.test(texto)) {
    const n = Number(texto);
    if (Number.isFinite(n)) return n;
  }

  // 1. ISO standard o formato YYYY-MM-DD
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(texto)) {
    const t = Date.parse(texto.replace(/\//g, "-"));
    if (Number.isFinite(t)) return t;
  }

  // 2. Formato DD/MM/YYYY o DD-MM-YYYY
  const mFecha = texto.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (mFecha) {
    const dia = Number(mFecha[1]);
    const mes = Number(mFecha[2]) - 1;
    let anio = Number(mFecha[3]);
    if (anio < 100) anio += 2000;
    const hora = mFecha[4] ? Number(mFecha[4]) : 0;
    const min = mFecha[5] ? Number(mFecha[5]) : 0;
    const seg = mFecha[6] ? Number(mFecha[6]) : 0;
    const d = new Date(anio, mes, dia, hora, min, seg);
    const t = d.getTime();
    if (Number.isFinite(t)) return t;
  }

  // 3. Relativas en español ("hace X horas", "hace X días", "ayer", etc.)
  const ahora = Date.now();
  if (/^(hoy|reci[eé]n|ahora|hace un momento)$/i.test(texto)) return ahora;
  if (/^ayer$/i.test(texto)) return ahora - 86_400_000;

  const mRel = texto.match(/hace\s+(\d+)\s*(s(?:eg(?:undos?)?)?|m(?:in(?:utos?)?)?|h(?:oras?)?|d(?:[ií]as?)?|sem(?:anas?)?|mes(?:es)?|a(?:[ñn]os?)?)\b/i);
  if (mRel) {
    const cantidad = Number(mRel[1]);
    const unidad = mRel[2].toLowerCase();
    if (unidad.startsWith("s") && !unidad.startsWith("sem")) return ahora - cantidad * 1000;
    if (unidad.startsWith("m") && !unidad.startsWith("mes")) return ahora - cantidad * 60_000;
    if (unidad.startsWith("h")) return ahora - cantidad * 3_600_000;
    if (unidad.startsWith("d")) return ahora - cantidad * 86_400_000;
    if (unidad.startsWith("sem")) return ahora - cantidad * 7 * 86_400_000;
    if (unidad.startsWith("mes")) return ahora - cantidad * 30 * 86_400_000;
    if (unidad.startsWith("a")) return ahora - cantidad * 365 * 86_400_000;
  }

  // 4. Fallback directo a Date.parse
  const direct = Date.parse(texto);
  return Number.isFinite(direct) ? direct : null;
}

export function resumirCapitulos(lista: Capitulo[], leido: string | null, estado?: string | null): ResultadoBiblioteca {
  const numeros = [...new Set(lista.map(c => c.numero ?? c.number ?? c.name).filter(n => n !== null && n !== undefined && String(n).trim() !== "").map(Number).filter(Number.isFinite))];
  const fechas = lista
    .map(c => c.published_at ?? c.fecha ?? c.release_date ?? c.chosen?.published_at)
    .map(parsearFechaCapitulo)
    .filter((f): f is number => typeof f === "number" && Number.isFinite(f));
  let maxFecha: number | null = null;
  for (const f of fechas) {
    if (maxFecha === null || f > maxFecha) maxFecha = f;
  }
  const punto = leido !== null && leido.trim() !== "" ? Number(leido) : -1;
  return {
    ultimo: numeros.length ? String(Math.max(...numeros)) : null,
    total: numeros.length || lista.length,
    ...(numeros.length <= 10000 ? { numeros } : {}),
    sinLeer: Number.isFinite(punto) ? numeros.filter(n => n > punto).length : 0,
    estado,
    publicado: maxFecha,
    comprobado: Date.now(),
    obtenido: Date.now(),
  };
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
    return resumirCapitulos((await serieIkigai(t.external_id, true, undefined, signal)).capitulos, t.last_chapter_name);
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
  if (t.source === "olympus") {
    const { pedirSerieOlympus } = await import("./olympusCliente");
    const slug = t.slug || t.external_id;
    const f = await pedirSerieOlympus(slug, true, signal, t.type ?? undefined);
    if (!Array.isArray(f.chapters)) throw new Error("La fuente no informó capítulos válidos");
    return resumirCapitulos(f.chapters, t.last_chapter_name, f.serie?.status);
  }
  if (t.source === "mangadex") {
    const url = `/api/externo/series/${encodeURIComponent(t.external_id)}?lang=es`;
    const f = await json(url, signal);
    if (!Array.isArray(f.chapters)) throw new Error("La fuente no informó capítulos válidos");
    return resumirCapitulos(f.chapters, t.last_chapter_name, f.serie?.status ?? f.series?.status ?? f.status);
  }
  if (t.source === "ehentai") {
    if (isPlayStoreApp()) throw new Error("Fuente no disponible en esta edición");
    const [gid, token] = t.external_id.split("/");
    const { fichaEhentai } = await import("./ehentai");
    const f = await fichaEhentai(gid, token);
    return resumirCapitulos([{ name: "1", published_at: f.posted ?? "" }], t.last_chapter_name, "completed");
  }
  throw new Error("Fuente no disponible");
}
