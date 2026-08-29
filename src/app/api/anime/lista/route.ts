import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

const STATUSES = ["watching", "planned", "completed", "dropped"] as const;
type AnimeStatus = (typeof STATUSES)[number];

function publicEntry(e: {
  anilistId: number;
  title: string;
  coverUrl: string | null;
  totalEpisodes: number | null;
  status: string;
  episodesWatched: number;
  score: number | null;
  updatedAt: Date;
}) {
  return {
    anilist_id: e.anilistId,
    title: e.title,
    cover_url: e.coverUrl,
    total_episodes: e.totalEpisodes,
    status: e.status,
    episodes_watched: e.episodesWatched,
    score: e.score,
    updated_at: e.updatedAt,
  };
}

/** GET /api/anime/lista?status= — lista de seguimiento del usuario. */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  const status = req.nextUrl.searchParams.get("status");
  const entries = await db.animeEntry.findMany({
    where: {
      userId: user.id,
      ...(status && STATUSES.includes(status as AnimeStatus) ? { status } : {}),
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(entries.map(publicEntry));
}

/**
 * PUT /api/anime/lista — agrega o actualiza una entrada.
 * Body: { anilist_id, title, cover_url?, total_episodes?, status?,
 *         episodes_watched?, score? }
 */
export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  let body: {
    anilist_id?: number;
    title?: string;
    cover_url?: string | null;
    total_episodes?: number | null;
    status?: string;
    episodes_watched?: number;
    score?: number | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const anilistId = Number(body.anilist_id);
  if (!Number.isInteger(anilistId) || anilistId <= 0) {
    return NextResponse.json({ error: "anilist_id inválido" }, { status: 400 });
  }
  const title = String(body.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "Falta el título" }, { status: 400 });

  const status = STATUSES.includes(body.status as AnimeStatus)
    ? (body.status as AnimeStatus)
    : "watching";
  const totalEpisodes =
    typeof body.total_episodes === "number" && body.total_episodes > 0
      ? Math.floor(body.total_episodes)
      : null;

  let watched = Number.isFinite(body.episodes_watched)
    ? Math.max(0, Math.floor(body.episodes_watched as number))
    : 0;
  if (totalEpisodes) watched = Math.min(watched, totalEpisodes);
  // marcar completado deja el contador al final; empezar de cero al planear
  if (status === "completed" && totalEpisodes) watched = totalEpisodes;

  const score =
    typeof body.score === "number" && body.score >= 1 && body.score <= 10
      ? Math.round(body.score)
      : null;

  const data = {
    title,
    coverUrl: typeof body.cover_url === "string" ? body.cover_url : null,
    totalEpisodes,
    status,
    episodesWatched: watched,
    score,
  };

  const entry = await db.animeEntry.upsert({
    where: { userId_anilistId: { userId: user.id, anilistId } },
    create: { userId: user.id, anilistId, ...data },
    update: data,
  });

  return NextResponse.json(publicEntry(entry));
}

/** DELETE /api/anime/lista?anilist_id= — saca el anime de la lista. */
export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  const anilistId = parseInt(req.nextUrl.searchParams.get("anilist_id") ?? "", 10);
  if (!Number.isInteger(anilistId)) {
    return NextResponse.json({ error: "anilist_id inválido" }, { status: 400 });
  }

  await db.animeEntry
    .delete({ where: { userId_anilistId: { userId: user.id, anilistId } } })
    .catch(() => {});

  return new NextResponse(null, { status: 204 });
}
