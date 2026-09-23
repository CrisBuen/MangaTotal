"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useLayoutEffect, useState } from "react";
import { ImagenFuente } from "@/components/fuentes/ImagenFuente";
import { SectionHeading, Surface } from "@/components/ui/Surface";
import { fichaHref } from "@/lib/externas";
import { FUENTES_BIBLIOTECA } from "@/lib/fuentesBiblioteca";

interface Guardada {
  source: string; external_id: string; slug: string | null; title: string;
  cover_url: string | null; last_chapter_name: string | null;
}

function ListaFuentes() {
  const params = useSearchParams();
  const seleccion = params.get("fuente");
  const fuente = FUENTES_BIBLIOTECA.find(f => f.id === seleccion);
  const [series, setSeries] = useState<Guardada[] | null>(null);
  const [error, setError] = useState(false);
  const [sinSesion, setSinSesion] = useState(false);
  const [intento, setIntento] = useState(0);
  const claveScroll = `mangatotal:fuentes:scroll:${seleccion ?? "indice"}`;

  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    setSinSesion(false);
    fetch("/api/externo/biblioteca", { cache: "no-store", signal: controller.signal })
      .then(async r => {
        if (r.status === 401) { if (!controller.signal.aborted) setSinSesion(true); return; }
        if (!r.ok) throw new Error();
        const datos = await r.json();
        if (!Array.isArray(datos)) throw new Error();
        if (!controller.signal.aborted) setSeries(datos);
      }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [intento]);

  useLayoutEffect(() => {
    if (!series) return;
    // Solo se recuerda la posición, nunca se copia la biblioteca al almacenamiento.
    let y = 0;
    try { y = Number(sessionStorage.getItem(claveScroll)) || 0; } catch { /* almacenamiento bloqueado */ }
    const frame = requestAnimationFrame(() => window.scrollTo(0, y));
    return () => cancelAnimationFrame(frame);
  }, [series, claveScroll]);

  function recordarScroll() {
    try { sessionStorage.setItem(claveScroll, String(window.scrollY)); } catch { /* almacenamiento bloqueado */ }
  }

  const lista = series?.filter(s => s.source === fuente?.id)
    .sort((a, b) => a.title.localeCompare(b.title, "es"));

  return <div className="space-y-6">
    <Link href={seleccion ? "/fuentes" : "/mas"} className="inline-block py-2 text-sm text-accent-ink">
      {seleccion ? "← Fuentes" : "← Más"}
    </Link>
    <SectionHeading eyebrow="Tu biblioteca" title={fuente?.nombre ?? "Fuentes"}
      description={fuente ? `${lista?.length ?? 0} series guardadas` : "Tus series guardadas, organizadas por fuente."} />
    {sinSesion ? <Link href="/login" className="text-accent-ink underline">Iniciá sesión para ver tus fuentes guardadas</Link>
      : error ? <Surface className="p-6"><p role="alert">No se pudo cargar tu biblioteca.</p>
      <button onClick={() => setIntento(n => n + 1)} className="mt-3 text-accent-ink underline">Reintentar</button></Surface>
      : !series ? <p role="status">Cargando biblioteca…</p>
      : seleccion && !fuente ? <p>Fuente no disponible.</p>
      : !fuente ? <Surface className="divide-y divide-line p-0">
        {FUENTES_BIBLIOTECA.map(f => <Link key={f.id} href={`/fuentes?fuente=${f.id}`} onClick={recordarScroll}
          className="flex min-h-20 items-center gap-4 px-5 py-4 hover:bg-[var(--surface-raised)]">
          <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] font-bold text-accent-ink">{f.nombre.slice(0, 2)}</span>
          <span className="flex-1 font-semibold text-ink">{f.nombre}</span>
          <span className="rounded-md bg-[var(--accent-soft)] px-3 py-1 text-accent-ink" aria-label={`${series.filter(s => s.source === f.id).length} series guardadas`}>{series.filter(s => s.source === f.id).length}</span>
          <span aria-hidden="true">›</span>
        </Link>)}
      </Surface>
      : lista?.length ? <ul className="divide-y divide-line">
        {lista.map(s => <li key={`${s.source}:${s.external_id}`}>
          <Link href={`${fichaHref(s.source, s.external_id, s.slug)}?bibliotecaFuente=${fuente.id}`} prefetch={false} onClick={recordarScroll}
            className="flex min-h-24 items-center gap-4 rounded-md px-2 py-3 hover:bg-[var(--surface-raised)]">
            <div className="h-20 w-14 shrink-0 overflow-hidden rounded-md bg-panel">
              {s.cover_url && <ImagenFuente src={s.cover_url} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />}
            </div>
            <span className="min-w-0 flex-1"><span className="block font-semibold text-ink">{s.title}</span>
              <span className="mt-1 block text-xs text-subtle">{s.last_chapter_name ? `Vas por el cap. ${s.last_chapter_name}` : "Sin empezar"}</span>
            </span><span aria-hidden="true">›</span>
          </Link>
        </li>)}
      </ul> : <p className="text-subtle">No tenés series guardadas en esta fuente.</p>}
  </div>;
}

export default function FuentesPage() {
  return <Suspense fallback={<p role="status">Cargando fuentes…</p>}><ListaFuentes /></Suspense>;
}
