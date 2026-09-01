import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { esFuenteExterna, publico, type FuenteExterna } from "@/lib/externas";

/**
 * Historial de lectura de series externas.
 *
 * Es para lo que pasa siempre: encontrás una serie en Olympus, Ikigai o
 * donde sea, leés un par de capítulos, se te apaga el teléfono y nunca la
 * guardaste. Sin esto, esa serie se perdía y había que volver a buscarla.
 *
 * Se anota al abrir un capítulo, no al mirar la ficha: entrar a una serie y
 * volverse no deja rastro, que es lo que se quiere.
 *
 * Son las mismas filas que la biblioteca, separadas por la columna `saved`.
 * Así, cuando la guardás, no se duplica ni se pierde por dónde ibas: la fila
 * ya existe y solo cambia de lado.
 */

/** GET /api/externo/historial — lo leído y no guardado, de más nuevo a más viejo. */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json([]);

  const tipo = req.nextUrl.searchParams.get("tipo") === "adult" ? "adult" : "normal";

  const historial = await db.externalSeries.findMany({
    where: {
      userId: user.id,
      saved: false,
      // Las fuentes externas actuales pertenecen al catálogo normal. Se
      // mantiene el filtro explícito para que jamás se mezcle con +18.
      ...(tipo === "adult" ? { type: "adult" } : { NOT: { type: "adult" } }),
    },
    orderBy: { updatedAt: "desc" },
    take: 60,
  });
  return NextResponse.json(historial.map(publico));
}

/**
 * POST /api/externo/historial — anota que se abrió un capítulo.
 * Body: { source, external_id, title, slug?, cover_url?, type?,
 *         last_chapter_id?, last_chapter_name? }
 */
export async function POST(req: NextRequest) {
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
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const source = body.source as FuenteExterna;
  const externalId = String(body.external_id ?? "").trim();
  const title = String(body.title ?? "").trim();

  if (!esFuenteExterna(source) || !externalId || !title) {
    return NextResponse.json({ error: "Faltan datos de la serie" }, { status: 400 });
  }

  const llave = { userId_source_externalId: { userId: user.id, source, externalId } };

  const progreso =
    body.last_chapter_id !== undefined
      ? {
          lastChapterId: body.last_chapter_id,
          lastChapterName: body.last_chapter_name ?? null,
          lastPageNumber: null,
        }
      : {};

  const fila = await db.externalSeries.upsert({
    where: llave,
    // nace en el historial: guardarla es una decisión aparte
    create: {
      userId: user.id,
      source,
      externalId,
      saved: false,
      slug: body.slug ?? null,
      title,
      coverUrl: body.cover_url ?? null,
      type: body.type ?? null,
      ...progreso,
    },
    // si ya estaba, se respeta de qué lado está: esto solo pone al día por
    // dónde va y la fecha
    update: progreso,
  });

  return NextResponse.json(publico(fila));
}

/** DELETE /api/externo/historial?source=&id= — lo saca del historial. */
export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  const params = req.nextUrl.searchParams;
  const source = params.get("source") as FuenteExterna;
  const externalId = params.get("id")?.trim();

  if (!esFuenteExterna(source) || !externalId) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  // solo borra si está en el historial: una serie guardada se saca desde la
  // biblioteca, no desde acá
  await db.externalSeries
    .deleteMany({ where: { userId: user.id, source, externalId, saved: false } })
    .catch(() => {});

  return new NextResponse(null, { status: 204 });
}
