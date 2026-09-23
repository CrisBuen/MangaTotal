import { db } from "./db";
import { buscarReferenciaBiblioteca } from "./identidadBiblioteca";

/** Solo consulta metadatos del usuario; no renombra ni migra ninguna fila. */
export async function resolverIdBiblioteca(userId: number, source: string, externalId: string, tipo?: string | null): Promise<string> {
  if (source !== "olympus") return externalId;
  const filas = await db.externalSeries.findMany({
    where: { userId, source },
    select: { source: true, externalId: true, slug: true, type: true, saved: true },
  });
  const referencia = buscarReferenciaBiblioteca(
    filas.map(e => ({ ...e, external_id: e.externalId })), source, externalId, tipo);
  return referencia?.external_id ?? externalId;
}
