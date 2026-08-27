"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { use } from "react";
import { SaveExternalButton } from "@/components/library/SaveExternalButton";
import { Surface } from "@/components/ui/Surface";

interface SerieOlympus {
  id: number;
  slug: string;
  title: string;
  cover_url: string | null;
  status: string | null;
  chapter_count: number | null;
  type: string;
  url_original: string;
  summary: string | null;
  genres: string[];
  team: string;
}

interface CapituloOlympus {
  id: number;
  name: string;
  published_at: string;
  team: string;
}

export default function SerieOlympusPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = use(props.params);
  const [serie, setSerie] = useState<SerieOlympus | null>(null);
  const [capitulos, setCapitulos] = useState<CapituloOlympus[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [error, setError] = useState(false);

  const cargar = useCallback(async () => {
    setError(false);
    try {
      const res = await fetch(`/api/externo/olympus/series/${slug}?page=${page}`);
      if (!res.ok) throw new Error("fallo");
      const data = await res.json();
      setSerie(data.serie);
      setCapitulos(data.chapters);
      setLastPage(data.last_page);
    } catch {
      setError(true);
    }
  }, [slug, page]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (error) {
    return (
      <Surface className="p-10 text-center">
        <p className="text-lg font-bold text-ink">No se pudo cargar la serie</p>
        <Link href="/explorar" className="mt-3 inline-block text-sm text-accent hover:underline">
          Volver a Explorar
        </Link>
      </Surface>
    );
  }

  if (!serie) {
    return (
      <p className="py-20 text-center font-mono text-xs uppercase tracking-[0.14em] text-subtle">
        Cargando...
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <Link
        href="/explorar?fuente=olympus"
        className="inline-block font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-subtle transition hover:text-accent"
      >
        ← Explorar
      </Link>

      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="w-full shrink-0 sm:w-48">
          <div className="aspect-[2/3] overflow-hidden rounded-2xl border border-line bg-[var(--surface-raised)]">
            {serie.cover_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={serie.cover_url}
                alt={serie.title}
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <h1 className="font-display text-3xl font-black uppercase leading-[0.95] tracking-[-0.04em] text-ink sm:text-4xl">
              {serie.title}
            </h1>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-subtle">
              {[serie.status, serie.chapter_count !== null ? `${serie.chapter_count} capítulos` : null].filter(Boolean).join(" · ")}
            </p>
          </div>

          <SaveExternalButton
            serie={{
              source: "olympus",
              external_id: serie.slug,
              slug: serie.slug,
              title: serie.title,
              cover_url: serie.cover_url,
              type: serie.type,
            }}
          />

          {/* atribución al grupo, en la ficha */}
          <a
            href={serie.url_original}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-accent bg-[var(--accent-soft)] px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-accent transition hover:opacity-90"
          >
            Traducido por {serie.team} ↗
          </a>

          {serie.genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {serie.genres.map((g) => (
                <span
                  key={g}
                  className="rounded-full border border-line bg-[var(--surface-raised)] px-3 py-1 text-xs text-subtle"
                >
                  {g.trim()}
                </span>
              ))}
            </div>
          )}

          {serie.summary && (
            <p className="max-w-3xl whitespace-pre-line text-sm leading-6 text-subtle">
              {serie.summary}
            </p>
          )}
        </div>
      </div>

      <section>
        <h2 className="mb-4 font-display text-2xl font-black uppercase tracking-[-0.03em] text-ink">
          Capítulos
        </h2>

        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
          {capitulos.map((c) => (
            <li key={c.id}>
              <Link
                href={`/leer-externo/olympus/${c.id}?slug=${serie.slug}&tipo=${serie.type}`}
                className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-[var(--surface-raised)]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">Capítulo {c.name}</p>
                  <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-subtle">
                    {c.team} ·{" "}
                    {new Date(c.published_at).toLocaleDateString("es-AR", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.1em] text-accent">
                  Leer →
                </span>
              </Link>
            </li>
          ))}
        </ul>

        {lastPage > 1 && (
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="rounded-xl border border-line px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-subtle transition hover:border-accent hover:text-ink disabled:opacity-40"
            >
              ← Anterior
            </button>
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-subtle">
              {page} / {lastPage}
            </span>
            <button
              disabled={page >= lastPage}
              onClick={() => setPage(page + 1)}
              className="rounded-xl border border-line px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-subtle transition hover:border-accent hover:text-ink disabled:opacity-40"
            >
              Siguiente →
            </button>
          </div>
        )}
      </section>

      <p className="border-t border-line pt-6 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-subtle">
        Serie y capítulos de{" "}
        <a href={serie.url_original} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
          {serie.team}
        </a>
        , publicados con su permiso
      </p>
    </div>
  );
}
