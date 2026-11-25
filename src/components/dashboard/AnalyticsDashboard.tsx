"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, buttonStyles } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Feedback";

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
  tioanime: "TioAnime",
  mundodonghua: "MundoDonghua",
  hentaitv: "HentaiTV",
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
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  // Caché de sesión por período: navegar entre semanas/meses ya vistos no vuelve a invocar Vercel.
  const cacheRef = useRef<Map<string, DashboardData>>(new Map());

  const load = useCallback(
    async ({ silent = false, force = false }: { silent?: boolean; force?: boolean } = {}) => {
      const key = `${range}:${offset}`;
      const cached = cacheRef.current.get(key);
      if (!force && cached) {
        setData(cached);
        setLoading(false);
        setError("");
        return;
      }

      if (!silent) setLoading(true);
      else setRefreshing(true);
      setError("");
      try {
        const response = await fetch(
          `/api/admin/analiticas?range=${range}&offset=${offset}${force ? "&fresh=1" : ""}`,
          { cache: "no-store" }
        );
        if (!response.ok) throw new Error("No se pudieron cargar las analíticas");
        const next = (await response.json()) as DashboardData;
        cacheRef.current.set(key, next);
        setData(next);
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
  }, [load]);

  // Refresco automático opcional (desactivado por defecto para 0 consumo en reposo).
  // Cuando se activa, solo refresca cada 60 s si está en el período actual y la pestaña es visible.
  useEffect(() => {
    if (!autoRefresh || offset !== 0) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void load({ silent: true, force: true });
      }
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, load, offset]);

  const exportQuery = useMemo(() => `range=${range}&offset=${offset}`, [offset, range]);

  const avgOpensPerVisitor =
    data && data.kpis.uniqueVisitors > 0
      ? (data.kpis.contentOpens / data.kpis.uniqueVisitors).toFixed(1)
      : "0.0";

  return (
    <div className="space-y-6">
      {/* Barra de controles */}
      <div className="flex flex-col gap-3 rounded-xl border border-line bg-panel p-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-line bg-[var(--surface-soft)] p-0.5">
            {(["week", "month"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setRange(r);
                  setOffset(0);
                }}
                className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                  range === r
                    ? "bg-accent text-[var(--on-accent)]"
                    : "text-subtle hover:text-ink"
                }`}
              >
                {r === "week" ? "Semanal" : "Mensual"}
              </button>
            ))}
          </div>

          <div className="inline-flex items-center overflow-hidden rounded-lg border border-line bg-[var(--surface-soft)]">
            <button
              type="button"
              onClick={() => setOffset((current) => current + 1)}
              className="px-3 py-1.5 text-xs font-semibold text-subtle transition-colors hover:bg-[var(--surface-raised)] hover:text-ink"
            >
              ← Anterior
            </button>
            <span className="border-x border-line px-3 py-1.5 font-mono text-[11px] text-ink">
              {data?.period.label ?? "Cargando…"}
            </span>
            <button
              type="button"
              disabled={offset === 0}
              onClick={() => setOffset((current) => Math.max(0, current - 1))}
              className="px-3 py-1.5 text-xs font-semibold text-subtle transition-colors hover:bg-[var(--surface-raised)] hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              Siguiente →
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {offset === 0 && (
            <button
              type="button"
              onClick={() => setAutoRefresh((v) => !v)}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors ${
                autoRefresh
                  ? "border-success/50 bg-success/10 text-success"
                  : "border-line bg-[var(--surface-soft)] text-subtle hover:border-line-strong hover:text-ink"
              }`}
              title="Activar o pausar el refresco automático cada 60 segundos"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${autoRefresh ? "animate-pulse bg-success" : "bg-faint"}`}
              />
              {autoRefresh ? "Auto 60s: ON" : "Auto: OFF"}
            </button>
          )}
          <a
            href={`/api/admin/analiticas/exportar?${exportQuery}`}
            className={buttonStyles({ variant: "secondary", size: "sm", className: "rounded-lg text-xs" })}
          >
            CSV Power BI
          </a>
          <a
            href="/api/admin/analiticas/exportar?dataset=realtime"
            className={buttonStyles({ variant: "secondary", size: "sm", className: "rounded-lg text-xs" })}
          >
            CSV en vivo
          </a>
          <Button
            size="sm"
            variant="primary"
            className="rounded-lg text-xs"
            onClick={() => void load({ silent: Boolean(data), force: true })}
            disabled={refreshing}
          >
            {refreshing ? "Actualizando…" : "↻ Actualizar"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/50 bg-danger/10 p-4 text-sm text-danger">
          <span>{error}</span>
          <Button size="sm" onClick={() => void load({ force: true })}>
            Reintentar
          </Button>
        </div>
      )}

      {loading && !data ? (
        <LoadingDashboard />
      ) : data ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-subtle">
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-accent-ink">
              {data.period.range === "week" ? "Corte semanal" : "Corte mensual"} · {data.period.timeZone}
            </span>
            <span className="font-mono text-[11px] text-faint">
              Actualizado {hora(data.generatedAt)} ·{" "}
              {autoRefresh && offset === 0 ? "refresco cada 60 s" : "refresco manual (bajo consumo)"}
            </span>
          </div>

          {/* KPIs */}
          <section className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
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
              detail={`${avgOpensPerVisitor} aperturas por visitante`}
            />
            <Kpi
              value={data.kpis.sourcesUsed}
              label="Fuentes activas"
              detail="Con consumo real en el período"
            />
          </section>

          {/* Gráfica principal + En vivo */}
          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.75fr)]">
            <div className="min-w-0 rounded-xl border border-line bg-panel p-5 sm:p-6">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-ink">Curva de actividad</h2>
                  <p className="mt-1 text-xs text-subtle">
                    {metric === "opens" ? "Capítulos y episodios abiertos por día" : "Visitantes únicos por día"} · pasá el cursor para ver el detalle
                  </p>
                </div>
                <div className="inline-flex rounded-lg border border-line bg-[var(--surface-soft)] p-0.5">
                  <button
                    type="button"
                    onClick={() => setMetric("opens")}
                    className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                      metric === "opens"
                        ? "bg-[var(--accent-soft)] text-accent-ink"
                        : "text-subtle hover:text-ink"
                    }`}
                  >
                    Aperturas
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetric("visitors")}
                    className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                      metric === "visitors"
                        ? "bg-[var(--accent-soft)] text-accent-ink"
                        : "text-subtle hover:text-ink"
                    }`}
                  >
                    Visitantes
                  </button>
                </div>
              </div>
              <ActivityChart data={data.activity} metric={metric} />
            </div>

            <div className="rounded-xl border border-line bg-panel p-5 sm:p-6">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xl font-bold text-ink">En vivo</h2>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-success">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
                  {numero.format(data.kpis.activeNow)} activos
                </span>
              </div>
              <p className="mt-1 text-xs text-subtle">
                Distribución en tiempo real por sección y fuente.
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
            </div>
          </section>

          {/* Ranking de fuentes + Plataformas */}
          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
            <div className="rounded-xl border border-line bg-panel p-5 sm:p-6">
              <h2 className="text-xl font-bold text-ink">Fuentes más usadas</h2>
              <p className="mt-1 text-xs text-subtle">
                Ranking por aperturas y visitantes únicos del período.
              </p>
              <SourceRanking rows={data.sources} />
            </div>

            <div className="rounded-xl border border-line bg-panel p-5 sm:p-6">
              <h2 className="text-xl font-bold text-ink">Plataformas</h2>
              <p className="mt-1 text-xs text-subtle">Distribución por aplicación.</p>
              <PlatformBreakdown rows={data.platforms} total={data.kpis.contentOpens} />
            </div>
          </section>

          {/* Exportación Power BI */}
          <div className="grid gap-4 rounded-xl border border-line bg-panel p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-accent-ink">
                Dataset Power BI
              </p>
              <h2 className="mt-1 text-xl font-bold text-ink">
                Exportación tabular lista para importar
              </h2>
              <p className="mt-1.5 max-w-3xl text-sm leading-6 text-subtle">
                El CSV separa fecha, fuente y plataforma con aperturas y visitantes únicos. El
                historial permanece en PostgreSQL sin perder cortes anteriores.
              </p>
            </div>
            <a
              href={`/api/admin/analiticas/exportar?${exportQuery}`}
              className={buttonStyles({ variant: "primary", className: "rounded-lg" })}
            >
              Descargar período (.csv)
            </a>
          </div>

          <p className="text-center font-mono text-[11px] tracking-[0.1em] text-faint">
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
    <div className="rounded-xl border border-line bg-panel p-5 transition-colors hover:border-line-strong">
      <div className="flex items-center gap-2">
        {live && <span className="h-2 w-2 animate-pulse rounded-full bg-success" />}
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-subtle">
          {label}
        </p>
      </div>
      <p className="mt-3 font-display text-4xl font-bold leading-none tabular-nums text-ink">
        {numero.format(value)}
      </p>
      <p className="mt-2.5 text-xs text-faint">{detail}</p>
    </div>
  );
}

function ActivityChart({
  data,
  metric,
}: {
  data: DashboardData["activity"];
  metric: Metric;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const width = 760;
  const height = 250;
  const left = 46;
  const top = 18;
  const bottom = 36;
  const right = 18;
  const innerWidth = width - left - right;
  const innerHeight = height - top - bottom;
  const values = data.map((row) => row[metric]);
  const maximum = Math.max(1, ...values);
  const points = values.map((value, index) => ({
    x: left + (data.length <= 1 ? innerWidth / 2 : (index / (data.length - 1)) * innerWidth),
    y: top + innerHeight - (value / maximum) * innerHeight,
    value,
    opens: data[index]?.opens ?? 0,
    visitors: data[index]?.visitors ?? 0,
    date: data[index]?.date ?? "",
  }));
  const line = points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
  const area = points.length
    ? `${line} L ${points.at(-1)?.x} ${top + innerHeight} L ${points[0].x} ${top + innerHeight} Z`
    : "";

  if (data.length === 0) return <EmptyChart text="Todavía no hay actividad en este período." />;

  const activePoint = hoveredIdx !== null ? points[hoveredIdx] : null;

  return (
    <div className="space-y-3">
      <div className="flex min-h-7 items-center justify-between rounded-lg border border-line/70 bg-[var(--surface-soft)] px-3 py-1.5 text-xs">
        {activePoint ? (
          <>
            <span className="font-mono font-semibold text-ink">{fechaCorta(activePoint.date)}</span>
            <span className="flex items-center gap-4 font-mono tabular-nums">
              <span className="text-accent-ink">{numero.format(activePoint.opens)} aperturas</span>
              <span className="text-subtle">{numero.format(activePoint.visitors)} visitantes</span>
            </span>
          </>
        ) : (
          <span className="text-faint">Seleccioná o pasá por un punto para inspeccionar el día.</span>
        )}
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="min-w-[580px] overflow-visible"
          role="img"
          aria-label={`${metric === "opens" ? "Aperturas" : "Visitantes únicos"} por día`}
          onMouseLeave={() => setHoveredIdx(null)}
        >
          <defs>
            <linearGradient id="analytics-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.34" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 0.5, 1].map((ratio) => {
            const y = top + innerHeight - ratio * innerHeight;
            return (
              <g key={ratio}>
                <line
                  x1={left}
                  x2={width - right}
                  y1={y}
                  y2={y}
                  stroke="var(--border)"
                  strokeDasharray={ratio === 0 ? undefined : "4 4"}
                />
                <text x={left - 10} y={y + 4} textAnchor="end" fill="var(--muted)" fontSize="10">
                  {numero.format(Math.round(maximum * ratio))}
                </text>
              </g>
            );
          })}

          {activePoint && (
            <line
              x1={activePoint.x}
              x2={activePoint.x}
              y1={top}
              y2={top + innerHeight}
              stroke="var(--accent-fg)"
              strokeOpacity="0.45"
              strokeDasharray="3 3"
            />
          )}

          <path d={area} fill="url(#analytics-area)" />
          <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.75" strokeLinejoin="round" />

          {points.map((point, index) => {
            const isHovered = hoveredIdx === index;
            return (
              <g
                key={point.date}
                onMouseEnter={() => setHoveredIdx(index)}
                onClick={() => setHoveredIdx(index)}
                className="cursor-pointer"
              >
                <circle cx={point.x} cy={point.y} r="14" fill="transparent" />
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={isHovered ? "5.5" : "3.5"}
                  fill="var(--bg)"
                  stroke={isHovered ? "var(--accent-fg)" : "var(--accent)"}
                  strokeWidth={isHovered ? "3" : "2.5"}
                >
                  <title>{`${fechaCorta(point.date)}: ${numero.format(point.value)}`}</title>
                </circle>
                {(data.length <= 8 || index % 5 === 0 || index === data.length - 1) && (
                  <text
                    x={point.x}
                    y={height - 10}
                    textAnchor={index === 0 ? "start" : index === data.length - 1 ? "end" : "middle"}
                    fill={isHovered ? "var(--fg)" : "var(--muted)"}
                    fontSize="10"
                  >
                    {fechaCorta(point.date)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function SourceRanking({ rows }: { rows: DashboardData["sources"] }) {
  if (rows.length === 0) return <EmptyChart text="Aún no hay aperturas registradas." />;
  const maximum = Math.max(...rows.map((row) => row.opens), 1);
  return (
    <div className="mt-5 space-y-4">
      {rows.map((row, idx) => (
        <div key={row.source} className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md font-mono text-[10px] font-bold ${
                  idx === 0
                    ? "bg-[var(--accent-soft)] text-accent-ink"
                    : "bg-[var(--surface-soft)] text-faint"
                }`}
              >
                {idx + 1}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">
                  {SOURCE_LABELS[row.source] ?? row.source}
                </p>
                <p className="font-mono text-[10px] text-faint">
                  {numero.format(row.visitors)} visitantes
                </p>
              </div>
            </div>
            <p className="shrink-0 font-mono text-xs tabular-nums text-accent-ink">
              {numero.format(row.opens)} · {Math.round(row.share * 100)}%
            </p>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-raised)]">
            <div
              className="h-full rounded-full bg-accent transition-all"
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
    <div className="mt-5 space-y-4">
      {rows.map((row) => {
        const pct = total ? Math.round((row.opens / total) * 100) : 0;
        return (
          <div
            key={row.platform}
            className="rounded-lg border border-line/70 bg-[var(--surface-soft)] p-3.5"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-ink">
                {PLATFORM_LABELS[row.platform] ?? row.platform}
              </span>
              <span className="font-mono text-xs tabular-nums text-accent-ink">
                {numero.format(row.opens)} ({pct}%)
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-raised)]">
              <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 font-mono text-[11px] text-faint">
              {numero.format(row.visitors)} visitantes únicos
            </p>
          </div>
        );
      })}
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
    <div className="mt-5 border-t border-line/70 pt-4">
      <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-faint">
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="mt-2.5 text-xs text-subtle">{empty}</p>
      ) : (
        <div className="mt-3 space-y-2.5">
          {rows.slice(0, 7).map((row) => (
            <div key={row.key}>
              <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                <span className="text-ink">{labels[row.key] ?? row.key}</span>
                <span className="font-mono tabular-nums text-accent-ink">{row.users}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-raised)]">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${Math.max(4, (row.users / Math.max(total, 1)) * 100)}%` }}
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
    <div className="mt-5 grid min-h-44 place-items-center rounded-xl border border-dashed border-line p-6 text-center text-sm text-subtle">
      {text}
    </div>
  );
}

function LoadingDashboard() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-32 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
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
