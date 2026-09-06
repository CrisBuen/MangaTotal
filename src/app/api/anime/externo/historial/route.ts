import { NextRequest, NextResponse } from "next/server";
import { animeAnimadoPermitido } from "@/lib/animeAcceso";
import {
  animeExternoPublico,
  esFuenteAnimeExterna,
  type FuenteAnimeExterna,
} from "@/lib/animeExternos";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { contenidoAdultoPermitido } from "@/lib/contentAccess";

/**
 * Separa el historial no guardado de los animes guardados que tienen avance.
 * Ambos usan la última reproducción real; no se guarda ninguna URL de video.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  if (!(await animeAnimadoPermitido(user.animeEnabled, user.animeTermsAcceptedAt))) {
    return NextResponse.json(
      { error: "La sección animada está desactivada en Android" },
      { status: 403 }
    );
  }

  const contenidoPermitido = await contenidoAdultoPermitido(user)
    ? {}
    : { isAdult: false };

  const [historial, continuar] = await Promise.all([
    db.externalAnime.findMany({
      where: {
        userId: user.id,
        saved: false,
        lastWatchedAt: { not: null },
        ...contenidoPermitido,
      },
      orderBy: { lastWatchedAt: "desc" },
      take: 30,
      include: {
        episodeProgress: { orderBy: { updatedAt: "desc" }, take: 1 },
      },
    }),
    db.externalAnime.findMany({
      where: {
        userId: user.id,
        saved: true,
        lastWatchedAt: { not: null },
        ...contenidoPermitido,
      },
      orderBy: { lastWatchedAt: "desc" },
      take: 30,
      include: {
        episodeProgress: { orderBy: { updatedAt: "desc" }, take: 1 },
      },
    }),
  ]);

  return NextResponse.json({
    historial: historial.map(animeExternoPublico),
    continuar: continuar.map(animeExternoPublico),
  });
}

/** DELETE — quita solo una entrada no guardada y su progreso del historial. */
export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  if (!(await animeAnimadoPermitido(user.animeEnabled, user.animeTermsAcceptedAt))) {
    return NextResponse.json(
      { error: "La sección animada está desactivada en Android" },
      { status: 403 }
    );
  }

  const source = req.nextUrl.searchParams.get("source") as FuenteAnimeExterna;
  const externalId = req.nextUrl.searchParams.get("id")?.trim();
  if (!esFuenteAnimeExterna(source) || !externalId) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  const verAdulto = await contenidoAdultoPermitido(user);
  await db.externalAnime
    .deleteMany({
      where: {
        userId: user.id,
        source,
        externalId,
        saved: false,
        ...(verAdulto ? {} : { isAdult: false }),
      },
    })
    .catch(() => {});

  return new NextResponse(null, { status: 204 });
}
