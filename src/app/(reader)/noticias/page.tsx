"use client";

import { useEffect, useState } from "react";
import { EmptyState, Skeleton } from "@/components/ui/Feedback";
import { SectionHeading } from "@/components/ui/Surface";

interface Noticia {
  id: number;
  title: string;
  body: string;
  created_at: string;
}

/**
 * Noticias, en su propia página.
 *
 * Antes vivían como una sección al final de Inicio y el enlace del menú era
 * un ancla que bajaba hasta ahí. Al tener página propia, el menú lleva a un
 * lugar de verdad y no hay que repetirlas en dos pantallas.
 */
export default function NoticiasPage() {
  const [noticias, setNoticias] = useState<Noticia[] | null>(null);

  useEffect(() => {
    fetch("/api/announcements")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setNoticias(Array.isArray(d) ? d : []))
      .catch(() => setNoticias([]));
  }, []);

  return (
    <div className="space-y-10" data-od-id="news-page">
      <SectionHeading
        eyebrow="Comunidad"
        title="Noticias"
        description="Anuncios y novedades de MangaTotal."
      />

      {noticias === null ? (
        <div className="space-y-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : noticias.length === 0 ? (
        <EmptyState
          title="No hay noticias por ahora"
          description="Los anuncios publicados por administración aparecerán acá."
        />
      ) : (
        <div className="space-y-4">
          {noticias.map((n) => (
            <article
              key={n.id}
              className="rounded-2xl border border-line bg-panel p-6 sm:p-8"
              data-od-id={`news-${n.id}`}
            >
              <time
                className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-accent"
                dateTime={n.created_at}
              >
                {new Date(n.created_at).toLocaleDateString("es-AR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </time>
              <h2 className="mt-3 font-display text-2xl font-black uppercase leading-tight text-ink sm:text-3xl">
                {n.title}
              </h2>
              <p className="mt-4 whitespace-pre-line text-sm leading-7 text-subtle">{n.body}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
