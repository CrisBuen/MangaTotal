"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { SaveExternalAnimeButton } from "@/components/anime/SaveExternalAnimeButton";
import { EpisodeWatchLink } from "@/components/anime/EpisodeWatchLink";
import { Surface } from "@/components/ui/Surface";
import type { FichaJkanime } from "@/lib/jkanime";

interface ProgresoEpisodio {
  episode_id: string;
  episode_number: string;
  position_seconds: number;
  duration_seconds: number;
  completed: boolean;
}

function minuto(segundos: number): string {
  const total = Math.max(0, Math.floor(segundos));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export default function FichaJkanimePage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = use(props.params);
  const [ficha, setFicha] = useState<FichaJkanime | null>(null);
  const [progresos, setProgresos] = useState<ProgresoEpisodio[]>([]);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setFicha(null);
    setProgresos([]);
    try {
      const res = await fetch(`/api/anime/jkanime/${encodeURIComponent(slug)}?page=${page}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "No se pudo cargar el anime");
      setFicha(data);

      const params = new URLSearchParams({
        source: "jkanime",
        id: String(data.id),
      });
      const progresoRes = await fetch(`/api/anime/externo/progreso?${params}`, {
        cache: "no-store",
      });
      if (progresoRes.ok) {
        const progreso = await progresoRes.json();
        setProgresos(Array.isArray(progreso?.episodes) ? progreso.episodes : []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el anime");
    }
  }, [page, slug]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <Surface className="mx-auto max-w-2xl p-8 text-center">
        <h1 className="font-display text-2xl font-bold text-ink">No se pudo abrir</h1>
        <p className="mt-2 text-sm text-red-400">{error}</p>
        <button onClick={load} className="mt-5 font-mono text-[11px] text-accent-ink">
          Reintentar
        </button>
      </Surface>
    );
  }

  if (!ficha) {
    return (
      <p className="py-20 text-center font-mono text-[13px] tracking-[0.08em] text-subtle">
        Cargando ficha y episodios...
      </p>
    );
  }

  return (
    <div className="space-y-9">
      <Link
        href="/explorar?seccion=animada"
        className="inline-block font-mono text-[11px] font-bold tracking-[0.06em] text-subtle transition hover:text-accent-ink"
      >
        ← Explorar anime
      </Link>

      <div className="flex flex-col gap-7 sm:flex-row">
        <div className="w-full shrink-0 sm:w-52">
          <div className="aspect-[2/3] overflow-hidden rounded-[10px] border border-line bg-[var(--surface-raised)]">
            {ficha.cover_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={ficha.cover_url}
                alt={ficha.title}
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-5">
          <div>
            <p className="font-mono text-[11px] font-bold tracking-[0.08em] text-accent-ink">
              JKAnime
            </p>
            <h1 className="mt-2 font-display text-4xl font-bold leading-[0.95] tracking-[-0.04em] text-ink sm:text-5xl">
              {ficha.title}
            </h1>
            {ficha.alternative_title && ficha.alternative_title !== ficha.title && (
              <p className="mt-2 text-sm text-subtle">{ficha.alternative_title}</p>
            )}
            <p className="mt-3 font-mono text-[11px] tracking-[0.06em] text-subtle">
              {[
                ficha.type,
                ficha.status,
                ficha.total_episodes ? `${ficha.total_episodes} episodios` : null,
                ficha.duration,
                ficha.season,
                ficha.quality,
              ].filter(Boolean).join(" · ")}
            </p>
          </div>

          {ficha.genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {ficha.genres.map((genre) => (
                <span
                  key={genre}
                  className="rounded-full border border-line bg-[var(--surface-raised)] px-3 py-1 text-[13px] text-subtle"
                >
                  {genre}
                </span>
              ))}
            </div>
          )}

          {ficha.description && (
            <p className="max-w-3xl text-sm leading-6 text-subtle">{ficha.description}</p>
          )}

          <div className="space-y-1 font-mono text-[11px] tracking-[0.1em] text-subtle">
            {ficha.studios.length > 0 && <p>Estudio: <span className="text-ink">{ficha.studios.join(", ")}</span></p>}
            {ficha.languages && <p>Idioma: <span className="text-ink">{ficha.languages}</span></p>}
            {ficha.aired_at && <p>Emitido: <span className="text-ink">{ficha.aired_at}</span></p>}
          </div>

          <div className="flex flex-wrap items-start gap-3">
            <SaveExternalAnimeButton
              anime={{
                source: "jkanime",
                external_id: String(ficha.id),
                slug: ficha.slug,
                title: ficha.title,
                cover_url: ficha.cover_url,
                type: ficha.type,
                status: ficha.status,
                total_episodes: ficha.total_episodes,
              }}
            />
            <a
              href={ficha.url_original}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center rounded-md border border-line bg-panel px-4 font-mono text-[11px] font-bold tracking-[0.06em] text-accent-ink transition hover:border-line-strong"
            >
              Ver ficha en JKAnime ↗
            </a>
          </div>
        </div>
      </div>

      <section>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] font-bold tracking-[0.08em] text-accent-ink">
              Reproducción oficial de la fuente
            </p>
            <h2 className="mt-1 font-display text-3xl font-bold leading-none text-ink">
              Episodios
            </h2>
          </div>
          {ficha.last_page > 1 && (
            <span className="font-mono text-[11px] tracking-[0.06em] text-subtle">
              Página {ficha.page} de {ficha.last_page}
            </span>
          )}
        </div>

        {ficha.episodes.length === 0 ? (
          <Surface className="p-8 text-center text-sm text-subtle">
            JKAnime no devolvió episodios para esta página.
          </Surface>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {ficha.episodes.map((episode) => {
              const progreso = progresos.find(
                (item) =>
                  item.episode_id === String(episode.id) ||
                  item.episode_number === episode.number
              );
              return (
                <EpisodeWatchLink
                  key={episode.id || episode.number}
                  href={`/explorar/jkanime/${ficha.slug}/${episode.number}`}
                  className="group overflow-hidden rounded-[10px] border border-line bg-panel transition hover:border-line-strong"
                >
                  <div className="relative aspect-video bg-[var(--surface-raised)]">
                    {episode.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={episode.image_url}
                        alt=""
                        className={`h-full w-full object-cover transition ${
                          progreso?.completed ? "grayscale opacity-35" : ""
                        }`}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    {progreso?.completed && (
                      <div className="absolute inset-0 bg-black/20" aria-hidden="true" />
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-mono text-[11px] font-bold tracking-[0.06em] text-accent-ink">
                      Episodio {episode.number}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm font-semibold text-ink">{episode.title}</p>
                    {progreso?.completed ? (
                      <p className="mt-2 font-mono text-[11px] font-bold tracking-[0.06em] text-subtle">
                        Ya visto
                      </p>
                    ) : progreso && progreso.position_seconds > 0 ? (
                      <p className="mt-2 font-mono text-[11px] font-bold tracking-[0.06em] text-accent-ink">
                        {minuto(progreso.position_seconds)}
                      </p>
                    ) : null}
                  </div>
                </EpisodeWatchLink>
              );
            })}
          </div>
        )}

        {ficha.last_page > 1 && (
          <div className="mt-7 flex items-center justify-center gap-3">
            <button
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
              className="rounded-md border border-line px-4 py-2 font-mono text-[11px] font-bold text-subtle disabled:opacity-40"
            >
              ← Anterior
            </button>
            <button
              disabled={page >= ficha.last_page}
              onClick={() => setPage((value) => value + 1)}
              className="rounded-md border border-line px-4 py-2 font-mono text-[11px] font-bold text-subtle disabled:opacity-40"
            >
              Siguiente →
            </button>
          </div>
        )}
      </section>

      <p className="border-t border-line pt-6 text-center font-mono text-[11px] tracking-[0.06em] text-subtle">
        Ficha y episodios provistos por JKAnime con su permiso
      </p>
    </div>
  );
}
