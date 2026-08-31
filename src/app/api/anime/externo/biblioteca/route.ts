import { NextRequest, NextResponse } from "next/server";
import { animeExternoPublico, esFuenteAnimeExterna, type FuenteAnimeExterna } from "@/lib/animeExternos";
import { animeAnimadoPermitido } from "@/lib/animeAcceso";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ErrorJkanime, esAdultoJkanime } from "@/lib/jkanime";
import { ErrorTioanime, esAdultoTioanime } from "@/lib/tioanime";

async function acceso(user: Awaited<ReturnType<typeof getSessionUser>>) {
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  if (!(await animeAnimadoPermitido(user.animeEnabled))) {
    return NextResponse.json({ error: "La sección animada está desactivada en Android" }, { status: 403 });
  }
  return null;
}

/** Anime de fuentes reproducibles guardado por el usuario. */
export async function GET() {
  const user = await getSessionUser();
  const rechazo = await acceso(user);
  if (rechazo) return rechazo;
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  const entradas = await db.externalAnime.findMany({
    where: {
      userId: user.id,
      saved: true,
      ...(user.showAdultContent || user.isAdmin ? {} : { isAdult: false }),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      episodeProgress: {
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
    },
  });
  return NextResponse.json(entradas.map(animeExternoPublico));
}

/** Guarda una referencia externa; nunca guarda direcciones de video. */
export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  const rechazo = await acceso(user);
  if (rechazo) return rechazo;
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  let body: {
    source?: string;
    external_id?: string;
    slug?: string | null;
    title?: string;
    cover_url?: string | null;
    type?: string | null;
    status?: string | null;
    total_episodes?: number | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const source = body.source as FuenteAnimeExterna;
  const externalId = String(body.external_id ?? "").trim().slice(0, 160);
  const slug = String(body.slug ?? "").trim().slice(0, 160);
  const title = String(body.title ?? "").trim().slice(0, 300);
  if (!esFuenteAnimeExterna(source) || !externalId || !slug || !title) {
    return NextResponse.json({ error: "Faltan datos del anime" }, { status: 400 });
  }
  if (!/^[a-z0-9][a-z0-9-]{0,159}$/i.test(slug)) {
    return NextResponse.json({ error: "Anime inválido" }, { status: 400 });
  }

  let isAdult = false;
  try {
    if (source === "jkanime") isAdult = await esAdultoJkanime(slug);
    if (source === "tioanime") isAdult = await esAdultoTioanime(slug);
  } catch (error) {
    const status = error instanceof ErrorJkanime || error instanceof ErrorTioanime ? error.status : 502;
    const message = error instanceof Error ? error.message : "No se pudo verificar el anime";
    return NextResponse.json({ error: message }, { status });
  }
  if (isAdult && !(user.showAdultContent || user.isAdmin)) {
    return NextResponse.json({ error: "Contenido no disponible" }, { status: 404 });
  }

  const portada =
    typeof body.cover_url === "string" && body.cover_url.startsWith("https://")
      ? body.cover_url.slice(0, 1000)
      : null;
  const total = Number(body.total_episodes);
  const data = {
    slug,
    title,
    coverUrl: portada,
    type: body.type ? String(body.type).slice(0, 80) : null,
    status: body.status ? String(body.status).slice(0, 80) : null,
    totalEpisodes: Number.isInteger(total) && total >= 0 ? total : null,
    isAdult,
    saved: true,
  };

  const entrada = await db.externalAnime.upsert({
    where: { userId_source_externalId: { userId: user.id, source, externalId } },
    create: { userId: user.id, source, externalId, ...data },
    update: data,
  });
  return NextResponse.json(animeExternoPublico(entrada));
}

/**
 * Quita el anime de la biblioteca animada. Si ya fue visto se conserva como
 * historial; borrar la tarjeta no debe borrar también el minuto de reproducción.
 */
export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  const rechazo = await acceso(user);
  if (rechazo) return rechazo;
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  const source = req.nextUrl.searchParams.get("source") as FuenteAnimeExterna;
  const externalId = req.nextUrl.searchParams.get("id")?.trim();
  if (!esFuenteAnimeExterna(source) || !externalId) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  const llave = { userId_source_externalId: { userId: user.id, source, externalId } };
  const entrada = await db.externalAnime.findUnique({
    where: llave,
    select: { lastWatchedAt: true },
  });
  if (entrada?.lastWatchedAt) {
    await db.externalAnime.update({ where: llave, data: { saved: false } });
  } else {
    await db.externalAnime.delete({ where: llave }).catch(() => {});
  }
  return new NextResponse(null, { status: 204 });
}
