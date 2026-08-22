import AdmZip from "adm-zip";
import { createHash } from "crypto";
import path from "path";
import sharp from "sharp";
import { db } from "./db";
import { getObjectStorage } from "./object-storage";
import { chapterFolderName, slugify } from "./slug";
import { contentTypeFor } from "./storage";

/** Tamaño máximo aceptado por zip (configurable, ver docs/04 §4.3). */
export const MAX_ZIP_BYTES = 500 * 1024 * 1024;

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

/** Error "esperado" del pipeline: su mensaje se muestra tal cual en el dashboard. */
export class IngestError extends Error {}

export interface IngestOptions {
  /** Serie existente elegida en el formulario. */
  seriesId?: number;
  /** Título para crear una serie nueva (si no hay seriesId). */
  newSeriesTitle?: string;
  /** Sección de la serie nueva: normal | adult. */
  seriesType?: "normal" | "adult";
  chapterNumber: number;
  chapterTitle?: string;
  originalFilename: string;
}

/**
 * Detecta serie y capítulo desde el nombre del zip con la convención
 * opcional `NombreSerie_Cap01.zip` (docs/04 §4.4).
 */
export function parseZipFilename(filename: string): { seriesTitle: string; chapterNumber: number } | null {
  const match = /^(.+?)_[Cc]ap\s*(\d+(?:\.\d+)?)\.zip$/i.exec(filename.trim());
  if (!match) return null;
  const chapterNumber = parseFloat(match[2]);
  if (!Number.isFinite(chapterNumber)) return null;
  return { seriesTitle: match[1].replace(/[-_]+/g, " ").trim(), chapterNumber };
}

interface ExtractedPage {
  name: string;
  ext: string;
  data: Buffer;
  checksum: string;
}

/**
 * Procesa un .zip subido: extrae, valida, ordena, publica el capítulo y
 * actualiza el registro en ingestion_jobs. Nunca lanza: todo error queda
 * registrado en el job (docs/04 §4.5 — nunca falla en silencio).
 */
export async function processZip(jobId: number, zipBuffer: Buffer, opts: IngestOptions): Promise<void> {
  const storage = getObjectStorage();
  // prefijo del capítulo ya subido, para revertir si algo falla después
  let chapterPrefix: string | null = null;
  let coverKey: string | null = null;

  try {
    await db.ingestionJob.update({ where: { id: jobId }, data: { status: "processing" } });

    // ── 1. Abrir y validar el zip ────────────────────────────────────────
    let zip: AdmZip;
    try {
      zip = new AdmZip(zipBuffer);
    } catch {
      throw new IngestError("El archivo no es un .zip válido o está corrupto");
    }

    const entries = zip
      .getEntries()
      .filter((e) => !e.isDirectory)
      .filter((e) => !e.entryName.includes("__MACOSX"))
      .filter((e) => {
        const base = path.basename(e.entryName);
        return !base.startsWith(".") && base.toLowerCase() !== "thumbs.db";
      })
      .filter((e) => IMAGE_EXTS.has(path.extname(e.entryName).toLowerCase()));

    if (entries.length === 0) {
      throw new IngestError("El zip no contiene páginas de imagen (png/jpg/webp)");
    }

    // ── 2. Orden natural por nombre (0001 < 0002 < 0010, no alfabético) ──
    entries.sort((a, b) =>
      a.entryName.localeCompare(b.entryName, undefined, { numeric: true, sensitivity: "base" })
    );

    // ── 3. Leer buffers y calcular checksum SHA-256 por página ───────────
    const pages: ExtractedPage[] = entries.map((e) => {
      const data = e.getData();
      return {
        name: e.entryName,
        ext: path.extname(e.entryName).toLowerCase(),
        data,
        checksum: createHash("sha256").update(data).digest("hex"),
      };
    });

    // ── 4. Resolver la serie (existente por selección/slug, o crear) ─────
    let series;
    if (opts.seriesId) {
      series = await db.series.findUnique({ where: { id: opts.seriesId } });
      if (!series) throw new IngestError("La serie seleccionada no existe");
    } else {
      const title = opts.newSeriesTitle?.trim();
      if (!title) throw new IngestError("Falta el título de la serie");
      const slug = slugify(title);
      series = await db.series.findUnique({ where: { slug } });
      if (!series) {
        series = await db.series.create({
          data: { title, slug, type: opts.seriesType === "adult" ? "adult" : "normal" },
        });
      }
    }

    // ── 5. Detección de duplicados ───────────────────────────────────────
    const sameNumber = await db.chapter.findFirst({
      where: { seriesId: series.id, number: opts.chapterNumber },
    });
    if (sameNumber) {
      throw new IngestError(
        `La serie "${series.title}" ya tiene un capítulo ${opts.chapterNumber}`
      );
    }

    const candidate = await db.page.findFirst({
      where: { checksumSha256: pages[0].checksum, chapter: { seriesId: series.id } },
      select: { chapterId: true },
    });
    if (candidate) {
      const existing = await db.page.findMany({
        where: { chapterId: candidate.chapterId },
        orderBy: { pageNumber: "asc" },
        select: { checksumSha256: true },
      });
      const identical =
        existing.length === pages.length &&
        existing.every((p, i) => p.checksumSha256 === pages[i].checksum);
      if (identical) {
        const dupChapter = await db.chapter.findUnique({ where: { id: candidate.chapterId } });
        throw new IngestError(
          `Capítulo duplicado: el mismo contenido ya fue subido como capítulo ${dupChapter?.number ?? "?"}`
        );
      }
    }

    // ── 6. Copiar páginas byte a byte al almacenamiento {serie}/{capitulo}/ ──
    const folder = chapterFolderName(opts.chapterNumber);
    chapterPrefix = [series.slug, folder].join("/");

    const pageRows: {
      pageNumber: number;
      filePath: string;
      width: number;
      height: number;
      fileSizeBytes: number;
      checksumSha256: string;
    }[] = [];

    for (let i = 0; i < pages.length; i++) {
      const fileName = String(i + 1).padStart(4, "0") + pages[i].ext;

      // sharp solo lee metadatos acá — nunca modifica la página original
      let width = 0;
      let height = 0;
      try {
        const meta = await sharp(pages[i].data).metadata();
        width = meta.width ?? 0;
        height = meta.height ?? 0;
      } catch {
        throw new IngestError(`La página "${pages[i].name}" está corrupta o no es una imagen válida`);
      }

      const key = [chapterPrefix, fileName].join("/");
      await storage.putObject(key, pages[i].data, contentTypeFor(fileName) ?? "application/octet-stream");

      pageRows.push({
        pageNumber: i + 1,
        filePath: key,
        width,
        height,
        fileSizeBytes: pages[i].data.length,
        checksumSha256: pages[i].checksum,
      });
    }

    // ── 7. Miniatura de portada (solo si la serie no tiene) ──────────────
    let coverImagePath = series.coverImagePath;
    if (!coverImagePath) {
      const coverBuffer = await sharp(pages[0].data)
        .resize({ width: 480, withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
      coverKey = [series.slug, "cover.jpg"].join("/");
      await storage.putObject(coverKey, coverBuffer, "image/jpeg");
      coverImagePath = coverKey;
    }

    // ── 8. Publicar en la base (transacción) ─────────────────────────────
    const chapter = await db.$transaction(async (tx) => {
      const ch = await tx.chapter.create({
        data: {
          seriesId: series.id,
          number: opts.chapterNumber,
          title: opts.chapterTitle?.trim() || null,
          sourceZipName: opts.originalFilename,
          pageCount: pageRows.length,
        },
      });
      await tx.page.createMany({
        data: pageRows.map((p) => ({ ...p, chapterId: ch.id })),
      });
      await tx.series.update({
        where: { id: series.id },
        data: { coverImagePath },
      });
      return ch;
    });

    await db.ingestionJob.update({
      where: { id: jobId },
      data: {
        status: "success",
        seriesId: series.id,
        chapterId: chapter.id,
        finishedAt: new Date(),
      },
    });
  } catch (err) {
    // revertir archivos ya copiados antes de marcar el error (docs/04 §4.5)
    if (chapterPrefix) await storage.deletePrefix(chapterPrefix).catch(() => {});
    if (coverKey) await storage.deleteObject(coverKey).catch(() => {});

    const message =
      err instanceof IngestError ? err.message : "Error interno durante la ingesta";
    if (!(err instanceof IngestError)) console.error("[ingesta] job", jobId, err);

    await db.ingestionJob
      .update({
        where: { id: jobId },
        data: { status: "error", errorMessage: message, finishedAt: new Date() },
      })
      .catch(() => {});
  }
}
