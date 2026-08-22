import { NextRequest, NextResponse } from "next/server";
import { getSessionAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

/** GET /api/admin/upload/:jobId — estado del job, usado para polling. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ jobId: string }> }) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  const { jobId: raw } = await ctx.params;
  const jobId = parseInt(raw, 10);
  if (!Number.isInteger(jobId)) {
    return NextResponse.json({ error: "jobId inválido" }, { status: 400 });
  }

  const job = await db.ingestionJob.findUnique({
    where: { id: jobId },
    include: { series: { select: { slug: true, title: true } } },
  });
  if (!job) return NextResponse.json({ error: "Job no encontrado" }, { status: 404 });

  return NextResponse.json({
    id: job.id,
    status: job.status,
    error_message: job.errorMessage,
    chapterId: job.chapterId,
    series_slug: job.series?.slug ?? null,
    series_title: job.series?.title ?? null,
  });
}
