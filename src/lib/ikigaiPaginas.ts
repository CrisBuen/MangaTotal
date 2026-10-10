import { esImagenIkigai } from "./imagenFuenteNativa";

/** Qwik 1.20 entrega el capítulo en objs, con referencias base 36 y Long exactos. */
function estadoCapitulo(texto: string, chapterId: string) {
  // El visor introduce escapes JS \x3C dentro de anuncios serializados. No
  // ejecutamos ese código: solo normalizamos escapes hexadecimales a JSON.
  const json = texto.replace(/\\(\\|x([0-9a-f]{2}))/gi, (todo, _escape, hex: string | undefined) => hex ? `\\u00${hex}` : todo);
  let data: { objs?: unknown[] };
  try { data = JSON.parse(json); } catch { return null; }
  const objetos = data?.objs;
  if (!Array.isArray(objetos) || objetos.length > 100_000) return null;
  const valor = (ref: unknown): unknown => {
    if (typeof ref !== "string" || !/^[0-9a-z]+$/.test(ref)) return undefined;
    return objetos[parseInt(ref, 36)];
  };
  const candidatos = objetos.filter((o): o is { id: string; pages: string; series?: string } => {
    if (!o || typeof o !== "object" || !("id" in o) || !("pages" in o)) return false;
    const id = valor(o.id);
    return typeof id === "string" && id.replace(/^\u0018/, "") === chapterId;
  });
  if (candidatos.length !== 1) return null;
  return { capitulo: candidatos[0], valor };
}

/** La clasificación es de la obra del capítulo, no del menú global del visor. */
export function adultoDelEstadoIkigai(texto: string, chapterId: string): boolean | undefined {
  const estado = estadoCapitulo(texto, chapterId);
  if (!estado) return undefined;
  const serie = estado.valor(estado.capitulo.series);
  if (!serie || typeof serie !== "object" || !("is_mature" in serie)) return undefined;
  const mature = estado.valor(serie.is_mature);
  const riesgo = "high_risk" in serie && estado.valor(serie.high_risk);
  return mature === true || riesgo === true ? true : mature === false ? false : undefined;
}

export function paginasDelEstadoIkigai(texto: string, chapterId: string): string[] {
  const estado = estadoCapitulo(texto, chapterId);
  if (!estado) return [];
  const { capitulo, valor } = estado;
  const referencias = valor(capitulo.pages);
  if (!Array.isArray(referencias) || !referencias.length || referencias.length > 1000) return [];
  const paginas = referencias.map(valor);
  // No barrer todas las URLs: hay portadas, publicidad y capítulos vecinos en
  // el mismo JSON. La lista tiene que pertenecer al ID que pidió el lector.
  if (!paginas.every((p): p is string => typeof p === "string" && esImagenIkigai(p))) return [];
  if (!paginas.some(p => new URL(p).pathname.includes(`/${chapterId}/`))) return [];
  return [...new Set(paginas)];
}
