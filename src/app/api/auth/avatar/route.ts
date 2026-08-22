import fs from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import sharp from "sharp";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { STORAGE_ROOT } from "@/lib/storage";

const MAX_AVATAR_BYTES = 10 * 1024 * 1024;

/** POST /api/auth/avatar — multipart con "file": foto de perfil del usuario. */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Se esperaba multipart/form-data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Falta la imagen" }, { status: 400 });
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return NextResponse.json({ error: "La imagen supera los 10 MB" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // el avatar sí se procesa (no es una página de manga): recorte cuadrado 256px
  let processed: Buffer;
  try {
    processed = await sharp(buffer)
      .resize(256, 256, { fit: "cover" })
      .webp({ quality: 90 })
      .toBuffer();
  } catch {
    return NextResponse.json({ error: "El archivo no es una imagen válida" }, { status: 400 });
  }

  const dir = path.join(STORAGE_ROOT, "avatars");
  await fs.mkdir(dir, { recursive: true });

  // nombre con timestamp para que el cache del navegador no muestre el viejo
  const fileName = `u${user.id}-${Date.now()}.webp`;
  await fs.writeFile(path.join(dir, fileName), processed);

  // borrar el avatar anterior si existía
  if (user.avatarPath) {
    await fs.rm(path.join(STORAGE_ROOT, user.avatarPath), { force: true }).catch(() => {});
  }

  const avatarPath = `avatars/${fileName}`;
  await db.user.update({ where: { id: user.id }, data: { avatarPath } });

  return NextResponse.json({ avatar_path: avatarPath });
}

/** DELETE /api/auth/avatar — quitar la foto de perfil. */
export async function DELETE() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  if (user.avatarPath) {
    await fs.rm(path.join(STORAGE_ROOT, user.avatarPath), { force: true }).catch(() => {});
    await db.user.update({ where: { id: user.id }, data: { avatarPath: null } });
  }

  return new NextResponse(null, { status: 204 });
}
