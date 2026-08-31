"use client";

import Link from "next/link";
import { AvisoFuente } from "@/components/fuentes/AvisoFuente";
import { use, useCallback, useEffect, useState } from "react";
import { anotarHistorial } from "@/components/library/historial";
import { SaveExternalButton } from "@/components/library/SaveExternalButton";
import { estiloCapitulo, sufijoPagina, useProgresoSerie } from "@/components/library/useProgresoSerie";
import { IKIGAI_NOMBRE, ikigaiDisponible, serieIkigai } from "@/lib/ikigai";

type Ficha = Awaited<ReturnType<typeof serieIkigai>>;

export default function SerieIkigaiPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = use(props.params);
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [orden, setOrden] = useState<"asc" | "desc">("asc");
  const progreso = useProgresoSerie("ikigai", slug);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setFicha(await serieIkigai(slug));
    } catch (err) {
      setError(err);
    }
  }, [slug]);

  useEffect(() => {
    if (!ikigaiDisponible()) {
      setError(new Error(IKIGAI_NOMBRE + " solo está disponible en la app de Android o de Windows"));
      return;
    }
    cargar();
  }, [cargar]);

  if (error) {
    return <AvisoFuente error={error} onReintentar={cargar} />;
  }

  if (!ficha) {
    return (
      <p className="py-20 text-center font-mono text-[13px] tracking-[0.08em] text-subtle">
        Cargando...
      </p>
    );
  }

  const capitulos = orden === "asc" ? ficha.capitulos : [...ficha.capitulos].reverse();

  // la misma serie sirve para guardarla y para anotarla en el historial
  const serieGuardable = {
    source: "ikigai" as const,
    external_id: slug,
    slug,
    title: ficha.title,
    cover_url: ficha.cover_url,
  };

  return (
    <div className="space-y-8">
      <Link
        href="/explorar"
        className="inline-block font-mono text-[11px] font-bold tracking-[0.06em] text-subtle transition hover:text-accent-ink"
      >
        ← Explorar
      </Link>

      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="w-full shrink-0 sm:w-48">
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

        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <h1 className="font-display text-3xl font-bold leading-[0.95] tracking-[-0.04em] text-ink sm:text-4xl">
              {ficha.title}
            </h1>
            <p className="mt-1 font-mono text-[13px] text-faint">
              {ficha.capitulos.length} capítulos
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <SaveExternalButton serie={serieGuardable} />
            <a
              href={ficha.url_original}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center rounded-md border border-accent bg-[var(--accent-soft)] px-4 font-mono text-[11px] font-bold tracking-[0.06em] text-accent-ink transition hover:opacity-90"
            >
              Ver en {IKIGAI_NOMBRE} ↗
            </a>
          </div>

          {ficha.generos.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {ficha.generos.map((g) => (
                <span
                  key={g}
                  className="rounded-full border border-line bg-[var(--surface-raised)] px-3 py-1 text-[13px] text-subtle"
                >
                  {g}
                </span>
              ))}
            </div>
          )}

          {ficha.description && (
            <p className="max-w-3xl whitespace-pre-line text-sm leading-6 text-subtle">
              {ficha.description}
            </p>
          )}
        </div>
      </div>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-bold tracking-[-0.03em] text-ink">
            Capítulos
          </h2>
          <button
            onClick={() => setOrden(orden === "asc" ? "desc" : "asc")}
            className="rounded-md border border-line px-3 py-2 font-mono text-[11px] font-bold tracking-[0.06em] text-subtle transition hover:border-line-strong hover:text-ink"
          >
            {orden === "asc" ? "Del 1 al último ↑" : "Del último al 1 ↓"}
          </button>
        </div>
        <ul className="divide-y divide-line overflow-hidden rounded-[10px] border border-line">
          {capitulos.map((c) => (
            <li key={c.id}>
              <Link
                onClick={() =>
                  anotarHistorial({
                    ...serieGuardable,
                    last_chapter_id: String(c.id),
                    last_chapter_name: String(c.numero ?? c.id),
                  })
                }
                href={`/leer-externo/ikigai/${c.id}?slug=${slug}${sufijoPagina(progreso, c.id === progreso.ultimoId) ? "&" + sufijoPagina(progreso, true) : ""}`}
                className={`flex items-center gap-3 px-5 py-3.5 transition hover:bg-[var(--surface-raised)] ${estiloCapitulo(
                  c.id === progreso.ultimoId,
                  progreso.ultimoNumero !== null && Number(c.numero) < progreso.ultimoNumero
                )}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">
                    Capítulo {c.numero ?? "?"}
                    {c.id === progreso.ultimoId && (
                      <span className="ml-2 font-mono text-[11px] tracking-[0.1em] text-accent-ink">
                        vas por acá
                      </span>
                    )}
                  </p>
                  {c.fecha && (
                    <p className="mt-0.5 font-mono text-[11px] tracking-[0.06em] text-subtle">
                      {c.fecha}
                    </p>
                  )}
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
        Traducido por{" "}
        <a
          href={ficha.url_original}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-ink hover:underline"
        >
          {IKIGAI_NOMBRE}
        </a>
        , publicado con su permiso
      </p>
    </div>
  );
}
