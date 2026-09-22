import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { esFuenteExterna } from "@/lib/externas";

/** Una ficha consulta solo su serie; descargar los capítulos de 400 guardadas sería excesivo. */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json(null);
  const source = req.nextUrl.searchParams.get("source") ?? "";
  const externalId = req.nextUrl.searchParams.get("id") ?? "";
  if (!esFuenteExterna(source) || !externalId || externalId.length > 500) {
    return NextResponse.json({ error: "Serie inválida" }, { status: 400 });
  }
  const serie = await db.externalSeries.findUnique({
    where: { userId_source_externalId: { userId: user.id, source, externalId } },
    select: {
      saved: true, lastChapterId: true, lastChapterName: true, lastPageNumber: true,
      readThroughNumber: true,
      chapterProgress: { select: { chapterId: true, pageNumber: true } },
    },
  });
  if (!serie) return NextResponse.json(null);
  return NextResponse.json({
    saved: serie.saved,
    last_chapter_id: serie.lastChapterId,
    last_chapter_name: serie.lastChapterName,
    last_page_number: serie.lastPageNumber,
    read_through_number: serie.readThroughNumber,
    chapters: serie.chapterProgress.map(c => ({ id: c.chapterId, page: c.pageNumber })),
  });
}
