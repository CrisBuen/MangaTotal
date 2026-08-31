"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState, Skeleton } from "@/components/ui/Feedback";
import { SectionHeading, Surface } from "@/components/ui/Surface";

interface Estadisticas {
  guardadas: number;
  historial: number;
  empezadas: number;
  favoritos: number;
  porFuente: { fuente: string; cuantas: number }[];
  animeSeguidos: number;
  episodiosVistos: number;
}

const NOMBRE_FUENTE: Record<string, string> = {
  mangadex: "MangaDex",
  olympus: "Olympus",
  tmo: "ZonaTMO",
  ikigai: "Ikigai",
  leercapitulo: "LeerCapítulo",
  catharsis: "Catharsis World",
};

/**
 * Estadísticas de lectura.
 *
 * Solo salen números que de verdad se guardan. No hay "tiempo de lectura"
 * porque no se mide en ninguna parte: preferimos que falte un dato antes que
 * mostrar uno inventado.
 */
export default function EstadisticasPage() {
  const [datos, setDatos] = useState<Estadisticas | null>(null);
  const [sinSesion, setSinSesion] = useState(false);

  useEffect(() => {
    fetch("/api/estadisticas")
      .then((r) => {
        if (r.status === 401) {
          setSinSesion(true);
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((d) => d && setDatos(d))
      .catch(() => {});
  }, []);

  if (sinSesion) {
    return (
      <div className="space-y-10">
        <SectionHeading eyebrow="Tu lectura" title="Estadísticas" description="Un resumen de lo que llevás leído." />
        <EmptyState
          title="Necesitás una cuenta"
          description="Las estadísticas salen de tu biblioteca y tu progreso, así que hay que iniciar sesión."
          action={
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center rounded-md border border-accent bg-accent px-5 font-mono text-[11px] font-bold tracking-[0.06em] text-[var(--on-accent)]"
            >
              Iniciar sesión
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-10" data-od-id="stats-page">
      <SectionHeading
        eyebrow="Tu lectura"
        title="Estadísticas"
        description="Un resumen de lo que llevás leído y guardado."
      />

      {datos === null ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Dato numero={datos.guardadas} etiqueta="En tu biblioteca" />
            <Dato numero={datos.empezadas} etiqueta="Series empezadas" />
            <Dato numero={datos.historial} etiqueta="En el historial" />
            <Dato numero={datos.favoritos} etiqueta="Favoritas" />
          </section>

          {datos.porFuente.length > 0 && (
            <section>
              <h2 className="mb-5 font-display text-3xl font-bold leading-none text-ink">
                De dónde las guardás
              </h2>
              <Surface className="divide-y divide-line p-0">
                {datos.porFuente.map((f) => (
                  <div key={f.fuente} className="flex items-center justify-between gap-4 px-6 py-4">
                    <span className="text-sm font-bold text-ink">
                      {NOMBRE_FUENTE[f.fuente] ?? f.fuente}
                    </span>
                    <span className="font-mono text-sm tabular-nums text-accent-ink">{f.cuantas}</span>
                  </div>
                ))}
              </Surface>
            </section>
          )}

          {(datos.animeSeguidos > 0 || datos.episodiosVistos > 0) && (
            <section>
              <h2 className="mb-5 font-display text-3xl font-bold leading-none text-ink">
                Series animadas
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Dato numero={datos.animeSeguidos} etiqueta="Series que seguís" />
                <Dato numero={datos.episodiosVistos} etiqueta="Episodios vistos" />
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Dato({ numero, etiqueta }: { numero: number; etiqueta: string }) {
  return (
    <Surface className="p-6 text-center">
      <p className="font-display text-4xl font-bold tabular-nums text-accent-ink">{numero}</p>
      <p className="mt-1 font-mono text-[13px] text-faint">{etiqueta}</p>
    </Surface>
  );
}
