import type { MangaMihon, RespaldoMihon } from "./mihonFormato";

export type FuenteMihon = "ikigai" | "olympus" | "leercapitulo" | "tmo";
export interface EntradaMihon {
  source: FuenteMihon; externalId: string; title: string; coverUrl: string | null;
  lastChapterId: string | null; lastChapterName: string | null; lastPageNumber: number | null;
}
export interface ResumenMihon {
  entradas: EntradaMihon[];
  fuentes: { nombre: string; guardadas: number; compatibles: number; duplicadas: number }[];
  conProgreso: number; sinProgresoCompatible: number; soloHistorial: number;
}
const slug = /^[a-zA-Z0-9_-]{1,300}$/;
const numero = /^\d{1,20}$/;
function ruta(url: string): string {
  if (/[\u0000-\u0020\\]/.test(url) || url.length > 4096) return "";
  try { return new URL(url, "https://respaldo.invalid/").pathname.replace(/^\/|\/$/g, ""); }
  catch { return ""; }
}
export function fuenteMihon(nombre: string): FuenteMihon | null {
  const n = nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (n === "ikigaimangas" || n === "ikigai") return "ikigai";
  if (n === "olympusscanlation" || n === "olympus") return "olympus";
  if (n === "leercapitulo") return "leercapitulo";
  if (n === "tumangaonline" || n === "zonatmo") return "tmo";
  return null;
}
export function idSerieMihon(source: FuenteMihon, url: string): string | null {
  const p = ruta(url).split("/");
  if (source === "ikigai") {
    const s = p.length === 1 ? p[0] : p.length === 2 && p[0] === "series" ? p[1] : "";
    return slug.test(s) ? s : null;
  }
  if (source === "olympus") return p.length === 1 && numero.test(p[0]) ? p[0] : null;
  if (source === "leercapitulo") return p.length === 3 && p[0] === "manga" && slug.test(p[1]) && slug.test(p[2]) ? p.slice(1).join("/") : null;
  if (source === "tmo") return p.length === 4 && p[0] === "library" &&
    /^(manga|manhwa|manhua|novel|one_shot|doujinshi|oel)$/.test(p[1]) && numero.test(p[2]) && slug.test(p[3]) ? p.slice(1).join("/") : null;
  return null;
}
function idCapitulo(source: FuenteMihon, serie: string, url: string): string | null {
  const p = ruta(url).split("/");
  if (source === "ikigai") return p.length === 2 && p[0] === "capitulo" && numero.test(p[1]) ? p[1] : null;
  if (source === "olympus") return p.length === 2 && p[0] === serie && numero.test(p[1]) ? p[1] : null;
  if (source === "leercapitulo") {
    return p.length === 4 && p[0] === "leer" && p[2] === serie.split("/")[1] && /^\d{1,6}(\.\d{1,4})?$/.test(p[3]) ? p[3] : null;
  }
  // view_uploads de TMO no es el slug del API actual. No inventamos el vínculo.
  return null;
}
/** Solo CDNs conocidos. Un archivo local tampoco debe inducir solicitudes a IPs privadas. */
export function portadaMihon(url: string): string | null {
  try {
    const u = new URL(url);
    const dominios = ["ikigaimangas.cloud", "olympusxyz.com", "olympusscanlation.com", "olympusbiblioteca.com", "imagesolymp.xyz", "leercapitulo.co", "leercapitulo.com", "lectormanga.com", "tumangaonline.com", "zonatmo.com", "otakuteca.com"];
    if (u.protocol !== "https:" || u.username || u.password || u.port || url.length > 4096 ||
        !dominios.some((d) => u.hostname === d || u.hostname.endsWith("." + d))) return null;
    return url;
  } catch { return null; }
}
function progreso(m: MangaMihon) {
  const caps = new Map(m.chapters.map((c) => [ruta(c.url), c]));
  let elegido: typeof m.chapters[number] | undefined, fecha = 0;
  for (const h of m.history) {
    const c = caps.get(ruta(h.url));
    if (c && h.at > fecha) { elegido = c; fecha = h.at; }
  }
  if (!elegido) {
    for (const c of m.chapters) {
      if (!(c.read || c.page > 0)) continue;
      if (!elegido || c.number > elegido.number ||
          (c.number === elegido.number && c.modified > elegido.modified)) elegido = c;
    }
  }
  return { elegido, fecha };
}
export function prepararMihon(backup: RespaldoMihon): ResumenMihon {
  const grupos = new Map<string, ResumenMihon["fuentes"][number]>();
  const unicas = new Map<string, { entrada: EntradaMihon; fecha: number; avance: number; sinProgreso: boolean }>();
  let soloHistorial = 0;
  for (const m of backup.mangas) {
    if (!m.favorite) { soloHistorial++; continue; }
    const nombre = backup.sources.get(m.source) ?? "Fuente sin identificar";
    let grupo = grupos.get(nombre);
    if (!grupo) { grupo = { nombre, guardadas: 0, compatibles: 0, duplicadas: 0 }; grupos.set(nombre, grupo); }
    grupo.guardadas++;
    const source = fuenteMihon(nombre);
    const externalId = source ? idSerieMihon(source, m.url) : null;
    if (!source || !externalId || !m.title.trim()) continue;
    const { elegido, fecha } = progreso(m);
    const chapter = elegido ? idCapitulo(source, externalId, elegido.url) : null;
    const entrada: EntradaMihon = {
      source, externalId, title: m.title.trim(), coverUrl: portadaMihon(m.cover),
      lastChapterId: chapter,
      lastChapterName: chapter && elegido ? (Number.isFinite(elegido.number) && elegido.number >= 0 ? String(elegido.number) : elegido.name) : null,
      // Mihon numera páginas desde cero; MangaTotal desde uno.
      lastPageNumber: chapter && elegido && elegido.page < 100000 ? elegido.page + 1 : null,
    };
    const key = source + ":" + externalId, anterior = unicas.get(key);
    const valor = { entrada, fecha, avance: elegido?.number ?? -1, sinProgreso: Boolean(elegido && !chapter) };
    if (anterior) {
      grupo.duplicadas++;
      if (fecha > anterior.fecha || (fecha === anterior.fecha && valor.avance > anterior.avance)) unicas.set(key, valor);
    } else { grupo.compatibles++; unicas.set(key, valor); }
  }
  const valores = [...unicas.values()];
  return {
    entradas: valores.map((v) => v.entrada), fuentes: [...grupos.values()],
    conProgreso: valores.filter((v) => v.entrada.lastChapterId).length,
    sinProgresoCompatible: valores.filter((v) => v.sinProgreso).length, soloHistorial,
  };
}
/** Validación repetida en el servidor; nunca confiamos en el JSON del navegador. */
export function validarEntradaMihon(v: unknown): v is EntradaMihon {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const e = v as EntradaMihon;
  if (!["ikigai", "olympus", "leercapitulo", "tmo"].includes(e.source) ||
      typeof e.externalId !== "string" || typeof e.title !== "string" || !e.title.trim() || e.title.length > 500 ||
      /[\u0000-\u001f]/.test(e.title)) return false;
  const url = e.source === "ikigai" || e.source === "olympus" ? e.externalId :
    (e.source === "leercapitulo" ? "manga/" : "library/") + e.externalId;
  if (idSerieMihon(e.source, url) !== e.externalId) return false;
  if (e.coverUrl !== null && (typeof e.coverUrl !== "string" || portadaMihon(e.coverUrl) !== e.coverUrl)) return false;
  if (e.lastChapterId !== null) {
    if (typeof e.lastChapterId !== "string" || e.source === "tmo" ||
        !(e.source === "leercapitulo" ? /^\d{1,6}(\.\d{1,4})?$/ : numero).test(e.lastChapterId)) return false;
    if (typeof e.lastChapterName !== "string" || e.lastChapterName.length > 500) return false;
    if (!Number.isInteger(e.lastPageNumber) || e.lastPageNumber! < 1 || e.lastPageNumber! > 100000) return false;
  } else if (e.lastPageNumber !== null || e.lastChapterName !== null) return false;
  return true;
}
