"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useRefrescoSerie } from "./useRefrescoSerie";

/** La ficha propia lee la base al refrescar la ruta; no consulta fuentes externas. */
export function RefrescarFichaPropia({ children, slug }: { children: React.ReactNode; slug: string }) {
  const router = useRouter();
  const cargar = useCallback(async () => {
    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), 19_000);
    try {
      const res = await fetch(`/api/series/${encodeURIComponent(slug)}`, { cache: "no-store", signal: controlador.signal });
      if (!res.ok) throw new Error("No se pudo actualizar la ficha");
      router.refresh();
    } finally {
      clearTimeout(temporizador);
    }
  }, [router, slug]);
  const refresco = useRefrescoSerie(cargar);

  return (
    <div className="space-y-12" data-od-id="series-detail-page" {...refresco.gesto}>
      {refresco.android && (refresco.refrescando || refresco.desplazamiento > 0) && (
        <div className="fixed left-1/2 top-4 z-[80] -translate-x-1/2 rounded-full border border-line bg-panel px-4 py-2 text-sm text-ink shadow-xl" role="status">
          <span className="mr-2 inline-block animate-spin">↻</span>Actualizando capítulos…
        </div>
      )}
      {refresco.aviso && <p className="text-sm text-subtle" role="status">{refresco.aviso}</p>}
      {children}
    </div>
  );
}

export function BotonRefrescarFichaPropia({ slug }: { slug: string }) {
  const router = useRouter();
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState(false);
  const actualizar = async () => {
    if (actualizando) return;
    setActualizando(true);
    setError(false);
    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), 19_000);
    try {
      const res = await fetch(`/api/series/${encodeURIComponent(slug)}`, { cache: "no-store", signal: controlador.signal });
      if (!res.ok) throw new Error("No se pudo actualizar la ficha");
      router.refresh();
    } catch {
      setError(true);
    } finally {
      clearTimeout(temporizador);
      setActualizando(false);
    }
  };
  return <button type="button" onClick={() => void actualizar()} disabled={actualizando}
    title={error ? "No se pudo actualizar; tocá para reintentar" : undefined}
    className="hidden rounded-md border border-line px-3 py-2 font-mono text-[11px] font-bold text-subtle hover:border-line-strong hover:text-ink md:inline-flex">
    {actualizando ? "Actualizando…" : error ? "↻ Reintentar" : "↻ Actualizar"}
  </button>;
}
