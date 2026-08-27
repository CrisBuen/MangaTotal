"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { AvisoFuente } from "@/components/fuentes/AvisoFuente";
import { SaveExternalButton } from "@/components/library/SaveExternalButton";
import { estiloCapitulo, sufijoPagina, useProgresoSerie } from "@/components/library/useProgresoSerie";
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
  const [actualizando, setActualizando] = useState(false);

  const progreso = useProgresoSerie("catharsis", id);

  const cargar = useCallback(
    async (fresco = false) => {
      setError(null);
      try {
        setFicha(await serieCw(id, fresco));
      } catch (err) {
        setError(err);
      }
    },
    [id]
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function actualizar() {
    if (actualizando) return;
    setActualizando(true);
    try {
      await cargar(true);
    } finally {
      setActualizando(false);
    }
  }

  if (error) {
    return <AvisoFuente error={error} onReintentar={() => cargar()} />;
  }

  if (!ficha) {
    return (
      <p className="py-20 text-center font-mono text-xs uppercase tracking-[0.14em] text-subtle">
        Cargando...
      </p>
    );
  }

  const capitulos = orden === "asc" ? ficha.capitulos : [...ficha.capitulos].reverse();
  const primero = ficha.capitulos[0];
  const continuar = ficha.capitulos.find((c) => c.id === progreso.ultimoId);
  const arranque = continuar ?? primero;

  const hrefCapitulo = (capId: string, esActual: boolean) => {
    const extra = sufijoPagina(progreso, esActual);
    return `/leer-externo/catharsis/${capId}?serie=${id}${extra ? `&${extra}` : ""}`;
  };

  return (
    <div className="space-y-10">
      <Link
        href="/explorar?fuente=catharsis"
        className="inline-block font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-subtle transition hover:text-accent"
      >
        ← Explorar
      </Link>

      {/* cabecera: portada grande y lo poco que la fuente publica de la serie */}
      <header className="flex flex-col gap-8 sm:flex-row">
        <div className="mx-auto w-44 shrink-0 sm:mx-0 sm:w-56">
          <div className="aspect-[2/3] overflow-hidden rounded-2xl bg-[var(--surface-raised)] ring-1 ring-line">
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
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-accent">
              {CW_NOMBRE}
            </p>
            <h1 className="mt-3 font-display text-4xl font-black uppercase leading-[0.95] text-ink sm:text-5xl">
              {ficha.nombre}
            </h1>
            <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.12em] text-subtle">
              {ficha.capitulos.length} {ficha.capitulos.length === 1 ? "capítulo" : "capítulos"}
              {progreso.ultimoNumero !== null && ` · vas por el ${progreso.ultimoNumero}`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {arranque && (
              <Link
                href={hrefCapitulo(arranque.id, arranque.id === progreso.ultimoId)}
                className="inline-flex min-h-11 items-center rounded-xl border border-accent bg-accent px-5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--bg)] shadow-[var(--glow)] transition hover:bg-[var(--accent-hover)]"
              >
                {continuar ? `Seguir en el ${continuar.etiqueta}` : "Empezar a leer"}
              </Link>
            )}

            <SaveExternalButton
              serie={{
                source: "catharsis",
                external_id: id,
                title: ficha.nombre,
                cover_url: ficha.portada ? imagenCw(ficha.portada, 400) : null,
              }}
            />

            <button
              onClick={actualizar}
              disabled={actualizando}
              title="Busca capítulos recién subidos"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-4 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-subtle transition hover:border-accent hover:text-ink disabled:opacity-60"
            >
              <svg
                viewBox="0 0 24 24"
                className={`h-3.5 w-3.5 fill-current ${actualizando ? "animate-spin" : ""}`}
                aria-hidden="true"
              >
                <path d="M12 5V2L8 6l4 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z" />
              </svg>
              {actualizando ? "Buscando" : "Actualizar"}
            </button>
          </div>
        </div>
      </header>

      {/* capítulos: rejilla de números, que es como se recorre una serie larga */}
      <section>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <h2 className="font-display text-3xl font-black uppercase leading-none text-ink">
            Capítulos
          </h2>
          <button
            onClick={() => setOrden(orden === "asc" ? "desc" : "asc")}
            className="inline-flex min-h-11 items-center rounded-xl border border-line px-4 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-subtle transition hover:border-accent hover:text-ink"
          >
            {orden === "asc" ? "Del 1 al último" : "Del último al 1"}
          </button>
        </div>

        {capitulos.length === 0 ? (
          <p className="py-12 text-center text-sm text-subtle">
            Esta serie todavía no tiene capítulos publicados.
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-10">
            {capitulos.map((c) => {
              const esActual = c.id === progreso.ultimoId;
              const esLeido =
                progreso.ultimoNumero !== null && !esActual && c.numero < progreso.ultimoNumero;

              return (
                <Link
                  key={c.id}
                  href={hrefCapitulo(c.id, esActual)}
                  title={`Capítulo ${c.etiqueta}`}
                  className={`flex min-h-11 items-center justify-center rounded-xl border border-line bg-panel px-2 text-sm font-bold tabular-nums text-ink transition hover:-translate-y-0.5 hover:border-accent hover:text-accent ${estiloCapitulo(
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

      <p className="border-t border-line pt-6 text-xs text-subtle">
        Publicado por{" "}
        <a
          href={CW_WEB}
          target="_blank"
          rel="noreferrer noopener"
          className="text-accent hover:underline"
        >
          {CW_NOMBRE}
        </a>
        , integrada con su permiso. Si te gusta la serie, pasá por su sitio.
      </p>
    </div>
  );
}
