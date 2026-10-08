import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { getSessionAdmin } from "@/lib/auth";
import {
  cuerpoAuthDemasiadoGrande,
  consumirLimite,
  REGLAS_AUTH,
  respuestaLimite,
  restablecerLimite,
} from "@/lib/authRateLimit";
import { db } from "@/lib/db";

export const runtime = "nodejs";

function respuesta(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** Recuperación asistida: solo un administrador puede generar una clave nueva. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await getSessionAdmin();
  if (!admin) return respuesta({ error: "Solo admin" }, 403);
  if (cuerpoAuthDemasiadoGrande(req)) {
    return respuesta({ error: "Solicitud demasiado grande" }, 413);
  }

  const { id: raw } = await ctx.params;
  const id = Number(raw);
  if (!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(id) || id > 2_147_483_647) {
    return respuesta({ error: "Id inválido" }, 400);
  }
  if (id === admin.id) {
    return respuesta({ error: "Para cambiar tu propia contraseña, usá la sección Perfil." }, 400);
  }

  const body: unknown = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || !("confirm" in body) || body.confirm !== true) {
    return respuesta({ error: "Confirmá la generación de una contraseña nueva." }, 400);
  }

  const limite = await consumirLimite(
    "admin-recuperacion",
    String(admin.id),
    REGLAS_AUTH.passwordUsuario,
  );
  if (!limite.permitido) return respuestaLimite(limite);

  try {
    const user = await db.user.findUnique({ where: { id }, select: { id: true, nickname: true } });
    if (!user) return respuesta({ error: "Usuario no encontrado" }, 404);

    const password = randomBytes(18).toString("base64url");
    const passwordHash = await bcrypt.hash(password, 10);
    await db.$transaction(async (tx) => {
      // Solo cambia el acceso: ni la biblioteca ni el estado de verificación
      // del correo se tocan. Las sesiones previas dejan de ser válidas.
      await tx.user.update({
        where: { id },
        data: { passwordHash, sessionVersion: { increment: 1 } },
      });
      // Un enlace anterior no debe poder reemplazar la clave recién entregada.
      await tx.accountToken.deleteMany({
        where: { userId: id, kind: { startsWith: "reset_password" }, usedAt: null },
      });
    });
    await restablecerLimite("login-cuenta", user.nickname.toLowerCase());
    console.info("[admin] contraseña restablecida", { adminId: admin.id, userId: id });

    // La clave en claro sale únicamente en esta respuesta; nunca se persiste
    // ni se registra. El administrador debe entregarla por un medio privado.
    return respuesta({ ok: true, password });
  } catch (error) {
    console.error("[admin] falló la recuperación", error instanceof Error ? error.name : "Error");
    return respuesta({ error: "No se pudo completar la recuperación. Volvé a intentar." }, 500);
  }
}
