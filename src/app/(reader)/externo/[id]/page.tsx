"use client";

import Link from "next/link";
import { anotarHistorial } from "@/components/library/historial";
import { SaveExternalButton } from "@/components/library/SaveExternalButton";
import { estiloCapitulo, useProgresoSerie } from "@/components/library/useProgresoSerie";
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

interface ChapterEntry {
  number: string | null;
  chosen: ExternalChapter;
  versions: ExternalChapter[];
}

export default function ExternalSeriePage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const [series, setSeries] = useState<ExternalSeries | null>(null);
  const [chapters, setChapters] = useState<ChapterEntry[]>([]);
  const [openVersions, setOpenVersions] = useState<string | null>(null);
  const [lang, setLang] = useState("es");
  const [loading, setLoading] = useState(true);
  const [orden, setOrden] = useState<"asc" | "desc">("asc");
  const progreso = useProgresoSerie("mangadex", id);
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
      <p className="py-20 text-center font-mono text-[13px] tracking-[0.08em] text-subtle">
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
          className="mt-4 inline-block font-mono text-[11px] font-bold tracking-[0.06em] text-accent-ink hover:underline"
        >
          ← Volver a explorar
        </Link>
      </Surface>
    );
  }

  if (!series) return null;

  const readable = orden === "asc" ? chapters : [...chapters].reverse();

  // la misma serie sirve para guardarla y para anotarla en el historial
  const serieGuardable = {
    source: "mangadex" as const,
    external_id: series.id,
    title: series.title,
    cover_url: series.cover_url,
    type: series.is_adult ? "adult" : "normal",
  };

  return (
    <div className="space-y-10">
      <Link
        href="/explorar"
        className="inline-block font-mono text-[11px] font-bold tracking-[0.06em] text-subtle transition hover:text-accent-ink"
      >
        ← Explorar
      </Link>

      <div className="flex flex-col gap-8 sm:flex-row">
        <div className="w-44 shrink-0 overflow-hidden rounded-[10px] border border-line bg-[var(--surface-raised)] sm:w-52">
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
            <h1 className="font-display text-4xl font-bold leading-[0.95] tracking-[-0.04em] text-ink">
              {series.title}
            </h1>
            {series.is_adult && (
              <span className="rounded-full border border-danger px-2 py-0.5 font-mono text-[11px] font-bold tracking-[0.1em] text-danger">
                +18
              </span>
            )}
          </div>

          <p className="mb-3 font-mono text-[11px] tracking-[0.06em] text-subtle">
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
                  className="rounded-full border border-line bg-[var(--surface-raised)] px-2.5 py-0.5 text-[13px] text-subtle"
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
            {chapters.length > 0 && (
              <Link
                onClick={() =>
                  anotarHistorial({
                    ...serieGuardable,
                    last_chapter_id: String(chapters[0].chosen.id),
                    last_chapter_name: String(chapters[0].number ?? chapters[0].chosen.id),
                  })
                }
                href={`/leer-externo/${chapters[0].chosen.id}`}
                className="rounded-md bg-accent px-5 py-2.5 font-mono text-[11px] font-bold tracking-[0.06em] text-[var(--on-accent)] transition hover:opacity-90"
              >
                Empezar a leer
              </Link>
            )}
            <SaveExternalButton serie={serieGuardable} />
            <div className="flex gap-1 rounded-md border border-line bg-[var(--surface-raised)] p-1">
              {[
                { key: "es", label: "Español" },
                { key: "en", label: "Inglés" },
              ].map((l) => (
                <button
                  key={l.key}
                  onClick={() => setLang(l.key)}
                  className={`rounded-lg px-3 py-1.5 font-mono text-[11px] font-bold tracking-[0.06em] transition ${
                    lang === l.key ? "bg-accent text-[var(--on-accent)]" : "text-subtle hover:text-ink"
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
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-bold tracking-[-0.03em] text-ink">
            Capítulos
          </h2>
          {chapters.length > 1 && (
            <button
              onClick={() => setOrden(orden === "asc" ? "desc" : "asc")}
              className="rounded-md border border-line px-3 py-2 font-mono text-[11px] font-bold tracking-[0.06em] text-subtle transition hover:border-line-strong hover:text-ink"
            >
              {orden === "asc" ? "Del 1 al último ↑" : "Del último al 1 ↓"}
            </button>
          )}
        </div>
        {chapters.length === 0 ? (
          <Surface className="p-10 text-center text-sm text-subtle">
            No hay capítulos en este idioma. Probá cambiando el idioma arriba.
          </Surface>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-[10px] border border-line">
            {readable.map((entry) => {
              const c = entry.chosen;
              const key = entry.number ?? c.id;
              const label = `Capítulo ${entry.number ?? "?"}${c.title ? `: ${c.title}` : ""}`;
              const isOpen = openVersions === key;

              return (
                <li key={key}>
                  <div
                    className={`flex items-center gap-3 px-5 py-3.5 transition hover:bg-[var(--surface-raised)] ${estiloCapitulo(
                      c.id === progreso.ultimoId,
                      progreso.ultimoNumero !== null && Number(entry.number) < progreso.ultimoNumero
                    )}`}
                  >
                    <Link
                      onClick={() =>
                        anotarHistorial({
                          ...serieGuardable,
                          last_chapter_id: String(c.id),
                          last_chapter_name: String(entry.number ?? c.id),
                        })
                      }
                      href={`/leer-externo/${c.id}`}
                      className="min-w-0 flex-1"
                    >
                      <p className="truncate text-sm font-semibold text-ink">
                        {label}
                        {c.id === progreso.ultimoId && (
                          <span className="ml-2 font-mono text-[11px] tracking-[0.1em] text-accent-ink">
                            vas por acá
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] tracking-[0.06em] text-subtle">
                        {c.group ?? "Grupo desconocido"} · {c.pages} págs.
                      </p>
                    </Link>

                    {entry.versions.length > 1 && (
                      <button
                        onClick={() => setOpenVersions(isOpen ? null : key)}
                        className="shrink-0 rounded-lg border border-line px-2.5 py-1 font-mono text-[11px] tracking-[0.1em] text-subtle transition hover:border-line-strong hover:text-ink"
                      >
                        {entry.versions.length} versiones {isOpen ? "▲" : "▼"}
                      </button>
                    )}

                    <Link
                      onClick={() =>
                        anotarHistorial({
                          ...serieGuardable,
                          last_chapter_id: String(c.id),
                          last_chapter_name: String(entry.number ?? c.id),
                        })
                      }
                      href={`/leer-externo/${c.id}`}
                      className="shrink-0 font-mono text-[11px] tracking-[0.1em] text-accent-ink"
                    >
                      Leer →
                    </Link>
                  </div>

                  {isOpen && (
                    <ul className="border-t border-line bg-[var(--surface-raised)]">
                      {entry.versions.map((v) => (
                        <li key={v.id}>
                          <Link
                            onClick={() =>
                              anotarHistorial({
                                ...serieGuardable,
                                last_chapter_id: String(v.id),
                                last_chapter_name: String(entry.number ?? v.id),
                              })
                            }
                            href={`/leer-externo/${v.id}`}
                            className="flex items-center gap-3 px-8 py-2.5 transition hover:bg-[color-mix(in_oklch,var(--accent)_10%,transparent)]"
                          >
                            <span className="min-w-0 flex-1 truncate font-mono text-[11px] tracking-[0.1em] text-subtle">
                              {v.group ?? "Grupo desconocido"} · {v.pages} págs.
                            </span>
                            {v.id === c.id && (
                              <span className="shrink-0 font-mono text-[11px] tracking-[0.1em] text-accent-ink">
                                Predeterminada
                              </span>
                            )}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="border-t border-line pt-6 text-center font-mono text-[11px] tracking-[0.06em] text-subtle">
        Serie y capítulos alojados en MangaDex · traducciones de sus grupos de scanlation
      </p>
    </div>
  );
}
