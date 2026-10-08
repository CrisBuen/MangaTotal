import { NextRequest, NextResponse } from "next/server";
import { enviarRecuperacion, normalizarEmail } from "@/lib/accountEmail";
import {
  cuerpoAuthDemasiadoGrande,
  consumirLimite,
  identidadCliente,
  REGLAS_AUTH,
  respuestaLimite,
} from "@/lib/authRateLimit";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  if (cuerpoAuthDemasiadoGrande(req)) {
    return NextResponse.json({ error: "Solicitud demasiado grande" }, { status: 413 });
  }
  const limite = await consumirLimite(
    "recovery-ip",
    identidadCliente(req),
    REGLAS_AUTH.recoveryIp,
  );
  if (!limite.permitido) return respuestaLimite(limite);

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  let email: string | null = null;
  try {
    email = normalizarEmail(body.email);
  } catch {
    // La respuesta siempre es igual para no revelar qué correos existen.
  }

  let resultado: "correo_invalido" | "cuenta_no_encontrada" | "enviado" | "fallido" =
    email ? "cuenta_no_encontrada" : "correo_invalido";
  if (email) {
    const user = await db.user.findUnique({ where: { email } });
    // Recibir y usar el enlace demuestra control del correo, aunque la cuenta
    // todavía no haya completado el enlace separado de verificación.
    if (user?.email) {
      const enviado = await enviarRecuperacion({
        id: user.id,
        nickname: user.nickname,
        email: user.email,
      }).catch(() => false);
      resultado = enviado ? "enviado" : "fallido";
    }
  }
  // Se registra únicamente el resultado, nunca el correo ni el usuario. La
  // respuesta pública sigue siendo idéntica para no revelar cuentas existentes.
  console.info(`[recuperacion] resultado=${resultado}`);

  return NextResponse.json({
    ok: true,
    message: "Si el correo está asociado a una cuenta, recibirás un enlace en unos minutos.",
  });
}
