import fs from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { chapterFolderName } from "@/lib/slug";
import { STORAGE_ROOT } from "@/lib/storage";

/** DELETE /api/chapters/:id — solo admin; borra también los archivos. */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  const { id: idRaw } = await ctx.params;
  const id = parseInt(idRaw, 10);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Id inválido" }, { status: 400 });

  const chapter = await db.chapter.findUnique({ where: { id }, include: { series: true } });
  if (!chapter) return NextResponse.json({ error: "Capítulo no encontrado" }, { status: 404 });

  await db.chapter.delete({ where: { id } });
  await fs
    .rm(path.join(STORAGE_ROOT, chapter.series.slug, chapterFolderName(chapter.number)), {
      recursive: true,
      force: true,
    })
    .catch(() => {});

  return new NextResponse(null, { status: 204 });
}
