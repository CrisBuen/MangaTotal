"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EpisodeWatchLink } from "@/components/anime/EpisodeWatchLink";
import { EmptyState, Skeleton } from "@/components/ui/Feedback";
import { cargarConCacheAndroid } from "@/lib/androidCache";

interface Entrada {
  source: string;
  external_id: string;
  title: string;
  cover_url: string | null;
  type: string | null;
  status: string | null;
  total_episodes: number | null;
  last_episode_number: string | null;
  last_position_seconds: number;
  last_duration_seconds: number;
  completed: boolean;
  href: string;
  resume_href: string | null;
}

interface ProgresoAnime {
  historial: Entrada[];
  continuar: Entrada[];
}

function minuto(segundos: number): string {
  const total = Math.max(0, Math.floor(segundos));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function coincide(entrada: Entrada, busqueda: string): boolean {
  const texto = busqueda.trim().toLocaleLowerCase("es");
  return texto ? entrada.title.toLocaleLowerCase("es").includes(texto) : true;
}

function TarjetaProgreso({
  entrada,
  reanudar = false,
}: {
  entrada: Entrada;
  reanudar?: boolean;
}) {
  const contenido = (
    <>
      <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-[var(--surface-raised)] ring-1 ring-line transition duration-300 group-hover:-translate-y-1 group-hover:ring-accent group-hover:shadow-[var(--glow)]">
        {entrada.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entrada.cover_url}
            alt={entrada.title}
            className="h-full w-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        )}
        <span className="absolute left-3 top-3 rounded-full bg-[color-mix(in_oklch,var(--bg)_86%,transparent)] px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-accent backdrop-blur-md">
          {entrada.source}
        </span>
      </div>
      <div className="px-1 pt-4">
        <h3 className="line-clamp-2 text-lg font-bold leading-[1.12] text-ink transition group-hover:text-accent">
          {entrada.title}
        </h3>
        {entrada.last_episode_number && (
          <p className="mt-2 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-accent">
            {entrada.completed
              ? `Episodio ${entrada.last_episode_number} · Ya visto`
              : entrada.last_position_seconds > 0
                ? `Episodio ${entrada.last_episode_number} · ${minuto(entrada.last_position_seconds)}`
                : `Episodio ${entrada.last_episode_number}`}
          </p>
        )}
      </div>
    </>
  );

  const className =
    "group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";
  if (reanudar && entrada.resume_href) {
    return (
      <EpisodeWatchLink href={entrada.resume_href} className={className}>
        {contenido}
      </EpisodeWatchLink>
    );
  }
  return <Link href={entrada.href} className={className}>{contenido}</Link>;
}

function BloqueProgreso({
  titulo,
  detalle,
  entradas,
  reanudar = false,
}: {
  titulo: string;
  detalle: string;
  entradas: Entrada[];
  reanudar?: boolean;
}) {
  if (entradas.length === 0) return null;
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-3xl font-black uppercase leading-none text-ink">
          {titulo}
        </h2>
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-subtle">
          {detalle}
        </span>
      </div>
      <div className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
          {entradas.map((entrada) => (
            <TarjetaProgreso
              key={`${titulo}:${entrada.source}:${entrada.external_id}`}
              entrada={entrada}
              reanudar={reanudar}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/** Biblioteca, historial y continuación de anime reproducible. */
export function SeccionAnimeExterno({ busqueda }: { busqueda: string }) {
  const [entradas, setEntradas] = useState<Entrada[] | null>(null);
  const [progreso, setProgreso] = useState<ProgresoAnime | null>(null);

  useEffect(() => {
    cargarConCacheAndroid<Entrada[]>(
      "biblioteca:anime-externo",
      async (signal) => {
        const res = await fetch("/api/anime/externo/biblioteca", {
          cache: "no-store",
          signal,
        });
        if (!res.ok) throw new Error("anime externo");
        return res.json();
      },
      { privateData: true, onCached: setEntradas }
    )
      .then((data) => setEntradas(Array.isArray(data) ? data : []))
      .catch(() => setEntradas([]));

    cargarConCacheAndroid<ProgresoAnime>(
      "biblioteca:anime-externo:progreso",
      async (signal) => {
        const res = await fetch("/api/anime/externo/historial", {
          cache: "no-store",
          signal,
        });
        if (!res.ok) throw new Error("historial de anime");
        return res.json();
      },
      {
        privateData: true,
        onCached: (data) => setProgreso({
          historial: Array.isArray(data?.historial) ? data.historial : [],
          continuar: Array.isArray(data?.continuar) ? data.continuar : [],
        }),
      }
    )
      .then((data) => setProgreso({
        historial: Array.isArray(data?.historial) ? data.historial : [],
        continuar: Array.isArray(data?.continuar) ? data.continuar : [],
      }))
      .catch(() => setProgreso({ historial: [], continuar: [] }));
  }, []);

  if (entradas === null) {
    return (
      <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="aspect-[2/3] w-full" />
        ))}
      </div>
    );
  }

  const visibles = entradas.filter((entrada) => coincide(entrada, busqueda));
  const historial = (progreso?.historial ?? []).filter((entrada) => coincide(entrada, busqueda));
  const continuar = (progreso?.continuar ?? []).filter((entrada) => coincide(entrada, busqueda));

  return (
    <div className="space-y-12" data-od-id="external-anime-library">
      <BloqueProgreso titulo="Historial" detalle="Visto y sin guardar" entradas={historial} />
      <BloqueProgreso
        titulo="Continuar viendo"
        detalle="Tu progreso"
        entradas={continuar}
        reanudar
      />

      <section className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-accent">
              Fuentes externas
            </p>
            <h2 className="mt-1 font-display text-3xl font-black uppercase leading-none text-ink">
              Anime animado
            </h2>
          </div>
          <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-subtle">
            {entradas.length} guardado{entradas.length === 1 ? "" : "s"}
          </span>
        </div>

        {entradas.length === 0 ? (
          <EmptyState
            title="Todavía no guardaste anime animado"
            description="Elegí una serie de JKAnime y guardala para encontrarla acá."
            action={
              <Link
                href="/explorar?seccion=animada"
                className="inline-flex min-h-11 items-center rounded-xl border border-accent bg-accent px-5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--bg)]"
              >
                Explorar anime
              </Link>
            }
          />
        ) : visibles.length === 0 ? (
          <EmptyState title="Sin resultados" description="Probá con otro nombre." />
        ) : (
          <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
            {visibles.map((entrada) => (
              <Link
                key={`${entrada.source}:${entrada.external_id}`}
                href={entrada.href}
                className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-[var(--surface-raised)] ring-1 ring-line transition duration-300 group-hover:-translate-y-1 group-hover:ring-accent group-hover:shadow-[var(--glow)]">
                  {entrada.cover_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={entrada.cover_url}
                      alt={entrada.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <span className="absolute left-3 top-3 rounded-full bg-[color-mix(in_oklch,var(--bg)_86%,transparent)] px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-accent backdrop-blur-md">
                    {entrada.source}
                  </span>
                </div>
                <div className="px-1 pt-4">
                  <h3 className="line-clamp-2 text-lg font-bold leading-[1.12] text-ink transition group-hover:text-accent">
                    {entrada.title}
                  </h3>
                  <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.12em] text-subtle">
                    {[entrada.type, entrada.status, entrada.total_episodes ? `${entrada.total_episodes} ep.` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
