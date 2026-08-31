import { NextRequest, NextResponse } from "next/server";
import { enviarVerificacion } from "@/lib/accountEmail";
import { getSessionUser } from "@/lib/auth";
import {
  consumirLimite,
  REGLAS_AUTH,
  respuestaLimite,
} from "@/lib/authRateLimit";

export async function POST(_req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  if (!user.email) {
    return NextResponse.json({ error: "Primero agregá un correo electrónico" }, { status: 400 });
  }
  if (user.emailVerifiedAt) return NextResponse.json({ ok: true, already_verified: true });

  const limite = await consumirLimite(
    "email-usuario",
    String(user.id),
    REGLAS_AUTH.emailUsuario,
  );
  if (!limite.permitido) return respuestaLimite(limite);

  const sent = await enviarVerificacion({
    id: user.id,
    nickname: user.nickname,
    email: user.email,
  }).catch(() => false);
  if (!sent) {
    return NextResponse.json(
      { error: "No se pudo enviar el correo. Revisá la configuración del servicio." },
      { status: 503 },
    );
  }
  return NextResponse.json({ ok: true });
}
