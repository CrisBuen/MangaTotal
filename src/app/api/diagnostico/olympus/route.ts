import { NextResponse } from "next/server";
import { novedades } from "@/lib/olympus";

/** Diagnóstico temporal: ejecuta novedades() y devuelve el error exacto. */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const r = await novedades(1);
    return NextResponse.json({
      ok: true,
      region: process.env.VERCEL_REGION ?? "local",
      page: r.page,
      last_page: r.last_page,
      total: r.total,
      series: r.series.length,
      primera: r.series[0]?.title,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      region: process.env.VERCEL_REGION ?? "local",
      mensaje: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack?.split("\n").slice(0, 4).join(" | ") : null,
    });
  }
}
