"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { EpisodeWatchLink } from "@/components/anime/EpisodeWatchLink";
import { EmptyState, Skeleton } from "@/components/ui/Feedback";
import { cargarConCacheAndroid, fetchConLimiteAndroid, guardarCacheAndroid } from "@/lib/androidCache";

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

function detalleEpisodio(entrada: Entrada): string {
  if (!entrada.last_episode_number) return entrada.source;
  if (entrada.completed) return `Episodio ${entrada.last_episode_number} · Ya visto`;
  if (entrada.last_position_seconds > 0) {
    return `Episodio ${entrada.last_episode_number} · ${minuto(entrada.last_position_seconds)}`;
  }
  return `Episodio ${entrada.last_episode_number}`;
}

function TarjetaProgreso({
  entrada,
  reanudar = false,
  historial = false,
  onQuitar,
  quitando = false,
}: {
  entrada: Entrada;
  reanudar?: boolean;
  historial?: boolean;
  onQuitar?: (entrada: Entrada) => void;
  quitando?: boolean;
}) {
  const [accionesTactiles, setAccionesTactiles] = useState(false);
  const pulsacion = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inicio = useRef<{ x: number; y: number } | null>(null);
  const omitirClick = useRef(false);

  function cancelarPulsacion() {
    if (pulsacion.current !== null) clearTimeout(pulsacion.current);
    pulsacion.current = null;
  }

  useEffect(() => () => cancelarPulsacion(), []);

  const contenido = (
    <>
      <div className="relative aspect-[2/3] overflow-hidden rounded-[10px] bg-[var(--surface-raised)] border border-line transition-colors group-hover:border-line-strong">
        {entrada.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entrada.cover_url}
            alt={entrada.title}
            className="h-full w-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
            draggable={false}
          />
        )}
        <span className="absolute left-3 top-3 rounded-full bg-[color-mix(in_oklch,var(--bg)_86%,transparent)] px-2 py-1 font-mono text-[11px] font-bold tracking-[0.1em] text-accent-ink ">
          {entrada.source}
        </span>
      </div>
      <div className="px-1 pt-4">
        <h3 className="line-clamp-2 text-base font-semibold leading-[1.25] text-ink transition-colors group-hover:text-accent-ink">
          {entrada.title}
        </h3>
        {!historial && entrada.last_episode_number && (
          <p className="mt-1 font-mono text-[13px] text-accent-ink">
            {detalleEpisodio(entrada)}
          </p>
        )}
      </div>
    </>
  );

  const className = "block rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";
  const enlace = reanudar && entrada.resume_href ? (
      <EpisodeWatchLink href={entrada.resume_href} className={className}>
        {contenido}
      </EpisodeWatchLink>
    ) : (
      <Link href={entrada.href} className={className}>{contenido}</Link>
    );

  return (
    <div
      className="group relative min-w-0"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setAccionesTactiles(false);
      }}
    >
      {historial && onQuitar && (
        <button
          type="button"
          onClick={() => onQuitar(entrada)}
          title="Sacar del historial"
          aria-label={`Sacar ${entrada.title} del historial`}
          disabled={quitando}
          className={`absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[color-mix(in_oklch,var(--bg)_80%,transparent)] text-sm text-subtle transition hover:text-accent-ink disabled:cursor-wait focus-visible:opacity-100 focus-visible:pointer-events-auto group-hover:opacity-100 group-hover:pointer-events-auto sm:h-7 sm:w-7 ${accionesTactiles ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        >
          ×
        </button>
      )}
      <div
        className={historial ? "select-none" : undefined}
        style={historial ? { WebkitTouchCallout: "none" } : undefined}
        onPointerDown={(event) => {
          cancelarPulsacion();
          omitirClick.current = false;
          inicio.current = null;
          if (!historial || !onQuitar || event.pointerType !== "touch" || !event.isPrimary) return;
          inicio.current = { x: event.clientX, y: event.clientY };
          // En Android no hay hover: mantener el dedo muestra la X sin abrir el episodio.
          pulsacion.current = setTimeout(() => {
            setAccionesTactiles(true);
            omitirClick.current = true;
          }, 450);
        }}
        onPointerMove={(event) => {
          if (inicio.current && Math.hypot(event.clientX - inicio.current.x, event.clientY - inicio.current.y) > 12) {
            cancelarPulsacion();
          }
        }}
        onPointerUp={cancelarPulsacion}
        onPointerCancel={cancelarPulsacion}
        onPointerLeave={cancelarPulsacion}
        onContextMenu={(event) => {
          if (historial && inicio.current) event.preventDefault();
        }}
        onClickCapture={(event) => {
          if (!omitirClick.current) return;
          event.preventDefault();
          event.stopPropagation();
          omitirClick.current = false;
        }}
      >
        {enlace}
      </div>
      {historial && (
        <div className="mt-1 flex items-center gap-2 px-1">
          <p className="min-w-0 flex-1 truncate font-mono text-[11px] tracking-[0.04em] text-subtle">
            {detalleEpisodio(entrada)}
          </p>
          <Link
            href={entrada.href}
            title="Ver ficha y episodios"
            aria-label={`Ver ficha de ${entrada.title}`}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-line text-sm text-subtle transition hover:border-line-strong hover:text-accent-ink"
          >
            →
          </Link>
        </div>
      )}
    </div>
  );
}

function BloqueProgreso({
  titulo,
  detalle,
  entradas,
  reanudar = false,
  historial = false,
  onQuitar,
  quitando = false,
}: {
  titulo: string;
  detalle: string;
  entradas: Entrada[];
  reanudar?: boolean;
  historial?: boolean;
  onQuitar?: (entrada: Entrada) => void;
  quitando?: boolean;
}) {
  if (entradas.length === 0) return null;
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-3xl font-bold leading-none text-ink">
          {titulo}
        </h2>
        <span className="font-mono text-[11px] tracking-[0.06em] text-subtle">
          {detalle}
        </span>
      </div>
      <div className="rounded-[10px] border border-line bg-panel p-4 sm:p-5">
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {entradas.map((entrada) => (
            <TarjetaProgreso
              key={`${titulo}:${entrada.source}:${entrada.external_id}`}
              entrada={entrada}
              reanudar={reanudar || historial}
              historial={historial}
              onQuitar={onQuitar}
              quitando={quitando}
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
  const [cargandoProgreso, setCargandoProgreso] = useState(true);
  const [quitando, setQuitando] = useState(false);
  const [errorHistorial, setErrorHistorial] = useState<string | null>(null);
  const [historialModificado, setHistorialModificado] = useState(false);

  // Solo persistimos una eliminación confirmada, fuera del actualizador de React.
  useEffect(() => {
    if (historialModificado && progreso) {
      void guardarCacheAndroid("biblioteca:anime-externo:progreso", progreso, { privateData: true });
    }
  }, [historialModificado, progreso]);

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
      .catch(() => setProgreso({ historial: [], continuar: [] }))
      .finally(() => setCargandoProgreso(false));
  }, []);

  async function quitarHistorial(entrada: Entrada) {
    if (quitando || cargandoProgreso) return;
    setQuitando(true);
    setErrorHistorial(null);
    try {
      const respuesta = await fetchConLimiteAndroid(
        `/api/anime/externo/historial?source=${encodeURIComponent(entrada.source)}&id=${encodeURIComponent(entrada.external_id)}`,
        { method: "DELETE" }
      );
      if (!respuesta.ok) throw new Error("historial de anime");
      setProgreso((anterior) => ({
        historial: (anterior?.historial ?? []).filter(
          (item) =>
            !(
              item.source === entrada.source &&
              item.external_id === entrada.external_id
            )
        ),
        continuar: anterior?.continuar ?? [],
      }));
      setHistorialModificado(true);
    } catch {
      setErrorHistorial("No se pudo quitar la serie del historial. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setQuitando(false);
    }
  }

  if (entradas === null) {
    return (
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
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
      {errorHistorial && <p role="alert" className="text-sm text-red-400">{errorHistorial}</p>}
      <BloqueProgreso
        titulo="Historial"
        detalle="Visto y sin guardar"
        entradas={historial}
        historial
        onQuitar={quitarHistorial}
        quitando={quitando || cargandoProgreso}
      />
      <BloqueProgreso
        titulo="Continuar viendo"
        detalle="Tu progreso"
        entradas={continuar}
        reanudar
      />

      <section className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] font-bold tracking-[0.08em] text-accent-ink">
              Fuentes externas
            </p>
            <h2 className="mt-1 font-display text-3xl font-bold leading-none text-ink">
              Anime animado
            </h2>
          </div>
          <span className="font-mono text-[11px] tracking-[0.06em] text-subtle">
            {entradas.length} guardado{entradas.length === 1 ? "" : "s"}
          </span>
        </div>

        {entradas.length === 0 ? (
          <EmptyState
            title="Todavía no guardaste anime animado"
            description="Elegí una serie de JKAnime, TioAnime o una fuente +18 habilitada y guardala para encontrarla acá."
            action={
              <Link
                href="/explorar?seccion=animada"
                className="inline-flex min-h-11 items-center rounded-md border border-accent bg-accent px-5 font-mono text-[11px] font-bold tracking-[0.06em] text-[var(--on-accent)]"
              >
                Explorar anime
              </Link>
            }
          />
        ) : visibles.length === 0 ? (
          <EmptyState title="Sin resultados" description="Probá con otro nombre." />
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {visibles.map((entrada) => (
              <Link
                key={`${entrada.source}:${entrada.external_id}`}
                href={entrada.href}
                className="group block rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <div className="relative aspect-[2/3] overflow-hidden rounded-[10px] bg-[var(--surface-raised)] border border-line transition-colors group-hover:border-line-strong">
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
                  <span className="absolute left-3 top-3 rounded-full bg-[color-mix(in_oklch,var(--bg)_86%,transparent)] px-2 py-1 font-mono text-[11px] font-bold tracking-[0.1em] text-accent-ink ">
                    {entrada.source}
                  </span>
                </div>
                <div className="px-1 pt-4">
                  <h3 className="line-clamp-2 text-base font-semibold leading-[1.25] text-ink transition-colors group-hover:text-accent-ink">
                    {entrada.title}
                  </h3>
                  <p className="mt-1 font-mono text-[13px] text-faint">
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
