import { NextRequest, NextResponse } from "next/server";
import { getSessionAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { MAX_ZIP_BYTES, processZip, type IngestOptions } from "@/lib/ingest";

/**
 * POST /api/admin/upload — multipart/form-data:
 *   file (zip), seriesId? | newSeriesTitle?, type?, chapterNumber, chapterTitle?
 * Responde 202 { jobId } y procesa en segundo plano (docs/05 §5.4).
 */
export async function POST(req: NextRequest) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Se esperaba multipart/form-data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".zip")) {
    return NextResponse.json({ error: "Solo se aceptan archivos .zip" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "El archivo está vacío" }, { status: 400 });
  }
  if (file.size > MAX_ZIP_BYTES) {
    return NextResponse.json(
      { error: `El zip supera el tamaño máximo (${Math.round(MAX_ZIP_BYTES / 1024 / 1024)} MB)` },
      { status: 400 }
    );
  }

  const chapterNumber = parseFloat(String(form.get("chapterNumber") ?? ""));
  if (!Number.isFinite(chapterNumber) || chapterNumber < 0) {
    return NextResponse.json({ error: "Número de capítulo inválido" }, { status: 400 });
  }

  const seriesIdRaw = String(form.get("seriesId") ?? "").trim();
  const seriesId = seriesIdRaw ? parseInt(seriesIdRaw, 10) : undefined;
  const newSeriesTitle = String(form.get("newSeriesTitle") ?? "").trim() || undefined;
  const typeRaw = String(form.get("type") ?? "").trim();
  const chapterTitle = String(form.get("chapterTitle") ?? "").trim() || undefined;

  if (!seriesId && !newSeriesTitle) {
    return NextResponse.json(
      { error: "Elegí una serie existente o escribí el título de una nueva" },
      { status: 400 }
    );
  }

  const opts: IngestOptions = {
    seriesId,
    newSeriesTitle,
    seriesType: typeRaw === "adult" ? "adult" : "normal",
    chapterNumber,
    chapterTitle,
    originalFilename: file.name,
  };

  const job = await db.ingestionJob.create({
    data: { originalFilename: file.name, status: "pending" },
  });

  const buffer = Buffer.from(await file.arrayBuffer());

  // procesamiento asíncrono: el frontend hace polling del jobId
  processZip(job.id, buffer, opts).catch((err) => {
    console.error("[ingesta] error no capturado, job", job.id, err);
  });

  return NextResponse.json({ jobId: job.id }, { status: 202 });
}

/** GET /api/admin/upload?limit=50 — historial de ingestas para el dashboard. */
export async function GET(req: NextRequest) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "50", 10) || 50, 200);

  const jobs = await db.ingestionJob.findMany({
    orderBy: { startedAt: "desc" },
    take: limit,
    include: {
      series: { select: { title: true, slug: true } },
      chapter: { select: { number: true } },
    },
  });

  return NextResponse.json(
    jobs.map((j) => ({
      id: j.id,
      original_filename: j.originalFilename,
      status: j.status,
      error_message: j.errorMessage,
      series: j.series ? { title: j.series.title, slug: j.series.slug } : null,
      chapter_number: j.chapter?.number ?? null,
      started_at: j.startedAt,
      finished_at: j.finishedAt,
    }))
  );
}
