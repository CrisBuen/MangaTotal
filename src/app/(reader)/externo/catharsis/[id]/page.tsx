"use client";

import Link from "next/link";
import { VolverFuente } from "@/components/library/VolverFuente";
import { use, useCallback, useEffect, useState } from "react";
import { AvisoFuente } from "@/components/fuentes/AvisoFuente";
import { anotarHistorial } from "@/components/library/historial";
import { SaveExternalButton } from "@/components/library/SaveExternalButton";
import { useRefrescoSerie } from "@/components/library/useRefrescoSerie";
import { capituloLeido, estiloCapitulo, paginaCapitulo, useProgresoSerie } from "@/components/library/useProgresoSerie";
import { CW_NOMBRE, CW_WEB, imagenCw, serieCw, type FichaCw } from "@/lib/catharsis";

/**
 * Ficha de una serie de Catharsis World.
 *
 * Catharsis no publica sinopsis ni géneros, así que la página se apoya en lo
 * único que da de verdad: la portada y una lista de capítulos que a veces
 * pasa de los doscientos. Por eso van en rejilla de números y no en filas —
 * con 269 capítulos, una lista larga no se recorre, se sufre.
 */
export default function SerieCwPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);

  const [ficha, setFicha] = useState<FichaCw | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [orden, setOrden] = useState<"asc" | "desc">("desc");

  const progreso = useProgresoSerie("catharsis", id);

  const cargar = useCallback(
    async (fresco = false) => {
      if (!fresco) setError(null);
      try {
        setFicha(await serieCw(id, fresco));
        setError(null);
      } catch (err) {
        if (fresco) throw err;
        setError(err);
      }
    },
    [id]
  );
  const refresco = useRefrescoSerie(() => cargar(true));

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (error) {
    return <AvisoFuente error={error} onReintentar={() => cargar()} />;
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
    source: "catharsis" as const,
    external_id: id,
    title: ficha.nombre,
    cover_url: ficha.portada ? imagenCw(ficha.portada, 400) : null,
  };
  const primero = ficha.capitulos[0];
  const continuar = ficha.capitulos.find((c) => c.id === progreso.ultimoId);
  const arranque = continuar ?? primero;

  const hrefCapitulo = (capId: string) => {
    const extra = paginaCapitulo(progreso, capId);
    return `/leer-externo/catharsis/${capId}?serie=${id}${extra ? `&${extra}` : ""}`;
  };

  return (
    <div className="space-y-10" {...refresco.gesto}>
      {refresco.android && (refresco.refrescando || refresco.desplazamiento > 0) && (
        <div className="fixed left-1/2 top-4 z-[80] -translate-x-1/2 rounded-full border border-line bg-panel px-4 py-2 text-sm text-ink shadow-xl" role="status">
          <span className="mr-2 inline-block animate-spin">↻</span>Actualizando capítulos…
        </div>
      )}
      {refresco.aviso && <p className="text-sm text-subtle" role="status">{refresco.aviso}</p>}
<VolverFuente
        href="/explorar?fuente=catharsis"
        className="inline-block font-mono text-[11px] font-bold tracking-[0.06em] text-subtle transition hover:text-accent-ink"
      >
        ← Explorar
      </VolverFuente>

      {/* cabecera: portada grande y lo poco que la fuente publica de la serie */}
      <header className="flex flex-col gap-8 sm:flex-row">
        <div className="mx-auto w-44 shrink-0 sm:mx-0 sm:w-56">
          <div className="aspect-[2/3] overflow-hidden rounded-[10px] border border-line bg-[var(--surface-raised)]">
            {ficha.portada && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imagenCw(ficha.portada, 400)}
                alt={ficha.nombre}
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-between gap-6">
          <div>
            <p className="font-mono text-[11px] font-bold tracking-[0.08em] text-accent-ink">
              {CW_NOMBRE}
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold leading-[0.95] text-ink sm:text-5xl">
              {ficha.nombre}
            </h1>
            <p className="mt-4 font-mono text-[11px] tracking-[0.06em] text-subtle">
              {ficha.capitulos.length} {ficha.capitulos.length === 1 ? "capítulo" : "capítulos"}
              {progreso.ultimoNumero !== null && ` · vas por el ${progreso.ultimoNumero}`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {arranque && (
              <Link
                onClick={() =>
                  anotarHistorial({
                    ...serieGuardable,
                    last_chapter_id: String(arranque.id),
                    last_chapter_name: String(arranque.etiqueta),
                  })
                }
                href={hrefCapitulo(arranque.id)}
                className="inline-flex min-h-11 items-center rounded-md border border-accent bg-accent px-5 font-mono text-[11px] font-bold tracking-[0.06em] text-[var(--on-accent)]  transition hover:bg-[var(--accent-hover)]"
              >
                {continuar ? `Seguir en el ${continuar.etiqueta}` : "Empezar a leer"}
              </Link>
            )}

            <SaveExternalButton serie={serieGuardable} />

          </div>
        </div>
      </header>

      {/* capítulos: rejilla de números, que es como se recorre una serie larga */}
      <section>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <h2 className="font-display text-3xl font-bold leading-none text-ink">
            Capítulos
          </h2>
          <div className="flex items-center gap-2">
          {!refresco.android && <button type="button" onClick={refresco.refrescar} disabled={refresco.refrescando}
            className="rounded-md border border-line px-3 py-2 font-mono text-[11px] font-bold text-subtle disabled:opacity-60">
            {refresco.refrescando ? "Actualizando…" : "↻ Actualizar"}
          </button>}
          <button
            onClick={() => setOrden(orden === "asc" ? "desc" : "asc")}
            className="inline-flex min-h-11 items-center rounded-md border border-line px-4 font-mono text-[11px] font-bold tracking-[0.06em] text-subtle transition hover:border-line-strong hover:text-ink"
          >
            {orden === "asc" ? "Del 1 al último" : "Del último al 1"}
          </button>
          </div>
        </div>

        {capitulos.length === 0 ? (
          <p className="py-12 text-center text-sm text-subtle">
            Esta serie todavía no tiene capítulos publicados.
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-10">
            {capitulos.map((c) => {
              const esActual = c.id === progreso.ultimoId;
              const esLeido = capituloLeido(progreso, String(c.id), c.numero);

              return (
                <Link
                  key={c.id}
                  onClick={() =>
                    anotarHistorial({
                      ...serieGuardable,
                      last_chapter_id: String(c.id),
                      last_chapter_name: String(c.etiqueta),
                    })
                  }
                  href={hrefCapitulo(c.id)}
                  title={`Capítulo ${c.etiqueta}`}
                  className={`flex min-h-11 items-center justify-center rounded-md border border-line bg-panel px-2 text-sm font-bold tabular-nums text-ink transition hover:border-line-strong hover:text-accent-ink ${estiloCapitulo(
                    esActual,
                    esLeido
                  )}`}
                >
                  {c.etiqueta}
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <p className="border-t border-line pt-6 text-[13px] text-subtle">
        Publicado por{" "}
        <a
          href={CW_WEB}
          target="_blank"
          rel="noreferrer noopener"
          className="text-accent-ink hover:underline"
        >
          {CW_NOMBRE}
        </a>
        , integrada con su permiso. Si te gusta la serie, pasá por su sitio.
      </p>
    </div>
  );
}
