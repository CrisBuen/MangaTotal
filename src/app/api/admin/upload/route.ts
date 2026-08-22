import { del, get } from "@vercel/blob";
import { NextRequest, NextResponse, after } from "next/server";
import { getSessionAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { MAX_ZIP_BYTES, processZip, type IngestOptions } from "@/lib/ingest";

// tiempo extra para procesar el zip tras responder (Vercel, ver after())
export const maxDuration = 300;

/**
 * POST /api/admin/upload — multipart/form-data:
 *   file (zip), seriesId? | newSeriesTitle?, type?, chapterNumber, chapterTitle?
 * Responde 202 { jobId } y procesa en segundo plano (docs/05 §5.4).
 */
export async function POST(req: NextRequest) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  // dos modos: multipart clásico (dev/local), o JSON con la clave de un zip
  // ya subido directo a Vercel Blob (evita el límite de body de ~4.5 MB)
  const isJson = (req.headers.get("content-type") ?? "").includes("application/json");

  let buffer: Buffer;
  let originalFilename: string;
  let tempBlobKey: string | null = null;
  let fields: {
    seriesId?: string;
    newSeriesTitle?: string;
    type?: string;
    chapterNumber?: string;
    chapterTitle?: string;
  };

  if (isJson) {
    let body: { blobPathname?: string; originalFilename?: string } & typeof fields;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Body inválido" }, { status: 400 });
    }
    const pathname = String(body.blobPathname ?? "");
    if (!pathname.startsWith("_uploads/") || pathname.includes("..")) {
      return NextResponse.json({ error: "Clave de blob inválida" }, { status: 400 });
    }
    originalFilename = String(body.originalFilename ?? "").trim() || "capitulo.zip";
    fields = body;

    try {
      const result = await get(pathname, { access: "private" });
      if (!result.stream) throw new Error("sin contenido");
      buffer = Buffer.from(await new Response(result.stream).arrayBuffer());
    } catch {
      return NextResponse.json({ error: "No se pudo leer el zip subido" }, { status: 400 });
    }
    tempBlobKey = pathname;
  } else {
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
    originalFilename = file.name;
    fields = {
      seriesId: String(form.get("seriesId") ?? ""),
      newSeriesTitle: String(form.get("newSeriesTitle") ?? ""),
      type: String(form.get("type") ?? ""),
      chapterNumber: String(form.get("chapterNumber") ?? ""),
      chapterTitle: String(form.get("chapterTitle") ?? ""),
    };
    buffer = Buffer.from(await file.arrayBuffer());
  }

  if (buffer.length === 0) {
    return NextResponse.json({ error: "El archivo está vacío" }, { status: 400 });
  }
  if (buffer.length > MAX_ZIP_BYTES) {
    return NextResponse.json(
      { error: `El zip supera el tamaño máximo (${Math.round(MAX_ZIP_BYTES / 1024 / 1024)} MB)` },
      { status: 400 }
    );
  }

  const chapterNumber = parseFloat(String(fields.chapterNumber ?? "").trim());
  if (!Number.isFinite(chapterNumber) || chapterNumber < 0) {
    return NextResponse.json({ error: "Número de capítulo inválido" }, { status: 400 });
  }

  const seriesIdRaw = String(fields.seriesId ?? "").trim();
  const seriesId = seriesIdRaw ? parseInt(seriesIdRaw, 10) : undefined;
  const newSeriesTitle = String(fields.newSeriesTitle ?? "").trim() || undefined;
  const typeRaw = String(fields.type ?? "").trim();
  const chapterTitle = String(fields.chapterTitle ?? "").trim() || undefined;

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
    originalFilename,
  };

  const job = await db.ingestionJob.create({
    data: { originalFilename, status: "pending" },
  });

  // procesamiento asíncrono: el frontend hace polling del jobId.
  // after() mantiene viva la función serverless hasta terminar (Vercel).
  after(
    processZip(job.id, buffer, opts)
      .catch((err) => {
        console.error("[ingesta] error no capturado, job", job.id, err);
      })
      .finally(async () => {
        // el zip temporal en _uploads/ ya no hace falta
        if (tempBlobKey) await del(tempBlobKey).catch(() => {});
      })
  );

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
