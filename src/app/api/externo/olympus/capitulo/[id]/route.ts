import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { paginas } from "@/lib/olympus";

/** GET /api/externo/olympus/capitulo/:id?slug=&tipo=comic — páginas del capítulo. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  const { id: raw } = await ctx.params;
  const id = parseInt(raw, 10);
  const slug = req.nextUrl.searchParams.get("slug")?.trim();
  const tipo = req.nextUrl.searchParams.get("tipo")?.trim() || "comic";

  if (!Number.isInteger(id) || !slug) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  try {
    return NextResponse.json(await paginas(id, tipo, slug));
  } catch (err) {
    console.error("[olympus] capítulo", id, err);
    return NextResponse.json({ error: "No se pudo cargar el capítulo" }, { status: 502 });
  }
}
