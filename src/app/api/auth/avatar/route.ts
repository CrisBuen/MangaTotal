import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getObjectStorage } from "@/lib/object-storage";
import { origenPermitido } from "@/lib/requestSecurity";

const MAX_AVATAR_BYTES = 10 * 1024 * 1024;

/** POST /api/auth/avatar — multipart con "file": foto de perfil del usuario. */
export async function POST(req: NextRequest) {
  if (!origenPermitido(req)) {
    return NextResponse.json({ error: "Origen de solicitud no permitido" }, { status: 403 });
  }
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

  const storage = getObjectStorage();

  // nombre con timestamp para que el cache del navegador no muestre el viejo
  const fileName = `u${user.id}-${Date.now()}.webp`;
  const avatarPath = `avatars/${fileName}`;
  await storage.putObject(avatarPath, processed, "image/webp");

  // borrar el avatar anterior si existía
  if (user.avatarPath) {
    await storage.deleteObject(user.avatarPath).catch(() => {});
  }

  await db.user.update({ where: { id: user.id }, data: { avatarPath } });

  return NextResponse.json({ avatar_path: avatarPath });
}

/** DELETE /api/auth/avatar — quitar la foto de perfil. */
export async function DELETE(req: NextRequest) {
  if (!origenPermitido(req)) {
    return NextResponse.json({ error: "Origen de solicitud no permitido" }, { status: 403 });
  }
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  if (user.avatarPath) {
    await getObjectStorage().deleteObject(user.avatarPath).catch(() => {});
    await db.user.update({ where: { id: user.id }, data: { avatarPath: null } });
  }

  return new NextResponse(null, { status: 204 });
}
