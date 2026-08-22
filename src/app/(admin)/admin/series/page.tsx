"use client";

import { useCallback, useEffect, useState } from "react";

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

const inputClass =
  "w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-violet-500";

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
    <div className="space-y-8">
      <h1 className="text-xl font-bold">Series</h1>

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900 p-5"
      >
        <h2 className="text-sm font-semibold text-zinc-300">
          {editingId ? "Editar serie" : "Crear serie nueva"}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">Título</label>
            <input
              className={inputClass}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">
              Título original (opcional)
            </label>
            <input
              className={inputClass}
              value={form.original_title}
              onChange={(e) => setForm({ ...form, original_title: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">Sección</label>
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
            <label className="mb-1 block text-xs font-medium text-zinc-400">Estado</label>
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
          <label className="mb-1 block text-xs font-medium text-zinc-400">
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
          <label className="mb-1 block text-xs font-medium text-zinc-400">
            Descripción (opcional)
          </label>
          <textarea
            className={inputClass}
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-2">
          <button
            disabled={busy}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
          >
            {editingId ? "Guardar cambios" : "Crear serie"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm({ ...emptyForm });
              }}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>

      <section>
        {series === null ? (
          <p className="py-6 text-center text-sm text-zinc-500">Cargando...</p>
        ) : series.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-800 py-8 text-center text-sm text-zinc-500">
            No hay series todavía.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-zinc-900 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-4 py-2.5">Título</th>
                  <th className="px-4 py-2.5">Sección</th>
                  <th className="px-4 py-2.5">Estado</th>
                  <th className="px-4 py-2.5">Caps.</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {series.map((s) => (
                  <tr key={s.id} className="bg-zinc-950/50">
                    <td className="px-4 py-2.5 font-medium">
                      {s.title}
                      {s.tags?.length > 0 && (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {s.tags.map((t) => (
                            <span
                              key={t.id}
                              className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400"
                            >
                              {t.name}
                            </span>
                          ))}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {s.type === "adult" ? (
                        <span className="rounded bg-red-600/20 px-1.5 py-0.5 text-[11px] font-semibold text-red-400">
                          +18
                        </span>
                      ) : (
                        <span className="text-zinc-400">Normal</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-400">{s.status}</td>
                    <td className="px-4 py-2.5 text-zinc-400">{s.chapter_count}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => startEdit(s)}
                        className="mr-2 text-xs text-violet-400 hover:underline"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => onDelete(s)}
                        className="text-xs text-red-400 hover:underline"
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
