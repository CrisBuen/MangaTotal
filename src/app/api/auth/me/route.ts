import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, publicUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { enviarVerificacion, normalizarEmail } from "@/lib/accountEmail";
import { peticionDesdePlayStore } from "@/lib/contentAccess";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  }
  const desdePlay = await peticionDesdePlayStore();
  return NextResponse.json({
    id: user.id,
    nickname: user.nickname,
    is_admin: user.isAdmin,
    show_adult_content: desdePlay ? false : user.showAdultContent,
    anime_enabled: desdePlay
      ? user.animeEnabled && Boolean(user.animeTermsAcceptedAt)
      : user.animeEnabled,
    preferred_reading_mode: user.preferredReadingMode,
    avatar_path: user.avatarPath,
    birthdate: user.birthdate,
    email: user.email,
    email_verified: Boolean(user.emailVerifiedAt),
    play_store_app: desdePlay,
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
    accept_anime_terms?: boolean;
    preferred_reading_mode?: string;
    email?: string | null;
    birthdate?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const data: {
    showAdultContent?: boolean;
    animeEnabled?: boolean;
    animeTermsAcceptedAt?: Date;
    preferredReadingMode?: string;
    email?: string | null;
    emailVerifiedAt?: Date | null;
    birthdate?: Date | null;
  } = {};
  const desdePlay = await peticionDesdePlayStore();
  if (typeof body.show_adult_content === "boolean") {
    if (desdePlay) {
      return NextResponse.json(
        { error: "El contenido +18 está disponible únicamente en la edición local" },
        { status: 403 },
      );
    }
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
    if (desdePlay && body.anime_enabled) {
      if (body.accept_anime_terms !== true) {
        return NextResponse.json(
          { error: "Tenés que aceptar las condiciones de la sección animada" },
          { status: 403 },
        );
      }
      data.animeTermsAcceptedAt = new Date();
    }
    data.animeEnabled = body.anime_enabled;
  }
  if (body.email !== undefined) {
    try {
      const email = normalizarEmail(body.email);
      data.email = email;
      if (email !== user.email) data.emailVerifiedAt = null;
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Correo electrónico inválido" },
        { status: 400 },
      );
    }
  }
  if (body.birthdate !== undefined) {
    const value = typeof body.birthdate === "string" ? body.birthdate.trim() : "";
    if (!value) {
      data.birthdate = null;
      data.showAdultContent = false;
    } else {
      const parsed = new Date(value + "T00:00:00");
      if (Number.isNaN(parsed.getTime()) || parsed > new Date()) {
        return NextResponse.json({ error: "Fecha de nacimiento inválida" }, { status: 400 });
      }
      data.birthdate = parsed;
      const years = (Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      if (years < 18) data.showAdultContent = false;
    }
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

  let updated;
  try {
    updated = await db.user.update({ where: { id: user.id }, data });
  } catch {
    return NextResponse.json({ error: "Ese correo ya está asociado a otra cuenta" }, { status: 409 });
  }

  let emailVerificationSent = false;
  if (data.email !== undefined && updated.email && !updated.emailVerifiedAt) {
    emailVerificationSent = await enviarVerificacion({
      id: updated.id,
      nickname: updated.nickname,
      email: updated.email,
    }).catch(() => false);
  }

  const publicUpdated = publicUser(updated);
  if (desdePlay) publicUpdated.show_adult_content = false;
  if (desdePlay) {
    publicUpdated.anime_enabled =
      updated.animeEnabled && Boolean(updated.animeTermsAcceptedAt);
  }
  return NextResponse.json({
    user: publicUpdated,
    email_verification_sent: emailVerificationSent,
  });
}
