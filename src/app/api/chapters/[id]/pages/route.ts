import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { contenidoAdultoPermitido } from "@/lib/contentAccess";

/** GET /api/chapters/:id/pages — páginas ordenadas por page_number. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  const { id: idRaw } = await ctx.params;
  const id = parseInt(idRaw, 10);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Id inválido" }, { status: 400 });

  const chapter = await db.chapter.findUnique({ where: { id }, include: { series: true } });
  if (!chapter) return NextResponse.json({ error: "Capítulo no encontrado" }, { status: 404 });
  if (chapter.series.type === "adult" && !(await contenidoAdultoPermitido(user))) {
    return NextResponse.json({ error: "Capítulo no encontrado" }, { status: 404 });
  }

  const pages = await db.page.findMany({
    where: { chapterId: id },
    orderBy: { pageNumber: "asc" },
  });

  return NextResponse.json(
    pages.map((p) => ({
      id: p.id,
      page_number: p.pageNumber,
      url: `/api/images/${p.filePath}`,
      width: p.width,
      height: p.height,
    }))
  );
}
