import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, publicUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  }
  return NextResponse.json({
    id: user.id,
    nickname: user.nickname,
    is_admin: user.isAdmin,
    show_adult_content: user.showAdultContent,
    preferred_reading_mode: user.preferredReadingMode,
    avatar_path: user.avatarPath,
    birthdate: user.birthdate,
  });
}

/** Preferencias propias: show_adult_content y preferred_reading_mode. */
export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  }

  let body: { show_adult_content?: boolean; preferred_reading_mode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const data: { showAdultContent?: boolean; preferredReadingMode?: string } = {};
  if (typeof body.show_adult_content === "boolean") {
    data.showAdultContent = body.show_adult_content;
  }
  if (body.preferred_reading_mode !== undefined) {
    if (!["cascade", "rtl"].includes(body.preferred_reading_mode)) {
      return NextResponse.json({ error: "Modo de lectura inválido" }, { status: 400 });
    }
    data.preferredReadingMode = body.preferred_reading_mode;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nada para actualizar" }, { status: 400 });
  }

  const updated = await db.user.update({ where: { id: user.id }, data });
  return NextResponse.json({ user: publicUser(updated) });
}
