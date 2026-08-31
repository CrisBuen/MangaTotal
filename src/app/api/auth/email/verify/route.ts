import { NextRequest, NextResponse } from "next/server";
import { verificarTokenCorreo } from "@/lib/accountEmail";
import {
  cuerpoAuthDemasiadoGrande,
  consumirLimite,
  identidadCliente,
  REGLAS_AUTH,
  respuestaLimite,
} from "@/lib/authRateLimit";

export async function POST(req: NextRequest) {
  if (cuerpoAuthDemasiadoGrande(req)) {
    return NextResponse.json({ error: "Solicitud demasiado grande" }, { status: 413 });
  }
  const limite = await consumirLimite("verify-token-ip", identidadCliente(req), REGLAS_AUTH.tokenIp);
  if (!limite.permitido) return respuestaLimite(limite);

  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  const token = typeof body.token === "string" ? body.token : "";
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) {
    return NextResponse.json({ error: "Enlace inválido" }, { status: 400 });
  }
  const user = await verificarTokenCorreo(token);
  if (!user) {
    return NextResponse.json({ error: "El enlace venció o ya fue utilizado" }, { status: 410 });
  }
  return NextResponse.json({ ok: true });
}
