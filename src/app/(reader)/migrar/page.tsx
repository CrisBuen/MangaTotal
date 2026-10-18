"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { fichaHref } from "@/lib/externas";
import { Surface } from "@/components/ui/Surface";
import { PortadaExterna } from "@/components/fuentes/PortadaExterna";
import { catalogoIkigai } from "@/lib/ikigai";
import { catalogoLc } from "@/lib/leercapitulo";
import { catalogoTmo } from "@/lib/zonatmo";
import { catalogoCw, imagenCw } from "@/lib/catharsis";
import { isPlayStoreApp } from "@/lib/appVersion";
import { migrarHistorialLocal } from "@/components/library/historial";
import type { GrupoFuenteMigracion, ItemResultadoMigracion } from "@/app/api/externo/buscar-todas/route";

const NOMBRES_FUENTES: Record<string, string> = {
  olympus: "Olympus Scanlation",
  ikigai: "Ikigai Mangas",
  leercapitulo: "LeerCapítulo",
  tmo: "ZonaTMO",
  catharsis: "Catharsis World",
  mangadex: "MangaDex",
  ehentai: "E-Hentai",
  hitomi: "Hitomi.la",
};

function ContenidoMigracion() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const origenFuente = searchParams.get("fuente") ?? "";
  const origenId = searchParams.get("id") ?? "";
  const origenSlug = searchParams.get("slug") ?? "";
  const origenTitulo = searchParams.get("titulo") ?? "";

  const [termino, setTermino] = useState(origenTitulo);
  const [buscando, setBuscando] = useState(false);
  const [grupos, setGrupos] = useState<GrupoFuenteMigracion[]>([]);
  const [sinResultados, setSinResultados] = useState(false);
  const [itemSeleccionado, setItemSeleccionado] = useState<ItemResultadoMigracion | null>(null);
  const [migrando, setMigrando] = useState(false);
  const [exito, setExito] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const claveCache = `mangatotal:migracion:${origenFuente}:${origenId}`;

  // Buscar en todas las fuentes (servidor + fuentes nativas del dispositivo)
  const ejecutarBusqueda = useCallback(async (query: string) => {
    const qLimpia = query.trim();
    if (!qLimpia || qLimpia.length < 2) return;

    setBuscando(true);
    setSinResultados(false);
    setError(null);

    try {
      const enPlay = isPlayStoreApp();
      const [remoto, ikigaiRes, lcRes, tmoRes, cwRes] = await Promise.all([
        fetch(`/api/externo/buscar-todas?q=${encodeURIComponent(qLimpia)}`)
          .then((r) => (r.ok ? r.json() : { fuentes: [] }))
          .then((d) => (Array.isArray(d?.fuentes) ? (d.fuentes as GrupoFuenteMigracion[]) : []))
          .catch(() => [] as GrupoFuenteMigracion[]),
        catalogoIkigai(1, { q: qLimpia })
          .then((res): GrupoFuenteMigracion => ({
            source: "ikigai",
            sourceNombre: "Ikigai Mangas",
            items: (res?.series ?? []).slice(0, 12).map((s) => ({
              id: s.slug,
              slug: s.slug,
              title: s.title,
              coverUrl: s.cover_url,
              source: "ikigai",
              sourceNombre: "Ikigai Mangas",
              type: "manga",
            })),
          }))
          .catch((): GrupoFuenteMigracion => ({ source: "ikigai", sourceNombre: "Ikigai Mangas", items: [] })),
        catalogoLc(1, { q: qLimpia })
          .then((res): GrupoFuenteMigracion => ({
            source: "leercapitulo",
            sourceNombre: "LeerCapítulo",
            items: (res?.series ?? []).slice(0, 12).map((s) => ({
              id: `${s.id}/${s.slug}`,
              slug: s.slug,
              title: s.title,
              coverUrl: s.cover_url,
              source: "leercapitulo",
              sourceNombre: "LeerCapítulo",
              type: "manga",
            })),
          }))
          .catch((): GrupoFuenteMigracion => ({ source: "leercapitulo", sourceNombre: "LeerCapítulo", items: [] })),
        catalogoTmo(1, { q: qLimpia })
          .then((res): GrupoFuenteMigracion => ({
            source: "tmo",
            sourceNombre: "ZonaTMO",
            items: (res?.series ?? []).slice(0, 12).map((s) => ({
              id: `${s.tipo}/${s.id}/${s.slug}`,
              slug: s.slug,
              title: s.title,
              coverUrl: s.cover_url,
              source: "tmo",
              sourceNombre: "ZonaTMO",
              type: s.tipo || "manga",
            })),
          }))
          .catch((): GrupoFuenteMigracion => ({ source: "tmo", sourceNombre: "ZonaTMO", items: [] })),
        catalogoCw({ busqueda: qLimpia, pagina: 1 })
          .then((res): GrupoFuenteMigracion => ({
            source: "catharsis",
            sourceNombre: "Catharsis World",
            items: (res?.series ?? []).slice(0, 12).map((s) => ({
              id: s.id,
              slug: null,
              title: s.nombre,
              coverUrl: s.portada ? imagenCw(s.portada, 256) : null,
              source: "catharsis",
              sourceNombre: "Catharsis World",
              type: "manga",
              capitulosTexto: s.capitulos ? `${s.capitulos} caps.` : undefined,
              totalCapitulos: s.capitulos ?? null,
            })),
          }))
          .catch((): GrupoFuenteMigracion => ({ source: "catharsis", sourceNombre: "Catharsis World", items: [] })),
      ]);

      const porFuente = new Map<string, GrupoFuenteMigracion>();
      for (const g of [...remoto, ikigaiRes, lcRes, tmoRes, cwRes]) {
        if (!g || !g.items?.length) continue;
        if (enPlay && (g.source === "ehentai" || g.source === "hitomi")) continue;
        const previo = porFuente.get(g.source);
        if (!previo || previo.items.length === 0) {
          porFuente.set(g.source, g);
        }
      }

      const lista = Array.from(porFuente.values());

      // Excluir la misma fuente de origen de los resultados para evitar migrar a sí mismo
      const filtrados = lista
        .map((g) => ({
          ...g,
          items: g.items.filter((it) => !(it.source === origenFuente && it.id === origenId)),
        }))
        .filter((g) => g.items.length > 0);

      setGrupos(filtrados);
      setSinResultados(filtrados.length === 0);

      // Guardar en sessionStorage para no perder resultados al volver de "Ver obra"
      try {
        sessionStorage.setItem(claveCache, JSON.stringify({ query: qLimpia, grupos: filtrados }));
      } catch {}
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al buscar");
    } finally {
      setBuscando(false);
    }
  }, [origenFuente, origenId, claveCache]);

  // Al cargar, recuperar de caché de sesión o buscar automáticamente
  useEffect(() => {
    let recuperado = false;
    try {
      const raw = sessionStorage.getItem(claveCache);
      if (raw) {
        const guardado = JSON.parse(raw);
        if (guardado?.grupos?.length) {
          setTermino(guardado.query || origenTitulo);
          setGrupos(guardado.grupos);
          recuperado = true;
        }
      }
    } catch {}

    if (!recuperado && origenTitulo) {
      ejecutarBusqueda(origenTitulo);
    }
  }, [origenTitulo, claveCache, ejecutarBusqueda]);

  // Ejecutar la migración
  const confirmarMigracion = async (destino: ItemResultadoMigracion) => {
    setMigrando(true);
    setError(null);

    try {
      migrarHistorialLocal(
        { source: origenFuente, externalId: origenId },
        {
          source: destino.source,
          externalId: destino.id,
          slug: destino.slug,
          title: destino.title,
          coverUrl: destino.coverUrl,
          type: destino.type,
        }
      );

      const res = await fetch("/api/externo/migrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origen: {
            source: origenFuente,
            externalId: origenId,
          },
          destino: {
            source: destino.source,
            externalId: destino.id,
            slug: destino.slug,
            title: destino.title,
            coverUrl: destino.coverUrl,
            type: destino.type,
          },
        }),
      }).catch(() => null);

      const hrefDestino = fichaHref(destino.source, destino.id, destino.slug ?? null);

      if (res && !res.ok && res.status !== 401) {
        const dataErr = await res.json().catch(() => ({}));
        throw new Error(dataErr.error || "No se pudo completar la migración");
      }

      const data = res?.ok ? await res.json().catch(() => ({})) : {};
      setExito(`¡Obra migrada a ${destino.sourceNombre}! Redirigiendo...`);

      // Limpiar caché de sesión
      try {
        sessionStorage.removeItem(claveCache);
      } catch {}

      setTimeout(() => {
        router.push(data.href || hrefDestino);
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al migrar");
      setMigrando(false);
    }
  };

  const urlVolver = origenFuente
    ? fichaHref(origenFuente, origenId, origenSlug || null)
    : "/biblioteca";

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-20">
      {/* Cabecera */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <Link
            href={urlVolver}
            className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold tracking-[0.06em] text-subtle transition hover:text-accent-ink"
          >
            ← Volver a la obra
          </Link>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-[-0.03em] text-ink sm:text-3xl">
            Migración de obra
          </h1>
          <p className="mt-1 font-mono text-[12px] tracking-[0.04em] text-subtle">
            Fuente actual:{" "}
            <span className="font-bold text-ink">
              {NOMBRES_FUENTES[origenFuente] || origenFuente}
            </span>{" "}
            · «{origenTitulo}»
          </p>
        </div>
      </div>

      {/* Buscador de coincidencias */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ejecutarBusqueda(termino);
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <input
            type="text"
            value={termino}
            onChange={(e) => setTermino(e.target.value)}
            placeholder="Buscar por título alternativo, nombre en inglés o japonés..."
            className="w-full rounded-md border border-line bg-[var(--surface-raised)] px-4 py-2.5 text-sm text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
          />
          {termino && (
            <button
              type="button"
              onClick={() => {
                setTermino("");
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle hover:text-ink"
            >
              ✕
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={buscando || !termino.trim()}
          className="rounded-md bg-accent px-5 py-2.5 font-mono text-[11px] font-bold tracking-[0.06em] text-[var(--on-accent)] transition hover:opacity-90 disabled:opacity-50"
        >
          {buscando ? "Buscando..." : "Buscar"}
        </button>
      </form>

      {/* Alertas */}
      {exito && (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-4 text-center font-medium text-emerald-300">
          {exito}
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 p-4 text-center font-medium text-red-300">
          {error}
        </div>
      )}

      {/* Indicador de carga */}
      {buscando && (
        <div className="py-16 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="mt-3 font-mono text-xs tracking-wider text-subtle">
            Consultando simultáneamente en todas las fuentes integradas...
          </p>
        </div>
      )}

      {/* Mensaje de sin resultados */}
      {!buscando && sinResultados && (
        <Surface className="p-8 text-center my-6">
          <p className="text-base font-semibold text-ink">
            No se encontraron coincidencias exactas para «{termino}» en las otras fuentes.
          </p>
          <p className="mt-2 text-xs text-subtle">
            Tip: Algunas fuentes guardan las obras con su nombre en inglés o en japonés (romaji). Modificá el buscador arriba para encontrarlo.
          </p>
        </Surface>
      )}

      {/* Lista vertical separada por fuentes con scroll */}
      {!buscando && grupos.length > 0 && (
        <div className="space-y-8">
          <p className="font-mono text-xs text-subtle">
            Se encontraron coincidencias en {grupos.length} {grupos.length === 1 ? "fuente" : "fuentes"}. Seleccioná una obra para ver sus capítulos o migrar:
          </p>

          {grupos.map((grupo) => (
            <section key={grupo.source} className="space-y-3">
              <div className="flex items-center gap-2 border-b border-line pb-2">
                <span className="flex h-6 w-6 items-center justify-center rounded bg-accent/15 text-[10px] font-bold text-accent-ink">
                  {grupo.sourceNombre.slice(0, 2)}
                </span>
                <h2 className="font-display text-lg font-bold text-ink">
                  {grupo.sourceNombre}
                </h2>
                <span className="ml-auto rounded-full bg-[var(--surface-raised)] border border-line px-2 py-0.5 font-mono text-[10px] text-subtle">
                  {grupo.items.length} {grupo.items.length === 1 ? "coincidencia" : "coincidencias"}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {grupo.items.map((item) => (
                  <button
                    key={`${item.source}:${item.id}`}
                    type="button"
                    onClick={() => setItemSeleccionado(item)}
                    className="group flex items-center gap-3.5 rounded-[10px] border border-line bg-panel p-3 text-left transition hover:border-accent hover:bg-[var(--surface-raised)] active:scale-[0.99]"
                  >
                    <div className="h-20 w-14 shrink-0 overflow-hidden rounded-md border border-line bg-[var(--surface-raised)]">
                      {item.coverUrl ? (
                        <PortadaExterna
                          source={item.source}
                          externalId={item.id}
                          src={item.coverUrl}
                          alt={item.title}
                          className="h-full w-full object-cover"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-subtle">
                          📖
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-semibold text-ink group-hover:text-accent-ink">
                        {item.title}
                      </p>
                      {item.capitulosTexto && (
                        <p className="mt-1 font-mono text-[11px] text-subtle">
                          {item.capitulosTexto}
                        </p>
                      )}
                    </div>

                    <span className="shrink-0 text-subtle group-hover:translate-x-0.5 group-hover:text-accent-ink">
                      ›
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Mini Menú interactivo al seleccionar una obra */}
      {itemSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-xl border border-line bg-panel p-6 shadow-2xl space-y-5">
            <div className="flex items-start gap-4">
              <div className="h-24 w-16 shrink-0 overflow-hidden rounded-md border border-line bg-[var(--surface-raised)]">
                {itemSeleccionado.coverUrl ? (
                  <PortadaExterna
                    source={itemSeleccionado.source}
                    externalId={itemSeleccionado.id}
                    src={itemSeleccionado.coverUrl}
                    alt={itemSeleccionado.title}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-subtle">📖</div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <span className="inline-block rounded bg-accent/15 px-2 py-0.5 font-mono text-[10px] font-bold text-accent-ink">
                  {itemSeleccionado.sourceNombre}
                </span>
                <h3 className="mt-1 line-clamp-2 text-base font-bold text-ink">
                  {itemSeleccionado.title}
                </h3>
                {itemSeleccionado.capitulosTexto && (
                  <p className="mt-1 font-mono text-xs text-subtle">
                    {itemSeleccionado.capitulosTexto}
                  </p>
                )}
              </div>
            </div>

            <p className="text-xs text-subtle leading-relaxed">
              ¿Qué deseas hacer con esta obra? Podés ver sus capítulos para comparar cuántos tiene, o migrarla directamente conservando tu progreso de lectura.
            </p>

            <div className="flex flex-col gap-2 pt-2">
              {/* Botón Ver obra */}
              <Link
                href={fichaHref(itemSeleccionado.source, itemSeleccionado.id, itemSeleccionado.slug ?? null)}
                className="flex items-center justify-center gap-2 rounded-md border border-line bg-[var(--surface-raised)] px-4 py-2.5 font-mono text-xs font-bold text-ink transition hover:border-accent hover:text-accent-ink"
              >
                <span>👁️ Ver obra y capítulos</span>
              </Link>

              {/* Botón Migrar */}
              <button
                type="button"
                disabled={migrando}
                onClick={() => confirmarMigracion(itemSeleccionado)}
                className="flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 font-mono text-xs font-bold text-[var(--on-accent)] transition hover:opacity-90 disabled:opacity-50"
              >
                {migrando ? (
                  <span>Migrando progreso...</span>
                ) : (
                  <span>⚡ Migrar a esta fuente</span>
                )}
              </button>

              {/* Cancelar */}
              <button
                type="button"
                disabled={migrando}
                onClick={() => setItemSeleccionado(null)}
                className="mt-1 text-center font-mono text-xs text-subtle hover:text-ink"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MigrarPage() {
  return (
    <Suspense fallback={<p className="py-24 text-center font-mono text-xs text-subtle">Cargando migración…</p>}>
      <ContenidoMigracion />
    </Suspense>
  );
}
