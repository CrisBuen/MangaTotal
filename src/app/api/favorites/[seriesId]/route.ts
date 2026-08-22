import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

/** DELETE /api/favorites/:seriesId */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ seriesId: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  const { seriesId: raw } = await ctx.params;
  const seriesId = parseInt(raw, 10);
  if (!Number.isInteger(seriesId)) {
    return NextResponse.json({ error: "seriesId inválido" }, { status: 400 });
  }

  await db.favorite
    .delete({ where: { userId_seriesId: { userId: user.id, seriesId } } })
    .catch(() => {});

  return new NextResponse(null, { status: 204 });
}
