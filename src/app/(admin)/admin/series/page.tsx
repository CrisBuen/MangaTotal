"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Feedback";
import { fieldControlClass } from "@/components/ui/Field";

interface AdminSeries {
  id: number;
  title: string;
  original_title: string | null;
  slug: string;
  type: string;
  description: string | null;
  status: string;
  chapter_count: number;
  tags: { id: number; name: string; slug: string }[];
}

type SeriesFilter = "all" | "normal" | "adult" | "ongoing" | "completed";

const inputClass = fieldControlClass;

const emptyForm = {
  title: "",
  original_title: "",
  type: "normal",
  description: "",
  status: "ongoing",
  tags: "",
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  ongoing: {
    label: "En curso",
    className: "border-success/40 bg-success/10 text-success",
  },
  completed: {
    label: "Completada",
    className: "border-accent/40 bg-[var(--accent-soft)] text-accent-ink",
  },
  dropped: {
    label: "Abandonada",
    className: "border-line bg-[var(--surface-raised)] text-subtle",
  },
};

export default function AdminSeriesPage() {
  const [series, setSeries] = useState<AdminSeries[] | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SeriesFilter>("all");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/series?all=true", { cache: "no-store" });
    if (res.ok) setSeries(await res.json());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openNewForm() {
    setEditingId(null);
    setForm({ ...emptyForm });
    setError(null);
    setEditorOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startEdit(s: AdminSeries) {
    setEditingId(s.id);
    setForm({
      title: s.title,
      original_title: s.original_title ?? "",
      type: s.type,
      description: s.description ?? "",
      status: s.status,
      tags: (s.tags ?? []).map((t) => t.name).join(", "),
    });
    setError(null);
    setEditorOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeEditor() {
    setEditingId(null);
    setForm({ ...emptyForm });
    setError(null);
    setEditorOpen(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError("Falta el título");

    setBusy(true);
    try {
      const res = await fetch(editingId ? `/api/series/${editingId}` : "/api/series", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          original_title: form.original_title.trim() || null,
          type: form.type,
          description: form.description.trim() || null,
          status: form.status,
          tags: form.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No se pudo guardar");
        return;
      }
      closeEditor();
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(s: AdminSeries) {
    const ok = window.confirm(
      `¿Borrar la serie "${s.title}" con sus ${s.chapter_count} capítulos y todos sus archivos? Esta acción no se puede deshacer.`
    );
    if (!ok) return;
    const res = await fetch(`/api/series/${s.id}`, { method: "DELETE" });
    if (res.ok || res.status === 204) await load();
  }

  const metrics = useMemo(() => {
    const list = series ?? [];
    return {
      total: list.length,
      normal: list.filter((s) => s.type !== "adult").length,
      adult: list.filter((s) => s.type === "adult").length,
      chapters: list.reduce((acc, s) => acc + (s.chapter_count || 0), 0),
    };
  }, [series]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (series ?? []).filter((s) => {
      if (filter === "normal" && s.type === "adult") return false;
      if (filter === "adult" && s.type !== "adult") return false;
      if (filter === "ongoing" && s.status !== "ongoing") return false;
      if (filter === "completed" && s.status !== "completed") return false;
      if (!q) return true;
      return (
        s.title.toLowerCase().includes(q) ||
        (s.original_title ?? "").toLowerCase().includes(q) ||
        (s.tags ?? []).some((t) => t.name.toLowerCase().includes(q))
      );
    });
  }, [filter, query, series]);

  return (
    <div className="space-y-6" data-od-id="admin-series-page">
      <div className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-ink">
            Catálogo local
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-[-0.03em] text-ink sm:text-4xl">
            Series
          </h1>
          <p className="mt-2 text-sm text-subtle">
            Creá, editá metadatos, etiquetas y estado de las series publicadas en MangaTotal.
          </p>
        </div>

        <Button
          variant={editorOpen && !editingId ? "secondary" : "primary"}
          size="sm"
          className="self-start rounded-lg sm:self-auto"
          onClick={() => (editorOpen && !editingId ? closeEditor() : openNewForm())}
        >
          {editorOpen && !editingId ? "Cerrar formulario" : "+ Nueva serie"}
        </Button>
      </div>

      {/* Mini KPIs calculados en cliente (0 consultas extra) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total series", value: metrics.total },
          { label: "Normales", value: metrics.normal },
          { label: "Sección +18", value: metrics.adult },
          { label: "Capítulos totales", value: metrics.chapters },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-line bg-panel px-4 py-3.5">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-faint">
              {item.label}
            </p>
            <p className="mt-1.5 font-display text-2xl font-bold tabular-nums text-ink">
              {series === null ? "—" : item.value}
            </p>
          </div>
        ))}
      </div>

      {/* Editor desplegable de creación / edición */}
      {editorOpen && (
        <form
          onSubmit={onSubmit}
          className="space-y-5 rounded-xl border border-accent/40 bg-panel p-5 sm:p-6"
          data-od-id="series-form"
        >
          <div className="flex items-center justify-between gap-3 border-b border-line pb-4">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-accent-ink">
                {editingId ? "Edición" : "Alta de catálogo"}
              </p>
              <h2 className="mt-0.5 text-xl font-bold text-ink">
                {editingId ? "Editar serie" : "Crear serie nueva"}
              </h2>
            </div>
            <Button variant="ghost" size="sm" onClick={closeEditor}>
              Cerrar
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-subtle">
                Título
              </label>
              <input
                className={inputClass}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-2 block font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-subtle">
                Título original (opcional)
              </label>
              <input
                className={inputClass}
                value={form.original_title}
                onChange={(e) => setForm({ ...form, original_title: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-2 block font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-subtle">
                Sección
              </label>
              <select
                className={inputClass}
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <option value="normal">Normal</option>
                <option value="adult">+18</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-subtle">
                Estado
              </label>
              <select
                className={inputClass}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="ongoing">En curso</option>
                <option value="completed">Completada</option>
                <option value="dropped">Abandonada</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-2 block font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-subtle">
              Tags (separados por coma)
            </label>
            <input
              className={inputClass}
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="ej: romance, escolar, comedia"
            />
          </div>

          <div>
            <label className="mb-2 block font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-subtle">
              Descripción (opcional)
            </label>
            <textarea
              className={inputClass}
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          {error && (
            <p className="rounded-lg border border-danger/50 bg-danger/10 px-4 py-2.5 text-sm text-danger" role="alert">
              {error}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy} loading={busy} variant="primary" className="rounded-lg">
              {editingId ? "Guardar cambios" : "Crear serie"}
            </Button>
            <Button type="button" onClick={closeEditor} variant="secondary" className="rounded-lg">
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {/* Barra de búsqueda y tabla */}
      <section className="overflow-hidden rounded-xl border border-line bg-panel">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: "all", label: "Todas" },
                { id: "normal", label: "Normales" },
                { id: "adult", label: "+18" },
                { id: "ongoing", label: "En curso" },
                { id: "completed", label: "Completadas" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  filter === tab.id
                    ? "border-accent/60 bg-[var(--accent-soft)] text-accent-ink"
                    : "border-line bg-[var(--surface-soft)] text-subtle hover:border-line-strong hover:text-ink"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por título o tag…"
            aria-label="Buscar series"
            className="min-h-9 w-full rounded-lg border border-line bg-[var(--surface-soft)] px-3 text-xs text-ink placeholder:text-faint focus:border-accent focus:outline-none sm:w-64"
          />
        </div>

        {series === null ? (
          <p className="py-10 text-center text-sm text-subtle">Cargando series…</p>
        ) : series.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No hay series todavía"
              description="Creá la primera serie con el botón + Nueva serie."
            />
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-subtle">
            Ninguna serie coincide con los filtros actuales.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-line bg-[var(--surface-soft)] font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
                <tr>
                  <th className="px-4 py-3 font-semibold">Título</th>
                  <th className="px-4 py-3 font-semibold">Sección</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 font-semibold">Caps.</th>
                  <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/80">
                {filtered.map((s) => {
                  const st = STATUS_BADGE[s.status] ?? {
                    label: s.status,
                    className: "border-line text-subtle",
                  };
                  return (
                    <tr key={s.id} className="transition-colors hover:bg-[var(--surface-raised)]/60">
                      <td className="px-4 py-3">
                        <Link
                          href={`/serie/${s.slug}`}
                          prefetch={false}
                          className="font-semibold text-ink hover:text-accent-ink hover:underline"
                        >
                          {s.title}
                        </Link>
                        {s.original_title && (
                          <p className="text-xs text-faint">{s.original_title}</p>
                        )}
                        {s.tags?.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {s.tags.map((t) => (
                              <span
                                key={t.id}
                                className="rounded-md border border-line bg-[var(--surface-soft)] px-1.5 py-0.5 text-[10px] text-subtle"
                              >
                                {t.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {s.type === "adult" ? (
                          <span className="rounded-full border border-danger/50 bg-danger/10 px-2.5 py-0.5 text-[11px] font-semibold text-danger">
                            +18
                          </span>
                        ) : (
                          <span className="rounded-full border border-line bg-[var(--surface-soft)] px-2.5 py-0.5 text-[11px] text-subtle">
                            Normal
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${st.className}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs tabular-nums text-subtle">
                        {s.chapter_count}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(s)}
                            className="rounded-lg border border-line bg-[var(--surface-soft)] px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-accent hover:text-accent-ink"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(s)}
                            className="rounded-lg border border-danger/40 bg-transparent px-3 py-1.5 text-xs font-semibold text-danger transition-colors hover:bg-danger hover:text-white"
                          >
                            Borrar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
