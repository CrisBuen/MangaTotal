"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { SectionHeading, Surface } from "@/components/ui/Surface";

interface SerieAlAzar {
  fuente: string;
  fuenteNombre: string;
  titulo: string;
  portada: string | null;
  href: string;
  nota: string | null;
}

/**
 * Ruleta: una serie al azar de cualquiera de las fuentes.
 *
 * La idea es que no cueste nada seguir tirando. Si no te convence, "Otra" y
 * listo; la portada de la que viene se precarga mientras mirás la actual, así
 * la siguiente aparece sin parpadeo aunque la conexión sea mala.
 */
export default function AleatorioPage() {
  const [serie, setSerie] = useState<SerieAlAzar | null>(null);
  const [girando, setGirando] = useState(true);
  const [error, setError] = useState(false);

  // la que ya está lista para la próxima vuelta
  const siguiente = useRef<SerieAlAzar | null>(null);

  const traer = useCallback(async (evitar?: string): Promise<SerieAlAzar | null> => {
    const qs = evitar ? `?evitar=${encodeURIComponent(evitar)}` : "";
    const r = await fetch(`/api/aleatorio${qs}`, { cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json()) as SerieAlAzar;
  }, []);

  /** Deja lista la próxima, y de paso su portada en la caché del navegador. */
  const precargar = useCallback(
    async (evitar: string) => {
      const s = await traer(evitar).catch(() => null);
      siguiente.current = s;
      if (s?.portada) {
        const img = new Image();
        img.src = s.portada;
      }
    },
    [traer]
  );

  const girar = useCallback(async () => {
    setGirando(true);
    setError(false);

    // si ya había una preparada, sale al instante
    const lista = siguiente.current;
    siguiente.current = null;

    const s = lista ?? (await traer(serie?.href).catch(() => null));
    if (!s) {
      setError(true);
      setGirando(false);
      return;
    }

    setSerie(s);
    setGirando(false);
    precargar(s.href);
  }, [precargar, serie?.href, traer]);

  useEffect(() => {
    girar();
    // solo al entrar: después gira con el botón
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-10">
      <SectionHeading
        eyebrow="Ruleta"
        title="Aleatorio"
        description="Una serie cualquiera, de cualquiera de las fuentes. Si no te gusta, tirá de nuevo."
      />

      {error ? (
        <Surface className="p-12 text-center">
          <p className="text-lg font-bold text-ink">Ninguna fuente contestó</p>
          <p className="mt-2 text-sm text-subtle">Puede ser cosa del momento. Probá de nuevo.</p>
          <button
            onClick={girar}
            className="mt-6 inline-flex min-h-11 items-center rounded-xl border border-accent bg-accent px-5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--bg)] transition hover:bg-[var(--accent-hover)]"
          >
            Reintentar
          </button>
        </Surface>
      ) : (
        <div className="flex flex-col items-center gap-8">
          <div className="w-full max-w-xs">
            <div
              className={`aspect-[2/3] overflow-hidden rounded-2xl bg-[var(--surface-raised)] ring-1 ring-line transition duration-300 ${
                girando ? "animate-pulse" : "shadow-[var(--glow)]"
              }`}
            >
              {serie?.portada && !girando && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={serie.portada}
                  alt={serie.titulo}
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              )}
            </div>

            <div className="mt-5 text-center">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-accent">
                {girando ? "Girando…" : serie?.fuenteNombre}
              </p>
              <h2 className="mt-2 text-2xl font-black leading-[1.1] text-ink">
                {girando ? " " : serie?.titulo}
              </h2>
              {!girando && serie?.nota && (
                <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-subtle">
                  {serie.nota}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            {serie && !girando && (
              <Link
                href={serie.href}
                className="inline-flex min-h-11 items-center rounded-xl border border-accent bg-accent px-6 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--bg)] shadow-[var(--glow)] transition hover:bg-[var(--accent-hover)]"
              >
                Ver esta
              </Link>
            )}
            <button
              onClick={girar}
              disabled={girando}
              className="inline-flex min-h-11 items-center rounded-xl border border-line px-6 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-subtle transition hover:border-accent hover:text-ink disabled:opacity-60"
            >
              {girando ? "Buscando…" : "Otra ↻"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
