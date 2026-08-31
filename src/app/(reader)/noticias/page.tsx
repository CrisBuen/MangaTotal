"use client";

import { useEffect, useState } from "react";
import { EmptyState, Skeleton } from "@/components/ui/Feedback";
import { SectionHeading, Surface } from "@/components/ui/Surface";

interface Noticia {
  id: number;
  title: string;
  body: string;
  created_at: string;
}

interface NoticiaExterna {
  titulo: string;
  enlace: string;
  fecha: string | null;
  autor: string | null;
  categoria: string | null;
  imagen: string | null;
  resumen: string;
}

const KUDASAI = "https://somoskudasai.com";

const fecha = (valor: string) =>
  new Date(valor).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });

/**
 * Noticias: las propias y las del mundo del anime y el manga.
 *
 * Las de afuera vienen de Somos Kudasai, integradas con su permiso. Se
 * muestra el titular con un resumen corto y la nota se lee en su sitio: es lo
 * correcto con quien la escribió, y así la integración les suma visitas.
 */
export default function NoticiasPage() {
  const [propias, setPropias] = useState<Noticia[] | null>(null);
  const [externas, setExternas] = useState<NoticiaExterna[] | null>(null);

  useEffect(() => {
    fetch("/api/announcements")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setPropias(Array.isArray(d) ? d : []))
      .catch(() => setPropias([]));

    fetch("/api/noticias/externas")
      .then((r) => (r.ok ? r.json() : { noticias: [] }))
      .then((d) => setExternas(Array.isArray(d.noticias) ? d.noticias : []))
      .catch(() => setExternas([]));
  }, []);

  return (
    <div className="space-y-14" data-od-id="news-page">
      <SectionHeading
        eyebrow="Comunidad"
        title="Noticias"
        description="Lo de MangaTotal y lo que pasa en el mundo del anime y el manga."
      />

      {/* las propias primero: son los avisos del servicio */}
      {propias !== null && propias.length > 0 && (
        <section>
          <h2 className="mb-5 font-display text-3xl font-bold leading-none text-ink">
            De MangaTotal
          </h2>
          <div className="space-y-4">
            {propias.map((n) => (
              <article
                key={n.id}
                className="rounded-[10px] border border-accent bg-panel p-6 sm:p-8"
                data-od-id={`news-${n.id}`}
              >
                <time
                  className="font-mono text-[11px] font-bold tracking-[0.08em] text-accent-ink"
                  dateTime={n.created_at}
                >
                  {fecha(n.created_at)}
                </time>
                <h3 className="mt-3 text-2xl font-bold leading-tight text-ink">{n.title}</h3>
                <p className="mt-4 whitespace-pre-line text-sm leading-7 text-subtle">{n.body}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-3xl font-bold leading-none text-ink">
            Anime y manga
          </h2>
          <a
            href={KUDASAI}
            target="_blank"
            rel="noreferrer noopener"
            className="font-mono text-[11px] font-bold tracking-[0.06em] text-accent-ink hover:underline"
          >
            Por Somos Kudasai ↗
          </a>
        </div>

        {externas === null ? (
          <div className="space-y-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        ) : externas.length === 0 ? (
          <EmptyState
            title="No se pudieron cargar las noticias"
            description="Su sitio no respondió en este momento. Probá más tarde."
          />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {externas.map((n) => (
                <a
                  key={n.enlace}
                  href={n.enlace}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="group flex flex-col overflow-hidden rounded-[10px] border border-line bg-panel transition-colors hover:border-line-strong"
                >
                  {n.imagen && (
                    <div className="aspect-video overflow-hidden bg-[var(--surface-raised)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={n.imagen}
                        alt=""
                        className="h-full w-full object-cover transition duration-500"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}
                  <div className="flex flex-1 flex-col p-5">
                    <p className="font-mono text-[11px] font-bold tracking-[0.08em] text-accent-ink">
                      {n.categoria ?? "Noticias"}
                      {n.fecha && ` · ${fecha(n.fecha)}`}
                    </p>
                    <h3 className="mt-3 line-clamp-3 text-lg font-bold leading-[1.2] text-ink transition-colors group-hover:text-accent-ink">
                      {n.titulo}
                    </h3>
                    <p className="mt-3 line-clamp-3 flex-1 text-[13px] leading-6 text-subtle">
                      {n.resumen}
                    </p>
                    <p className="mt-4 font-mono text-[11px] tracking-[0.06em] text-subtle">
                      {n.autor ? `${n.autor} · ` : ""}Leer en su sitio ↗
                    </p>
                  </div>
                </a>
              ))}
            </div>

            <p className="mt-6 text-[13px] leading-6 text-subtle">
              Las noticias son de{" "}
              <a
                href={KUDASAI}
                target="_blank"
                rel="noreferrer noopener"
                className="text-accent-ink hover:underline"
              >
                Somos Kudasai
              </a>
              , integradas con su permiso. Acá se muestra el titular y un resumen; la nota completa
              se lee en su sitio.
            </p>
          </>
        )}
      </section>

      {propias !== null && propias.length === 0 && externas !== null && externas.length === 0 && (
        <EmptyState
          title="No hay noticias por ahora"
          description="Los anuncios de MangaTotal aparecerán acá."
        />
      )}
    </div>
  );
}
