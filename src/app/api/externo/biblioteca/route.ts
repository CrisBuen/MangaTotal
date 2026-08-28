import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { esFuenteExterna, publico, type FuenteExterna } from "@/lib/externas";


/**
 * GET /api/externo/biblioteca — series externas guardadas por el usuario.
 *
 * Con ?todo=1 vienen también las del historial (las que abrió un capítulo
 * pero no guardó). El lector lo usa para anotar por dónde va aunque la
 * serie todavía no esté en la biblioteca.
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json([]);

  const todo = req.nextUrl.searchParams.get("todo") === "1";

  const guardadas = await db.externalSeries.findMany({
    where: { userId: user.id, ...(todo ? {} : { saved: true }) },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(guardadas.map(publico));
}

/**
 * PUT /api/externo/biblioteca — guarda la serie o actualiza el progreso.
 * Body: { source, external_id, slug?, title, cover_url?, type?,
 *         last_chapter_id?, last_chapter_name? }
 */
export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  let body: {
    source?: string;
    external_id?: string;
    slug?: string | null;
    title?: string;
    cover_url?: string | null;
    type?: string | null;
    last_chapter_id?: string | null;
    last_chapter_name?: string | null;
    last_page_number?: number | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const source = body.source as FuenteExterna;
  const externalId = String(body.external_id ?? "").trim();
  const title = String(body.title ?? "").trim();

  if (!esFuenteExterna(source) || !externalId) {
    return NextResponse.json({ error: "Faltan datos de la serie" }, { status: 400 });
  }

  const llave = { userId_source_externalId: { userId: user.id, source, externalId } };

  // Sin título es un aviso de avance a secas: solo toca el progreso de una
  // serie que ya está guardada, sin pisar portada ni nombre.
  if (!title) {
    const existente = await db.externalSeries.findUnique({ where: llave });
    if (!existente) return NextResponse.json({ error: "La serie no está guardada" }, { status: 404 });

    const actualizada = await db.externalSeries.update({
      where: llave,
      data: {
        ...(body.last_chapter_id !== undefined
          ? {
              lastChapterId: body.last_chapter_id,
              lastChapterName: body.last_chapter_name ?? null,
            }
          : {}),
        ...(body.last_page_number !== undefined ? { lastPageNumber: body.last_page_number } : {}),
      },
    });
    return NextResponse.json(publico(actualizada));
  }

  const datos = {
    // un PUT con título es un guardado a mano: si venía del historial, pasa
    // a la biblioteca
    saved: true,
    slug: body.slug ?? null,
    title,
    coverUrl: body.cover_url ?? null,
    type: body.type ?? null,
    // el progreso solo se pisa cuando viene en el pedido
    ...(body.last_chapter_id !== undefined
      ? {
          lastChapterId: body.last_chapter_id,
          lastChapterName: body.last_chapter_name ?? null,
          lastPageNumber: body.last_page_number ?? null,
        }
      : {}),
  };

  const guardada = await db.externalSeries.upsert({
    where: llave,
    create: { userId: user.id, source, externalId, ...datos },
    update: datos,
  });

  return NextResponse.json(publico(guardada));
}

/** DELETE /api/externo/biblioteca?source=&id= — la saca de la biblioteca. */
export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  const params = req.nextUrl.searchParams;
  const source = params.get("source") as FuenteExterna;
  const externalId = params.get("id")?.trim();

  if (!esFuenteExterna(source) || !externalId) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  await db.externalSeries
    .delete({ where: { userId_source_externalId: { userId: user.id, source, externalId } } })
    .catch(() => {});

  return new NextResponse(null, { status: 204 });
}
