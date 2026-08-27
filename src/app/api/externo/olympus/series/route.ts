import { NextRequest, NextResponse } from "next/server";
import { catalogo, type FiltrosOlympus } from "@/lib/olympus";

/**
 * GET /api/externo/olympus/series?page=1&q=&genero=&estado=&tipo=&orden=
 * Catálogo de Olympus Scanlation, integrado con su permiso.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const page = Math.max(parseInt(params.get("page") ?? "1", 10) || 1, 1);

  const numero = (clave: string) => {
    const v = parseInt(params.get(clave) ?? "", 10);
    return Number.isInteger(v) && v > 0 ? v : undefined;
  };

  const tipo = params.get("tipo")?.trim();
  const filtros: FiltrosOlympus = {
    q: params.get("q")?.trim() || undefined,
    genero: numero("genero"),
    estado: numero("estado"),
    tipo: tipo === "comic" || tipo === "novel" ? tipo : undefined,
    orden: params.get("orden")?.trim() || undefined,
  };

  try {
    return NextResponse.json(await catalogo(page, filtros));
  } catch (err) {
    console.error("[olympus] catálogo", err);
    return NextResponse.json(
      { error: "No se pudo consultar el catálogo de Olympus" },
      { status: 502 }
    );
  }
}
