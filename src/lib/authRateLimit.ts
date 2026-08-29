import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "./db";
import { getSessionSecret } from "./env";

export interface ReglaLimite {
  maxIntentos: number;
  ventanaMs: number;
  bloqueoMs: number;
}

export interface ResultadoLimite {
  permitido: boolean;
  reintentarEn: number;
  noDisponible?: boolean;
}

export const REGLAS_AUTH = {
  loginIp: { maxIntentos: 30, ventanaMs: 15 * 60_000, bloqueoMs: 15 * 60_000 },
  loginCuenta: { maxIntentos: 8, ventanaMs: 15 * 60_000, bloqueoMs: 15 * 60_000 },
  registroIp: { maxIntentos: 10, ventanaMs: 60 * 60_000, bloqueoMs: 60 * 60_000 },
  passwordUsuario: { maxIntentos: 8, ventanaMs: 15 * 60_000, bloqueoMs: 15 * 60_000 },
} satisfies Record<string, ReglaLimite>;

/** Vercel reemplaza esta cabecera en producción para que no pueda falsificarse. */
export function identidadCliente(req: NextRequest): string {
  const valor =
    req.headers.get("x-vercel-forwarded-for") ??
    req.headers.get("x-forwarded-for") ??
    req.headers.get("x-real-ip") ??
    "sin-ip";
  return valor.split(",")[0].trim().slice(0, 128) || "sin-ip";
}

/** Nunca se persisten la IP, el apodo ni el id que originaron el contador. */
function claveProtegida(ambito: string, valor: string): string {
  return createHmac("sha256", getSessionSecret())
    .update(ambito)
    .update("\0")
    .update(valor)
    .digest("hex");
}

export async function consumirLimite(
  ambito: string,
  valor: string,
  regla: ReglaLimite
): Promise<ResultadoLimite> {
  const key = claveProtegida(ambito, valor);
  const ahora = new Date();
  const inicioMinimo = new Date(ahora.getTime() - regla.ventanaMs);

  try {
    return await db.$transaction(
      async (tx) => {
        // Serializa solamente los intentos de esta clave. Evita que una ráfaga
        // concurrente atraviese el límite antes de que se actualice la fila.
        // pg_advisory_xact_lock devuelve el pseudotipo void, que Prisma no
        // puede deserializar directamente. IS NULL obliga a Postgres a
        // devolver un booleano soportado sin cambiar el efecto del bloqueo.
        await tx.$queryRaw<{ locked: boolean }[]>`
          SELECT pg_advisory_xact_lock(hashtext(${key})) IS NULL AS locked
        `;
        const actual = await tx.authRateLimit.findUnique({ where: { key } });

        if (actual?.blockedUntil && actual.blockedUntil > ahora) {
          return {
            permitido: false,
            reintentarEn: Math.max(
              1,
              Math.ceil((actual.blockedUntil.getTime() - ahora.getTime()) / 1000)
            ),
          };
        }

        if (!actual || actual.windowStartedAt <= inicioMinimo) {
          await tx.authRateLimit.upsert({
            where: { key },
            create: {
              key,
              attempts: 1,
              windowStartedAt: ahora,
              blockedUntil: null,
            },
            update: {
              attempts: 1,
              windowStartedAt: ahora,
              blockedUntil: null,
            },
          });
          return { permitido: true, reintentarEn: 0 };
        }

        const intentos = actual.attempts + 1;
        const bloqueadoHasta =
          intentos > regla.maxIntentos ? new Date(ahora.getTime() + regla.bloqueoMs) : null;
        await tx.authRateLimit.update({
          where: { key },
          data: { attempts: intentos, blockedUntil: bloqueadoHasta },
        });

        return bloqueadoHasta
          ? {
              permitido: false,
              reintentarEn: Math.max(1, Math.ceil(regla.bloqueoMs / 1000)),
            }
          : { permitido: true, reintentarEn: 0 };
      },
      { timeout: 5_000 }
    );
  } catch (error) {
    console.error(
      "No se pudo consultar el limitador de autenticación:",
      error instanceof Error ? error.message : "Error desconocido"
    );
    // Si el limitador no puede consultar su estado, es más seguro no ejecutar
    // una comparación de contraseña costosa sin ninguna defensa.
    return { permitido: false, reintentarEn: 30, noDisponible: true };
  }
}

export async function restablecerLimite(ambito: string, valor: string): Promise<void> {
  const key = claveProtegida(ambito, valor);
  await db.authRateLimit.delete({ where: { key } }).catch(() => undefined);
}

/** Limpieza ocasional para que IPs viejas no hagan crecer la tabla sin límite. */
export async function limpiarLimitesAntiguos(): Promise<void> {
  if (Math.random() >= 0.01) return;
  const antesDe = new Date(Date.now() - 48 * 60 * 60_000);
  await db.authRateLimit.deleteMany({ where: { updatedAt: { lt: antesDe } } }).catch(() => undefined);
}

export function respuestaLimite(resultado: ResultadoLimite) {
  const status = resultado.noDisponible ? 503 : 429;
  return NextResponse.json(
    {
      error: resultado.noDisponible
        ? "No se pudo comprobar el acceso. Intentá nuevamente en unos segundos."
        : "Demasiados intentos. Esperá unos minutos y volvé a intentar.",
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(resultado.reintentarEn),
      },
    }
  );
}

export function cuerpoAuthDemasiadoGrande(req: NextRequest): boolean {
  const largo = Number(req.headers.get("content-length") ?? "0");
  return Number.isFinite(largo) && largo > 8 * 1024;
}

export function passwordDentroDelLimite(password: string): boolean {
  return password.length <= 128 && Buffer.byteLength(password, "utf8") <= 72;
}

/** Conserva compatibilidad con contraseñas antiguas largas al compararlas. */
export function passwordComparable(password: string): boolean {
  return password.length <= 2_048 && Buffer.byteLength(password, "utf8") <= 4_096;
}
