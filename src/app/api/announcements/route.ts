import { NextRequest, NextResponse } from "next/server";
import { getSessionAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

/** GET /api/announcements — noticias públicas, más recientes primero. */
export async function GET() {
  const announcements = await db.announcement.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return NextResponse.json(
    announcements.map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      created_at: a.createdAt,
    }))
  );
}

/** POST /api/announcements { title, body } — solo admin. */
export async function POST(req: NextRequest) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  let body: { title?: string; body?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const title = body.title?.trim();
  const text = body.body?.trim();
  if (!title || !text) {
    return NextResponse.json({ error: "Faltan título o contenido" }, { status: 400 });
  }

  const announcement = await db.announcement.create({ data: { title, body: text } });
  return NextResponse.json({ announcement }, { status: 201 });
}
