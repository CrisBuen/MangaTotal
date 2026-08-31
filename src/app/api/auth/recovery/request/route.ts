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

  if (email) {
    const user = await db.user.findUnique({ where: { email } });
    if (user?.email && user.emailVerifiedAt) {
      await enviarRecuperacion({
        id: user.id,
        nickname: user.nickname,
        email: user.email,
      }).catch(() => false);
    }
  }

  return NextResponse.json({
    ok: true,
    message: "Si el correo está verificado, recibirás un enlace en unos minutos.",
  });
}
