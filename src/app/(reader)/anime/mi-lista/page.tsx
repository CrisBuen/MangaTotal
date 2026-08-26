"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SectionHeading, Surface } from "@/components/ui/Surface";

interface Entry {
  anilist_id: number;
  title: string;
  cover_url: string | null;
  total_episodes: number | null;
  status: string;
  episodes_watched: number;
  score: number | null;
  updated_at: string;
}

const TABS = [
  { key: "watching", label: "Viendo" },
  { key: "planned", label: "Pendientes" },
  { key: "completed", label: "Completados" },
  { key: "dropped", label: "Abandonados" },
];

export default function MiListaPage() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [tab, setTab] = useState("watching");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/anime/lista");
    if (res.status === 401) {
      setNeedsLogin(true);
      setEntries([]);
      return;
    }
    setEntries(res.ok ? await res.json() : []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addEpisode(entry: Entry) {
    if (entry.total_episodes && entry.episodes_watched >= entry.total_episodes) return;
    setBusy(entry.anilist_id);
    try {
      await fetch("/api/anime/lista", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anilist_id: entry.anilist_id,
          title: entry.title,
          cover_url: entry.cover_url,
          total_episodes: entry.total_episodes,
          status: entry.status,
          episodes_watched: entry.episodes_watched + 1,
          score: entry.score,
        }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  }

  const visible = (entries ?? []).filter((e) => e.status === tab);
  const counts = TABS.map((t) => ({
    ...t,
    count: (entries ?? []).filter((e) => e.status === t.key).length,
  }));

  return (
    <div className="space-y-10">
      <SectionHeading
        eyebrow="Tu seguimiento"
        title="Mi lista"
        description="Lo que estás viendo, lo que dejaste pendiente y lo que ya terminaste."
        action={
          <Link
            href="/anime"
            className="inline-flex min-h-11 items-center rounded-xl border border-line px-5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-subtle transition hover:border-accent hover:text-ink"
          >
            Explorar anime
          </Link>
        }
      />

      {needsLogin ? (
        <Surface className="p-12 text-center">
          <p className="text-lg font-bold text-ink">Necesitás una cuenta</p>
          <p className="mt-1 text-sm text-subtle">
            <Link href="/login" className="font-bold text-accent hover:underline">
              Iniciá sesión
            </Link>{" "}
            para llevar tu seguimiento de anime.
          </p>
        </Surface>
      ) : (
        <>
          <div className="flex flex-wrap gap-1 rounded-xl border border-line bg-[var(--surface-raised)] p-1">
            {counts.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-lg px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] transition ${
                  tab === t.key ? "bg-accent text-[var(--bg)]" : "text-subtle hover:text-ink"
                }`}
              >
                {t.label} <span className="opacity-70">{t.count}</span>
              </button>
            ))}
          </div>

          {entries === null ? (
            <p className="py-16 text-center font-mono text-xs uppercase tracking-[0.14em] text-subtle">
              Cargando lista...
            </p>
          ) : visible.length === 0 ? (
            <Surface className="p-12 text-center">
              <p className="text-lg font-bold text-ink">Nada por acá todavía</p>
              <p className="mt-1 text-sm text-subtle">
                Entrá a un anime del catálogo y marcalo para que aparezca en esta sección.
              </p>
            </Surface>
          ) : (
            <div className="space-y-3">
              {visible.map((e) => {
                const pct = e.total_episodes
                  ? Math.round((e.episodes_watched / e.total_episodes) * 100)
                  : 0;
                return (
                  <div
                    key={e.anilist_id}
                    className="flex gap-4 rounded-2xl border border-line bg-panel p-4"
                  >
                    <Link href={`/anime/${e.anilist_id}`} className="w-16 shrink-0 sm:w-20">
                      <div className="aspect-[2/3] overflow-hidden rounded-xl bg-[var(--surface-raised)]">
                        {e.cover_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={e.cover_url}
                            alt={e.title}
                            className="h-full w-full object-cover"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        )}
                      </div>
                    </Link>

                    <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
                      <Link href={`/anime/${e.anilist_id}`}>
                        <p className="line-clamp-1 font-display text-lg font-bold text-ink hover:text-accent">
                          {e.title}
                        </p>
                      </Link>

                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-subtle">
                          {e.episodes_watched}
                          {e.total_episodes ? ` / ${e.total_episodes}` : ""} eps
                          {e.score ? ` · nota ${e.score}` : ""}
                        </span>
                        {e.total_episodes && (
                          <div className="h-1.5 max-w-40 flex-1 overflow-hidden rounded-full bg-[var(--surface-raised)]">
                            <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
                          </div>
                        )}
                      </div>
                    </div>

                    {tab === "watching" && (
                      <button
                        disabled={
                          busy === e.anilist_id ||
                          Boolean(e.total_episodes && e.episodes_watched >= e.total_episodes)
                        }
                        onClick={() => addEpisode(e)}
                        className="shrink-0 self-center rounded-xl border border-accent bg-[var(--accent-soft)] px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-accent transition hover:opacity-90 disabled:opacity-40"
                      >
                        +1 ep
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
