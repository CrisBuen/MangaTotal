import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { usarTokenRecuperacion } from "@/lib/accountEmail";
import {
  cuerpoAuthDemasiadoGrande,
  consumirLimite,
  identidadCliente,
  passwordDentroDelLimite,
  REGLAS_AUTH,
  respuestaLimite,
} from "@/lib/authRateLimit";

export async function POST(req: NextRequest) {
  if (cuerpoAuthDemasiadoGrande(req)) {
    return NextResponse.json({ error: "Solicitud demasiado grande" }, { status: 413 });
  }
  const limite = await consumirLimite("reset-token-ip", identidadCliente(req), REGLAS_AUTH.tokenIp);
  if (!limite.permitido) return respuestaLimite(limite);

  let body: { token?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) {
    return NextResponse.json({ error: "Enlace inválido" }, { status: 400 });
  }
  if (password.length < 8 || !passwordDentroDelLimite(password)) {
    return NextResponse.json(
      { error: "La contraseña debe tener entre 8 y 72 bytes" },
      { status: 400 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  if (!(await usarTokenRecuperacion(token, passwordHash))) {
    return NextResponse.json({ error: "El enlace venció o ya fue utilizado" }, { status: 410 });
  }
  return NextResponse.json({ ok: true });
}
