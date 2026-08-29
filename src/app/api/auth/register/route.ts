import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { getSession, publicUser } from "@/lib/auth";
import {
  cuerpoAuthDemasiadoGrande,
  consumirLimite,
  identidadCliente,
  limpiarLimitesAntiguos,
  passwordDentroDelLimite,
  REGLAS_AUTH,
  respuestaLimite,
} from "@/lib/authRateLimit";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  if (cuerpoAuthDemasiadoGrande(req)) {
    return NextResponse.json({ error: "Solicitud demasiado grande" }, { status: 413 });
  }

  const limite = await consumirLimite(
    "registro-ip",
    identidadCliente(req),
    REGLAS_AUTH.registroIp
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
  const nickname = typeof datos.nickname === "string" ? datos.nickname.trim() : "";
  const password = typeof datos.password === "string" ? datos.password : "";
  const birthdateRaw = typeof datos.birthdate === "string" ? datos.birthdate.trim() : "";

  if (!/^[a-zA-Z0-9_.-]{2,30}$/.test(nickname)) {
    return NextResponse.json(
      { error: "El apodo debe tener 2-30 caracteres, sin espacios (letras, números, _ . -)" },
      { status: 400 }
    );
  }
  if (password.length < 8 || !passwordDentroDelLimite(password)) {
    return NextResponse.json(
      { error: "La contraseña debe tener entre 8 y 72 bytes" },
      { status: 400 }
    );
  }

  let birthdate: Date | null = null;
  if (birthdateRaw) {
    const parsed = new Date(birthdateRaw + "T00:00:00");
    if (isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "Fecha de nacimiento inválida" }, { status: 400 });
    }
    birthdate = parsed;
  }

  // Precarga de la preferencia +18 según edad (dato personal, no gate legal)
  // La sección +18 siempre arranca apagada, incluso para mayores de edad:
  // se activa a mano desde el perfil (requisito de las tiendas de apps).
  const showAdultContent = false;

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await db.$transaction(async (tx) => {
    // Evita que dos registros simultáneos se conviertan ambos en el primer
    // administrador cuando la base todavía está vacía.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('mangatotal-primer-admin'))`;
    const existing = await tx.user.findUnique({ where: { nickname } });
    if (existing) return null;

    // Primer usuario registrado = admin automáticamente (docs/07 §7.1)
    const userCount = await tx.user.count();
    return tx.user.create({
      data: {
        nickname,
        passwordHash,
        birthdate,
        isAdmin: userCount === 0,
        showAdultContent,
      },
    });
  });
  if (!user) {
    return NextResponse.json({ error: "Ese apodo ya está en uso" }, { status: 409 });
  }

  await limpiarLimitesAntiguos();

  const session = await getSession();
  session.userId = user.id;
  session.nickname = user.nickname;
  session.isAdmin = user.isAdmin;
  session.sessionVersion = user.sessionVersion;
  await session.save();

  return NextResponse.json({ user: publicUser(user) }, { status: 201 });
}
