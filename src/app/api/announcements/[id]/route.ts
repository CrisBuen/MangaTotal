import { NextRequest, NextResponse } from "next/server";
import { getSessionAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

/** PATCH /api/announcements/:id { title?, body? } — solo admin. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  const { id: raw } = await ctx.params;
  const id = parseInt(raw, 10);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Id inválido" }, { status: 400 });

  const existing = await db.announcement.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Noticia no encontrada" }, { status: 404 });

  let body: { title?: string; body?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const data: Record<string, string> = {};
  if (body.title !== undefined) {
    const title = body.title.trim();
    if (!title) return NextResponse.json({ error: "Título vacío" }, { status: 400 });
    data.title = title;
  }
  if (body.body !== undefined) {
    const text = body.body.trim();
    if (!text) return NextResponse.json({ error: "Contenido vacío" }, { status: 400 });
    data.body = text;
  }

  const announcement = await db.announcement.update({ where: { id }, data });
  return NextResponse.json({ announcement });
}

/** DELETE /api/announcements/:id — solo admin. */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  const { id: raw } = await ctx.params;
  const id = parseInt(raw, 10);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Id inválido" }, { status: 400 });

  await db.announcement.delete({ where: { id } }).catch(() => {});
  return new NextResponse(null, { status: 204 });
}
