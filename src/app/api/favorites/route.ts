import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

/** POST /api/favorites { seriesId } */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  let body: { seriesId?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const seriesId = Number(body.seriesId);
  if (!Number.isInteger(seriesId)) {
    return NextResponse.json({ error: "seriesId inválido" }, { status: 400 });
  }

  const series = await db.series.findUnique({ where: { id: seriesId } });
  if (!series) return NextResponse.json({ error: "Serie no encontrada" }, { status: 404 });

  await db.favorite.upsert({
    where: { userId_seriesId: { userId: user.id, seriesId } },
    create: { userId: user.id, seriesId },
    update: {},
  });

  return new NextResponse(null, { status: 201 });
}
