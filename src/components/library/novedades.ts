"use client";

import { serieIkigai } from "@/lib/ikigai";
import { serieLc } from "@/lib/leercapitulo";
import { serieTmo } from "@/lib/zonatmo";

export interface SerieGuardadaMin {
  source: string;
  external_id: string;
  slug: string | null;
  type: string | null;
  last_chapter_name: string | null;
}

/** Cuántas series se consultan a la vez: suficiente sin ahogar la conexión. */
const A_LA_VEZ = 4;

/** El último capítulo publicado de una serie, según su fuente. */
async function ultimoCapitulo(g: SerieGuardadaMin): Promise<string | null> {
  const ultimo = (lista: { numero?: string | null; name?: string | null }[]) => {
    const nums = lista
      .map((c) => Number(c.numero ?? c.name))
      .filter((n) => Number.isFinite(n));
    return nums.length ? String(Math.max(...nums)) : null;
  };

  if (g.source === "mangadex") {
    const r = await fetch(`/api/externo/series/${g.external_id}?lang=es`);
    if (!r.ok) return null;
    const d = await r.json();
    return ultimo((d.chapters ?? []).map((e: { number: string | null }) => ({ numero: e.number })));
  }

  if (g.source === "olympus") {
    const r = await fetch(`/api/externo/olympus/series/${g.slug ?? g.external_id}`);
    if (!r.ok) return null;
    const d = await r.json();
    return ultimo(d.chapters ?? []);
  }

  if (g.source === "tmo") {
    const [tipo = "manga", id = "", slug = ""] = g.external_id.split("/");
    const f = await serieTmo(tipo, id, slug);
    return ultimo(f.capitulos);
  }

  if (g.source === "ikigai") {
    const f = await serieIkigai(g.external_id);
    return ultimo(f.capitulos);
  }

  if (g.source === "leercapitulo") {
    const [id = "", slug = ""] = g.external_id.split("/");
    const f = await serieLc(id, slug);
    return ultimo(f.capitulos);
  }

  return null;
}

export interface Novedad {
  /** Último capítulo publicado, o null si no se pudo averiguar. */
  ultimo: string | null;
  /** Cuántos capítulos hay sin leer. */
  sinLeer: number;
}

/**
 * Revisa todas las series guardadas y devuelve, por serie, cuál es su
 * último capítulo y cuántos quedan sin leer.
 *
 * Se consulta de a cuatro en paralelo. Una fuente que falle (por ejemplo
 * Ikigai desde el navegador) no arrastra al resto: queda sin dato.
 */
export async function buscarNovedades(
  guardadas: SerieGuardadaMin[],
  alAvanzar?: (hechas: number, total: number) => void
): Promise<Record<string, Novedad>> {
  const salida: Record<string, Novedad> = {};
  let hechas = 0;

  for (let i = 0; i < guardadas.length; i += A_LA_VEZ) {
    const lote = guardadas.slice(i, i + A_LA_VEZ);
    await Promise.all(
      lote.map(async (g) => {
        const clave = `${g.source}-${g.external_id}`;
        try {
          const ultimo = await ultimoCapitulo(g);
          const leido = Number(g.last_chapter_name);
          const sinLeer =
            ultimo !== null && Number.isFinite(leido)
              ? Math.max(0, Math.round(Number(ultimo) - leido))
              : 0;
          salida[clave] = { ultimo, sinLeer };
        } catch {
          salida[clave] = { ultimo: null, sinLeer: 0 };
        } finally {
          hechas++;
          alAvanzar?.(hechas, guardadas.length);
        }
      })
    );
  }

  return salida;
}
