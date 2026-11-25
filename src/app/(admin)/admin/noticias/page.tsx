"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Feedback";
import { fieldControlClass } from "@/components/ui/Field";

interface Announcement {
  id: number;
  title: string;
  body: string;
  created_at: string;
}

const inputClass = fieldControlClass;

export default function AdminNoticiasPage() {
  const [news, setNews] = useState<Announcement[] | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/announcements", { cache: "no-store" });
    if (res.ok) setNews(await res.json());
  }, []);

  useEffect(() => {
    void load();
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
    setError(null);
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
    if (editingId === n.id) reset();
    await load();
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return news ?? [];
    return (news ?? []).filter(
      (n) => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)
    );
  }, [news, query]);

  return (
    <div className="space-y-6" data-od-id="admin-news-page">
      <div className="border-b border-line pb-6">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-ink">
          Comunicación
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-[-0.03em] text-ink sm:text-4xl">
          Noticias y anuncios
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-subtle">
          Publicá novedades, avisos de mantenimiento o nuevas series visibles para los lectores.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.35fr)] lg:items-start">
        {/* Compositor */}
        <form
          onSubmit={onSubmit}
          className={`space-y-5 rounded-xl border bg-panel p-5 sm:p-6 lg:sticky lg:top-20 ${
            editingId ? "border-accent/60" : "border-line"
          }`}
        >
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-accent-ink">
              {editingId ? "Editando anuncio" : "Nueva publicación"}
            </p>
            <h2 className="mt-0.5 text-xl font-bold text-ink">
              {editingId ? "Editar noticia" : "Publicar noticia"}
            </h2>
          </div>

          <div>
            <label className="mb-2 block font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-subtle">
              Título
            </label>
            <input
              className={inputClass}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder='ej: "¡Nueva fuente integrada!"'
            />
          </div>

          <div>
            <label className="mb-2 block font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-subtle">
              Contenido
            </label>
            <textarea
              className={inputClass}
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Contale a los lectores qué novedades hay…"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-danger/50 bg-danger/10 px-4 py-2.5 text-sm text-danger" role="alert">
              {error}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy} loading={busy} variant="primary" className="rounded-lg">
              {editingId ? "Guardar cambios" : "Publicar"}
            </Button>
            {editingId && (
              <Button type="button" onClick={reset} variant="secondary" className="rounded-lg">
                Cancelar
              </Button>
            )}
          </div>
        </form>

        {/* Listado publicado */}
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-mono text-xs text-subtle">
              {news === null ? "Cargando…" : `${news.length} ${news.length === 1 ? "noticia" : "noticias"}`}
            </p>
            {(news?.length ?? 0) > 0 && (
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filtrar noticias…"
                aria-label="Filtrar noticias"
                className="min-h-9 w-full rounded-lg border border-line bg-panel px-3 text-xs text-ink placeholder:text-faint focus:border-accent focus:outline-none sm:w-56"
              />
            )}
          </div>

          {news === null ? (
            <div className="rounded-xl border border-line bg-panel p-8 text-center text-sm text-subtle">
              Cargando noticias…
            </div>
          ) : news.length === 0 ? (
            <EmptyState
              title="No publicaste noticias"
              description="La próxima publicación aparecerá aquí y en la biblioteca."
            />
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-line bg-panel p-8 text-center text-sm text-subtle">
              Sin coincidencias para &ldquo;{query}&rdquo;.
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((n) => (
                <article
                  key={n.id}
                  className={`rounded-xl border bg-panel p-5 transition-colors ${
                    editingId === n.id ? "border-accent/60" : "border-line hover:border-line-strong"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="text-lg font-bold text-ink">{n.title}</h3>
                    <span className="rounded-md border border-line bg-[var(--surface-soft)] px-2 py-0.5 font-mono text-[11px] text-subtle">
                      {new Date(n.created_at).toLocaleDateString("es-AR")}
                    </span>
                  </div>
                  <p className="mt-2.5 whitespace-pre-line text-sm leading-6 text-subtle">{n.body}</p>
                  <div className="mt-4 flex items-center gap-2 border-t border-line/70 pt-3">
                    <button
                      type="button"
                      onClick={() => startEdit(n)}
                      className="rounded-lg border border-line bg-[var(--surface-soft)] px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-accent hover:text-accent-ink"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(n)}
                      className="rounded-lg border border-danger/40 bg-transparent px-3 py-1.5 text-xs font-semibold text-danger transition-colors hover:bg-danger hover:text-white"
                    >
                      Borrar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
