"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { VolverFuente } from "@/components/library/VolverFuente";
import { SaveExternalButton } from "@/components/library/SaveExternalButton";
import { BotonDescargaCapitulo } from "@/components/reader/BotonDescargaCapitulo";
import { BotonMigrar } from "@/components/library/BotonMigrar";
import { Surface } from "@/components/ui/Surface";
import { anotarHistorial } from "@/components/library/historial";
import type { FichaHitomi } from "@/lib/hitomiTipos";

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

export default function SerieHitomiPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(props.params);
  const [ficha, setFicha] = useState<FichaHitomi | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`/api/externo/hitomi/${id}`);
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
  }, [id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const obtenerPaginas = useCallback(async (): Promise<string[]> => {
    const res = await fetch(`/api/externo/hitomi/${id}/paginas`);
    if (!res.ok) throw new Error("No se pudieron obtener las páginas de esta galería");
    const data = await res.json();
    return data.paginas || [];
  }, [id]);

  if (error) {
    return (
      <Surface className="mx-auto max-w-2xl p-10 text-center my-12">
        <p className="text-lg font-bold text-ink">{error}</p>
        <VolverFuente
          href="/explorar?fuente=hitomi"
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
        Cargando galería de Hitomi.la...
      </p>
    );
  }

  const tituloLimpio = decodificarHtml(ficha.title);
  const portadaUrl =
    ficha.thumb && !ficha.thumb.startsWith("/api/externo/imagen") && ficha.thumb.startsWith("http")
      ? `/api/externo/imagen?u=${encodeURIComponent(ficha.thumb)}`
      : ficha.thumb;

  const serieGuardable = {
    source: "hitomi" as const,
    external_id: id,
    title: tituloLimpio,
    cover_url: portadaUrl,
    type: "adult",
  };

  const todasLasEtiquetas: { tag: string; label: string }[] = [
    ...(ficha.parodys ?? [])
      .filter((p) => p && p.toLowerCase() !== "original")
      .map((p) => ({ tag: `series:${p}`, label: `📚 ${p}` })),
    ...(ficha.characters ?? []).map((c) => ({ tag: `character:${c}`, label: `👤 ${c}` })),
    ...(ficha.artists ?? []).map((a) => ({ tag: `artist:${a}`, label: `🎨 ${a}` })),
    ...(ficha.groups ?? []).map((g) => ({ tag: `group:${g}`, label: `👥 ${g}` })),
    ...(ficha.tags ?? []).map((t) => ({ tag: t, label: t })),
  ];

  return (
    <div className="space-y-10">
      <VolverFuente
        href="/explorar?fuente=hitomi"
        className="inline-block font-mono text-[11px] font-bold tracking-[0.06em] text-subtle transition hover:text-accent-ink"
      >
        ← Explorar
      </VolverFuente>

      {/* Estructura oficial de la obra */}
      <div className="flex flex-col gap-8 sm:flex-row">
        <div className="w-44 shrink-0 overflow-hidden rounded-[10px] border border-line bg-[var(--surface-raised)] sm:w-52">
          <div className="aspect-[2/3]">
            {portadaUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={portadaUrl}
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
            Externo · Hitomi.la · {ficha.type || "doujinshi"} · {ficha.filecount} páginas · Idioma: {ficha.language}
            {ficha.artists && ficha.artists.length > 0 ? ` · Artista: ${ficha.artists.join(", ")}` : ""}
          </p>

          {/* Etiquetas interactivas */}
          {todasLasEtiquetas.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {todasLasEtiquetas.map((item) => (
                <Link
                  key={item.tag}
                  href={`/explorar?fuente=hitomi&hitomi_tag=${encodeURIComponent(item.tag)}`}
                  className="rounded-full border border-line bg-[var(--surface-raised)] px-2.5 py-0.5 text-[12px] text-subtle transition hover:border-accent hover:text-accent-ink"
                  title={`Filtrar por "${item.tag}" en el catálogo`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          )}

          {ficha.japanese_title && (
            <p className="mb-4 font-sans text-sm text-subtle italic">
              {decodificarHtml(ficha.japanese_title)}
            </p>
          )}

          {/* Acciones de la obra */}
          <div className="flex flex-wrap items-center gap-3">
            <Link
              onClick={() =>
                void anotarHistorial({
                  ...serieGuardable,
                  last_chapter_id: id,
                  last_chapter_name: "Capítulo Completo",
                })
              }
              href={`/leer-externo/hitomi/${id}`}
              className="rounded-md bg-accent px-5 py-2.5 font-mono text-[11px] font-bold tracking-[0.06em] text-[var(--on-accent)] transition hover:opacity-90"
            >
              Empezar a leer
            </Link>
            <SaveExternalButton serie={serieGuardable} />
            <BotonMigrar fuente="hitomi" externalId={id} titulo={tituloLimpio} />
          </div>
        </div>
      </div>

      {/* Sección de Capítulos */}
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
                    last_chapter_id: id,
                    last_chapter_name: "Capítulo Completo",
                  })
                }
                href={`/leer-externo/hitomi/${id}`}
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
                fuente="Hitomi.la"
                serieNombre={tituloLimpio}
                capituloNombre="Capítulo Completo"
                obtenerPaginas={obtenerPaginas}
              />

              <Link
                onClick={() =>
                  void anotarHistorial({
                    ...serieGuardable,
                    last_chapter_id: id,
                    last_chapter_name: "Capítulo Completo",
                  })
                }
                href={`/leer-externo/hitomi/${id}`}
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
          Hitomi.la
        </a>
      </p>
    </div>
  );
}
