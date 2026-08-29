import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { getSession, getSessionUser } from "@/lib/auth";
import {
  cuerpoAuthDemasiadoGrande,
  consumirLimite,
  passwordComparable,
  passwordDentroDelLimite,
  REGLAS_AUTH,
  respuestaLimite,
  restablecerLimite,
} from "@/lib/authRateLimit";
import { db } from "@/lib/db";

/** POST /api/auth/password { current_password, new_password } */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  if (cuerpoAuthDemasiadoGrande(req)) {
    return NextResponse.json({ error: "Solicitud demasiado grande" }, { status: 413 });
  }

  const claveUsuario = String(user.id);
  const limite = await consumirLimite(
    "password-usuario",
    claveUsuario,
    REGLAS_AUTH.passwordUsuario
  );
  if (!limite.permitido) return respuestaLimite(limite);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const datos =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const current = typeof datos.current_password === "string" ? datos.current_password : "";
  const next = typeof datos.new_password === "string" ? datos.new_password : "";

  const currentValid =
    passwordComparable(current) && (await bcrypt.compare(current, user.passwordHash));
  if (!currentValid) {
    return NextResponse.json({ error: "La contraseña actual es incorrecta" }, { status: 401 });
  }
  if (next.length < 8 || !passwordDentroDelLimite(next)) {
    return NextResponse.json(
      { error: "La contraseña nueva debe tener entre 8 y 72 bytes" },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(next, 10);
  const updated = await db.user.update({
    where: { id: user.id },
    data: { passwordHash, sessionVersion: { increment: 1 } },
    select: { sessionVersion: true },
  });
  await restablecerLimite("password-usuario", claveUsuario);

  // La sesión desde la que se cambió la contraseña sigue abierta; todas las
  // demás conservan la versión anterior y se invalidan en su próxima petición.
  const session = await getSession();
  session.sessionVersion = updated.sessionVersion;
  await session.save();

  return NextResponse.json({ ok: true });
}
