import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

/** GET /api/progress/continue — sección "Continuar leyendo". */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  const rows = await db.readingProgress.findMany({
    where: {
      userId: user.id,
      ...(user.showAdultContent ? {} : { series: { type: "normal" } }),
    },
    orderBy: { updatedAt: "desc" },
    take: 12,
    include: { series: true, chapter: true },
  });

  return NextResponse.json(
    rows.map((r) => ({
      series: {
        id: r.series.id,
        title: r.series.title,
        slug: r.series.slug,
        type: r.series.type,
        cover_image_path: r.series.coverImagePath,
      },
      chapter: {
        id: r.chapter.id,
        number: r.chapter.number,
        title: r.chapter.title,
        page_count: r.chapter.pageCount,
      },
      lastPageNumber: r.lastPageNumber,
      updated_at: r.updatedAt,
    }))
  );
}
