import { NextRequest, NextResponse } from "next/server";
import {
  ANALYTICS_TIME_ZONE,
  getPowerBiRows,
  getRealtimeRows,
  parseAnalyticsOffset,
  parseAnalyticsRange,
  REALTIME_WINDOW_SECONDS,
} from "@/lib/adminAnalytics";
import { getSessionAdmin } from "@/lib/auth";

function celda(value: string | number): string {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function csv(headers: string[], rows: Array<Array<string | number>>): string {
  return "\uFEFF" + [headers, ...rows].map((row) => row.map(celda).join(",")).join("\r\n");
}

function descarga(contenido: string, nombre: string) {
  return new NextResponse(contenido, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombre}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export const dynamic = "force-dynamic";

/**
 * CSV plano para auditoría o importación directa en Power BI.
 *
 * El archivo del período trae una fila por día, fuente y plataforma; no
 * contiene identificadores individuales ni datos de cuentas.
 */
export async function GET(req: NextRequest) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  const dataset = req.nextUrl.searchParams.get("dataset");
  if (dataset === "realtime") {
    const corte = new Date().toISOString();
    const rows = await getRealtimeRows();
    return descarga(
      csv(
        ["corte_iso", "zona_horaria", "ventana_segundos", "seccion", "fuente", "plataforma", "usuarios_activos"],
        rows.map((row) => [
          corte,
          ANALYTICS_TIME_ZONE,
          REALTIME_WINDOW_SECONDS,
          row.section,
          row.source,
          row.platform,
          row.users,
        ])
      ),
      `mangatotal-tiempo-real-${corte.slice(0, 10)}.csv`
    );
  }

  const range = parseAnalyticsRange(req.nextUrl.searchParams.get("range"));
  const offset = parseAnalyticsOffset(req.nextUrl.searchParams.get("offset"));
  const { period, rows } = await getPowerBiRows(range, offset);
  const inicio = period.start.slice(0, 10);
  const fin = new Date(new Date(period.end).getTime() - 1).toISOString().slice(0, 10);

  return descarga(
    csv(
      [
        "periodicidad",
        "periodo_inicio",
        "periodo_fin",
        "zona_horaria",
        "fecha",
        "fuente",
        "plataforma",
        "aperturas",
        "visitantes_unicos",
      ],
      rows.map((row) => [
        range === "week" ? "semanal" : "mensual",
        inicio,
        fin,
        period.timeZone,
        row.date,
        row.source,
        row.platform,
        row.opens,
        row.visitors,
      ])
    ),
    `mangatotal-analiticas-${range}-${inicio}.csv`
  );
}
