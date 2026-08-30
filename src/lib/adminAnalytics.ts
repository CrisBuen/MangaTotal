import { Prisma } from "@prisma/client";
import { db } from "./db";

export const ANALYTICS_TIME_ZONE = "America/Santiago";
export const REALTIME_WINDOW_SECONDS = 120;

export type AnalyticsRange = "week" | "month";

export interface AnalyticsPeriod {
  range: AnalyticsRange;
  offset: number;
  start: string;
  end: string;
  label: string;
  isCurrent: boolean;
  timeZone: string;
}

interface PeriodRow {
  start: Date;
  end: Date;
}

interface SummaryRow {
  opens: number;
  visitors: number;
}

interface DailyRow {
  date: string;
  opens: number;
  visitors: number;
}

interface SourceRow {
  source: string;
  opens: number;
  visitors: number;
}

interface PlatformRow {
  platform: string;
  opens: number;
  visitors: number;
}

interface ActiveRow {
  key: string;
  users: number;
}

export interface PowerBiRow {
  date: string;
  source: string;
  platform: string;
  opens: number;
  visitors: number;
}

function clampOffset(raw: number): number {
  if (!Number.isFinite(raw)) return 0;
  return Math.min(104, Math.max(0, Math.trunc(raw)));
}

export function parseAnalyticsRange(value: string | null): AnalyticsRange {
  return value === "month" ? "month" : "week";
}

export function parseAnalyticsOffset(value: string | null): number {
  return clampOffset(Number(value ?? 0));
}

function etiquetaPeriodo(start: Date, end: Date): string {
  const formato = new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: ANALYTICS_TIME_ZONE,
  });
  return `${formato.format(start)} — ${formato.format(new Date(end.getTime() - 1))}`;
}

export async function getAnalyticsPeriod(
  range: AnalyticsRange,
  rawOffset: number
): Promise<{ period: AnalyticsPeriod; start: Date; end: Date }> {
  const offset = clampOffset(rawOffset);
  const query =
    range === "week"
      ? Prisma.sql`
          SELECT
            (
              date_trunc('week', now() AT TIME ZONE ${ANALYTICS_TIME_ZONE})
              - (${offset}::integer * interval '1 week')
            ) AT TIME ZONE ${ANALYTICS_TIME_ZONE} AS "start",
            (
              date_trunc('week', now() AT TIME ZONE ${ANALYTICS_TIME_ZONE})
              - (${offset}::integer * interval '1 week')
              + interval '1 week'
            ) AT TIME ZONE ${ANALYTICS_TIME_ZONE} AS "end"
        `
      : Prisma.sql`
          SELECT
            (
              date_trunc('month', now() AT TIME ZONE ${ANALYTICS_TIME_ZONE})
              - (${offset}::integer * interval '1 month')
            ) AT TIME ZONE ${ANALYTICS_TIME_ZONE} AS "start",
            (
              date_trunc('month', now() AT TIME ZONE ${ANALYTICS_TIME_ZONE})
              - (${offset}::integer * interval '1 month')
              + interval '1 month'
            ) AT TIME ZONE ${ANALYTICS_TIME_ZONE} AS "end"
        `;

  const [row] = await db.$queryRaw<PeriodRow[]>(query);
  if (!row) throw new Error("No se pudo calcular el período de analíticas");

  return {
    start: row.start,
    end: row.end,
    period: {
      range,
      offset,
      start: row.start.toISOString(),
      end: row.end.toISOString(),
      label: etiquetaPeriodo(row.start, row.end),
      isCurrent: offset === 0,
      timeZone: ANALYTICS_TIME_ZONE,
    },
  };
}

export async function getAnalyticsSnapshot(range: AnalyticsRange, rawOffset: number) {
  const { period, start, end } = await getAnalyticsPeriod(range, rawOffset);
  const activeSince = new Date(Date.now() - REALTIME_WINDOW_SECONDS * 1000);

  const [
    summaryRows,
    dailyRows,
    sourceRows,
    platformRows,
    activeTotal,
    activeSections,
    activeSources,
  ] = await Promise.all([
    db.$queryRaw<SummaryRow[]>(Prisma.sql`
      SELECT
        COUNT(*)::integer AS "opens",
        COUNT(DISTINCT "visitor_id")::integer AS "visitors"
      FROM "analytics_events"
      WHERE "event_type" = 'content_open'
        AND "occurred_at" >= (${start}::timestamptz AT TIME ZONE 'UTC')
        AND "occurred_at" < (${end}::timestamptz AT TIME ZONE 'UTC')
    `),
    db.$queryRaw<DailyRow[]>(Prisma.sql`
      WITH "days" AS (
        SELECT generate_series(
          (${start}::timestamptz AT TIME ZONE ${ANALYTICS_TIME_ZONE})::date,
          ((${end}::timestamptz - interval '1 millisecond') AT TIME ZONE ${ANALYTICS_TIME_ZONE})::date,
          interval '1 day'
        )::date AS "day"
      ),
      "activity" AS (
        SELECT
          (("occurred_at" AT TIME ZONE 'UTC') AT TIME ZONE ${ANALYTICS_TIME_ZONE})::date AS "day",
          COUNT(*)::integer AS "opens",
          COUNT(DISTINCT "visitor_id")::integer AS "visitors"
        FROM "analytics_events"
        WHERE "event_type" = 'content_open'
          AND "occurred_at" >= (${start}::timestamptz AT TIME ZONE 'UTC')
          AND "occurred_at" < (${end}::timestamptz AT TIME ZONE 'UTC')
        GROUP BY 1
      )
      SELECT
        to_char("days"."day", 'YYYY-MM-DD') AS "date",
        COALESCE("activity"."opens", 0)::integer AS "opens",
        COALESCE("activity"."visitors", 0)::integer AS "visitors"
      FROM "days"
      LEFT JOIN "activity" USING ("day")
      ORDER BY "days"."day"
    `),
    db.$queryRaw<SourceRow[]>(Prisma.sql`
      SELECT
        "source",
        COUNT(*)::integer AS "opens",
        COUNT(DISTINCT "visitor_id")::integer AS "visitors"
      FROM "analytics_events"
      WHERE "event_type" = 'content_open'
        AND "occurred_at" >= (${start}::timestamptz AT TIME ZONE 'UTC')
        AND "occurred_at" < (${end}::timestamptz AT TIME ZONE 'UTC')
        AND "source" IS NOT NULL
      GROUP BY "source"
      ORDER BY "opens" DESC, "source" ASC
    `),
    db.$queryRaw<PlatformRow[]>(Prisma.sql`
      SELECT
        "platform",
        COUNT(*)::integer AS "opens",
        COUNT(DISTINCT "visitor_id")::integer AS "visitors"
      FROM "analytics_events"
      WHERE "event_type" = 'content_open'
        AND "occurred_at" >= (${start}::timestamptz AT TIME ZONE 'UTC')
        AND "occurred_at" < (${end}::timestamptz AT TIME ZONE 'UTC')
      GROUP BY "platform"
      ORDER BY "opens" DESC, "platform" ASC
    `),
    db.analyticsPresence.count({ where: { lastSeen: { gte: activeSince } } }),
    db.$queryRaw<ActiveRow[]>(Prisma.sql`
      SELECT "section" AS "key", COUNT(*)::integer AS "users"
      FROM "analytics_presence"
      WHERE "last_seen" >= (${activeSince}::timestamptz AT TIME ZONE 'UTC')
      GROUP BY "section"
      ORDER BY "users" DESC, "section" ASC
    `),
    db.$queryRaw<ActiveRow[]>(Prisma.sql`
      SELECT "source" AS "key", COUNT(*)::integer AS "users"
      FROM "analytics_presence"
      WHERE "last_seen" >= (${activeSince}::timestamptz AT TIME ZONE 'UTC')
        AND "source" IS NOT NULL
      GROUP BY "source"
      ORDER BY "users" DESC, "source" ASC
    `),
  ]);

  const summary = summaryRows[0] ?? { opens: 0, visitors: 0 };
  return {
    generatedAt: new Date().toISOString(),
    realtimeWindowSeconds: REALTIME_WINDOW_SECONDS,
    period,
    kpis: {
      activeNow: activeTotal,
      uniqueVisitors: summary.visitors,
      contentOpens: summary.opens,
      sourcesUsed: sourceRows.length,
    },
    activity: dailyRows,
    sources: sourceRows.map((row) => ({
      ...row,
      share: summary.opens > 0 ? row.opens / summary.opens : 0,
    })),
    platforms: platformRows,
    realtime: {
      sections: activeSections,
      sources: activeSources,
    },
  };
}

export async function getPowerBiRows(
  range: AnalyticsRange,
  rawOffset: number
): Promise<{ period: AnalyticsPeriod; rows: PowerBiRow[] }> {
  const { period, start, end } = await getAnalyticsPeriod(range, rawOffset);
  const rows = await db.$queryRaw<PowerBiRow[]>(Prisma.sql`
    SELECT
      to_char(
        (("occurred_at" AT TIME ZONE 'UTC') AT TIME ZONE ${ANALYTICS_TIME_ZONE})::date,
        'YYYY-MM-DD'
      ) AS "date",
      COALESCE("source", 'sin_fuente') AS "source",
      "platform",
      COUNT(*)::integer AS "opens",
      COUNT(DISTINCT "visitor_id")::integer AS "visitors"
    FROM "analytics_events"
    WHERE "event_type" = 'content_open'
      AND "occurred_at" >= (${start}::timestamptz AT TIME ZONE 'UTC')
      AND "occurred_at" < (${end}::timestamptz AT TIME ZONE 'UTC')
    GROUP BY 1, 2, 3
    ORDER BY 1, 2, 3
  `);
  return { period, rows };
}

export async function getRealtimeRows() {
  const activeSince = new Date(Date.now() - REALTIME_WINDOW_SECONDS * 1000);
  return db.$queryRaw<Array<{ section: string; source: string; platform: string; users: number }>>(
    Prisma.sql`
      SELECT
        "section",
        COALESCE("source", 'sin_fuente') AS "source",
        "platform",
        COUNT(*)::integer AS "users"
      FROM "analytics_presence"
      WHERE "last_seen" >= (${activeSince}::timestamptz AT TIME ZONE 'UTC')
      GROUP BY 1, 2, 3
      ORDER BY "users" DESC, 1, 2, 3
    `
  );
}
