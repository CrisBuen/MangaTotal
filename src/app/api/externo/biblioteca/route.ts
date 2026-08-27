import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

const FUENTES = ["mangadex", "olympus", "tmo", "ikigai", "leercapitulo"] as const;
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
  lastPageNumber: number | null;
  updatedAt: Date;
}) {
  const href = fichaHref(e.source, e.externalId, e.slug);
  return {
    source: e.source,
    external_id: e.externalId,
    slug: e.slug,
    title: e.title,
    cover_url: e.coverUrl,
    type: e.type,
    last_chapter_id: e.lastChapterId,
    last_chapter_name: e.lastChapterName,
    last_page_number: e.lastPageNumber,
    updated_at: e.updatedAt,
    // a dónde lleva la tarjeta dentro de MangaTotal
    href,
    // retomar la lectura exactamente donde quedó, si ya empezó
    href_continuar: e.lastChapterId
      ? capituloHref(e.source, e.externalId, e.slug, e.type, e.lastChapterId, e.lastPageNumber)
      : href,
  };
}

/** La ficha de la serie dentro de MangaTotal. */
function fichaHref(source: string, externalId: string, slug: string | null): string {
  if (source === "olympus") return `/externo/olympus/${slug ?? externalId}`;
  if (source === "ikigai") return `/externo/ikigai/${externalId}`;
  if (source === "tmo") return `/externo/tmo/${externalId}`;
  if (source === "leercapitulo") return `/externo/leercapitulo/${externalId}`;
  return `/externo/${externalId}`;
}

/**
 * El lector, en el capítulo y la página donde quedó.
 *
 * Cada fuente identifica sus capítulos a su manera y el lector necesita
 * saber de qué serie viene, así que el enlace se arma acá una sola vez.
 */
function capituloHref(
  source: string,
  externalId: string,
  slug: string | null,
  type: string | null,
  chapterId: string,
  page: number | null
): string {
  const pagina = page && page > 1 ? `page=${page}` : "";
  const con = (base: string, extra = "") => {
    const qs = [extra, pagina].filter(Boolean).join("&");
    return qs ? `${base}?${qs}` : base;
  };

  if (source === "olympus") {
    return con(`/leer-externo/olympus/${chapterId}`, `slug=${slug ?? externalId}&tipo=${type ?? "comic"}`);
  }
  if (source === "ikigai") {
    return con(`/leer-externo/ikigai/${chapterId}`, `slug=${externalId}`);
  }
  if (source === "tmo") {
    // el identificador guardado es "tipo/id/slug"
    const [tipo = "manga", id = "", s = ""] = externalId.split("/");
    return con(`/leer-externo/tmo/${chapterId}`, `tipo=${tipo}&id=${id}&slug=${s}`);
  }
  if (source === "leercapitulo") {
    // el identificador guardado es "id/slug"
    const [id = "", s = ""] = externalId.split("/");
    return con(`/leer-externo/leercapitulo/${chapterId}`, `serie=${id}&slug=${s}`);
  }
  return con(`/leer-externo/${chapterId}`);
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
    last_page_number?: number | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const source = body.source as Fuente;
  const externalId = String(body.external_id ?? "").trim();
  const title = String(body.title ?? "").trim();

  if (!FUENTES.includes(source) || !externalId) {
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
