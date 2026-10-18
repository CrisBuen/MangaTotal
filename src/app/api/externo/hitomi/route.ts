import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { contenidoAdultoPermitido } from "@/lib/contentAccess";
import { catalogoHitomi, sugerirTagsHitomi } from "@/lib/hitomi";

export const dynamic = "force-dynamic";

/**
 * Catálogo, búsqueda y autocompletado de etiquetas de Hitomi.la.
 * Requiere estrictamente que el usuario tenga el contenido +18 activado
 * y no esté usando la versión de Google Play Store.
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  const permitido = await contenidoAdultoPermitido(user);
  if (!permitido) {
    return NextResponse.json({ error: "Contenido no permitido en esta edición" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const suggest = searchParams.get("suggest");
  if (suggest !== null) {
    const tags = await sugerirTagsHitomi(suggest);
    return NextResponse.json({ tags });
  }

  const busqueda = searchParams.get("q") ?? "";
  const idioma = searchParams.get("lang") ?? "todos";
  const tag = searchParams.get("tag") ?? "";
  const tipo = searchParams.get("tipo") ?? "todos";
  const pagina = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);

  try {
    const resultado = await catalogoHitomi({
      busqueda,
      idioma,
      tag,
      tipo,
      pagina,
    });
    return NextResponse.json(resultado);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al consultar Hitomi.la";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

