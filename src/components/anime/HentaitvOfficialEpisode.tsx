"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Surface } from "@/components/ui/Surface";
import type { ReproduccionHentaitv } from "@/lib/hentaitv";

export function HentaitvOfficialEpisode({ slug, episode }: { slug: string; episode: string }) {
  const [data, setData] = useState<ReproduccionHentaitv | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setData(null);
    try {
      const res = await fetch(`/api/anime/hentaitv/${encodeURIComponent(slug)}/${encodeURIComponent(episode)}`, { cache: "no-store" });
      const respuesta = await res.json();
      if (!res.ok) throw new Error(respuesta?.error ?? "No se pudo cargar el episodio");
      setData(respuesta);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el episodio");
    }
  }, [episode, slug]);

  useEffect(() => void load(), [load]);

  const guardarInicio = () => {
    if (!data) return;
    void fetch("/api/anime/externo/progreso", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        source: "hentaitv",
        external_id: data.external_id,
        slug: data.slug,
        title: data.series_title,
        cover_url: data.cover_url,
        total_episodes: data.total_episodes,
        episode_id: data.episode_id,
        episode_number: data.episode_number,
        episode_title: data.episode_title,
        position_seconds: 1,
        duration_seconds: 0,
      }),
    });
  };

  if (error) {
    return (
      <Surface className="mx-auto max-w-xl p-8 text-center">
        <h1 className="font-display text-2xl font-bold text-ink">No se pudo cargar esta fuente</h1>
        <p className="mt-2 text-sm text-red-400">{error}</p>
        <button type="button" onClick={load} className="mt-5 rounded-md border border-line px-4 py-2 font-mono text-[11px] font-bold text-subtle">Reintentar</button>
      </Surface>
    );
  }

  if (!data) {
    return <p className="py-20 text-center font-mono text-[13px] tracking-[0.08em] text-subtle">Preparando episodio...</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={`/explorar/hentaitv/${data.slug}`} className="inline-block font-mono text-[11px] font-bold tracking-[0.06em] text-subtle transition hover:text-accent-ink">← Volver a la serie</Link>
      <Surface className="overflow-hidden p-0">
        {data.poster_url && (
          <div className="aspect-video overflow-hidden border-b border-line bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.poster_url} alt="" className="h-full w-full object-cover opacity-70" referrerPolicy="no-referrer" />
          </div>
        )}
        <div className="space-y-5 p-6 sm:p-8">
          <div>
            <p className="font-mono text-[11px] font-bold tracking-[0.08em] text-accent-ink">HentaiTV · Episodio {data.episode_number}</p>
            <h1 className="mt-2 font-display text-3xl font-bold text-ink">{data.series_title}</h1>
          </div>
          <p className="text-sm leading-6 text-subtle">
            HentaiTV protege su reproductor para que funcione únicamente en su propio dominio. El episodio se abrirá en su página oficial.
          </p>
          <a
            href={data.url_original}
            target="_blank"
            rel="noopener noreferrer"
            onClick={guardarInicio}
            className="inline-flex min-h-12 items-center rounded-md border border-accent bg-accent px-5 font-mono text-[11px] font-bold tracking-[0.06em] text-[var(--on-accent)] transition hover:opacity-90"
          >
            Abrir reproductor oficial ↗
          </a>
        </div>
      </Surface>
      <p className="text-center font-mono text-[11px] tracking-[0.06em] text-subtle">Episodio provisto por HentaiTV con su permiso</p>
    </div>
  );
}
