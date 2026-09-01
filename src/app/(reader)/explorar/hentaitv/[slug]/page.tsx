"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { SaveExternalAnimeButton } from "@/components/anime/SaveExternalAnimeButton";
import { Surface } from "@/components/ui/Surface";
import type { FichaHentaitv } from "@/lib/hentaitv";

interface ProgresoEpisodio {
  episode_id: string;
  episode_number: string;
  position_seconds: number;
  completed: boolean;
}

export default function FichaHentaitvPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = use(props.params);
  const [ficha, setFicha] = useState<FichaHentaitv | null>(null);
  const [progresos, setProgresos] = useState<ProgresoEpisodio[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setFicha(null);
    setProgresos([]);
    try {
      const res = await fetch(`/api/anime/hentaitv/${encodeURIComponent(slug)}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "No se pudo cargar el anime");
      setFicha(data);

      const params = new URLSearchParams({ source: "hentaitv", id: data.slug });
      const progresoRes = await fetch(`/api/anime/externo/progreso?${params}`, { cache: "no-store" });
      if (progresoRes.ok) {
        const progreso = await progresoRes.json();
        setProgresos(Array.isArray(progreso?.episodes) ? progreso.episodes : []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el anime");
    }
  }, [slug]);

  useEffect(() => void load(), [load]);

  if (error) {
    return (
      <Surface className="mx-auto max-w-2xl p-8 text-center">
        <h1 className="font-display text-2xl font-bold text-ink">No se pudo abrir</h1>
        <p className="mt-2 text-sm text-red-400">{error}</p>
        <button type="button" onClick={load} className="mt-5 font-mono text-[11px] text-accent-ink">Reintentar</button>
      </Surface>
    );
  }

  if (!ficha) {
    return <p className="py-20 text-center font-mono text-[13px] tracking-[0.08em] text-subtle">Cargando ficha y episodios...</p>;
  }

  return (
    <div className="space-y-9">
      <Link href="/explorar?seccion=animada&anime_fuente=hentaitv" className="inline-block font-mono text-[11px] font-bold tracking-[0.06em] text-subtle transition hover:text-accent-ink">← Explorar anime +18</Link>

      <div className="flex flex-col gap-7 sm:flex-row">
        <div className="w-full shrink-0 sm:w-52">
          <div className="aspect-[2/3] overflow-hidden rounded-[10px] border border-line bg-[var(--surface-raised)]">
            {ficha.cover_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ficha.cover_url} alt={ficha.title} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-5">
          <div>
            <p className="font-mono text-[11px] font-bold tracking-[0.08em] text-accent-ink">HentaiTV · +18</p>
            <h1 className="mt-2 font-display text-4xl font-bold leading-[0.95] tracking-[-0.04em] text-ink sm:text-5xl">{ficha.title}</h1>
            <p className="mt-3 font-mono text-[11px] tracking-[0.06em] text-subtle">
              {[ficha.year, ficha.author, `${ficha.total_episodes} episodios`].filter(Boolean).join(" · ")}
            </p>
          </div>

          {ficha.genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {ficha.genres.map((genre) => <span key={genre} className="rounded-full border border-line bg-[var(--surface-raised)] px-3 py-1 text-[13px] text-subtle">{genre}</span>)}
            </div>
          )}
          {ficha.description && <p className="max-w-3xl text-sm leading-6 text-subtle">{ficha.description}</p>}

          <div className="flex flex-wrap items-start gap-3">
            <SaveExternalAnimeButton anime={{
              source: "hentaitv",
              external_id: ficha.slug,
              slug: ficha.slug,
              title: ficha.title,
              cover_url: ficha.cover_url,
              type: "Animación +18",
              status: null,
              total_episodes: ficha.total_episodes,
            }} />
            <a href={ficha.url_original} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-md border border-line bg-panel px-4 font-mono text-[11px] font-bold tracking-[0.06em] text-accent-ink transition hover:border-line-strong">Ver ficha en HentaiTV ↗</a>
          </div>
        </div>
      </div>

      <section>
        <div className="mb-5">
          <p className="font-mono text-[11px] font-bold tracking-[0.08em] text-accent-ink">Reproducción oficial de la fuente</p>
          <h2 className="mt-1 font-display text-3xl font-bold leading-none text-ink">Episodios</h2>
        </div>

        {ficha.episodes.length === 0 ? (
          <Surface className="p-8 text-center text-sm text-subtle">HentaiTV no devolvió episodios para esta serie.</Surface>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {ficha.episodes.map((episode) => {
              const progreso = progresos.find((item) => item.episode_id === episode.id || item.episode_number === episode.number);
              return (
                <Link key={episode.id} href={`/explorar/hentaitv/${ficha.slug}/${episode.number}`} className="group overflow-hidden rounded-[10px] border border-line bg-panel transition hover:border-line-strong">
                  <div className="relative aspect-video bg-[var(--surface-raised)]">
                    {episode.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={episode.image_url} alt="" className={`h-full w-full object-cover transition ${progreso?.completed ? "grayscale opacity-35" : ""}`} loading="lazy" referrerPolicy="no-referrer" />
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-mono text-[11px] font-bold tracking-[0.06em] text-accent-ink">Episodio {episode.number}</p>
                    <p className="mt-1 line-clamp-2 text-sm font-semibold text-ink">{episode.title}</p>
                    {episode.published_at && <p className="mt-2 font-mono text-[11px] text-faint">{episode.published_at}</p>}
                    {progreso && <p className="mt-2 font-mono text-[11px] font-bold text-accent-ink">Abierto</p>}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <p className="border-t border-line pt-6 text-center font-mono text-[11px] tracking-[0.06em] text-subtle">Ficha y episodios provistos por HentaiTV con su permiso</p>
    </div>
  );
}
