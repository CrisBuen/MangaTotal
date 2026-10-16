import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { contenidoAdultoPermitido } from "@/lib/contentAccess";
import { catalogoEhentai } from "@/lib/ehentai";

export const dynamic = "force-dynamic";

/**
 * Catálogo y búsqueda de E-Hentai.
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
  const busqueda = searchParams.get("q") ?? "";
  const categoria = searchParams.get("cat") ?? "todos";
  const idioma = searchParams.get("lang") ?? "todos";
  const pagina = Math.max(0, parseInt(searchParams.get("page") ?? "0", 10) || 0);

  try {
    const resultado = await catalogoEhentai({
      busqueda,
      categoria,
      idioma,
      pagina,
    });
    return NextResponse.json(resultado);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al consultar E-Hentai";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
