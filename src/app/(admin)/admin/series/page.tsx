"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Feedback";
import { fieldControlClass } from "@/components/ui/Field";
import { SectionHeading } from "@/components/ui/Surface";

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

const inputClass = fieldControlClass;

const emptyForm = {
  title: "",
  original_title: "",
  type: "normal",
  description: "",
  status: "ongoing",
  tags: "",
};

export default function AdminSeriesPage() {
  const [series, setSeries] = useState<AdminSeries[] | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/series?all=true");
    if (res.ok) setSeries(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
    window.scrollTo({ top: 0, behavior: "smooth" });
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
      setForm({ ...emptyForm });
      setEditingId(null);
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

  return (
    <div className="space-y-10" data-od-id="admin-series-page">
      <SectionHeading eyebrow="Catálogo" title="Series" description="Creá, editá y organizá el archivo publicado." />

      <form
        onSubmit={onSubmit}
        className="space-y-5 rounded-2xl border border-line bg-panel p-6"
        data-od-id="series-form"
      >
        <h2 className="text-3xl text-ink">
          {editingId ? "Editar serie" : "Crear serie nueva"}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-ink">Título</label>
            <input
              className={inputClass}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-ink">
              Título original (opcional)
            </label>
            <input
              className={inputClass}
              value={form.original_title}
              onChange={(e) => setForm({ ...form, original_title: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-ink">Sección</label>
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
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-ink">Estado</label>
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
          <label className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-ink">
            Tags (separados por coma, sin límite)
          </label>
          <input
            className={inputClass}
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
            placeholder="ej: milf, romance, escolar, comedia"
          />
        </div>
        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-ink">
            Descripción (opcional)
          </label>
          <textarea
            className={inputClass}
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        {error && <p className="border-l-2 border-danger pl-3 text-sm text-danger" role="alert">{error}</p>}
        <div className="flex gap-2">
          <Button
            disabled={busy}
            variant="primary"
          >
            {editingId ? "Guardar cambios" : "Crear serie"}
          </Button>
          {editingId && (
            <Button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm({ ...emptyForm });
              }}
              variant="secondary"
            >
              Cancelar
            </Button>
          )}
        </div>
      </form>

      <section>
        {series === null ? (
          <p className="py-6 text-center text-sm text-subtle">Cargando…</p>
        ) : series.length === 0 ? (
          <EmptyState title="No hay series todavía" description="Creá la primera serie con el formulario superior." />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line bg-panel">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-line bg-[var(--surface-raised)] text-[10px] uppercase tracking-[0.1em] text-subtle">
                <tr>
                  <th className="px-4 py-2.5">Título</th>
                  <th className="px-4 py-2.5">Sección</th>
                  <th className="px-4 py-2.5">Estado</th>
                  <th className="px-4 py-2.5">Caps.</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-line">
                {series.map((s) => (
                  <tr key={s.id} className="bg-panel hover:bg-[var(--surface-raised)]">
                    <td className="px-4 py-2.5 font-medium">
                      {s.title}
                      {s.tags?.length > 0 && (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {s.tags.map((t) => (
                            <span
                              key={t.id}
                              className="border border-line px-1.5 py-0.5 text-[10px] text-subtle"
                            >
                              {t.name}
                            </span>
                          ))}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {s.type === "adult" ? (
                        <span className="border border-danger px-1.5 py-0.5 text-[11px] font-semibold text-danger">
                          +18
                        </span>
                      ) : (
                        <span className="text-subtle">Normal</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-subtle">{s.status}</td>
                    <td className="px-4 py-2.5 font-mono text-subtle">{s.chapter_count}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => startEdit(s)}
                        className="mr-3 min-h-11 text-xs font-bold uppercase tracking-[0.08em] text-ink underline underline-offset-4"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => onDelete(s)}
                        className="min-h-11 text-xs font-bold uppercase tracking-[0.08em] text-danger underline underline-offset-4"
                      >
                        Borrar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
