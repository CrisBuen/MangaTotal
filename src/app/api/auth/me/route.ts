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
    anime_enabled: user.animeEnabled,
    preferred_reading_mode: user.preferredReadingMode,
    avatar_path: user.avatarPath,
    birthdate: user.birthdate,
  });
}

/** Preferencias propias: contenido adulto, anime y modo de lectura. */
export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  }

  let body: {
    show_adult_content?: boolean;
    anime_enabled?: boolean;
    preferred_reading_mode?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const data: {
    showAdultContent?: boolean;
    animeEnabled?: boolean;
    preferredReadingMode?: string;
  } = {};
  if (typeof body.show_adult_content === "boolean") {
    // encenderla exige fecha de nacimiento cargada y 18 años cumplidos
    if (body.show_adult_content) {
      if (!user.birthdate) {
        return NextResponse.json(
          { error: "Agregá tu fecha de nacimiento para activar esta sección" },
          { status: 403 }
        );
      }
      const years = (Date.now() - user.birthdate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      if (years < 18) {
        return NextResponse.json(
          { error: "Esta sección es solo para mayores de 18 años" },
          { status: 403 }
        );
      }
    }
    data.showAdultContent = body.show_adult_content;
  }
  if (typeof body.anime_enabled === "boolean") {
    // Es distinto del filtro +18: habilita la sección animada completa.
    data.animeEnabled = body.anime_enabled;
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
