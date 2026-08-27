import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

const FUENTES = ["mangadex", "olympus"] as const;
type Fuente = (typeof FUENTES)[number];

function publico(e: {
  source: string;
  externalId: string;
  slug: string | null;
  title: string;
  coverUrl: string | null;
  type: string | null;
  lastChapterId: string | null;
  lastChapterName: string | null;
  updatedAt: Date;
}) {
  return {
    source: e.source,
    external_id: e.externalId,
    slug: e.slug,
    title: e.title,
    cover_url: e.coverUrl,
    type: e.type,
    last_chapter_id: e.lastChapterId,
    last_chapter_name: e.lastChapterName,
    updated_at: e.updatedAt,
    // a dónde lleva la tarjeta dentro de MangaTotal
    href:
      e.source === "olympus"
        ? `/externo/olympus/${e.slug ?? e.externalId}`
        : `/externo/${e.externalId}`,
  };
}

/** GET /api/externo/biblioteca — series externas guardadas por el usuario. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json([]);

  const guardadas = await db.externalSeries.findMany({
    where: { userId: user.id },
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
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const source = body.source as Fuente;
  const externalId = String(body.external_id ?? "").trim();
  const title = String(body.title ?? "").trim();

  if (!FUENTES.includes(source) || !externalId || !title) {
    return NextResponse.json({ error: "Faltan datos de la serie" }, { status: 400 });
  }

  const datos = {
    slug: body.slug ?? null,
    title,
    coverUrl: body.cover_url ?? null,
    type: body.type ?? null,
    // el progreso solo se pisa cuando viene en el pedido
    ...(body.last_chapter_id !== undefined
      ? {
          lastChapterId: body.last_chapter_id,
          lastChapterName: body.last_chapter_name ?? null,
        }
      : {}),
  };

  const guardada = await db.externalSeries.upsert({
    where: { userId_source_externalId: { userId: user.id, source, externalId } },
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
  const source = params.get("source") as Fuente;
  const externalId = params.get("id")?.trim();

  if (!FUENTES.includes(source) || !externalId) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  await db.externalSeries
    .delete({ where: { userId_source_externalId: { userId: user.id, source, externalId } } })
    .catch(() => {});

  return new NextResponse(null, { status: 204 });
}
