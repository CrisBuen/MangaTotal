"use client";

import { useCallback, useEffect, useState } from "react";

interface Entry {
  anilist_id: number;
  status: string;
  episodes_watched: number;
  total_episodes: number | null;
  score: number | null;
}

const STATUS_OPTIONS = [
  { key: "watching", label: "Viendo" },
  { key: "planned", label: "Pendiente" },
  { key: "completed", label: "Completado" },
  { key: "dropped", label: "Abandonado" },
];

/**
 * Control de seguimiento de un anime: estado, episodios vistos y nota.
 * Guarda en la lista del usuario (no reproduce ni aloja video).
 */
export function TrackerPanel({
  anilistId,
  title,
  coverUrl,
  totalEpisodes,
  loggedIn,
}: {
  anilistId: number;
  title: string;
  coverUrl: string | null;
  totalEpisodes: number | null;
  loggedIn: boolean;
}) {
  const [entry, setEntry] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loggedIn) {
      setLoading(false);
      return;
    }
    fetch("/api/anime/lista")
      .then((r) => (r.ok ? r.json() : []))
      .then((list: Entry[]) => {
        setEntry(list.find((e) => e.anilist_id === anilistId) ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [anilistId, loggedIn]);

  const save = useCallback(
    async (patch: Partial<Entry>) => {
      setSaving(true);
      const next = {
        anilist_id: anilistId,
        title,
        cover_url: coverUrl,
        total_episodes: totalEpisodes,
        status: patch.status ?? entry?.status ?? "watching",
        episodes_watched: patch.episodes_watched ?? entry?.episodes_watched ?? 0,
        score: patch.score !== undefined ? patch.score : (entry?.score ?? null),
      };
      try {
        const res = await fetch("/api/anime/lista", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
        if (res.ok) setEntry(await res.json());
      } finally {
        setSaving(false);
      }
    },
    [anilistId, title, coverUrl, totalEpisodes, entry]
  );

  async function remove() {
    setSaving(true);
    try {
      await fetch(`/api/anime/lista?anilist_id=${anilistId}`, { method: "DELETE" });
      setEntry(null);
    } finally {
      setSaving(false);
    }
  }

  if (!loggedIn) {
    return (
      <div className="rounded-2xl border border-line bg-panel p-5 text-sm text-subtle">
        <a href="/login" className="font-bold text-accent hover:underline">
          Iniciá sesión
        </a>{" "}
        para llevar el seguimiento de este anime.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-line bg-panel p-5 font-mono text-[10px] uppercase tracking-[0.12em] text-subtle">
        Cargando seguimiento...
      </div>
    );
  }

  const watched = entry?.episodes_watched ?? 0;
  const pct = totalEpisodes ? Math.round((watched / totalEpisodes) * 100) : 0;

  return (
    <div className="space-y-4 rounded-2xl border border-line bg-panel p-5" data-od-id="anime-tracker">
      <div className="flex flex-wrap gap-1.5">
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s.key}
            disabled={saving}
            onClick={() => save({ status: s.key })}
            className={`rounded-full border px-3 py-1.5 text-xs transition disabled:opacity-50 ${
              entry?.status === s.key
                ? "border-accent bg-[var(--accent-soft)] text-accent"
                : "border-line text-subtle hover:text-ink"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {entry && (
        <>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-subtle">
                Episodios vistos
              </span>
              <span className="font-mono text-xs text-ink">
                {watched}
                {totalEpisodes ? ` / ${totalEpisodes}` : ""}
              </span>
            </div>

            {totalEpisodes ? (
              <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-raised)]">
                <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
              </div>
            ) : null}

            <div className="flex items-center gap-2">
              <button
                disabled={saving || watched <= 0}
                onClick={() => save({ episodes_watched: watched - 1 })}
                className="h-9 w-9 rounded-lg border border-line text-ink transition hover:border-accent disabled:opacity-40"
                aria-label="Un episodio menos"
              >
                −
              </button>
              <button
                disabled={saving || (totalEpisodes ? watched >= totalEpisodes : false)}
                onClick={() => save({ episodes_watched: watched + 1 })}
                className="h-9 flex-1 rounded-lg border border-accent bg-[var(--accent-soft)] font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-accent transition hover:opacity-90 disabled:opacity-40"
              >
                + Episodio visto
              </button>
            </div>
          </div>

          <div>
            <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-subtle">
              Tu nota
            </p>
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  disabled={saving}
                  onClick={() => save({ score: entry.score === n ? null : n })}
                  className={`h-8 w-8 rounded-lg border text-xs transition disabled:opacity-50 ${
                    entry.score === n
                      ? "border-accent bg-accent text-[var(--bg)]"
                      : "border-line text-subtle hover:border-accent hover:text-ink"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <button
            disabled={saving}
            onClick={remove}
            className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-subtle transition hover:text-danger disabled:opacity-50"
          >
            Quitar de mi lista
          </button>
        </>
      )}
    </div>
  );
}
