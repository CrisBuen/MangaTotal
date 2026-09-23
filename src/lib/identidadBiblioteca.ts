/** La identidad guardada no cambia cuando Olympus renueva el sufijo fechado. */
export interface ReferenciaBiblioteca {
  source: string;
  external_id: string;
  slug?: string | null;
  type?: string | null;
  saved?: boolean;
}

export function buscarReferenciaBiblioteca<T extends ReferenciaBiblioteca>(
  lista: readonly T[], source: string, externalId: string, tipo?: string | null
): T | null {
  const compatibles = lista.filter(e => e.source === source &&
    (source !== "olympus" || !tipo || !e.type || tipo === e.type));
  const exacta = compatibles.find(e => e.external_id === externalId);
  if (exacta && exacta.saved !== false) return exacta;
  if (source !== "olympus") return exacta ?? null;
  // Misma regla que aliasOlympus: nunca por título, portada o parecido.
  const base = (s: string) => s.replace(/-\d{8}-\d{9}$/, "");
  const candidatas = compatibles.filter(e =>
    base(e.external_id) === base(externalId) ||
    (e.slug && base(e.slug) === base(externalId)));
  // Antes del arreglo, abrir el slug nuevo podía crear otra fila de historial.
  // La guardada conserva el progreso importado: se usa, sin borrar ninguna fila.
  const guardadas = candidatas.filter(e => e.saved === true);
  if (guardadas.length === 1) return guardadas[0];
  // No se fusionan entradas ni se adivina si hay más de una candidata guardada.
  return candidatas.length === 1 ? candidatas[0] : exacta ?? null;
}
