"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, buttonStyles } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Feedback";
import { Surface } from "@/components/ui/Surface";

type Range = "week" | "month";
type Metric = "opens" | "visitors";

interface DashboardData {
  generatedAt: string;
  realtimeWindowSeconds: number;
  period: {
    range: Range;
    offset: number;
    start: string;
    end: string;
    label: string;
    isCurrent: boolean;
    timeZone: string;
  };
  kpis: {
    activeNow: number;
    uniqueVisitors: number;
    contentOpens: number;
    sourcesUsed: number;
  };
  activity: Array<{ date: string; opens: number; visitors: number }>;
  sources: Array<{
    source: string;
    opens: number;
    visitors: number;
    share: number;
  }>;
  platforms: Array<{ platform: string; opens: number; visitors: number }>;
  realtime: {
    sections: Array<{ key: string; users: number }>;
    sources: Array<{ key: string; users: number }>;
  };
}

const SOURCE_LABELS: Record<string, string> = {
  mangatotal: "MangaTotal",
  mangadex: "MangaDex",
  olympus: "Olympus",
  zonatmo: "ZonaTMO",
  leercapitulo: "LeerCapítulo",
  catharsis: "Catharsis World",
  ikigai: "Ikigai",
  jkanime: "JKAnime",
};

const SECTION_LABELS: Record<string, string> = {
  inicio: "Inicio",
  biblioteca: "Biblioteca",
  explorar: "Explorar",
  anilist: "AniList",
  lectura: "Leyendo",
  anime: "Viendo anime",
  noticias: "Noticias",
  aleatorio: "Aleatorio",
  estadisticas: "Estadísticas",
  perfil: "Perfil",
  ajustes: "Ajustes",
  mas: "Más",
  otros: "Otras páginas",
};

const PLATFORM_LABELS: Record<string, string> = {
  web: "Web",
  android: "Android",
  windows: "Windows",
};

const numero = new Intl.NumberFormat("es-CL");

export function AnalyticsDashboard() {
  const [range, setRange] = useState<Range>("week");
  const [offset, setOffset] = useState(0);
  const [metric, setMetric] = useState<Metric>("opens");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      setError("");
      try {
        const response = await fetch(`/api/admin/analiticas?range=${range}&offset=${offset}`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("No se pudieron cargar las analíticas");
        setData((await response.json()) as DashboardData);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "No se pudieron cargar las analíticas");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [offset, range]
  );

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 15_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const exportQuery = useMemo(
    () => `range=${range}&offset=${offset}`,
    [offset, range]
  );

  return (
    <div className="space-y-6">
      <Surface className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={range === "week" ? "primary" : "secondary"}
            size="sm"
            onClick={() => {
              setRange("week");
              setOffset(0);
            }}
          >
            Semanal
          </Button>
          <Button
            variant={range === "month" ? "primary" : "secondary"}
            size="sm"
            onClick={() => {
              setRange("month");
              setOffset(0);
            }}
          >
            Mensual
          </Button>
          <span className="mx-1 h-7 w-px bg-line" aria-hidden="true" />
          <Button size="sm" onClick={() => setOffset((current) => current + 1)}>
            ← Anterior
          </Button>
          <Button
            size="sm"
            disabled={offset === 0}
            onClick={() => setOffset((current) => Math.max(0, current - 1))}
          >
            Siguiente →
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/api/admin/analiticas/exportar?${exportQuery}`}
            className={buttonStyles({ variant: "secondary", size: "sm" })}
          >
            CSV para Power BI
          </a>
          <a
            href="/api/admin/analiticas/exportar?dataset=realtime"
            className={buttonStyles({ variant: "secondary", size: "sm" })}
          >
            CSV tiempo real
          </a>
          <Button size="sm" onClick={() => void load(true)} disabled={refreshing}>
            {refreshing ? "Actualizando…" : "Actualizar"}
          </Button>
        </div>
      </Surface>

      {error && (
        <Surface className="border-danger p-5 text-sm text-danger">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <Button size="sm" onClick={() => void load()}>
              Reintentar
            </Button>
          </div>
        </Surface>
      )}

      {loading && !data ? (
        <LoadingDashboard />
      ) : data ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-accent">
                {data.period.range === "week" ? "Corte semanal" : "Corte mensual"}
              </p>
              <p className="mt-1 text-sm text-subtle">{data.period.label}</p>
            </div>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-subtle">
              Actualizado {hora(data.generatedAt)} · refresco cada 15 s
            </p>
          </div>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              value={data.kpis.activeNow}
              label="Usuarios ahora"
              detail={`Latido en los últimos ${data.realtimeWindowSeconds} s`}
              live
            />
            <Kpi
              value={data.kpis.uniqueVisitors}
              label="Visitantes únicos"
              detail="Instalaciones distintas en el período"
            />
            <Kpi
              value={data.kpis.contentOpens}
              label="Aperturas"
              detail="Capítulos y episodios abiertos"
            />
            <Kpi
              value={data.kpis.sourcesUsed}
              label="Fuentes usadas"
              detail="Con actividad real en el período"
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]">
            <Surface className="min-w-0 p-5 sm:p-6">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black uppercase text-ink">Actividad</h2>
                  <p className="mt-1 text-sm text-subtle">
                    Aperturas reales por día · {data.period.timeZone}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={metric === "opens" ? "primary" : "secondary"}
                    onClick={() => setMetric("opens")}
                  >
                    Aperturas
                  </Button>
                  <Button
                    size="sm"
                    variant={metric === "visitors" ? "primary" : "secondary"}
                    onClick={() => setMetric("visitors")}
                  >
                    Visitantes
                  </Button>
                </div>
              </div>
              <ActivityChart data={data.activity} metric={metric} />
            </Surface>

            <Surface className="p-5 sm:p-6">
              <h2 className="text-2xl font-black uppercase text-ink">En vivo</h2>
              <p className="mt-1 text-sm text-subtle">
                Distribución de los {numero.format(data.kpis.activeNow)} usuarios activos.
              </p>
              <RealtimeList
                title="Por sección"
                rows={data.realtime.sections}
                labels={SECTION_LABELS}
                total={data.kpis.activeNow}
              />
              <RealtimeList
                title="Leyendo o viendo"
                rows={data.realtime.sources}
                labels={SOURCE_LABELS}
                total={Math.max(
                  1,
                  data.realtime.sources.reduce((sum, row) => sum + row.users, 0)
                )}
                empty="Nadie está leyendo o viendo una fuente ahora."
              />
            </Surface>
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
            <Surface className="p-5 sm:p-6">
              <h2 className="text-2xl font-black uppercase text-ink">Fuentes más usadas</h2>
              <p className="mt-1 text-sm text-subtle">
                Ranking por aperturas; cada fila también muestra visitantes únicos.
              </p>
              <SourceRanking rows={data.sources} />
            </Surface>

            <Surface className="p-5 sm:p-6">
              <h2 className="text-2xl font-black uppercase text-ink">Plataformas</h2>
              <p className="mt-1 text-sm text-subtle">Aperturas del período por aplicación.</p>
              <PlatformBreakdown rows={data.platforms} total={data.kpis.contentOpens} />
            </Surface>
          </section>

          <Surface className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
                Dataset Power BI
              </p>
              <h2 className="mt-2 text-2xl font-black uppercase text-ink">
                Exportación tabular lista para importar
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-subtle">
                El CSV separa fecha, fuente y plataforma e incluye aperturas y visitantes
                únicos. El historial queda en PostgreSQL; cambiar de período no recalcula
                datos ficticios ni elimina cortes anteriores.
              </p>
            </div>
            <a
              href={`/api/admin/analiticas/exportar?${exportQuery}`}
              className={buttonStyles({ variant: "primary" })}
            >
              Descargar período
            </a>
          </Surface>

          <p className="text-center font-mono text-[9px] uppercase tracking-[0.13em] text-subtle">
            Privacidad: conteo anónimo por instalación · sin IP, correo, apodo ni título leído
          </p>
        </>
      ) : null}
    </div>
  );
}

function Kpi({
  value,
  label,
  detail,
  live = false,
}: {
  value: number;
  label: string;
  detail: string;
  live?: boolean;
}) {
  return (
    <Surface className="p-5">
      <div className="flex items-center gap-2">
        {live && <span className="h-2 w-2 animate-pulse rounded-full bg-success" />}
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-subtle">
          {label}
        </p>
      </div>
      <p className="mt-3 font-display text-5xl font-black leading-none tabular-nums text-ink">
        {numero.format(value)}
      </p>
      <p className="mt-3 text-xs leading-5 text-subtle">{detail}</p>
    </Surface>
  );
}

function ActivityChart({
  data,
  metric,
}: {
  data: DashboardData["activity"];
  metric: Metric;
}) {
  const width = 760;
  const height = 260;
  const left = 46;
  const top = 18;
  const bottom = 38;
  const right = 18;
  const innerWidth = width - left - right;
  const innerHeight = height - top - bottom;
  const values = data.map((row) => row[metric]);
  const maximum = Math.max(1, ...values);
  const points = values.map((value, index) => ({
    x: left + (data.length <= 1 ? 0 : (index / (data.length - 1)) * innerWidth),
    y: top + innerHeight - (value / maximum) * innerHeight,
    value,
    date: data[index]?.date ?? "",
  }));
  const line = points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
  const area = points.length
    ? `${line} L ${points.at(-1)?.x} ${top + innerHeight} L ${points[0].x} ${top + innerHeight} Z`
    : "";

  if (data.length === 0) return <EmptyChart text="Todavía no hay actividad en este período." />;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="min-w-[620px] overflow-visible"
        role="img"
        aria-label={`${metric === "opens" ? "Aperturas" : "Visitantes únicos"} por día`}
      >
        <defs>
          <linearGradient id="analytics-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((ratio) => {
          const y = top + innerHeight - ratio * innerHeight;
          return (
            <g key={ratio}>
              <line x1={left} x2={width - right} y1={y} y2={y} stroke="var(--border)" />
              <text x={left - 10} y={y + 4} textAnchor="end" fill="var(--muted)" fontSize="10">
                {numero.format(Math.round(maximum * ratio))}
              </text>
            </g>
          );
        })}
        <path d={area} fill="url(#analytics-area)" />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="3" />
        {points.map((point, index) => (
          <g key={point.date}>
            <circle cx={point.x} cy={point.y} r="4" fill="var(--bg)" stroke="var(--accent)" strokeWidth="3">
              <title>{`${fechaCorta(point.date)}: ${numero.format(point.value)}`}</title>
            </circle>
            {(data.length <= 8 || index % 5 === 0 || index === data.length - 1) && (
              <text
                x={point.x}
                y={height - 10}
                textAnchor={index === 0 ? "start" : index === data.length - 1 ? "end" : "middle"}
                fill="var(--muted)"
                fontSize="10"
              >
                {fechaCorta(point.date)}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

function SourceRanking({ rows }: { rows: DashboardData["sources"] }) {
  if (rows.length === 0) return <EmptyChart text="Aún no hay aperturas registradas." />;
  const maximum = Math.max(...rows.map((row) => row.opens), 1);
  return (
    <div className="mt-6 space-y-5">
      {rows.map((row) => (
        <div key={row.source}>
          <div className="mb-2 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-ink">{SOURCE_LABELS[row.source] ?? row.source}</p>
              <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-subtle">
                {numero.format(row.visitors)} visitantes
              </p>
            </div>
            <p className="font-mono text-xs tabular-nums text-accent">
              {numero.format(row.opens)} · {Math.round(row.share * 100)}%
            </p>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-raised)]">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${Math.max(2, (row.opens / maximum) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function PlatformBreakdown({
  rows,
  total,
}: {
  rows: DashboardData["platforms"];
  total: number;
}) {
  if (rows.length === 0) return <EmptyChart text="Aún no hay plataformas con actividad." />;
  return (
    <div className="mt-6 space-y-4">
      {rows.map((row) => (
        <div key={row.platform} className="border-b border-line pb-4 last:border-0">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-bold text-ink">
              {PLATFORM_LABELS[row.platform] ?? row.platform}
            </span>
            <span className="font-mono text-sm tabular-nums text-accent">
              {numero.format(row.opens)}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-raised)]">
            <div
              className="h-full bg-accent"
              style={{ width: `${total ? (row.opens / total) * 100 : 0}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-subtle">{numero.format(row.visitors)} visitantes únicos</p>
        </div>
      ))}
    </div>
  );
}

function RealtimeList({
  title,
  rows,
  labels,
  total,
  empty = "No hay usuarios activos en este corte.",
}: {
  title: string;
  rows: Array<{ key: string; users: number }>;
  labels: Record<string, string>;
  total: number;
  empty?: string;
}) {
  return (
    <div className="mt-6">
      <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-subtle">
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-subtle">{empty}</p>
      ) : (
        <div className="mt-3 space-y-3">
          {rows.slice(0, 7).map((row) => (
            <div key={row.key}>
              <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                <span className="text-ink">{labels[row.key] ?? row.key}</span>
                <span className="font-mono tabular-nums text-accent">{row.users}</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-[var(--surface-raised)]">
                <div
                  className="h-full bg-accent"
                  style={{ width: `${Math.max(3, (row.users / Math.max(total, 1)) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="mt-6 grid min-h-48 place-items-center rounded-xl border border-dashed border-line p-6 text-center text-sm text-subtle">
      {text}
    </div>
  );
}

function LoadingDashboard() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-36" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    </div>
  );
}

function fechaCorta(date: string): string {
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

function hora(date: string): string {
  return new Intl.DateTimeFormat("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "America/Santiago",
  }).format(new Date(date));
}
