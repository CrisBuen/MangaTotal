import { PrismaClient } from "@prisma/client";
import { assertDatabaseUrl } from "./env";

/**
 * El cliente de Prisma, uno solo por instancia.
 *
 * En Vercel cada petición puede caer en una instancia distinta, y cada una
 * abre su propio grupo de conexiones contra Postgres. Con poca gente no se
 * nota; con muchas instancias a la vez se acaban las conexiones y empiezan
 * los errores intermitentes, que son los peores de diagnosticar porque solo
 * aparecen cuando hay tráfico.
 *
 * De ahí las dos cosas de este archivo: guardar el cliente para reusarlo, y
 * pedir una sola conexión por instancia cuando corre sin servidor propio.
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Ajusta la dirección para correr sin servidor propio.
 *
 * Dos cosas:
 *
 *   · Una conexión por instancia. Son muchas instancias y cada una vive
 *     poco, así que es lo que recomienda Prisma para este caso.
 *
 *   · Con el endpoint agrupado de Neon (el que lleva `-pooler`), avisarle a
 *     Prisma que hay un PgBouncer en modo transacción. Sin eso aparecen
 *     errores de "prepared statement already exists", intermitentes y solo
 *     con tráfico, que son justo los que se quieren evitar.
 *
 * Se hace acá y no en la variable de entorno porque en Vercel esa variable
 * la administra la integración de Neon: es de solo lectura y se resincroniza
 * sola cada vez que cambia la contraseña.
 *
 * Lo que ya venga puesto a mano en la dirección se respeta.
 */
function paraServidorEfimero(url: string): string {
  try {
    const u = new URL(url);
    if (!u.searchParams.has("connection_limit")) u.searchParams.set("connection_limit", "1");
    if (u.hostname.includes("-pooler") && !u.searchParams.has("pgbouncer")) {
      u.searchParams.set("pgbouncer", "true");
    }
    return u.toString();
  } catch {
    // si no se puede leer, se deja tal cual: mejor eso que romper el arranque
    return url;
  }
}

function crearCliente(): PrismaClient {
  assertDatabaseUrl();

  const url = process.env.DATABASE_URL;
  // VERCEL solo existe cuando corre allá; en local no se toca nada
  if (url && process.env.VERCEL) {
    return new PrismaClient({ datasourceUrl: paraServidorEfimero(url) });
  }
  return new PrismaClient();
}

export const db = globalForPrisma.prisma ?? crearCliente();

// se guarda siempre, no solo en desarrollo: en producción evita que un
// módulo reevaluado abra un cliente nuevo con sus conexiones nuevas
globalForPrisma.prisma = db;
