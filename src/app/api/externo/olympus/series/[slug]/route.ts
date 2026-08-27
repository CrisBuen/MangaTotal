import { NextRequest, NextResponse } from "next/server";
import { capitulos, serie } from "@/lib/olympus";

/** GET /api/externo/olympus/series/:slug?page=1 — ficha + capítulos. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const page = Math.max(parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10) || 1, 1);

  try {
    const [ficha, lista] = await Promise.all([serie(slug), capitulos(slug, page)]);
    return NextResponse.json({ serie: ficha, ...lista });
  } catch (err) {
    console.error("[olympus] serie", slug, err);
    return NextResponse.json({ error: "No se pudo cargar la serie" }, { status: 502 });
  }
}
