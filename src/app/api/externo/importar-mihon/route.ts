import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { origenPermitido } from "@/lib/requestSecurity";
import { listaCompleta } from "@/lib/olympus";
import { aliasOlympus } from "@/lib/referenciasLectura";
import { portadaMihon, validarEntradaMihon, type EntradaMihon } from "@/lib/mihonImportacion";

export const runtime = "nodejs";
/** Solo recibe metadatos confirmados; nunca el archivo ni las preferencias de Mihon. */
export async function POST(req: NextRequest) {
  if (!origenPermitido(req)) return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Iniciá sesión para importar" }, { status: 401 });
  let entradas: EntradaMihon[];
  try {
    if (!req.headers.get("content-type")?.startsWith("application/json")) throw new Error();
    // También se limita el cuerpo real: Content-Length es opcional y no es confiable.
    const reader = req.body?.getReader();
    if (!reader) throw new Error();
    const partes: Uint8Array[] = []; let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        total += value.length;
        if (total > 128 * 1024) { await reader.cancel(); throw new Error(); }
        partes.push(value);
      }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(total); let offset = 0;
    for (const p of partes) { bytes.set(p, offset); offset += p.length; }
    const cuerpo = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!Array.isArray(cuerpo.entradas) || !cuerpo.entradas.length || cuerpo.entradas.length > 25 ||
        !cuerpo.entradas.every(validarEntradaMihon)) throw new Error();
    entradas = cuerpo.entradas;
  } catch { return NextResponse.json({ error: "Lote de importación inválido (máximo 25 series)" }, { status: 400 }); }

  try {
    const indice = entradas.some((e) => e.source === "olympus") ? await listaCompleta() : [];
    const guardadasOlympus = indice.length ? await db.externalSeries.findMany({
      where: { userId: user.id, source: "olympus" },
      select: { externalId: true, slug: true, type: true },
    }) : [];
    const identidadesOlympus = new Map<string, string>();
    for (const g of guardadasOlympus) {
      const slug = g.slug ?? g.externalId;
      const exactas = indice.filter((s) => s.slug === slug && (!g.type || s.type === g.type));
      const referencia = exactas.length === 1 ? exactas[0] : aliasOlympus(slug, indice, g.type ?? undefined);
      if (referencia && !identidadesOlympus.has(String(referencia.id))) {
        identidadesOlympus.set(String(referencia.id), g.externalId);
      }
    }
    const omitidas: { source: string; externalId: string; motivo: string }[] = [];
    const datos: Prisma.ExternalSeriesCreateManyInput[] = [];
    const vistas = new Set<string>();
    for (const e of entradas) {
      // La extensión de Olympus guarda un ID numérico. Se resuelve por ID, jamás por título.
      const coincidencias = e.source === "olympus" ? indice.filter((s) => String(s.id) === e.externalId) : [];
      const olympus = coincidencias.length === 1 ? coincidencias[0] : null;
      if (e.source === "olympus" && (!olympus || !/^[a-zA-Z0-9_-]{1,300}$/.test(olympus.slug))) {
        omitidas.push({ source: e.source, externalId: e.externalId, motivo: "El ID no aparece de forma única en el catálogo actual de Olympus" });
        continue;
      }
      // Una serie guardada con el slug anterior sigue siendo la misma.
      // Se conserva su identidad para no duplicarla ni separar su progreso.
      const externalId = olympus ? identidadesOlympus.get(e.externalId) ?? olympus.slug : e.externalId;
      const key = e.source + ":" + externalId;
      if (vistas.has(key)) continue;
      vistas.add(key);
      datos.push({
        userId: user.id, source: e.source, externalId, saved: true,
        slug: olympus?.slug ?? null, title: e.title.trim(),
        coverUrl: olympus ? portadaMihon(olympus.cover ?? "") : e.coverUrl,
        type: olympus?.type === "novel" ? "novel" : olympus ? "comic" : null,
        lastChapterId: e.lastChapterId, lastChapterName: e.lastChapterName, lastPageNumber: e.lastPageNumber,
      });
    }
    let creadas = 0;
    if (datos.length) {
      // La restricción única y skipDuplicates permiten reintentar incluso si se cortó
      // la conexión después del commit. El progreso existente nunca se sobrescribe.
      creadas = await db.$transaction(async (tx) => {
        const nuevas = await tx.externalSeries.createMany({ data: datos, skipDuplicates: true });
        await tx.externalSeries.updateMany({
          where: { userId: user.id, saved: false, OR: datos.map((e) => ({ source: e.source, externalId: e.externalId })) },
          data: { saved: true },
        });
        return nuevas.count;
      });
    }
    return NextResponse.json({ creadas, conservadas: datos.length - creadas, omitidas });
  } catch {
    return NextResponse.json({ error: "No se pudo guardar este lote. Podés reintentar sin duplicar series." }, { status: 503 });
  }
}
