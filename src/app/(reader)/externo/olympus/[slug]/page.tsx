"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { use } from "react";
import { anotarHistorial } from "@/components/library/historial";
import { SaveExternalButton } from "@/components/library/SaveExternalButton";
import { useRefrescoSerie } from "@/components/library/useRefrescoSerie";
import { capituloLeido, estiloCapitulo, paginaCapitulo, useProgresoSerie } from "@/components/library/useProgresoSerie";
import { Surface } from "@/components/ui/Surface";
import { cargarConCacheAndroid } from "@/lib/androidCache";

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
  const [error, setError] = useState(false);
  const [orden, setOrden] = useState<"asc" | "desc">("asc");
  const progreso = useProgresoSerie("olympus", slug);
  const solicitud = useRef(0);

  const cargar = useCallback(async (fresco = false) => {
    const actual = ++solicitud.current;
    if (!fresco) {
      setError(false);
      setSerie(null);
      setCapitulos([]);
    }
    const aplicar = (data: { serie: SerieOlympus; chapters: CapituloOlympus[] }) => {
      if (actual !== solicitud.current) return;
      setSerie(data.serie);
      setCapitulos(data.chapters);
    };
    try {
      const data = await cargarConCacheAndroid<{ serie: SerieOlympus; chapters: CapituloOlympus[] }>(
        `ficha:olympus:${slug}`,
        async (signal) => {
          const res = await fetch(`/api/externo/olympus/series/${encodeURIComponent(slug)}${fresco ? "?fresco=1" : ""}`, { signal, cache: fresco ? "no-store" : "default" });
          if (!res.ok) throw new Error("fallo");
          return res.json();
        },
        {
          publicCache: true,
          force: fresco,
          freshForMs: 5 * 60 * 1000,
          maxAgeMs: 24 * 60 * 60 * 1000,
          timeoutMs: fresco ? 19_000 : 30_000,
          onCached: aplicar,
        }
      );
      aplicar(data);
    } catch (err) {
      if (fresco) throw err;
      if (actual === solicitud.current) setError(true);
    }
  }, [slug]);
  const refresco = useRefrescoSerie(() => cargar(true));

  useEffect(() => {
    cargar();
    return () => { solicitud.current++; };
  }, [cargar]);

  if (error) {
    return (
      <Surface className="p-10 text-center">
        <p className="text-lg font-bold text-ink">No se pudo cargar la serie</p>
        <Link href="/explorar" className="mt-3 inline-block text-sm text-accent-ink hover:underline">
          Volver a Explorar
        </Link>
      </Surface>
    );
  }

  if (!serie) {
    return (
      <p className="py-20 text-center font-mono text-[13px] tracking-[0.08em] text-subtle">
        Cargando...
      </p>
    );
  }

  const capitulosOrdenados = orden === "asc" ? capitulos : [...capitulos].reverse();

  // la misma serie sirve para guardarla y para anotarla en el historial
  const serieGuardable = {
    source: "olympus" as const,
    // La URL guardada sigue siendo la identidad de la entrada. Resolver la
    // ficha no debe crear otra fila ni desconectar favoritos y progreso.
    external_id: slug,
    slug,
    title: serie.title,
    cover_url: serie.cover_url,
    type: serie.type,
  };

  return (
    <div className="space-y-8" {...refresco.gesto}>
      {refresco.android && (refresco.refrescando || refresco.desplazamiento > 0) && (
        <div className="fixed left-1/2 top-4 z-[80] -translate-x-1/2 rounded-full border border-line bg-panel px-4 py-2 text-sm text-ink shadow-xl" role="status">
          <span className="mr-2 inline-block animate-spin">↻</span>Actualizando capítulos…
        </div>
      )}
      {refresco.aviso && <p className="text-sm text-subtle" role="status">{refresco.aviso}</p>}
      <Link
        href="/explorar?fuente=olympus"
        className="inline-block font-mono text-[11px] font-bold tracking-[0.06em] text-subtle transition hover:text-accent-ink"
      >
        ← Explorar
      </Link>

      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="w-full shrink-0 sm:w-48">
          <div className="aspect-[2/3] overflow-hidden rounded-[10px] border border-line bg-[var(--surface-raised)]">
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
            <h1 className="font-display text-3xl font-bold leading-[0.95] tracking-[-0.04em] text-ink sm:text-4xl">
              {serie.title}
            </h1>
            <p className="mt-1 font-mono text-[13px] text-faint">
              {[serie.status, serie.chapter_count !== null ? `${serie.chapter_count} capítulos` : null].filter(Boolean).join(" · ")}
            </p>
          </div>

          <SaveExternalButton serie={serieGuardable} />

          {/* atribución al grupo, en la ficha */}
          <a
            href={serie.url_original}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-accent bg-[var(--accent-soft)] px-3 py-2 font-mono text-[11px] font-bold tracking-[0.06em] text-accent-ink transition hover:opacity-90"
          >
            Traducido por {serie.team} ↗
          </a>

          {serie.genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {serie.genres.map((g) => (
                <span
                  key={g}
                  className="rounded-full border border-line bg-[var(--surface-raised)] px-3 py-1 text-[13px] text-subtle"
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
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-bold tracking-[-0.03em] text-ink">
            Capítulos
          </h2>
          <div className="flex items-center gap-2">
          {!refresco.android && <button type="button" onClick={refresco.refrescar} disabled={refresco.refrescando}
            className="rounded-md border border-line px-3 py-2 font-mono text-[11px] font-bold text-subtle disabled:opacity-60">
            {refresco.refrescando ? "Actualizando…" : "↻ Actualizar"}
          </button>}
          <button
            onClick={() => setOrden(orden === "asc" ? "desc" : "asc")}
            className="rounded-md border border-line px-3 py-2 font-mono text-[11px] font-bold tracking-[0.06em] text-subtle transition hover:border-line-strong hover:text-ink"
          >
            {orden === "asc" ? "Del 1 al último ↑" : "Del último al 1 ↓"}
          </button>
          </div>
        </div>

        <ul className="divide-y divide-line overflow-hidden rounded-[10px] border border-line">
          {capitulosOrdenados.map((c) => (
            <li key={c.id}>
              <Link
                onClick={() =>
                  anotarHistorial({
                    ...serieGuardable,
                    last_chapter_id: String(c.id),
                    last_chapter_name: String(c.name),
                  })
                }
                href={`/leer-externo/olympus/${c.id}?slug=${encodeURIComponent(slug)}&tipo=${serie.type}${paginaCapitulo(progreso, String(c.id)) ? "&" + paginaCapitulo(progreso, String(c.id)) : ""}`}
                className={`flex items-center gap-3 px-5 py-3.5 transition hover:bg-[var(--surface-raised)] ${estiloCapitulo(
                  String(c.id) === progreso.ultimoId,
                  capituloLeido(progreso, String(c.id), c.name)
                )}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">
                    Capítulo {c.name}
                    {String(c.id) === progreso.ultimoId && (
                      <span className="ml-2 font-mono text-[11px] tracking-[0.1em] text-accent-ink">
                        vas por acá
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] tracking-[0.06em] text-subtle">
                    {c.team} ·{" "}
                    {new Date(c.published_at).toLocaleDateString("es-AR", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-[11px] tracking-[0.1em] text-accent-ink">
                  Leer →
                </span>
              </Link>
            </li>
          ))}
        </ul>

      </section>

      <p className="border-t border-line pt-6 text-center font-mono text-[11px] tracking-[0.06em] text-subtle">
        Serie y capítulos de{" "}
        <a href={serie.url_original} target="_blank" rel="noopener noreferrer" className="text-accent-ink hover:underline">
          {serie.team}
        </a>
        , publicados con su permiso
      </p>
    </div>
  );
}
