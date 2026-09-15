/**
 * Solo se recuperan referencias con una coincidencia inequívoca en la fuente.
 * Nunca se adivina un capítulo por cercanía ni una serie por título parecido.
 */
export function recuperarIdIkigai(id: string, capitulos: readonly { id: string }[]): string {
  if (capitulos.some((c) => c.id === id)) return id;

  // Las versiones anteriores guardaban String(Number(id)): para los ids de
  // 19 dígitos de Ikigai eso pierde precisión. Number solo se usa para
  // reconocer aquel daño, nunca como identificador del lector o de la base.
  if (!/^\d{16,20}$/.test(id) || Number.isSafeInteger(Number(id)) || String(Number(id)) !== id) {
    return id;
  }
  const candidatos = capitulos.filter((c) => /^\d+$/.test(c.id) && String(Number(c.id)) === id);
  if (candidatos.length > 1) {
    throw new Error("No se pudo identificar el capítulo guardado. Volvé a la ficha y elegí el capítulo.");
  }
  return candidatos[0]?.id ?? id;
}

export function aliasOlympus<T extends { id: number; slug: string; type: string }>(
  slug: string,
  catalogo: readonly T[],
  tipo?: string
): T | null {
  // Olympus agrega una fecha y nueve dígitos al slug al republicar su
  // catálogo. Se compara la base exacta; una coincidencia ambigua no sirve.
  const base = (valor: string) => valor.replace(/-\d{8}-\d{9}$/, "");
  const candidatos = catalogo.filter((s) =>
    base(s.slug) === base(slug) && (!tipo || s.type === tipo)
  );
  return candidatos.length === 1 && candidatos[0].slug !== slug ? candidatos[0] : null;
}
