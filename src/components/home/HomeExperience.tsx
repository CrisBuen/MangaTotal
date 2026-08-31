"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DownloadSection } from "@/components/pwa/DownloadSection";
import { TopSemanal } from "@/components/home/TopSemanal";
import { ContinueReading } from "@/components/home/ContinueReading";
import { buttonStyles } from "@/components/ui/Button";
import { Badge, Skeleton } from "@/components/ui/Feedback";

interface Noticia {
  titulo: string;
  enlace: string;
  fecha: string | null;
  autor: string | null;
  categoria: string | null;
  imagen: string | null;
  resumen: string;
}

interface Me {
  nickname?: string;
  show_adult_content?: boolean;
}

/** Cada cuánto cambia la noticia del inicio. */
const ROTACION_MS = 6000;

/** Cuántas noticias entran en la rotación. Más que esto nadie las ve. */
const CUANTAS = 6;

export function HomeExperience() {
  const [noticias, setNoticias] = useState<Noticia[] | null>(null);
  const [me, setMe] = useState<Me>({});
  const [actual, setActual] = useState(0);
  const [detenido, setDetenido] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => setMe(d ?? {}))
      .catch(() => setMe({}));

    fetch("/api/noticias/externas")
      .then((r) => (r.ok ? r.json() : { noticias: [] }))
      .then((d) => setNoticias(Array.isArray(d.noticias) ? d.noticias.slice(0, CUANTAS) : []))
      .catch(() => setNoticias([]));
  }, []);

  // la rotación se frena mientras el puntero está encima: si no, la noticia
  // se cambia justo cuando alguien la está leyendo o va a tocar el botón
  useEffect(() => {
    if (detenido || (noticias?.length ?? 0) < 2) return;
    const t = setInterval(
      () => setActual((i) => (i + 1) % (noticias?.length ?? 1)),
      ROTACION_MS
    );
    return () => clearInterval(t);
  }, [detenido, noticias?.length]);

  const noticia = noticias?.[actual] ?? null;

  return (
    <div className="flex flex-col gap-16" data-od-id="home-page">
      <div className="order-1">
        <ContinueReading />
      </div>
      <section
        className="order-4 grid overflow-hidden rounded-[10px] border border-line bg-panel md:grid-cols-[minmax(0,1fr)_minmax(280px,40%)]"
        data-od-id="home-hero"
        onMouseEnter={() => setDetenido(true)}
        onMouseLeave={() => setDetenido(false)}
      >
        {noticia?.imagen && (
          <div className="relative h-48 overflow-hidden border-b border-line md:col-start-2 md:row-start-1 md:h-full md:min-h-80 md:border-b-0 md:border-l">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={noticia.enlace}
              src={noticia.imagen}
              alt=""
              className="h-full w-full animate-[fadeIn_600ms_ease-out] object-cover object-center opacity-80"
              referrerPolicy="no-referrer"
            />
          </div>
        )}

        <div className="relative z-10 flex min-w-0 flex-col justify-center px-5 py-7 md:col-start-1 md:row-start-1 sm:px-8 sm:py-9">
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <Badge tone="accent">Noticias</Badge>
            <span className="font-mono text-[11px] font-medium tracking-[0.08em] text-faint">
              {noticia?.categoria || "Somos Kudasai"}
            </span>
          </div>

          {noticias === null ? (
            <div className="max-w-2xl space-y-4" aria-label="Cargando noticias">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-6 w-3/4" />
            </div>
          ) : noticia ? (
            <>
              <h2 className="line-clamp-3 max-w-2xl font-display text-[clamp(1.5rem,3vw,2rem)] font-bold leading-[1.12] tracking-[-0.02em] text-ink">
                {noticia.titulo}
              </h2>

              <p className="mt-4 line-clamp-4 max-w-2xl text-sm leading-6 text-subtle sm:mt-5">
                {noticia.resumen}
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <a
                  href={noticia.enlace}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={buttonStyles({ variant: "primary" })}
                  data-od-id="hero-noticia-cta"
                >
                  Abrir noticia ↗
                </a>
                <Link href="/noticias" className={buttonStyles({ variant: "secondary" })}>
                  Ver todas
                </Link>
              </div>

              <p className="mt-5 text-[13px] text-faint">
                Publicado por Somos Kudasai
                {noticia.autor && ` · ${noticia.autor}`}
              </p>

              {noticias.length > 1 && (
                <div className="mt-6 flex items-center gap-2" data-od-id="hero-dots">
                  {noticias.map((n, i) => (
                    <button
                      key={n.enlace}
                      onClick={() => setActual(i)}
                      aria-label={`Ver noticia ${i + 1}`}
                      aria-current={i === actual}
                      className={`h-1.5 rounded-full transition-all ${
                        i === actual
                          ? "w-8 bg-accent "
                          : "w-3 bg-[var(--surface-raised)] hover:bg-subtle"
                      }`}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <h2 className="max-w-3xl font-display text-[clamp(1.5rem,3vw,2rem)] font-bold leading-[1.12] tracking-[-0.02em] text-ink">
                Todas tus historias. Una experiencia total.
              </h2>
              <p className="mt-5 max-w-xl text-sm leading-6 text-subtle sm:text-base">
                Las noticias no están disponibles en este momento. El catálogo y las
                fuentes funcionan con normalidad.
              </p>
              <Link
                href="/biblioteca?f=normal"
                className={`mt-8 self-start ${buttonStyles({ variant: "primary" })}`}
              >
                Abrir biblioteca
              </Link>
            </>
          )}
        </div>
      </section>

      <div className="order-2">
        <TopSemanal />
      </div>

      <section className="order-3 grid gap-4 md:grid-cols-2" data-od-id="home-library-access">
        <LibraryAccessCard
          eyebrow="Biblioteca principal"
          title="Contenido Normal"
          description="Manga, manhwa y manhua organizados por etiquetas y actualizaciones."
          href="/biblioteca?f=normal"
        />
        {me.show_adult_content ? (
          <LibraryAccessCard
            eyebrow="Preferencia activa"
            title="Contenido +18"
            description="Acceso a la sección adulta según la configuración de tu perfil."
            href="/biblioteca?f=adult"
          />
        ) : (
          <LibraryAccessCard
            eyebrow="Cuenta"
            title={me.nickname ? "Configurar contenido" : "Guardá tu progreso"}
            description={
              me.nickname
                ? "Administrá el contenido +18 y tu modo de lectura desde el perfil."
                : "Iniciá sesión para continuar lecturas y guardar favoritos."
            }
            href={me.nickname ? "/perfil" : "/login"}
          />
        )}
      </section>

      <div className="order-5">
        <DownloadSection />
      </div>
    </div>
  );
}

function LibraryAccessCard({
  eyebrow,
  title,
  description,
  href,
}: {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group min-h-48 rounded-[10px] border border-line bg-panel p-6 transition-colors hover:border-line-strong sm:p-7"
    >
      <div className="flex h-full flex-col">
        <p className="font-mono text-[11px] font-medium tracking-[0.08em] text-faint">
          {eyebrow}
        </p>
        <h3 className="mt-auto max-w-md font-display text-2xl font-semibold leading-tight tracking-[-0.02em] text-ink">
          {title}
        </h3>
        <p className="mt-4 max-w-md text-sm leading-6 text-subtle">{description}</p>
      </div>
    </Link>
  );
}
