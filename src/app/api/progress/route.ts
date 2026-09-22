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
  const pagina = Math.min(pageNumber, Math.max(1, chapter.pageCount));

  // El marcador activo cambia al abrir otro capítulo; el capítulo visitado
  // conserva su propia página para que releer el primero no borre el cien.
  const progress = await db.readingProgress.upsert({
    where: { userId_seriesId: { userId: user.id, seriesId: chapter.seriesId } },
    create: {
      userId: user.id,
      seriesId: chapter.seriesId,
      chapterId,
      lastPageNumber: pagina,
    },
    update: {
      chapterId,
      lastPageNumber: pagina,
    },
  });

  await db.readChapter.upsert({
    where: { userId_chapterId: { userId: user.id, chapterId } },
    create: { userId: user.id, chapterId, pageNumber: pagina },
    update: { pageNumber: pagina },
  });

  return NextResponse.json({ progress });
}
