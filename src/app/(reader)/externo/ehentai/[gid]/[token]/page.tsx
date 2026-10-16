"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { VolverFuente } from "@/components/library/VolverFuente";
import { SaveExternalButton } from "@/components/library/SaveExternalButton";
import { BotonDescargaCapitulo } from "@/components/reader/BotonDescargaCapitulo";
import { Surface } from "@/components/ui/Surface";
import { Chip } from "@/components/ui/Chip";
import type { FichaEhentai } from "@/lib/ehentai";

export default function SerieEhentaiPage(props: {
  params: Promise<{ gid: string; token: string }>;
}) {
  const { gid, token } = use(props.params);
  const [ficha, setFicha] = useState<FichaEhentai | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`/api/externo/ehentai/${gid}/${token}`);
      if (!res.ok) {
        if (res.status === 403) {
          throw new Error("Contenido +18 no disponible. Podés activarlo en Más → Ajustes → Seguridad.");
        }
        throw new Error(`No se pudo cargar la galería (${res.status})`);
      }
      const data = await res.json();
      setFicha(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al cargar la galería");
    } finally {
      setCargando(false);
    }
  }, [gid, token]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const obtenerPaginas = useCallback(async (): Promise<string[]> => {
    const res = await fetch(`/api/externo/ehentai/${gid}/${token}/paginas`);
    if (!res.ok) throw new Error("No se pudieron obtener las páginas de esta galería");
    const data = await res.json();
    return data.paginas || [];
  }, [gid, token]);

  if (error) {
    return (
      <Surface className="mx-auto max-w-2xl p-10 text-center my-12">
        <p className="text-lg font-bold text-ink">{error}</p>
        <VolverFuente
          href="/lectura/descubrir?fuente=ehentai"
          className="mt-4 inline-block text-sm text-accent-ink hover:underline"
        >
          Volver a E-Hentai
        </VolverFuente>
      </Surface>
    );
  }

  if (cargando || !ficha) {
    return (
      <p className="py-24 text-center font-mono text-[13px] tracking-[0.08em] text-subtle">
        Cargando galería de E-Hentai...
      </p>
    );
  }

  const serieGuardable = {
    source: "ehentai" as const,
    external_id: `${gid}/${token}`,
    title: ficha.title,
    cover_url: ficha.thumb,
    type: ficha.category,
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <VolverFuente
        href="/lectura/descubrir?fuente=ehentai"
        className="inline-flex items-center gap-1.5 font-mono text-xs text-subtle transition hover:text-ink"
      >
        ← Volver a Descubrir
      </VolverFuente>

      {/* Ficha principal */}
      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        {ficha.thumb && (
          <div className="w-48 shrink-0 overflow-hidden rounded-[10px] border border-line shadow-md mx-auto md:mx-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ficha.thumb}
              alt={ficha.title}
              className="h-auto w-full object-cover"
              loading="eager"
            />
          </div>
        )}

        <div className="min-w-0 flex-1 space-y-4 text-center md:text-left">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
              <span className="rounded bg-accent/15 px-2 py-0.5 font-mono text-[11px] font-bold tracking-[0.06em] text-accent-ink uppercase">
                {ficha.category}
              </span>
              <span className="font-mono text-xs text-subtle">
                {ficha.filecount} páginas
              </span>
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink md:text-3xl">
              {ficha.title}
            </h1>
            {ficha.title_jpn && (
              <p className="font-sans text-sm text-subtle">{ficha.title_jpn}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
            <Link
              href={`/leer-externo/ehentai/${gid}/${token}`}
              className="rounded-md bg-accent px-5 py-2.5 font-mono text-[11px] font-bold tracking-[0.06em] text-[var(--on-accent)] transition hover:opacity-90 shadow-sm"
            >
              Empezar a leer
            </Link>
            <SaveExternalButton serie={serieGuardable} />
          </div>

          {/* Etiquetas */}
          {ficha.tags && ficha.tags.length > 0 && (
            <div className="pt-2">
              <p className="mb-2 font-mono text-[11px] font-medium text-faint">
                Etiquetas
              </p>
              <div className="flex flex-wrap gap-1.5 justify-center md:justify-start">
                {ficha.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md border border-line bg-[var(--surface-raised)] px-2 py-0.5 font-mono text-[11px] text-subtle"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Subido por y fecha */}
          <div className="pt-2 font-mono text-[11px] text-faint">
            {ficha.uploader && <span>Subido por: {ficha.uploader} · </span>}
            {ficha.posted && (
              <span>
                {new Date(ficha.posted).toLocaleDateString("es-AR", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Sección de Capítulos */}
      <section className="space-y-4 pt-4">
        <h2 className="font-display text-2xl font-bold tracking-[-0.03em] text-ink">
          Capítulos
        </h2>

        <ul className="divide-y divide-line overflow-hidden rounded-[10px] border border-line bg-panel">
          <li>
            <div className="flex items-center gap-3 px-5 py-4 transition hover:bg-[var(--surface-raised)]">
              <Link
                href={`/leer-externo/ehentai/${gid}/${token}`}
                className="min-w-0 flex-1"
              >
                <p className="truncate text-sm font-semibold text-ink">
                  Capítulo Completo
                </p>
                <p className="mt-0.5 font-mono text-[11px] tracking-[0.06em] text-subtle">
                  {ficha.filecount} páginas · Calidad original FullHD
                </p>
              </Link>

              {/* Botón de descarga local */}
              <BotonDescargaCapitulo
                fuente="E-Hentai"
                serieNombre={ficha.title}
                capituloNombre="Capítulo Completo"
                obtenerPaginas={obtenerPaginas}
              />

              <Link
                href={`/leer-externo/ehentai/${gid}/${token}`}
                className="shrink-0 font-mono text-[11px] tracking-[0.1em] text-accent-ink"
              >
                Leer →
              </Link>
            </div>
          </li>
        </ul>
      </section>

      <p className="border-t border-line pt-6 text-center font-mono text-[11px] tracking-[0.06em] text-subtle">
        Galería original alojada en{" "}
        <a
          href={ficha.url_original}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-ink hover:underline"
        >
          E-Hentai Galleries
        </a>
      </p>
    </div>
  );
}
