"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { VolverFuente } from "@/components/library/VolverFuente";
import { SaveExternalButton } from "@/components/library/SaveExternalButton";
import { BotonDescargaCapitulo } from "@/components/reader/BotonDescargaCapitulo";
import { BotonMigrar } from "@/components/library/BotonMigrar";
import { BotonFlotanteLectura } from "@/components/reader/BotonFlotanteLectura";
import { Surface } from "@/components/ui/Surface";
import { anotarHistorial } from "@/components/library/historial";
import type { FichaEhentai } from "@/lib/ehentai";

function decodificarHtml(texto: string): string {
  return texto
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&nbsp;/g, " ");
}

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
          href="/explorar?fuente=ehentai"
          className="mt-4 inline-block font-mono text-[11px] font-bold tracking-[0.06em] text-accent-ink hover:underline"
        >
          ← Volver a Explorar
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

  const tituloLimpio = decodificarHtml(ficha.title);
  const serieGuardable = {
    source: "ehentai" as const,
    external_id: `${gid}/${token}`,
    title: tituloLimpio,
    cover_url: ficha.thumb,
    type: "adult",
  };

  return (
    <div className="space-y-10">
      <VolverFuente
        href="/explorar?fuente=ehentai"
        className="inline-block font-mono text-[11px] font-bold tracking-[0.06em] text-subtle transition hover:text-accent-ink"
      >
        ← Explorar
      </VolverFuente>

      {/* Estructura oficial idéntica al resto de fuentes */}
      <div className="flex flex-col gap-8 sm:flex-row">
        <div className="w-44 shrink-0 overflow-hidden rounded-[10px] border border-line bg-[var(--surface-raised)] sm:w-52">
          <div className="aspect-[2/3]">
            {ficha.thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={ficha.thumb}
                alt={tituloLimpio}
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-5xl text-subtle">📖</div>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl font-bold leading-[1.05] tracking-[-0.03em] text-ink sm:text-4xl">
              {tituloLimpio}
            </h1>
            <span className="rounded-full border border-danger px-2 py-0.5 font-mono text-[11px] font-bold tracking-[0.1em] text-danger">
              +18
            </span>
          </div>

          <p className="mb-3 font-mono text-[11px] tracking-[0.06em] text-subtle">
            Externo · E-Hentai · {ficha.category} · {ficha.filecount} páginas
            {ficha.uploader ? ` · Subido por ${ficha.uploader}` : ""}
          </p>

          {/* Etiquetas interactivas que buscan en catálogo al hacer click */}
          {ficha.tags && ficha.tags.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {ficha.tags.map((t) => (
                <Link
                  key={t}
                  href={`/explorar?fuente=ehentai&eh_tag=${encodeURIComponent(t)}&eh_lang=todos`}
                  className="rounded-full border border-line bg-[var(--surface-raised)] px-2.5 py-0.5 text-[12px] text-subtle transition hover:border-accent hover:text-accent-ink"
                  title={`Filtrar por "${t}" en el catálogo`}
                >
                  {t}
                </Link>
              ))}
            </div>
          )}

          {ficha.title_jpn && (
            <p className="mb-4 font-sans text-sm text-subtle italic">
              {decodificarHtml(ficha.title_jpn)}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <SaveExternalButton serie={serieGuardable} />
            <BotonMigrar fuente="ehentai" externalId={`${gid}/${token}`} titulo={tituloLimpio} />
          </div>
        </div>
      </div>

      {/* Sección de Capítulos con el botón de descarga y diseño estándar */}
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-bold tracking-[-0.03em] text-ink">
            Capítulos
          </h2>
        </div>

        <ul className="divide-y divide-line overflow-hidden rounded-[10px] border border-line bg-panel">
          <li>
            <div className="flex items-center gap-3 px-5 py-4 transition hover:bg-[var(--surface-raised)]">
              <Link
                onClick={() =>
                  void anotarHistorial({
                    ...serieGuardable,
                    last_chapter_id: `${gid}/${token}`,
                    last_chapter_name: "Capítulo Completo",
                  })
                }
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
                serieNombre={tituloLimpio}
                capituloNombre="Capítulo Completo"
                obtenerPaginas={obtenerPaginas}
              />

              <Link
                onClick={() =>
                  void anotarHistorial({
                    ...serieGuardable,
                    last_chapter_id: `${gid}/${token}`,
                    last_chapter_name: "Capítulo Completo",
                  })
                }
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

      <BotonFlotanteLectura
        source="ehentai"
        externalId={`${gid}/${token}`}
        slug={`${gid}/${token}`}
        title={tituloLimpio}
        coverUrl={ficha.thumb}
        type="adult"
        primerCapitulo={{ id: `${gid}/${token}`, name: "Capítulo Completo" }}
        cargando={cargando}
      />
    </div>
  );
}
