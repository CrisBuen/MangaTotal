"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SectionHeading, Surface } from "@/components/ui/Surface";

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

const LANGS = [
  { key: "es", label: "Español" },
  { key: "en", label: "Inglés" },
];

export default function ExplorarPage() {
  const [series, setSeries] = useState<ExternalSeries[] | null>(null);
  const [lang, setLang] = useState("es");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    const params = new URLSearchParams({ lang, offset: String(offset) });
    if (search.trim()) params.set("q", search.trim());
    try {
      const res = await fetch(`/api/externo/series?${params}`);
      if (!res.ok) throw new Error("fallo");
      const data = await res.json();
      setSeries(data.series);
      setTotal(data.total);
    } catch {
      setError(true);
      setSeries([]);
    }
  }, [lang, search, offset]);

  useEffect(() => {
    setSeries(null);
    const t = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  // cambiar idioma o búsqueda vuelve a la primera página
  useEffect(() => {
    setOffset(0);
  }, [lang, search]);

  const page = Math.floor(offset / 24) + 1;
  const lastPage = Math.max(1, Math.ceil(Math.min(total, 9500) / 24));

  return (
    <div className="space-y-10">
      <SectionHeading
        eyebrow="Catálogo externo"
        title="Explorar"
        description="Series publicadas por grupos de scanlation en MangaDex. Se leen acá mismo, con tu progreso guardado."
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-xl border border-line bg-[var(--surface-raised)] p-1">
          {LANGS.map((l) => (
            <button
              key={l.key}
              onClick={() => setLang(l.key)}
              className={`rounded-lg px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] transition ${
                lang === l.key ? "bg-accent text-[var(--bg)]" : "text-subtle hover:text-ink"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar serie..."
          className="ml-auto w-full max-w-sm rounded-xl border border-line bg-[var(--surface-raised)] px-4 py-2.5 text-sm text-ink placeholder-subtle outline-none focus:border-accent"
        />
      </div>

      {error && (
        <Surface className="p-6 text-center text-sm text-subtle">
          No se pudo conectar con el catálogo externo. Intentá de nuevo en un momento.
        </Surface>
      )}

      {series === null ? (
        <p className="py-16 text-center font-mono text-xs uppercase tracking-[0.14em] text-subtle">
          Cargando catálogo...
        </p>
      ) : series.length === 0 && !error ? (
        <Surface className="p-12 text-center">
          <p className="text-lg font-bold text-ink">Sin resultados</p>
          <p className="mt-1 text-sm text-subtle">Probá con otro término o cambiá el idioma.</p>
        </Surface>
      ) : (
        <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
          {series.map((s) => (
            <Link
              key={s.id}
              href={`/externo/${s.id}`}
              className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-[var(--surface-raised)] ring-1 ring-line transition duration-300 group-hover:-translate-y-1 group-hover:ring-accent group-hover:shadow-[var(--glow)]">
                {s.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.cover_url}
                    alt={s.title}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-4 text-center font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-subtle">
                    Sin portada
                  </div>
                )}
                {s.is_adult && (
                  <span className="absolute left-3 top-3 rounded-full border border-danger bg-[color-mix(in_oklch,var(--bg)_82%,transparent)] px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-danger backdrop-blur-md">
                    +18
                  </span>
                )}
              </div>
              <div className="px-1 pt-4">
                <h3 className="line-clamp-2 text-lg font-bold leading-[1.12] text-ink transition group-hover:text-accent">
                  {s.title}
                </h3>
                {s.status && (
                  <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.12em] text-subtle">
                    {s.status}
                    {s.year ? ` · ${s.year}` : ""}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {series !== null && series.length > 0 && (
        <div className="flex items-center justify-center gap-3 pt-4">
          <button
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - 24))}
            className="rounded-xl border border-line px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-subtle transition hover:border-accent hover:text-ink disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-subtle">
            Página {page} de {lastPage}
          </span>
          <button
            disabled={page >= lastPage}
            onClick={() => setOffset(offset + 24)}
            className="rounded-xl border border-line px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-subtle transition hover:border-accent hover:text-ink disabled:opacity-40"
          >
            Siguiente →
          </button>
        </div>
      )}

      <p className="border-t border-line pt-6 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-subtle">
        Catálogo y capítulos provistos por MangaDex y sus grupos de scanlation
      </p>
    </div>
  );
}
