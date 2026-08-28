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
 * Sin servidor propio conviene una conexión por instancia: son muchas
 * instancias y cada una vive poco. Es lo que recomienda Prisma para este
 * caso. Si la dirección ya trae el parámetro puesto a mano, se respeta.
 */
function conexionUnica(url: string): string {
  try {
    const u = new URL(url);
    if (!u.searchParams.has("connection_limit")) u.searchParams.set("connection_limit", "1");
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
    return new PrismaClient({ datasourceUrl: conexionUnica(url) });
  }
  return new PrismaClient();
}

export const db = globalForPrisma.prisma ?? crearCliente();

// se guarda siempre, no solo en desarrollo: en producción evita que un
// módulo reevaluado abra un cliente nuevo con sus conexiones nuevas
globalForPrisma.prisma = db;
