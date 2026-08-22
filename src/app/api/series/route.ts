import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { slugify } from "@/lib/slug";

/**
 * GET /api/series?type=normal|adult&search=&favorites=true&all=true
 * Accesible sin sesión (visitante): solo sección normal, sin favoritos.
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();

  const params = req.nextUrl.searchParams;
  const type = params.get("type");
  const search = params.get("search")?.trim();
  const favorites = params.get("favorites") === "true";
  // all=true: vista de gestión (solo admin) — ignora el filtro show_adult_content
  const all = params.get("all") === "true" && user?.isAdmin;

  const where: Record<string, unknown> = {};

  if (!all) {
    // respeta la preferencia del usuario; visitante = sin +18
    if (!user?.showAdultContent) {
      where.type = "normal";
    } else if (type === "normal" || type === "adult") {
      where.type = type;
    }
  } else if (type === "normal" || type === "adult") {
    where.type = type;
  }

  if (search) {
    where.OR = [{ title: { contains: search } }, { originalTitle: { contains: search } }];
  }
  if (favorites) {
    if (!user) return NextResponse.json([]);
    where.favorites = { some: { userId: user.id } };
  }

  const series = await db.series.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { chapters: true } },
      favorites: { where: { userId: user?.id ?? -1 }, select: { id: true } },
    },
  });

  return NextResponse.json(
    series.map((s) => ({
      id: s.id,
      title: s.title,
      original_title: s.originalTitle,
      slug: s.slug,
      type: s.type,
      description: s.description,
      cover_image_path: s.coverImagePath,
      status: s.status,
      chapter_count: s._count.chapters,
      is_favorite: s.favorites.length > 0,
      updated_at: s.updatedAt,
    }))
  );
}

/** POST /api/series — crear serie manualmente (solo admin). */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  let body: {
    title?: string;
    original_title?: string;
    type?: string;
    description?: string;
    status?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const title = body.title?.trim();
  if (!title) return NextResponse.json({ error: "Falta el título" }, { status: 400 });

  const type = body.type === "adult" ? "adult" : "normal";
  const status = ["ongoing", "completed", "dropped"].includes(body.status ?? "")
    ? (body.status as string)
    : "ongoing";

  const slug = slugify(title);
  const existing = await db.series.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: "Ya existe una serie con ese título/slug" }, { status: 409 });
  }

  const series = await db.series.create({
    data: {
      title,
      originalTitle: body.original_title?.trim() || null,
      slug,
      type,
      description: body.description?.trim() || null,
      status,
    },
  });

  return NextResponse.json({ series }, { status: 201 });
}
