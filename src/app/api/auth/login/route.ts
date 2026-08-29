import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { getSession, publicUser } from "@/lib/auth";
import {
  cuerpoAuthDemasiadoGrande,
  consumirLimite,
  identidadCliente,
  limpiarLimitesAntiguos,
  passwordComparable,
  REGLAS_AUTH,
  respuestaLimite,
  restablecerLimite,
} from "@/lib/authRateLimit";
import { db } from "@/lib/db";

// Comparar siempre un hash evita que el tiempo de respuesta confirme si un
// apodo existe. No corresponde a ninguna cuenta ni contraseña real.
const HASH_INEXISTENTE = "$2b$10$7kmkZHumbtYfKlzFuBm.H.UK4cE27zZVN516rcj6NeAYBZRY803Ai";

export async function POST(req: NextRequest) {
  if (cuerpoAuthDemasiadoGrande(req)) {
    return NextResponse.json({ error: "Solicitud demasiado grande" }, { status: 413 });
  }

  const ip = identidadCliente(req);
  const limiteIp = await consumirLimite("login-ip", ip, REGLAS_AUTH.loginIp);
  if (!limiteIp.permitido) return respuestaLimite(limiteIp);

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
  if (
    !nickname ||
    !password ||
    nickname.length > 30 ||
    !/^[a-zA-Z0-9_.-]+$/.test(nickname) ||
    !passwordComparable(password)
  ) {
    return NextResponse.json({ error: "Faltan apodo o contraseña" }, { status: 400 });
  }

  const cuentaLimitada = nickname.toLowerCase();
  const limiteCuenta = await consumirLimite(
    "login-cuenta",
    cuentaLimitada,
    REGLAS_AUTH.loginCuenta
  );
  if (!limiteCuenta.permitido) return respuestaLimite(limiteCuenta);

  const user = await db.user.findUnique({ where: { nickname } });
  const valid = await bcrypt.compare(password, user?.passwordHash ?? HASH_INEXISTENTE);
  if (!user || !valid) {
    return NextResponse.json({ error: "Apodo o contraseña incorrectos" }, { status: 401 });
  }

  await restablecerLimite("login-cuenta", cuentaLimitada);
  await limpiarLimitesAntiguos();

  const session = await getSession();
  session.userId = user.id;
  session.nickname = user.nickname;
  session.isAdmin = user.isAdmin;
  session.sessionVersion = user.sessionVersion;
  await session.save();

  return NextResponse.json({ user: publicUser(user) });
}
