import { NextRequest, NextResponse } from "next/server";
import { buscar, catalogo } from "@/lib/olympus";

/**
 * GET /api/externo/olympus/series?page=1&q=
 * Catálogo de Olympus Scanlation, integrado con su permiso.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const page = Math.max(parseInt(params.get("page") ?? "1", 10) || 1, 1);
  const q = params.get("q")?.trim();

  try {
    if (q) {
      const encontradas = await buscar(q);
      return NextResponse.json({
        series: encontradas.slice(0, 60),
        page: 1,
        last_page: 1,
        total: encontradas.length,
      });
    }
    return NextResponse.json(await catalogo(page));
  } catch (err) {
    console.error("[olympus] catálogo", err);
    return NextResponse.json(
      { error: "No se pudo consultar el catálogo de Olympus" },
      { status: 502 }
    );
  }
}
