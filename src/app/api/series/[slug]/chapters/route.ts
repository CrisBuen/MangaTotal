import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

/** GET /api/series/:slug/chapters — capítulos con progreso del usuario actual. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  // accesible sin sesión (visitante)
  const user = await getSessionUser();

  const { slug } = await ctx.params;
  const series = await db.series.findUnique({ where: { slug } });
  if (!series) return NextResponse.json({ error: "Serie no encontrada" }, { status: 404 });
  if (series.type === "adult" && !user?.showAdultContent && !user?.isAdmin) {
    return NextResponse.json({ error: "Serie no encontrada" }, { status: 404 });
  }

  const chapters = await db.chapter.findMany({
    where: { seriesId: series.id },
    orderBy: { number: "asc" },
    include: {
      progress: { where: { userId: user?.id ?? -1 }, select: { lastPageNumber: true } },
    },
  });

  return NextResponse.json(
    chapters.map((c) => ({
      id: c.id,
      number: c.number,
      title: c.title,
      page_count: c.pageCount,
      uploaded_at: c.uploadedAt,
      progress: c.progress[0] ? { last_page_number: c.progress[0].lastPageNumber } : null,
    }))
  );
}
