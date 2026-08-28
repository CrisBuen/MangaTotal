"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DownloadSection } from "@/components/pwa/DownloadSection";
import { SeriesCard, type SeriesSummary } from "@/components/library/SeriesCard";
import { buttonStyles } from "@/components/ui/Button";
import { Badge, Skeleton } from "@/components/ui/Feedback";

interface HomeSeries extends SeriesSummary {
  description?: string | null;
  original_title?: string | null;
  updated_at?: string;
  tags?: { id: number; name: string; slug: string }[];
}

interface ContinueItem {
  series: { id: number; title: string; slug: string; type: string; cover_image_path: string | null };
  chapter: { id: number; number: number; page_count: number };
  lastPageNumber: number;
}

interface Me {
  nickname?: string;
  show_adult_content?: boolean;
}

/** Cada cuánto cambia la serie destacada del inicio. */
const HERO_ROTATION_MS = 6000;

export function HomeExperience() {
  const [series, setSeries] = useState<HomeSeries[] | null>(null);
  const [continues, setContinues] = useState<ContinueItem[]>([]);
  const [me, setMe] = useState<Me>({});
  const [catalogError, setCatalogError] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then((response) => (response.ok ? response.json() : {})).catch(() => ({})),
      // sin type: el visitante ve solo la sección normal y el usuario con
      // +18 activado ve todo (la API aplica la preferencia por su cuenta)
      fetch("/api/series")
        .then(async (response) => {
          if (!response.ok) throw new Error("catalog");
          return response.json();
        })
        .catch(() => {
          setCatalogError(true);
          return [];
        }),
      fetch("/api/progress/continue")
        .then((response) => (response.ok ? response.json() : []))
        .catch(() => []),
    ]).then(([meData, seriesData, continueData]) => {
      setMe(meData ?? {});
      setSeries(Array.isArray(seriesData) ? seriesData : []);
      setContinues(Array.isArray(continueData) ? continueData : []);
    });
  }, []);

  // el hero rota entre las series propias más recientes, una cada 6 s
  const highlights = useMemo(() => (series ?? []).slice(0, 6), [series]);

  useEffect(() => {
    if (highlights.length < 2) return;
    const timer = setInterval(
      () => setHighlightIndex((index) => (index + 1) % highlights.length),
      HERO_ROTATION_MS
    );
    return () => clearInterval(timer);
  }, [highlights.length]);

  // si el catálogo se acorta, no quedar apuntando fuera de rango
  useEffect(() => {
    setHighlightIndex((index) => (index < highlights.length ? index : 0));
  }, [highlights.length]);

  const featured = highlights[highlightIndex] ?? null;

  return (
    <div className="space-y-20 sm:space-y-24" data-od-id="home-page">
      <section
        className="relative isolate min-h-[26rem] overflow-hidden rounded-[2rem] border border-line bg-panel shadow-2xl sm:min-h-[34rem]"
        data-od-id="home-hero"
      >
        {featured?.cover_image_path && (
          <div className="absolute inset-x-0 top-0 h-56 sm:inset-y-0 sm:left-auto sm:right-0 sm:h-auto sm:w-[58%]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={featured.id}
              src={`/api/images/${featured.cover_image_path}`}
              alt={featured.title}
              className="h-full w-full animate-[fadeIn_600ms_ease-out] object-cover object-top opacity-70 sm:object-center"
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
        <div className="absolute -left-20 top-28 h-56 w-56 rounded-full bg-[var(--accent-soft)] blur-3xl" aria-hidden="true" />

        <div className="relative z-10 flex min-h-[26rem] max-w-3xl flex-col justify-end px-5 py-8 sm:min-h-[34rem] sm:px-10 sm:py-12 lg:px-14 lg:py-16">
          <div className="mb-auto flex items-center gap-3">
            <Badge tone="accent">MangaTotal</Badge>
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-subtle">
              {featured ? "Última incorporación" : "Biblioteca conectada"}
            </span>
          </div>

          {series === null ? (
            <div className="max-w-2xl space-y-4" aria-label="Cargando portada">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-6 w-3/4" />
            </div>
          ) : featured ? (
            <>
              <p className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
                {featured.chapter_count ?? 0} capítulo{featured.chapter_count === 1 ? "" : "s"}
              </p>
              <h1 className="line-clamp-4 max-w-3xl font-display text-[1.75rem] font-black uppercase leading-[0.95] tracking-[-0.04em] text-ink sm:text-6xl sm:leading-[0.88] sm:tracking-[-0.06em] lg:text-7xl">
                {featured.title}
              </h1>
              <p className="mt-4 line-clamp-3 max-w-2xl text-sm leading-6 text-subtle sm:mt-5 sm:line-clamp-none sm:text-base">
                {featured.description || "Descubrí la incorporación más reciente del catálogo y revisá todos sus capítulos disponibles."}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href={`/serie/${featured.slug}`} className={buttonStyles({ variant: "primary" })} data-od-id="hero-series-cta">
                  Ver serie
                </Link>
                <Link href="/biblioteca" className={buttonStyles({ variant: "secondary" })}>
                  Explorar catálogo
                </Link>
              </div>

              {highlights.length > 1 && (
                <div className="mt-8 flex items-center gap-2" data-od-id="hero-dots">
                  {highlights.map((item, index) => (
                    <button
                      key={item.id}
                      onClick={() => setHighlightIndex(index)}
                      aria-label={`Ver ${item.title}`}
                      aria-current={index === highlightIndex}
                      className={`h-1.5 rounded-full transition-all ${
                        index === highlightIndex
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
                {catalogError
                  ? "El catálogo no está disponible en este momento. Podés reintentar desde la Biblioteca."
                  : "Cuando publiques una serie, su portada y sus capítulos aparecerán aquí."}
              </p>
              <Link href="/biblioteca?f=normal" className={`mt-8 self-start ${buttonStyles({ variant: "primary" })}`}>
                Abrir biblioteca
              </Link>
            </>
          )}
        </div>
      </section>

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
            description={me.nickname ? "Administrá el contenido +18 y tu modo de lectura desde el perfil." : "Iniciá sesión para continuar lecturas y guardar favoritos."}
            href={me.nickname ? "/perfil" : "/login"}
          />
        )}
      </section>

      <DownloadSection />
    </div>
  );
}

function SectionTitle({ eyebrow, title, href }: { eyebrow: string; title: string; href: string }) {
  return (
    <div className="mb-8 flex items-end justify-between gap-5">
      <div>
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-accent">{eyebrow}</p>
        <h2 className="mt-2 font-display text-3xl font-black uppercase tracking-[-0.04em] text-ink sm:text-4xl">{title}</h2>
      </div>
      <Link href={href} className="hidden min-h-11 items-center text-[11px] font-bold uppercase tracking-[0.12em] text-subtle transition hover:text-accent sm:inline-flex">
        Ver más →
      </Link>
    </div>
  );
}

function LibraryAccessCard({ eyebrow, title, description, href }: { eyebrow: string; title: string; description: string; href: string }) {
  return (
    <Link href={href} className="group relative min-h-64 overflow-hidden rounded-[2rem] border border-line bg-panel p-7 transition hover:border-accent hover:shadow-[var(--glow)] sm:p-9">
      <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-[var(--accent-soft)] blur-3xl transition group-hover:scale-125" aria-hidden="true" />
      <div className="relative flex h-full flex-col">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-accent">{eyebrow}</p>
        <h3 className="mt-auto max-w-md font-display text-3xl font-black uppercase leading-none text-ink">{title}</h3>
        <p className="mt-4 max-w-md text-sm leading-6 text-subtle">{description}</p>
      </div>
    </Link>
  );
}
