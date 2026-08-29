import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { aniFetch } from "@/lib/anilist";

interface MediaEstado {
  id: number;
  episodes: number | null;
  status: string | null;
  nextAiringEpisode: { episode: number; airingAt: number } | null;
}

const CONSULTA = `
  query ($ids: [Int]) {
    Page(page: 1, perPage: 50) {
      media(id_in: $ids, type: ANIME) {
        id
        episodes
        status
        nextAiringEpisode { episode airingAt }
      }
    }
  }
`;

/**
 * GET /api/anime/novedades — para cada anime que sigue el usuario, cuántos
 * episodios salieron y cuántos le faltan ver.
 *
 * AniList acepta pedir muchos por id de una sola vez, así que revisar toda
 * la lista es una consulta, no una por serie.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  if (!user.animeEnabled) {
    return NextResponse.json({ error: "La sección Anime está desactivada" }, { status: 403 });
  }

  const seguidos = await db.animeEntry.findMany({
    where: { userId: user.id },
    select: { anilistId: true, episodesWatched: true, totalEpisodes: true },
  });
  if (seguidos.length === 0) return NextResponse.json({});

  const salida: Record<
    number,
    { emitidos: number | null; total: number | null; sinVer: number; enEmision: boolean }
  > = {};

  try {
    // de a 50, que es lo que devuelve una página de AniList
    for (let i = 0; i < seguidos.length; i += 50) {
      const lote = seguidos.slice(i, i + 50);
      const data = await aniFetch<{ Page: { media: MediaEstado[] } }>(
        CONSULTA,
        { ids: lote.map((s) => s.anilistId) },
        120
      );

      for (const m of data.Page.media ?? []) {
        const seguido = lote.find((s) => s.anilistId === m.id);
        if (!seguido) continue;

        // el próximo episodio anunciado dice cuál fue el último que salió
        const emitidos = m.nextAiringEpisode
          ? Math.max(0, m.nextAiringEpisode.episode - 1)
          : m.episodes;

        salida[m.id] = {
          emitidos,
          total: m.episodes,
          sinVer: emitidos !== null ? Math.max(0, emitidos - seguido.episodesWatched) : 0,
          enEmision: m.status === "RELEASING",
        };
      }
    }
  } catch (err) {
    console.error("[anime] novedades", err);
    return NextResponse.json({ error: "No se pudo consultar AniList" }, { status: 502 });
  }

  return NextResponse.json(salida);
}
