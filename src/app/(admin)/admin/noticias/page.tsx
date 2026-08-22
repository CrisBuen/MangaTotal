"use client";

import { useCallback, useEffect, useState } from "react";

interface Announcement {
  id: number;
  title: string;
  body: string;
  created_at: string;
}

const inputClass =
  "w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-violet-500";

export default function AdminNoticiasPage() {
  const [news, setNews] = useState<Announcement[] | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/announcements");
    if (res.ok) setNews(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit(n: Announcement) {
    setEditingId(n.id);
    setTitle(n.title);
    setBody(n.body);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function reset() {
    setEditingId(null);
    setTitle("");
    setBody("");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim() || !body.trim()) return setError("Faltan título o contenido");

    setBusy(true);
    try {
      const res = await fetch(
        editingId ? `/api/announcements/${editingId}` : "/api/announcements",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title.trim(), body: body.trim() }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No se pudo guardar");
        return;
      }
      reset();
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(n: Announcement) {
    if (!window.confirm(`¿Borrar la noticia "${n.title}"?`)) return;
    await fetch(`/api/announcements/${n.id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold">Noticias</h1>
        <p className="text-sm text-zinc-500">
          Anuncios y novedades que aparecen en la pestaña "Todo" de la biblioteca.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900 p-5"
      >
        <h2 className="text-sm font-semibold text-zinc-300">
          {editingId ? "Editar noticia" : "Publicar noticia nueva"}
        </h2>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">Título</label>
          <input
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder='ej: "¡Nueva serie en camino!"'
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">Contenido</label>
          <textarea
            className={inputClass}
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Contale a los lectores qué se viene..."
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-2">
          <button
            disabled={busy}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
          >
            {editingId ? "Guardar cambios" : "Publicar"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={reset}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>

      {news === null ? (
        <p className="py-6 text-center text-sm text-zinc-500">Cargando...</p>
      ) : news.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-800 py-8 text-center text-sm text-zinc-500">
          No publicaste ninguna noticia todavía.
        </p>
      ) : (
        <div className="space-y-3">
          {news.map((n) => (
            <article key={n.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <h3 className="font-semibold">{n.title}</h3>
                <span className="shrink-0 text-xs text-zinc-500">
                  {new Date(n.created_at).toLocaleDateString("es-AR")}
                </span>
              </div>
              <p className="mb-3 whitespace-pre-line text-sm text-zinc-300">{n.body}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => startEdit(n)}
                  className="text-xs text-violet-400 hover:underline"
                >
                  Editar
                </button>
                <button onClick={() => remove(n)} className="text-xs text-red-400 hover:underline">
                  Borrar
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
