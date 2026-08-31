"use client";

import { useEffect, useState } from "react";
import type { FuenteAnimeExterna } from "@/lib/animeExternos";

export interface AnimeExternoGuardable {
  source: FuenteAnimeExterna;
  external_id: string;
  slug: string;
  title: string;
  cover_url?: string | null;
  type?: string | null;
  status?: string | null;
  total_episodes?: number | null;
}

/** Guarda referencias de anime externo; el reproductor permanece en la fuente. */
export function SaveExternalAnimeButton({ anime }: { anime: AnimeExternoGuardable }) {
  const [guardado, setGuardado] = useState<boolean | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/anime/externo/biblioteca", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : []))
      .then((lista: { source: string; external_id: string }[]) =>
        setGuardado(
          lista.some(
            (entrada) => entrada.source === anime.source && entrada.external_id === anime.external_id
          )
        )
      )
      .catch(() => setGuardado(false));
  }, [anime.external_id, anime.source]);

  async function alternar() {
    setOcupado(true);
    setError(null);
    try {
      const res = guardado
        ? await fetch(
            `/api/anime/externo/biblioteca?source=${anime.source}&id=${encodeURIComponent(anime.external_id)}`,
            { method: "DELETE" }
          )
        : await fetch("/api/anime/externo/biblioteca", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(anime),
          });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "No se pudo actualizar la biblioteca");
      }
      setGuardado(!guardado);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la biblioteca");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="space-y-1">
      <button
        onClick={alternar}
        disabled={ocupado || guardado === null}
        className={`inline-flex min-h-11 items-center gap-2 rounded-md border px-4 font-mono text-[11px] font-bold tracking-[0.06em] transition disabled:opacity-50 ${
          guardado
            ? "border-accent bg-[var(--accent-soft)] text-accent-ink"
            : "border-line text-subtle hover:border-line-strong hover:text-ink"
        }`}
        data-od-id="save-external-anime"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
          {guardado ? (
            <path d="M6 2h12a1 1 0 0 1 1 1v18l-7-4-7 4V3a1 1 0 0 1 1-1zm5.2 12 5-5-1.4-1.4-3.6 3.6-1.8-1.8L8 11.8l3.2 3.2z" />
          ) : (
            <path d="M6 2h12a1 1 0 0 1 1 1v18l-7-4-7 4V3a1 1 0 0 1 1-1zm1 2v14.3l5-2.9 5 2.9V4H7z" />
          )}
        </svg>
        {guardado === null ? "..." : guardado ? "En Anime animado" : "Guardar en Anime animado"}
      </button>
      {error && <p className="max-w-xs text-[13px] text-red-400">{error}</p>}
    </div>
  );
}
