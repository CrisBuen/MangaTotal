"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Feedback";
import { fieldControlClass } from "@/components/ui/Field";
import { SectionHeading } from "@/components/ui/Surface";

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
    <div className="space-y-10" data-od-id="admin-news-page">
      <SectionHeading eyebrow="Comunicación" title="Noticias" description="Anuncios y novedades que aparecen en la pestaña Todo de la biblioteca." />

      <form
        onSubmit={onSubmit}
        className="space-y-5 rounded-[10px] border border-line bg-panel p-6"
      >
        <h2 className="text-3xl text-ink">
          {editingId ? "Editar noticia" : "Publicar noticia nueva"}
        </h2>
        <div>
          <label className="mb-2 block text-[13px] font-bold tracking-[0.08em] text-ink">Título</label>
          <input
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder='ej: "¡Nueva serie en camino!"'
          />
        </div>
        <div>
          <label className="mb-2 block text-[13px] font-bold tracking-[0.08em] text-ink">Contenido</label>
          <textarea
            className={inputClass}
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Contale a los lectores qué se viene..."
          />
        </div>
        {error && <p className="border-l-2 border-danger pl-3 text-sm text-danger" role="alert">{error}</p>}
        <div className="flex gap-2">
          <Button
            disabled={busy}
            variant="primary"
          >
            {editingId ? "Guardar cambios" : "Publicar"}
          </Button>
          {editingId && (
            <Button
              type="button"
              onClick={reset}
              variant="secondary"
            >
              Cancelar
            </Button>
          )}
        </div>
      </form>

      {news === null ? (
        <p className="py-6 text-center text-sm text-subtle">Cargando…</p>
      ) : news.length === 0 ? (
        <EmptyState title="No publicaste noticias" description="La próxima publicación aparecerá aquí y en la biblioteca." />
      ) : (
        <div className="border-b border-line">
          {news.map((n) => (
            <article key={n.id} className="border-t border-line py-5">
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <h3 className="text-xl text-ink">{n.title}</h3>
                <span className="shrink-0 font-mono text-[11px] text-subtle">
                  {new Date(n.created_at).toLocaleDateString("es-AR")}
                </span>
              </div>
              <p className="mb-3 whitespace-pre-line text-sm text-subtle">{n.body}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => startEdit(n)}
                  className="min-h-11 text-[13px] font-bold text-ink underline underline-offset-4"
                >
                  Editar
                </button>
                <button onClick={() => remove(n)} className="min-h-11 text-[13px] font-bold text-danger underline underline-offset-4">
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
