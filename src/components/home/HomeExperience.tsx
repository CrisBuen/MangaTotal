"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DownloadSection } from "@/components/pwa/DownloadSection";
import { TopSemanal } from "@/components/home/TopSemanal";
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
    <div className="space-y-20 sm:space-y-24" data-od-id="home-page">
      <section
        className="relative isolate min-h-[26rem] overflow-hidden rounded-[2rem] border border-line bg-panel shadow-2xl sm:min-h-[32rem]"
        data-od-id="home-hero"
        onMouseEnter={() => setDetenido(true)}
        onMouseLeave={() => setDetenido(false)}
      >
        {noticia?.imagen && (
          <div className="absolute inset-x-0 top-0 h-56 sm:inset-y-0 sm:left-auto sm:right-0 sm:h-auto sm:w-[58%]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={noticia.enlace}
              src={noticia.imagen}
              alt=""
              className="h-full w-full animate-[fadeIn_600ms_ease-out] object-cover object-center opacity-70"
              referrerPolicy="no-referrer"
            />
          </div>
        )}

        <div
          className="absolute inset-0 sm:hidden"
          style={{
            background:
              "linear-gradient(0deg, var(--bg) 32%, color-mix(in oklch, var(--bg) 55%, transparent) 72%, transparent 100%)",
          }}
        />
        <div
          className="absolute inset-0 hidden sm:block"
          style={{
            background:
              "linear-gradient(90deg, var(--bg) 0%, color-mix(in oklch, var(--bg) 94%, transparent) 42%, color-mix(in oklch, var(--bg) 28%, transparent) 100%), linear-gradient(0deg, var(--bg) 0%, transparent 55%)",
          }}
        />
        <div
          className="absolute -left-20 top-28 h-56 w-56 rounded-full bg-[var(--accent-soft)] blur-3xl"
          aria-hidden="true"
        />

        <div className="relative z-10 flex min-h-[26rem] max-w-3xl flex-col justify-end px-5 py-8 sm:min-h-[32rem] sm:px-10 sm:py-12 lg:px-14 lg:py-14">
          <div className="mb-auto flex flex-wrap items-center gap-3">
            <Badge tone="accent">Noticias</Badge>
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-subtle">
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
              <h1 className="line-clamp-3 max-w-2xl font-display text-2xl font-black uppercase leading-[1.02] tracking-[-0.03em] text-ink sm:text-4xl sm:leading-[0.95] lg:text-[2.75rem]">
                {noticia.titulo}
              </h1>

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

              <p className="mt-5 font-mono text-[9px] uppercase tracking-[0.14em] text-subtle">
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
                          ? "w-8 bg-accent shadow-[var(--glow)]"
                          : "w-3 bg-[var(--surface-raised)] hover:bg-subtle"
                      }`}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <h1 className="max-w-3xl font-display text-3xl font-black uppercase leading-[0.95] tracking-[-0.04em] text-ink sm:text-6xl sm:leading-[0.88] lg:text-7xl">
                Todas tus historias. Una experiencia total.
              </h1>
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

      <TopSemanal />

      <section className="grid gap-5 md:grid-cols-2" data-od-id="home-library-access">
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

      <DownloadSection />
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
      className="group relative min-h-64 overflow-hidden rounded-[2rem] border border-line bg-panel p-7 transition hover:border-accent hover:shadow-[var(--glow)] sm:p-9"
    >
      <div
        className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-[var(--accent-soft)] blur-3xl transition group-hover:scale-125"
        aria-hidden="true"
      />
      <div className="relative flex h-full flex-col">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
          {eyebrow}
        </p>
        <h3 className="mt-auto max-w-md font-display text-3xl font-black uppercase leading-none text-ink">
          {title}
        </h3>
        <p className="mt-4 max-w-md text-sm leading-6 text-subtle">{description}</p>
      </div>
    </Link>
  );
}
