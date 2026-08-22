import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

/** PATCH /api/progress { chapterId, pageNumber } — upsert del marcador por serie. */
export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  let body: { chapterId?: number; pageNumber?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const chapterId = Number(body.chapterId);
  const pageNumber = Number(body.pageNumber);
  if (!Number.isInteger(chapterId) || !Number.isInteger(pageNumber) || pageNumber < 1) {
    return NextResponse.json({ error: "chapterId/pageNumber inválidos" }, { status: 400 });
  }

  const chapter = await db.chapter.findUnique({ where: { id: chapterId } });
  if (!chapter) return NextResponse.json({ error: "Capítulo no encontrado" }, { status: 404 });

  // un solo marcador activo por (usuario, serie) — se sobrescribe al avanzar
  const progress = await db.readingProgress.upsert({
    where: { userId_seriesId: { userId: user.id, seriesId: chapter.seriesId } },
    create: {
      userId: user.id,
      seriesId: chapter.seriesId,
      chapterId,
      lastPageNumber: Math.min(pageNumber, chapter.pageCount),
    },
    update: {
      chapterId,
      lastPageNumber: Math.min(pageNumber, chapter.pageCount),
    },
  });

  return NextResponse.json({ progress });
}
