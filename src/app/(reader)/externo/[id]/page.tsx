"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { Surface } from "@/components/ui/Surface";

interface ExternalSeries {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  year: number | null;
  is_adult: boolean;
  tags: string[];
  cover_url: string | null;
}

interface ExternalChapter {
  id: string;
  number: string | null;
  title: string | null;
  pages: number;
  lang: string;
  published_at: string;
  external_url: string | null;
  group: string | null;
}

export default function ExternalSeriePage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const [series, setSeries] = useState<ExternalSeries | null>(null);
  const [chapters, setChapters] = useState<ExternalChapter[]>([]);
  const [lang, setLang] = useState("es");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/externo/series/${id}?lang=${lang}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo cargar la serie");
        return;
      }
      setSeries(data.series);
      setChapters(data.chapters);
    } catch {
      setError("No se pudo conectar con el catálogo externo");
    } finally {
      setLoading(false);
    }
  }, [id, lang]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !series) {
    return (
      <p className="py-20 text-center font-mono text-xs uppercase tracking-[0.14em] text-subtle">
        Cargando serie...
      </p>
    );
  }

  if (error && !series) {
    return (
      <Surface className="p-12 text-center">
        <p className="text-lg font-bold text-ink">{error}</p>
        <Link
          href="/explorar"
          className="mt-4 inline-block font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-accent hover:underline"
        >
          ← Volver a explorar
        </Link>
      </Surface>
    );
  }

  if (!series) return null;

  const readable = chapters.filter((c) => !c.external_url);

  return (
    <div className="space-y-10">
      <Link
        href="/explorar"
        className="inline-block font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-subtle transition hover:text-accent"
      >
        ← Explorar
      </Link>

      <div className="flex flex-col gap-8 sm:flex-row">
        <div className="w-44 shrink-0 overflow-hidden rounded-2xl border border-line bg-[var(--surface-raised)] sm:w-52">
          <div className="aspect-[2/3]">
            {series.cover_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={series.cover_url}
                alt={series.title}
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-5xl text-subtle">📖</div>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h1 className="font-display text-4xl font-black uppercase leading-[0.95] tracking-[-0.04em] text-ink">
              {series.title}
            </h1>
            {series.is_adult && (
              <span className="rounded-full border border-danger px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-danger">
                +18
              </span>
            )}
          </div>

          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-subtle">
            Externo · MangaDex
            {series.status ? ` · ${series.status}` : ""}
            {series.year ? ` · ${series.year}` : ""} · {readable.length} capítulo
            {readable.length === 1 ? "" : "s"}
          </p>

          {series.tags.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {series.tags.slice(0, 12).map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-line bg-[var(--surface-raised)] px-2.5 py-0.5 text-xs text-subtle"
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          {series.description && (
            <p className="mb-5 max-w-3xl whitespace-pre-line text-sm leading-6 text-subtle">
              {series.description.slice(0, 600)}
              {series.description.length > 600 ? "..." : ""}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {readable.length > 0 && (
              <Link
                href={`/leer-externo/${readable[0].id}`}
                className="rounded-xl bg-accent px-5 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--bg)] transition hover:opacity-90"
              >
                Empezar a leer
              </Link>
            )}
            <div className="flex gap-1 rounded-xl border border-line bg-[var(--surface-raised)] p-1">
              {[
                { key: "es", label: "Español" },
                { key: "en", label: "Inglés" },
              ].map((l) => (
                <button
                  key={l.key}
                  onClick={() => setLang(l.key)}
                  className={`rounded-lg px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] transition ${
                    lang === l.key ? "bg-accent text-[var(--bg)]" : "text-subtle hover:text-ink"
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <section>
        <h2 className="mb-4 font-display text-2xl font-black uppercase tracking-[-0.03em] text-ink">
          Capítulos
        </h2>
        {chapters.length === 0 ? (
          <Surface className="p-10 text-center text-sm text-subtle">
            No hay capítulos en este idioma. Probá cambiando el idioma arriba.
          </Surface>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
            {chapters.map((c) => {
              const label = `Capítulo ${c.number ?? "?"}${c.title ? `: ${c.title}` : ""}`;
              const inner = (
                <div className="flex items-center gap-4 px-5 py-3.5 transition hover:bg-[var(--surface-raised)]">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{label}</p>
                    <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-subtle">
                      {c.group ?? "Grupo desconocido"} · {c.lang}
                      {c.pages > 0 ? ` · ${c.pages} págs.` : ""}
                    </p>
                  </div>
                  {c.external_url ? (
                    <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.1em] text-subtle">
                      Externo ↗
                    </span>
                  ) : (
                    <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.1em] text-accent">
                      Leer →
                    </span>
                  )}
                </div>
              );

              return (
                <li key={c.id}>
                  {c.external_url ? (
                    <a href={c.external_url} target="_blank" rel="noopener noreferrer">
                      {inner}
                    </a>
                  ) : (
                    <Link href={`/leer-externo/${c.id}`}>{inner}</Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="border-t border-line pt-6 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-subtle">
        Serie y capítulos alojados en MangaDex · traducciones de sus grupos de scanlation
      </p>
    </div>
  );
}
