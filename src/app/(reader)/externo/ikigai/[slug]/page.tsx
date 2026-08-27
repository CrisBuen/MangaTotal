"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { SaveExternalButton } from "@/components/library/SaveExternalButton";
import { estiloCapitulo, sufijoPagina, useProgresoSerie } from "@/components/library/useProgresoSerie";
import { Surface } from "@/components/ui/Surface";
import { IKIGAI_NOMBRE, ikigaiDisponible, serieIkigai } from "@/lib/ikigai";

type Ficha = Awaited<ReturnType<typeof serieIkigai>>;

export default function SerieIkigaiPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = use(props.params);
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [orden, setOrden] = useState<"asc" | "desc">("asc");
  const progreso = useProgresoSerie("ikigai", slug);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setFicha(await serieIkigai(slug));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la serie");
    }
  }, [slug]);

  useEffect(() => {
    if (!ikigaiDisponible()) {
      setError(IKIGAI_NOMBRE + " solo está disponible en la app de Android o de Windows");
      return;
    }
    cargar();
  }, [cargar]);

  if (error) {
    return (
      <Surface className="p-10 text-center">
        <p className="text-lg font-bold text-ink">{error}</p>
        <Link href="/explorar" className="mt-4 inline-block text-sm text-accent hover:underline">
          Volver a Explorar
        </Link>
      </Surface>
    );
  }

  if (!ficha) {
    return (
      <p className="py-20 text-center font-mono text-xs uppercase tracking-[0.14em] text-subtle">
        Cargando...
      </p>
    );
  }

  const capitulos = orden === "asc" ? ficha.capitulos : [...ficha.capitulos].reverse();

  return (
    <div className="space-y-8">
      <Link
        href="/explorar"
        className="inline-block font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-subtle transition hover:text-accent"
      >
        ← Explorar
      </Link>

      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="w-full shrink-0 sm:w-48">
          <div className="aspect-[2/3] overflow-hidden rounded-2xl border border-line bg-[var(--surface-raised)]">
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
            <h1 className="font-display text-3xl font-black uppercase leading-[0.95] tracking-[-0.04em] text-ink sm:text-4xl">
              {ficha.title}
            </h1>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-subtle">
              {ficha.capitulos.length} capítulos
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <SaveExternalButton
              serie={{
                source: "ikigai",
                external_id: slug,
                slug,
                title: ficha.title,
                cover_url: ficha.cover_url,
              }}
            />
            <a
              href={ficha.url_original}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center rounded-xl border border-accent bg-[var(--accent-soft)] px-4 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-accent transition hover:opacity-90"
            >
              Ver en {IKIGAI_NOMBRE} ↗
            </a>
          </div>

          {ficha.generos.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {ficha.generos.map((g) => (
                <span
                  key={g}
                  className="rounded-full border border-line bg-[var(--surface-raised)] px-3 py-1 text-xs text-subtle"
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
          <h2 className="font-display text-2xl font-black uppercase tracking-[-0.03em] text-ink">
            Capítulos
          </h2>
          <button
            onClick={() => setOrden(orden === "asc" ? "desc" : "asc")}
            className="rounded-xl border border-line px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-subtle transition hover:border-accent hover:text-ink"
          >
            {orden === "asc" ? "Del 1 al último ↑" : "Del último al 1 ↓"}
          </button>
        </div>
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
          {capitulos.map((c) => (
            <li key={c.id}>
              <Link
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
                      <span className="ml-2 font-mono text-[9px] uppercase tracking-[0.1em] text-accent">
                        vas por acá
                      </span>
                    )}
                  </p>
                  {c.fecha && (
                    <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-subtle">
                      {c.fecha}
                    </p>
                  )}
                </div>
                <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.1em] text-accent">
                  Leer →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <p className="border-t border-line pt-6 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-subtle">
        Traducido por{" "}
        <a
          href={ficha.url_original}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          {IKIGAI_NOMBRE}
        </a>
        , publicado con su permiso
      </p>
    </div>
  );
}
