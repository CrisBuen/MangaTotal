import { NextRequest, NextResponse } from "next/server";
import { correoConfigurado, enviarRecuperacion, normalizarEmail } from "@/lib/accountEmail";
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  let email: string | null = null;
  try {
    email = normalizarEmail(
      body && typeof body === "object" && "email" in body ? body.email : null,
    );
  } catch {
    // La respuesta siempre es igual para no revelar qué correos existen.
  }

  // Es un fallo global, independiente de que exista la cuenta. Se puede
  // informar sin convertir la recuperación en un buscador de usuarios.
  if (!correoConfigurado()) {
    console.error("[recuperacion] servicio de correo no configurado");
    return NextResponse.json(
      { error: "El envío de correo no está disponible en este momento. Intentá más tarde." },
      { status: 503 },
    );
  }

  let resultado: "correo_invalido" | "cuenta_no_encontrada" | "aceptado" | "fallido" =
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
      }).catch((error: unknown) => {
        console.error("[recuperacion] falló la preparación del correo", error instanceof Error ? error.name : "Error");
        return false;
      });
      resultado = enviado ? "aceptado" : "fallido";
    }
  }
  // Se registra únicamente el resultado, nunca el correo ni el usuario. La
  // respuesta pública sigue siendo idéntica para no revelar cuentas existentes.
  console.info(`[recuperacion] resultado=${resultado}`);

  return NextResponse.json({
    ok: true,
    message: "Solicitud recibida. Si el correo está asociado a una cuenta, recibirás un enlace. Revisá también spam; si no llega, intentá de nuevo o contactá a soporte.",
  });
}
