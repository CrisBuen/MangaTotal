import { NextRequest, NextResponse } from "next/server";
import { capitulos, serie } from "@/lib/olympus";

/**
 * GET /api/externo/olympus/series/:slug — ficha con TODOS sus capítulos.
 *
 * Su API los entrega de a 40, pero acá se devuelven completos: la ficha
 * muestra la serie entera y el orden se da vuelta desde el botón.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;

  try {
    // La ficha puede resolver un slug antiguo: sus capítulos se consultan
    // con esa misma dirección vigente, no con la que ya devolvió 404.
    const ficha = await serie(slug);
    const lista = await capitulos(ficha.slug);
    return NextResponse.json({ serie: ficha, ...lista });
  } catch (err) {
    console.error("[olympus] serie", slug, err);
    return NextResponse.json({ error: "No se pudo cargar la serie" }, { status: 502 });
  }
}
