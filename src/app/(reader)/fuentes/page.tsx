"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { PortadaExterna } from "@/components/fuentes/PortadaExterna";
import { SectionHeading, Surface } from "@/components/ui/Surface";
import { fichaHref } from "@/lib/externas";
import { FUENTES_BIBLIOTECA } from "@/lib/fuentesBiblioteca";
import { BotonMigrar } from "@/components/library/BotonMigrar";
import { enAppAndroid } from "@/lib/pantalla";
import { isPlayStoreApp } from "@/lib/appVersion";

interface Guardada {
  source: string; external_id: string; slug: string | null; title: string;
  cover_url: string | null; last_chapter_name: string | null;
}

function ListaFuentes() {
  const params = useSearchParams();
  const seleccion = params.get("fuente");
  const [enPlay, setEnPlay] = useState(false);
  const fuentesVisibles = FUENTES_BIBLIOTECA.filter(
    f => !enPlay || (f.id !== "ehentai" && f.id !== "hitomi")
  );
  const fuente = fuentesVisibles.find(f => f.id === seleccion);
  const [series, setSeries] = useState<Guardada[] | null>(null);
  const [error, setError] = useState(false);
  const [sinSesion, setSinSesion] = useState(false);
  const [intento, setIntento] = useState(0);
  const [esAndroid, setEsAndroid] = useState(false);
  const [serieMenu, setSerieMenu] = useState<Guardada | null>(null);
  const longPressRef = useRef<NodeJS.Timeout | null>(null);
  const fueLongPressRef = useRef(false);
  const claveScroll = `mangatotal:fuentes:scroll:${seleccion ?? "indice"}`;

  useEffect(() => {
    setEnPlay(isPlayStoreApp());
    setEsAndroid(enAppAndroid() || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
  }, []);

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

  function handleTouchStart(s: Guardada) {
    fueLongPressRef.current = false;
    longPressRef.current = setTimeout(() => {
      fueLongPressRef.current = true;
      if (navigator.vibrate) {
        try { navigator.vibrate(40); } catch { /* vibración no soportada */ }
      }
      setSerieMenu(s);
    }, 500);
  }

  function handleTouchMove() {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }

  function handleTouchEnd(e: React.TouchEvent | React.MouseEvent) {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
    if (fueLongPressRef.current) {
      e.preventDefault();
    }
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
        {fuentesVisibles.map(f => <Link key={f.id} href={`/fuentes?fuente=${f.id}`} onClick={recordarScroll}
          className="flex min-h-20 items-center gap-4 px-5 py-4 hover:bg-[var(--surface-raised)]">
          <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] font-bold text-accent-ink">{f.nombre.slice(0, 2)}</span>
          <span className="flex-1 font-semibold text-ink">{f.nombre}</span>
          <span className="rounded-md bg-[var(--accent-soft)] px-3 py-1 text-accent-ink" aria-label={`${series.filter(s => s.source === f.id).length} series guardadas`}>{series.filter(s => s.source === f.id).length}</span>
          <span aria-hidden="true">›</span>
        </Link>)}
      </Surface>
      : lista?.length ? (
        <div className="space-y-3">
          {esAndroid && (
            <div className="flex items-center gap-2 rounded-lg border border-line bg-[var(--surface-raised)] px-3.5 py-2.5 text-xs text-subtle">
              <span className="text-sm">💡</span>
              <span>Mantené pulsada una serie para migrarla a otra fuente.</span>
            </div>
          )}
          <ul className="divide-y divide-line">
            {lista.map(s => {
              const hrefObra = `${fichaHref(s.source, s.external_id, s.slug)}?bibliotecaFuente=${fuente.id}`;
              return (
                <li
                  key={`${s.source}:${s.external_id}`}
                  className="group flex min-h-24 items-center gap-3 rounded-md px-2 py-3 transition hover:bg-[var(--surface-raised)]"
                  onTouchStart={() => handleTouchStart(s)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onContextMenu={(e) => {
                    if (esAndroid) {
                      e.preventDefault();
                      setSerieMenu(s);
                    }
                  }}
                >
                  <Link
                    href={hrefObra}
                    prefetch={false}
                    onClick={(e) => {
                      if (fueLongPressRef.current) {
                        e.preventDefault();
                        return;
                      }
                      recordarScroll();
                    }}
                    className="flex min-w-0 flex-1 items-center gap-4"
                  >
                    <div className="h-20 w-14 shrink-0 overflow-hidden rounded-md bg-panel">
                      {s.cover_url && (
                        <PortadaExterna
                          source={s.source}
                          externalId={s.external_id}
                          src={s.cover_url}
                          alt=""
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-ink">{s.title}</span>
                      <span className="mt-1 block text-xs text-subtle">
                        {s.last_chapter_name ? `Vas por el cap. ${s.last_chapter_name}` : "Sin empezar"}
                      </span>
                    </span>
                  </Link>

                  <div className="flex shrink-0 items-center gap-2">
                    {!esAndroid && (
                      <BotonMigrar
                        fuente={s.source}
                        externalId={s.external_id}
                        slug={s.slug}
                        titulo={s.title}
                        variante="compacto"
                      />
                    )}
                    <Link
                      href={hrefObra}
                      onClick={recordarScroll}
                      className="p-1 text-lg text-subtle transition hover:text-ink"
                      aria-hidden="true"
                    >
                      ›
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : <p className="text-subtle">No tenés series guardadas en esta fuente.</p>}

    {/* Menú de acción para Android al mantener pulsada una serie */}
    {serieMenu && (
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
        onClick={() => setSerieMenu(null)}
      >
        <div
          className="w-full max-w-sm rounded-2xl border border-line bg-panel p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 border-b border-line pb-3">
            {serieMenu.cover_url && (
              <div className="h-14 w-10 shrink-0 overflow-hidden rounded bg-panel">
                <PortadaExterna
                  source={serieMenu.source}
                  externalId={serieMenu.external_id}
                  src={serieMenu.cover_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink line-clamp-1">{serieMenu.title}</p>
              <p className="text-xs text-subtle">{fuente?.nombre ?? serieMenu.source}</p>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <Link
              href={`/migrar?fuente=${encodeURIComponent(serieMenu.source)}&id=${encodeURIComponent(serieMenu.external_id)}${serieMenu.slug ? `&slug=${encodeURIComponent(serieMenu.slug)}` : ""}&titulo=${encodeURIComponent(serieMenu.title)}`}
              onClick={() => setSerieMenu(null)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 font-mono text-xs font-bold uppercase tracking-wider text-[var(--on-accent)] transition hover:opacity-90 active:scale-98"
            >
              🔄 Migrar obra
            </Link>
            <Link
              href={`${fichaHref(serieMenu.source, serieMenu.external_id, serieMenu.slug)}?bibliotecaFuente=${fuente?.id ?? serieMenu.source}`}
              onClick={() => setSerieMenu(null)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-[var(--surface-raised)] py-3 text-xs font-semibold text-ink transition hover:border-line-strong active:scale-98"
            >
              📖 Ver obra
            </Link>
            <button
              type="button"
              onClick={() => setSerieMenu(null)}
              className="w-full py-2.5 text-xs font-medium text-subtle hover:text-ink"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    )}
  </div>;
}

export default function FuentesPage() {
  return <Suspense fallback={<p role="status">Cargando fuentes…</p>}><ListaFuentes /></Suspense>;
}
