"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { cargarConCacheAndroid, guardarCacheAndroid } from "@/lib/androidCache";

interface Entrada {
  source: string;
  external_id: string;
  title: string;
  cover_url: string | null;
  last_chapter_name: string | null;
  href: string;
  href_continuar: string;
}

const NOMBRE_FUENTE: Record<string, string> = {
  mangadex: "MangaDex",
  olympus: "Olympus",
  tmo: "ZonaTMO",
  ikigai: "Ikigai",
  leercapitulo: "LeerCapítulo",
  catharsis: "Catharsis",
};

/**
 * Historial: las series que abriste para leer y no llegaste a guardar.
 *
 * Es para lo que pasa siempre: encontrás algo en cualquiera de las fuentes,
 * leés un par de capítulos, se apaga el teléfono, y después no te acordás ni
 * de dónde era. Acá quedan, con el capítulo por el que ibas.
 *
 * Solo entra lo que abriste para leer. Mirar una serie y volverse no cuenta.
 */
export function SeccionHistorial({ tipo = "normal" }: { tipo?: "normal" | "adult" }) {
  const [entradas, setEntradas] = useState<Entrada[] | null>(null);

  const cargar = useCallback(async () => {
    try {
      const data = await cargarConCacheAndroid<Entrada[]>(
        "biblioteca:historial",
        async (signal) => {
          const r = await fetch(`/api/externo/historial?tipo=${tipo}`, { signal });
          if (!r.ok) throw new Error("historial");
          return r.json();
        },
        { privateData: true, onCached: setEntradas }
      );
      setEntradas(data);
    } catch {
      setEntradas([]);
    }
  }, [tipo]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function quitar(e: Entrada) {
    // se saca de la lista enseguida: esperar al servidor se siente lento
    setEntradas((previas) =>
      {
        const siguientes = (previas ?? []).filter(
          (x) => !(x.source === e.source && x.external_id === e.external_id)
        );
        void guardarCacheAndroid("biblioteca:historial", siguientes, { privateData: true });
        return siguientes;
      }
    );
    await fetch(
      `/api/externo/historial?source=${e.source}&id=${encodeURIComponent(e.external_id)}`,
      { method: "DELETE" }
    ).catch(() => {});
  }

  // sin nada que mostrar no ocupa lugar: es una ayuda, no una sección fija
  if (!entradas || entradas.length === 0) return null;

  return (
    <section id="historial" className="scroll-mt-28" data-od-id="library-history">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <h2 className="min-w-0 font-display text-3xl font-bold leading-none text-ink sm:text-4xl">
          Historial
        </h2>
        <span className="font-mono text-[11px] font-bold tracking-[0.08em] text-subtle">
          Leído y sin guardar
        </span>
      </div>

      <div className="flex min-w-0 gap-5 overflow-x-auto rounded-[10px] border border-line bg-panel p-5">
        {entradas.map((e) => (
          <div key={`${e.source}:${e.external_id}`} className="group relative w-36 shrink-0">
            <button
              onClick={() => quitar(e)}
              title="Sacar del historial"
              aria-label={`Sacar ${e.title} del historial`}
              className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-[color-mix(in_oklch,var(--bg)_80%,transparent)] text-sm text-subtle opacity-0  transition hover:text-accent-ink focus-visible:opacity-100 group-hover:opacity-100"
            >
              ×
            </button>

            <Link href={e.href_continuar} className="block">
              <div className="aspect-[2/3] overflow-hidden rounded-[10px] border border-line bg-[var(--surface-raised)] transition-colors hover:border-line-strong">
                {e.cover_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={e.cover_url}
                    alt={e.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                )}
              </div>
              <h3 className="mt-3 line-clamp-2 text-sm font-bold leading-[1.15] text-ink transition hover:text-accent-ink">
                {e.title}
              </h3>
            </Link>

            <div className="mt-1 flex items-center gap-2">
              <p className="min-w-0 flex-1 truncate font-mono text-[11px] tracking-[0.06em] text-subtle">
                {NOMBRE_FUENTE[e.source] ?? e.source}
                {e.last_chapter_name && ` · cap. ${e.last_chapter_name}`}
              </p>
              <Link
                href={e.href}
                title="Ver ficha y capítulos"
                aria-label={`Ver ficha de ${e.title}`}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-line text-sm text-subtle transition hover:border-line-strong hover:text-accent-ink"
              >
                →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
