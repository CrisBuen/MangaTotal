"use client";

import Link from "next/link";

/**
 * Lleva a la ruleta.
 *
 * Antes sorteaba una serie del catálogo propio y te tiraba directo a su
 * ficha, que era poco: si no te gustaba había que volver atrás y tocar de
 * nuevo. Ahora abre /aleatorio, que sortea entre todas las fuentes y deja
 * seguir tirando desde ahí.
 */
export function RandomSeriesButton() {
  return (
    <Link
      href="/aleatorio"
      className="relative hidden min-h-11 shrink-0 items-center rounded-md px-2 text-sm text-subtle transition-colors hover:bg-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink xl:inline-flex"
      data-od-id="random-series-button"
    >
      Aleatorio
    </Link>
  );
}
