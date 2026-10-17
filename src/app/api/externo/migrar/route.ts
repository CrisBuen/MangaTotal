import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fichaHref } from "@/lib/externas";

export const dynamic = "force-dynamic";

/**
 * POST /api/externo/migrar
 *
 * Migra una obra desde una fuente origen a una fuente destino,
 * transfiriendo el progreso de lectura (capítulo leído, página, historial)
 * y el estado de guardado en la biblioteca.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  }

  let body: {
    origen: {
      source: string;
      externalId: string;
    };
    destino: {
      source: string;
      externalId: string;
      slug?: string | null;
      title: string;
      coverUrl?: string | null;
      type?: string | null;
      chapterId?: string | null;
      chapterName?: string | null;
    };
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de solicitud inválido" }, { status: 400 });
  }

  const { origen, destino } = body;
  if (!origen?.source || !origen?.externalId || !destino?.source || !destino?.externalId || !destino?.title) {
    return NextResponse.json({ error: "Faltan parámetros de migración" }, { status: 400 });
  }

  try {
    // 1. Buscar la serie origen en la base de datos
    const serieOrigen = await db.externalSeries.findUnique({
      where: {
        userId_source_externalId: {
          userId: user.id,
          source: origen.source,
          externalId: origen.externalId,
        },
      },
      include: {
        chapterProgress: true,
      },
    });

    const saved = serieOrigen?.saved ?? true;
    const lastChapterName = destino.chapterName ?? serieOrigen?.lastChapterName ?? null;
    const lastChapterId = destino.chapterId ?? serieOrigen?.lastChapterId ?? null;
    const lastPageNumber = serieOrigen?.lastPageNumber ?? 1;
    const readThroughNumber = serieOrigen?.readThroughNumber ?? null;

    // 2. Crear o actualizar la serie destino con el progreso transferido
    const serieDestino = await db.externalSeries.upsert({
      where: {
        userId_source_externalId: {
          userId: user.id,
          source: destino.source,
          externalId: destino.externalId,
        },
      },
      create: {
        userId: user.id,
        source: destino.source,
        externalId: destino.externalId,
        slug: destino.slug ?? null,
        title: destino.title,
        coverUrl: destino.coverUrl ?? null,
        type: destino.type ?? null,
        saved,
        lastChapterId,
        lastChapterName,
        lastPageNumber,
        readThroughNumber,
      },
      update: {
        title: destino.title,
        slug: destino.slug ?? null,
        coverUrl: destino.coverUrl ?? undefined,
        type: destino.type ?? undefined,
        saved,
        lastChapterId,
        lastChapterName,
        lastPageNumber,
        readThroughNumber,
      },
    });

    // 3. Si la serie origen existía, eliminarla de la biblioteca para evitar duplicados
    if (serieOrigen) {
      // Eliminar registros de progreso dependientes si existen
      await db.externalChapterProgress.deleteMany({
        where: { externalSeriesId: serieOrigen.id },
      }).catch(() => {});

      await db.externalSeries.delete({
        where: { id: serieOrigen.id },
      }).catch(() => {});
    }

    const hrefDestino = fichaHref(destino.source, destino.externalId, destino.slug ?? null);

    return NextResponse.json({
      ok: true,
      mensaje: "Serie migrada correctamente",
      href: hrefDestino,
      serie: {
        source: serieDestino.source,
        external_id: serieDestino.externalId,
        title: serieDestino.title,
        last_chapter_name: serieDestino.lastChapterName,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error durante la migración";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
