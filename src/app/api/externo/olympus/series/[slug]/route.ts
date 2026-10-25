import { NextRequest, NextResponse } from "next/server";
import { capitulos, serie } from "@/lib/olympus";

/**
 * GET /api/externo/olympus/series/:slug — ficha con TODOS sus capítulos.
 *
 * Su API los entrega de a 40, pero acá se devuelven completos: la ficha
 * muestra la serie entera y el orden se da vuelta desde el botón.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const fresco = req.nextUrl.searchParams.get("fresco") === "1";

  try {
    // Pedimos ficha y capítulos en paralelo para ahorrar la mitad del tiempo.
    // Si la ficha resolvió un alias (slug nuevo distinto al pedido), re-consultamos con el slug vigente.
    const [ficha, listaInicial] = await Promise.all([
      serie(slug, undefined, fresco),
      capitulos(slug, fresco).catch(() => null),
    ]);
    const lista =
      listaInicial && ficha.slug === slug
        ? listaInicial
        : await capitulos(ficha.slug, fresco);
    return NextResponse.json({ serie: ficha, ...lista });
  } catch (err) {
    console.error("[olympus] serie", slug, err);
    return NextResponse.json({ error: "No se pudo cargar la serie" }, { status: 502 });
  }
}
