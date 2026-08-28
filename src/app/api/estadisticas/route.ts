import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/estadisticas — el resumen de lectura de quien está conectado.
 *
 * Solo se cuenta lo que de verdad se guarda. No hay "tiempo de lectura"
 * porque no se mide en ninguna parte, y poner un número inventado sería
 * peor que no ponerlo.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  const [guardadas, historial, empezadasFuera, porFuente, favoritos, propiasEmpezadas, anime] =
    await Promise.all([
      db.externalSeries.count({ where: { userId: user.id, saved: true } }),
      db.externalSeries.count({ where: { userId: user.id, saved: false } }),
      db.externalSeries.count({ where: { userId: user.id, lastChapterId: { not: null } } }),
      db.externalSeries.groupBy({
        by: ["source"],
        where: { userId: user.id, saved: true },
        _count: { source: true },
      }),
      db.favorite.count({ where: { userId: user.id } }),
      db.readingProgress.count({ where: { userId: user.id } }),
      db.animeEntry.aggregate({
        where: { userId: user.id },
        _count: { id: true },
        _sum: { episodesWatched: true },
      }),
    ]);

  return NextResponse.json({
    guardadas,
    historial,
    // series de fuentes externas en las que abrió al menos un capítulo
    empezadas: empezadasFuera + propiasEmpezadas,
    favoritos,
    porFuente: porFuente
      .map((f) => ({ fuente: f.source, cuantas: f._count.source }))
      .sort((a, b) => b.cuantas - a.cuantas),
    animeSeguidos: anime._count.id,
    episodiosVistos: anime._sum.episodesWatched ?? 0,
  });
}
