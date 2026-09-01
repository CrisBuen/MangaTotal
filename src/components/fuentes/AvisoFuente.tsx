"use client";

import Link from "next/link";
import { useState } from "react";
import { Surface } from "@/components/ui/Surface";
import {
  DesafioPendiente,
  limpiarVerificacion,
  puedeResolverDesafio,
  resolverDesafio,
} from "@/lib/fuenteNativa";

/**
 * Lo que se muestra cuando una fuente externa no responde.
 *
 * Separa dos cosas que se ven parecidas pero no lo son:
 *
 *   · el sitio pide comprobar que hay una persona → hay un botón que abre
 *     la casilla y después reintenta solo;
 *   · cualquier otro problema → el mensaje y un reintento a mano.
 *
 * Vive acá y no en cada página para que las fuentes que se agreguen después
 * lo hereden sin tener que acordarse.
 */
export function AvisoFuente({
  error,
  volverA = "/explorar",
  volverTexto = "Volver a Explorar",
  onReintentar,
}: {
  error: unknown;
  volverA?: string;
  volverTexto?: string;
  onReintentar?: () => void;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [fallo, setFallo] = useState(false);

  const desafio = error instanceof DesafioPendiente ? error : null;
  const mensaje =
    error instanceof Error
      ? error.message
      : typeof error === "string" && error.trim()
        ? error
        : "No se pudo cargar esta fuente";

  async function verificar() {
    if (!desafio || ocupado) return;
    setOcupado(true);
    setFallo(false);
    try {
      const listo = await resolverDesafio(`https://${desafio.host}/`);
      if (listo) onReintentar?.();
      else setFallo(true);
    } catch {
      setFallo(true);
    } finally {
      setOcupado(false);
    }
  }

  async function reiniciarVerificacion() {
    setOcupado(true);
    try {
      await limpiarVerificacion();
      setFallo(false);
    } finally {
      setOcupado(false);
    }
  }

  // el sitio pide la casilla y esta app sabe abrirla
  if (desafio && puedeResolverDesafio()) {
    return (
      <Surface className="p-10 text-center">
        <p className="text-lg font-bold text-ink">
          {desafio.host} quiere comprobar que sos una persona
        </p>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-subtle">
          Se abre una ventana con la casilla del sitio. Tocala y volvés acá solo; no hace falta
          repetirlo cada vez.
        </p>

        <button
          onClick={verificar}
          disabled={ocupado}
          className="mt-6 inline-flex min-h-11 items-center rounded-md border border-accent bg-accent px-5 font-mono text-[11px] font-bold tracking-[0.06em] text-[var(--on-accent)] transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
        >
          {ocupado ? "Esperando…" : "Verificar ahora"}
        </button>

        {fallo && (
          <p className="mt-5 text-sm text-subtle">
            No quedó verificado.{" "}
            <button onClick={verificar} className="text-accent-ink hover:underline">
              Probá de nuevo
            </button>{" "}
            o{" "}
            <button onClick={reiniciarVerificacion} className="text-accent-ink hover:underline">
              empezá de cero
            </button>
            .
          </p>
        )}

        <div className="mt-6">
          <Link href={volverA} className="text-sm text-accent-ink hover:underline">
            {volverTexto}
          </Link>
        </div>
      </Surface>
    );
  }

  // el sitio pide la casilla pero esto es la web: no hay forma de abrirla
  if (desafio) {
    return (
      <Surface className="p-10 text-center">
        <p className="text-lg font-bold text-ink">{desafio.host} solo se puede leer desde la app</p>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-subtle">
          El sitio pide comprobar que hay una persona, y eso solo se puede hacer desde la app de
          Android o la de Windows. El resto de las fuentes funciona acá con normalidad.
        </p>
        <div className="mt-6">
          <Link href={volverA} className="text-sm text-accent-ink hover:underline">
            {volverTexto}
          </Link>
        </div>
      </Surface>
    );
  }

  return (
    <Surface className="p-10 text-center">
      <p className="text-lg font-bold text-ink">{mensaje}</p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-5">
        {onReintentar && (
          <button
            onClick={onReintentar}
            className="inline-flex min-h-11 items-center rounded-md border border-line px-5 font-mono text-[11px] font-bold tracking-[0.06em] text-subtle transition hover:border-line-strong hover:text-ink"
          >
            Reintentar
          </button>
        )}
        <Link href={volverA} className="text-sm text-accent-ink hover:underline">
          {volverTexto}
        </Link>
      </div>
    </Surface>
  );
}
