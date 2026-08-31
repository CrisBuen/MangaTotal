import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getObjectStorage } from "@/lib/object-storage";
import { normalizeTagNames, publicTag, setSeriesTags } from "@/lib/tags";
import { contenidoAdultoPermitido } from "@/lib/contentAccess";

/**
 * GET /api/series/:slug — serie + capítulos (con progreso del usuario).
 * PATCH y DELETE usan el id numérico en el mismo segmento (docs/07 §7.2).
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  // accesible sin sesión (visitante): sin progreso ni favoritos, sin +18
  const user = await getSessionUser();

  const { slug } = await ctx.params;
  const series = await db.series.findUnique({
    where: { slug },
    include: {
      chapters: {
        orderBy: { number: "asc" },
        include: {
          progress: { where: { userId: user?.id ?? -1 }, select: { lastPageNumber: true } },
        },
      },
      favorites: { where: { userId: user?.id ?? -1 }, select: { id: true } },
      tags: { orderBy: { name: "asc" } },
    },
  });

  if (!series) return NextResponse.json({ error: "Serie no encontrada" }, { status: 404 });
  if (series.type === "adult" && !(await contenidoAdultoPermitido(user))) {
    return NextResponse.json({ error: "Serie no encontrada" }, { status: 404 });
  }

  return NextResponse.json({
    id: series.id,
    title: series.title,
    original_title: series.originalTitle,
    slug: series.slug,
    type: series.type,
    description: series.description,
    cover_image_path: series.coverImagePath,
    status: series.status,
    is_favorite: series.favorites.length > 0,
    tags: series.tags.map(publicTag),
    chapters: series.chapters.map((c) => ({
      id: c.id,
      number: c.number,
      title: c.title,
      page_count: c.pageCount,
      uploaded_at: c.uploadedAt,
      progress: c.progress[0] ? { last_page_number: c.progress[0].lastPageNumber } : null,
    })),
  });
}

/** PATCH /api/series/:id — editar serie (solo admin). */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  const { slug } = await ctx.params;
  const id = parseInt(slug, 10);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Id inválido" }, { status: 400 });
  }

  const series = await db.series.findUnique({ where: { id } });
  if (!series) return NextResponse.json({ error: "Serie no encontrada" }, { status: 404 });

  let body: {
    title?: string;
    original_title?: string | null;
    type?: string;
    description?: string | null;
    status?: string;
    tags?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (body.title !== undefined) {
    const title = body.title.trim();
    if (!title) return NextResponse.json({ error: "Título vacío" }, { status: 400 });
    data.title = title;
  }
  if (body.original_title !== undefined) data.originalTitle = body.original_title?.trim() || null;
  if (body.type !== undefined) {
    if (!["normal", "adult"].includes(body.type)) {
      return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
    }
    data.type = body.type;
  }
  if (body.description !== undefined) data.description = body.description?.trim() || null;
  if (body.status !== undefined) {
    if (!["ongoing", "completed", "dropped"].includes(body.status)) {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    }
    data.status = body.status;
  }

  const updated = await db.series.update({ where: { id }, data });

  if (body.tags !== undefined) {
    await setSeriesTags(id, normalizeTagNames(body.tags));
  }

  return NextResponse.json({ series: updated });
}

/** DELETE /api/series/:id — borra serie + su carpeta en storage/ (solo admin). */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  const { slug } = await ctx.params;
  const id = parseInt(slug, 10);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Id inválido" }, { status: 400 });
  }

  const series = await db.series.findUnique({ where: { id } });
  if (!series) return NextResponse.json({ error: "Serie no encontrada" }, { status: 404 });

  await db.series.delete({ where: { id } });
  await getObjectStorage().deletePrefix(series.slug).catch(() => {});

  return new NextResponse(null, { status: 204 });
}
