import { NextRequest, NextResponse } from "next/server";
import { esFuenteAnimeExterna, type FuenteAnimeExterna } from "@/lib/animeExternos";
import { animeAnimadoPermitido } from "@/lib/animeAcceso";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { contenidoAdultoPermitido } from "@/lib/contentAccess";
import { ErrorJkanime, esAdultoJkanime } from "@/lib/jkanime";
import { ErrorTioanime, esAdultoTioanime } from "@/lib/tioanime";

const MAX_SECONDS = 12 * 60 * 60;

async function acceso(user: Awaited<ReturnType<typeof getSessionUser>>) {
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  if (!(await animeAnimadoPermitido(user.animeEnabled, user.animeTermsAcceptedAt))) {
    return NextResponse.json({ error: "La sección animada está desactivada en Android" }, { status: 403 });
  }
  return null;
}

function cadena(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function segundos(value: unknown): number {
  const numero = Math.round(Number(value));
  return Number.isFinite(numero) ? Math.min(Math.max(numero, 0), MAX_SECONDS) : 0;
}

/** Devuelve el progreso de un episodio o la lista completa de una serie. */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  const rechazo = await acceso(user);
  if (rechazo) return rechazo;
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  const source = req.nextUrl.searchParams.get("source") as FuenteAnimeExterna;
  const externalId = cadena(req.nextUrl.searchParams.get("id"), 160);
  const episodeId = cadena(req.nextUrl.searchParams.get("episode_id"), 160);
  if (!esFuenteAnimeExterna(source) || !externalId) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  const anime = await db.externalAnime.findUnique({
    where: { userId_source_externalId: { userId: user.id, source, externalId } },
    select: { id: true, isAdult: true },
  });
  if (!anime) {
    if (!episodeId) return NextResponse.json({ episodes: [] });
    return NextResponse.json({
      position_seconds: 0,
      duration_seconds: 0,
      completed: false,
    });
  }
  if (anime.isAdult && !(await contenidoAdultoPermitido(user))) {
    return NextResponse.json({ error: "Contenido no disponible" }, { status: 404 });
  }

  if (!episodeId) {
    const episodios = await db.externalAnimeEpisodeProgress.findMany({
      where: { externalAnimeId: anime.id },
      orderBy: { updatedAt: "desc" },
      select: {
        episodeId: true,
        episodeNumber: true,
        positionSeconds: true,
        durationSeconds: true,
        completed: true,
        updatedAt: true,
      },
    });
    return NextResponse.json({
      episodes: episodios.map((item) => ({
        episode_id: item.episodeId,
        episode_number: item.episodeNumber,
        position_seconds: item.positionSeconds,
        duration_seconds: item.durationSeconds,
        completed: item.completed,
        updated_at: item.updatedAt,
      })),
    });
  }

  const progreso = await db.externalAnimeEpisodeProgress.findUnique({
    where: { externalAnimeId_episodeId: { externalAnimeId: anime.id, episodeId } },
  });
  return NextResponse.json({
    position_seconds: progreso?.positionSeconds ?? 0,
    duration_seconds: progreso?.durationSeconds ?? 0,
    completed: progreso?.completed ?? false,
  });
}

/**
 * Guarda progreso sin guardar URLs de reproducción. También crea una entrada
 * de historial (saved=false) cuando se mira un anime que no estaba guardado.
 */
export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  const rechazo = await acceso(user);
  if (rechazo) return rechazo;
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  let body: {
    source?: string;
    external_id?: string;
    slug?: string;
    title?: string;
    cover_url?: string | null;
    total_episodes?: number | null;
    episode_id?: string;
    episode_number?: string;
    episode_title?: string;
    position_seconds?: number;
    duration_seconds?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const source = body.source as FuenteAnimeExterna;
  const externalId = cadena(body.external_id, 160);
  const slug = cadena(body.slug, 160);
  const title = cadena(body.title, 300);
  const episodeId = cadena(body.episode_id, 160);
  const episodeNumber = cadena(body.episode_number, 40);
  const episodeTitle = cadena(body.episode_title, 300);
  if (
    !esFuenteAnimeExterna(source) ||
    !externalId ||
    !slug ||
    !title ||
    !episodeId ||
    !episodeNumber ||
    !/^[a-z0-9][a-z0-9-]{0,159}$/i.test(slug)
  ) {
    return NextResponse.json({ error: "Faltan datos del episodio" }, { status: 400 });
  }

  const llave = { userId_source_externalId: { userId: user.id, source, externalId } };
  const existente = await db.externalAnime.findUnique({
    where: llave,
    select: { isAdult: true },
  });

  let isAdult = existente?.isAdult ?? false;
  if (!existente) {
    try {
      if (source === "jkanime") isAdult = await esAdultoJkanime(slug);
      if (source === "tioanime") isAdult = await esAdultoTioanime(slug);
    } catch (error) {
      const status = error instanceof ErrorJkanime || error instanceof ErrorTioanime ? error.status : 502;
      const message = error instanceof Error ? error.message : "No se pudo verificar el anime";
      return NextResponse.json({ error: message }, { status });
    }
  }
  if (isAdult && !(await contenidoAdultoPermitido(user))) {
    return NextResponse.json({ error: "Contenido no disponible" }, { status: 404 });
  }

  const positionSeconds = segundos(body.position_seconds);
  const durationSeconds = segundos(body.duration_seconds);
  const completed =
    durationSeconds > 0 &&
    (positionSeconds >= Math.max(0, durationSeconds - 30) ||
      positionSeconds / durationSeconds >= 0.9);
  const total = Number(body.total_episodes);
  const coverUrl =
    typeof body.cover_url === "string" && body.cover_url.startsWith("https://")
      ? body.cover_url.slice(0, 1000)
      : null;
  const ahora = new Date();

  const anime = await db.externalAnime.upsert({
    where: llave,
    create: {
      userId: user.id,
      source,
      externalId,
      slug,
      title,
      coverUrl,
      totalEpisodes: Number.isInteger(total) && total >= 0 ? total : null,
      isAdult,
      saved: false,
      lastEpisodeId: episodeId,
      lastEpisodeNumber: episodeNumber,
      lastEpisodeTitle: episodeTitle || null,
      lastWatchedAt: ahora,
    },
    update: {
      slug,
      title,
      coverUrl,
      totalEpisodes: Number.isInteger(total) && total >= 0 ? total : undefined,
      isAdult,
      lastEpisodeId: episodeId,
      lastEpisodeNumber: episodeNumber,
      lastEpisodeTitle: episodeTitle || null,
      lastWatchedAt: ahora,
    },
  });

  const progreso = await db.externalAnimeEpisodeProgress.upsert({
    where: {
      externalAnimeId_episodeId: {
        externalAnimeId: anime.id,
        episodeId,
      },
    },
    create: {
      externalAnimeId: anime.id,
      episodeId,
      episodeNumber,
      episodeTitle: episodeTitle || null,
      positionSeconds,
      durationSeconds,
      completed,
    },
    update: {
      episodeNumber,
      episodeTitle: episodeTitle || null,
      positionSeconds,
      durationSeconds,
      completed,
    },
  });

  return NextResponse.json({
    position_seconds: progreso.positionSeconds,
    duration_seconds: progreso.durationSeconds,
    completed: progreso.completed,
  });
}
