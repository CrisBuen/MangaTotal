"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { EmptyState, Skeleton } from "@/components/ui/Feedback";

interface Entrada {
  anilist_id: number;
  title: string;
  cover_url: string | null;
  total_episodes: number | null;
  status: string;
  episodes_watched: number;
  score: number | null;
}

interface Novedad {
  emitidos: number | null;
  total: number | null;
  sinVer: number;
  enEmision: boolean;
}

const ESTADOS: { key: string; label: string }[] = [
  { key: "watching", label: "Viendo" },
  { key: "planned", label: "Pendientes" },
  { key: "completed", label: "Terminadas" },
  { key: "dropped", label: "Abandonadas" },
];

/**
 * Series animadas de la biblioteca: lo mismo que la sección de lectura pero
 * para el seguimiento de anime. No se reproduce nada acá — cada ficha lleva
 * a las plataformas con licencia que publica AniList.
 */
export function SeccionAnimadas({ busqueda }: { busqueda: string }) {
  const [entradas, setEntradas] = useState<Entrada[] | null>(null);
  const [novedades, setNovedades] = useState<Record<number, Novedad>>({});
  const [estado, setEstado] = useState<string | null>(null);
  const [revisando, setRevisando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch("/api/anime/lista");
      setEntradas(r.ok ? await r.json() : []);
    } catch {
      setEntradas([]);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function actualizarTodo() {
    if (revisando) return;
    setRevisando(true);
    try {
      const r = await fetch("/api/anime/novedades", { cache: "no-store" });
      if (r.ok) setNovedades(await r.json());
    } finally {
      setRevisando(false);
    }
  }

  if (entradas === null) {
    return (
      <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[2/3] w-full" />
        ))}
      </div>
    );
  }

  if (entradas.length === 0) {
    return (
      <EmptyState
        title="Todavía no seguís ninguna serie animada"
        description="Buscá una en la pestaña Anime y agregala para llevar la cuenta de los episodios."
        action={
          <Link
            href="/anime"
            className="inline-flex min-h-11 items-center rounded-xl border border-accent bg-accent px-5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--bg)]"
          >
            Ir a Anime
          </Link>
        }
      />
    );
  }

  const texto = busqueda.trim().toLowerCase();
  const visibles = entradas
    .filter((e) => (estado ? e.status === estado : true))
    .filter((e) => (texto ? e.title.toLowerCase().includes(texto) : true))
    // adelante las que tienen episodios sin ver
    .sort((a, b) => (novedades[b.anilist_id]?.sinVer ?? 0) - (novedades[a.anilist_id]?.sinVer ?? 0));

  const continuando = visibles.filter(
    (e) => e.status === "watching" && e.episodes_watched > 0
  );

  return (
    <div className="space-y-12">
      <section className="flex flex-col gap-4 rounded-2xl border border-line bg-panel p-3 sm:flex-row sm:items-center">
        <div className="flex gap-1 overflow-x-auto">
          <button
            onClick={() => setEstado(null)}
            className={`min-h-11 shrink-0 rounded-xl px-4 text-[11px] font-bold uppercase tracking-[0.12em] transition ${
              estado === null
                ? "bg-[var(--accent-soft)] text-accent ring-1 ring-accent"
                : "text-subtle hover:bg-[var(--surface-raised)] hover:text-ink"
            }`}
          >
            Todas
          </button>
          {ESTADOS.map((s) => (
            <button
              key={s.key}
              onClick={() => setEstado(estado === s.key ? null : s.key)}
              className={`min-h-11 shrink-0 rounded-xl px-4 text-[11px] font-bold uppercase tracking-[0.12em] transition ${
                estado === s.key
                  ? "bg-[var(--accent-soft)] text-accent ring-1 ring-accent"
                  : "text-subtle hover:bg-[var(--surface-raised)] hover:text-ink"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button
          onClick={actualizarTodo}
          disabled={revisando}
          title="Revisa si salieron episodios nuevos de lo que seguís"
          className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-line px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-subtle transition hover:border-accent hover:text-ink disabled:opacity-60 sm:ml-auto"
        >
          <svg
            viewBox="0 0 24 24"
            className={`h-3.5 w-3.5 fill-current ${revisando ? "animate-spin" : ""}`}
            aria-hidden="true"
          >
            <path d="M12 5V2L8 6l4 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z" />
          </svg>
          {revisando ? "Revisando" : "Actualizar todo"}
        </button>
      </section>

      {continuando.length > 0 && (
        <section>
          <div className="mb-5 flex items-end justify-between gap-4">
            <h2 className="font-display text-3xl font-black uppercase leading-none text-ink sm:text-4xl">
              Continuar viendo
            </h2>
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-subtle">
              Tu progreso
            </span>
          </div>
          <div className="flex gap-5 overflow-x-auto rounded-2xl border border-line bg-panel p-5">
            {continuando.map((e) => (
              <Tarjeta key={e.anilist_id} entrada={e} novedad={novedades[e.anilist_id]} ancho />
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-5 flex items-end justify-between gap-4">
          <h2 className="font-display text-3xl font-black uppercase leading-none text-ink sm:text-4xl">
            Series animadas
          </h2>
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-subtle">
            AniList
          </span>
        </div>
        {visibles.length === 0 ? (
          <EmptyState title="Sin resultados" description="Probá con otro nombre o cambiá el estado." />
        ) : (
          <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
            {visibles.map((e) => (
              <Tarjeta key={e.anilist_id} entrada={e} novedad={novedades[e.anilist_id]} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Tarjeta({
  entrada,
  novedad,
  ancho = false,
}: {
  entrada: Entrada;
  novedad?: Novedad;
  ancho?: boolean;
}) {
  const total = novedad?.total ?? entrada.total_episodes;
  const sinVer = novedad?.sinVer ?? 0;

  return (
    <Link
      href={`/anime/${entrada.anilist_id}`}
      className={`group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        ancho ? "w-40 shrink-0" : ""
      }`}
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
        {sinVer > 0 && (
          <span className="absolute right-3 top-3 rounded-full bg-accent px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--bg)]">
            +{sinVer}
          </span>
        )}
        {novedad?.enEmision && (
          <span className="absolute left-3 top-3 rounded-full bg-[color-mix(in_oklch,var(--bg)_86%,transparent)] px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-accent backdrop-blur-md">
            En emisión
          </span>
        )}
      </div>
      <div className="px-1 pt-4">
        <h3 className="line-clamp-2 text-lg font-bold leading-[1.12] text-ink transition group-hover:text-accent">
          {entrada.title}
        </h3>
        <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.12em] text-subtle">
          Ep. {entrada.episodes_watched}
          {total ? ` de ${total}` : ""}
        </p>
      </div>
    </Link>
  );
}
