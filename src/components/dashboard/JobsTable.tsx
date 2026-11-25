"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";

export interface IngestionJobItem {
  id: number;
  original_filename: string;
  status: string;
  error_message: string | null;
  series: { title: string; slug: string } | null;
  chapter_number: number | null;
  started_at: string;
  finished_at: string | null;
}

type FilterStatus = "all" | "success" | "error" | "active";

const STATUS_META: Record<
  string,
  { label: string; dot: string; badge: string }
> = {
  pending: {
    label: "Pendiente",
    dot: "bg-subtle",
    badge: "border-line bg-[var(--surface-raised)] text-subtle",
  },
  processing: {
    label: "Procesando",
    dot: "bg-warning animate-pulse",
    badge: "border-warning/40 bg-warning/10 text-warning",
  },
  success: {
    label: "Éxito",
    dot: "bg-success",
    badge: "border-success/40 bg-success/10 text-success",
  },
  error: {
    label: "Error",
    dot: "bg-danger",
    badge: "border-danger/40 bg-danger/10 text-danger",
  },
};

/**
 * Historial de ingestas .zip optimizado para no gastar cuota de Vercel:
 * recibe los registros iniciales desde SSR y únicamente hace polling mientras
 * exista alguna ingesta activa (`pending` o `processing`) y la pestaña esté visible.
 */
export function JobsTable({ initialJobs }: { initialJobs?: IngestionJobItem[] }) {
  const [jobs, setJobs] = useState<IngestionJobItem[] | null>(initialJobs ?? null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/admin/upload?limit=50", { cache: "no-store" });
      if (res.ok) setJobs(await res.json());
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Solo consulta al montar si no llegaron datos iniciales por SSR.
  useEffect(() => {
    if (initialJobs === undefined) {
      void load();
    }
  }, [initialJobs, load]);

  const hasActiveJobs = useMemo(
    () => (jobs ?? []).some((j) => j.status === "pending" || j.status === "processing"),
    [jobs]
  );

  // Polling inteligente: solo corre si hay un .zip procesándose ahora mismo
  // y la pestaña está en primer plano (0 invocaciones en reposo).
  useEffect(() => {
    if (!hasActiveJobs) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 6000);
    return () => window.clearInterval(timer);
  }, [hasActiveJobs, load]);

  const counts = useMemo(() => {
    const list = jobs ?? [];
    return {
      all: list.length,
      success: list.filter((j) => j.status === "success").length,
      error: list.filter((j) => j.status === "error").length,
      active: list.filter((j) => j.status === "pending" || j.status === "processing").length,
    };
  }, [jobs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (jobs ?? []).filter((j) => {
      if (filter === "success" && j.status !== "success") return false;
      if (filter === "error" && j.status !== "error") return false;
      if (filter === "active" && j.status !== "pending" && j.status !== "processing") return false;
      if (!q) return true;
      return (
        j.original_filename.toLowerCase().includes(q) ||
        (j.series?.title ?? "").toLowerCase().includes(q) ||
        (j.error_message ?? "").toLowerCase().includes(q)
      );
    });
  }, [filter, jobs, query]);

  if (jobs === null) {
    return (
      <div className="rounded-xl border border-line bg-panel p-8 text-center text-sm text-subtle">
        Cargando historial…
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-panel">
      {/* Barra de controles y filtros client-side (0 llamadas al servidor) */}
      <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: "all", label: "Todos", count: counts.all },
              { id: "success", label: "Éxito", count: counts.success },
              { id: "error", label: "Errores", count: counts.error },
              { id: "active", label: "En curso", count: counts.active },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                filter === tab.id
                  ? "border-accent/60 bg-[var(--accent-soft)] text-accent-ink"
                  : "border-line bg-[var(--surface-soft)] text-subtle hover:border-line-strong hover:text-ink"
              }`}
            >
              <span>{tab.label}</span>
              <span className="font-mono text-[10px] opacity-80">{tab.count}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrar archivo o serie…"
            aria-label="Filtrar ingestas"
            className="min-h-9 w-full rounded-lg border border-line bg-[var(--surface-soft)] px-3 text-xs text-ink placeholder:text-faint focus:border-accent focus:outline-none sm:w-48"
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void load()}
            disabled={refreshing}
            className="shrink-0 rounded-lg text-xs"
          >
            {refreshing ? "…" : "↻"}
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <p className="text-sm font-medium text-ink">
            {jobs.length === 0 ? "Todavía no subiste ningún .zip." : "Sin coincidencias para este filtro."}
          </p>
          <p className="mt-1 text-xs text-subtle">
            {jobs.length === 0
              ? "Cuando subas capítulos desde Subir capítulo aparecerán acá."
              : "Probá cambiando el estado o borrando la búsqueda."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line bg-[var(--surface-soft)] font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
              <tr>
                <th className="px-4 py-3 font-semibold">Archivo</th>
                <th className="px-4 py-3 font-semibold">Serie</th>
                <th className="px-4 py-3 font-semibold">Cap.</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold">Detalle</th>
                <th className="px-4 py-3 text-right font-semibold">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/80">
              {filtered.map((j) => {
                const meta = STATUS_META[j.status] ?? {
                  label: j.status,
                  dot: "bg-subtle",
                  badge: "border-line text-subtle",
                };
                return (
                  <tr key={j.id} className="transition-colors hover:bg-[var(--surface-raised)]/60">
                    <td className="max-w-[200px] truncate px-4 py-3 font-mono text-xs text-ink" title={j.original_filename}>
                      {j.original_filename}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-sm">
                      {j.series ? (
                        <Link
                          href={`/serie/${j.series.slug}`}
                          prefetch={false}
                          className="font-medium text-ink hover:text-accent-ink hover:underline"
                        >
                          {j.series.title}
                        </Link>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs tabular-nums text-subtle">
                      {j.chapter_number ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${meta.badge}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden="true" />
                        {meta.label}
                      </span>
                    </td>
                    <td
                      className="max-w-[220px] truncate px-4 py-3 text-xs text-danger"
                      title={j.error_message ?? undefined}
                    >
                      {j.error_message ?? <span className="text-faint">—</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-[11px] text-subtle">
                      {new Date(j.started_at).toLocaleString("es-AR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
