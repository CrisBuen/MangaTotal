"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SeriesCard, type SeriesSummary } from "@/components/library/SeriesCard";
import { buttonStyles } from "@/components/ui/Button";
import { Badge, EmptyState, Skeleton } from "@/components/ui/Feedback";

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

interface Announcement {
  id: number;
  title: string;
  body: string;
  created_at: string;
}

interface Me {
  nickname?: string;
  show_adult_content?: boolean;
}

export function HomeExperience() {
  const [series, setSeries] = useState<HomeSeries[] | null>(null);
  const [continues, setContinues] = useState<ContinueItem[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[] | null>(null);
  const [me, setMe] = useState<Me>({});
  const [catalogError, setCatalogError] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then((response) => (response.ok ? response.json() : {})).catch(() => ({})),
      fetch("/api/series?type=normal")
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
      fetch("/api/announcements")
        .then((response) => (response.ok ? response.json() : []))
        .catch(() => []),
    ]).then(([meData, seriesData, continueData, announcementData]) => {
      setMe(meData ?? {});
      setSeries(Array.isArray(seriesData) ? seriesData : []);
      setContinues(Array.isArray(continueData) ? continueData : []);
      setAnnouncements(Array.isArray(announcementData) ? announcementData : []);
    });
  }, []);

  const featured = series?.[0] ?? null;
  const categories = useMemo(() => {
    const map = new Map<string, { name: string; slug: string; count: number }>();
    for (const item of series ?? []) {
      for (const tag of item.tags ?? []) {
        const current = map.get(tag.slug);
        map.set(tag.slug, { name: tag.name, slug: tag.slug, count: (current?.count ?? 0) + 1 });
      }
    }
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 10);
  }, [series]);

  return (
    <div className="space-y-20 sm:space-y-24" data-od-id="home-page">
      <section
        className="relative isolate min-h-[34rem] overflow-hidden rounded-[2rem] border border-line bg-panel shadow-2xl"
        data-od-id="home-hero"
      >
        {featured?.cover_image_path && (
          <div className="absolute inset-y-0 right-0 w-full md:w-[58%]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/images/${featured.cover_image_path}`}
              alt={featured.title}
              className="h-full w-full object-cover object-center opacity-70"
            />
          </div>
        )}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, var(--bg) 0%, color-mix(in oklch, var(--bg) 94%, transparent) 42%, color-mix(in oklch, var(--bg) 28%, transparent) 100%), linear-gradient(0deg, var(--bg) 0%, transparent 55%)",
          }}
        />
        <div className="absolute -left-20 top-28 h-56 w-56 rounded-full bg-[var(--accent-soft)] blur-3xl" aria-hidden="true" />

        <div className="relative z-10 flex min-h-[34rem] max-w-3xl flex-col justify-end px-6 py-10 sm:px-10 sm:py-12 lg:px-14 lg:py-16">
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
              <h1 className="max-w-3xl font-display text-5xl font-black uppercase leading-[0.88] tracking-[-0.06em] text-ink sm:text-6xl lg:text-7xl">
                {featured.title}
              </h1>
              <p className="mt-5 max-w-2xl text-sm leading-6 text-subtle sm:text-base">
                {featured.description || "Descubrí la incorporación más reciente del catálogo y revisá todos sus capítulos disponibles."}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href={`/serie/${featured.slug}`} className={buttonStyles({ variant: "primary" })} data-od-id="hero-series-cta">
                  Ver serie
                </Link>
                <Link href="/biblioteca?f=normal" className={buttonStyles({ variant: "secondary" })}>
                  Explorar catálogo
                </Link>
              </div>
            </>
          ) : (
            <>
              <h1 className="max-w-3xl font-display text-5xl font-black uppercase leading-[0.88] tracking-[-0.06em] text-ink sm:text-6xl lg:text-7xl">
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

      <section data-od-id="home-latest">
        <SectionTitle eyebrow="Catálogo" title="Últimas actualizaciones" href="/biblioteca?f=normal" />
        {series === null ? (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="aspect-[2/3]" />)}
          </div>
        ) : series.length === 0 ? (
          <EmptyState title="No hay series publicadas" description="Las series disponibles aparecerán aquí automáticamente." />
        ) : (
          <div className="flex snap-x gap-5 overflow-x-auto pb-5">
            {series.slice(0, 10).map((item) => (
              <div key={item.id} className="w-[min(68vw,14rem)] shrink-0 snap-start sm:w-52">
                <SeriesCard series={item} />
              </div>
            ))}
          </div>
        )}
      </section>

      {continues.length > 0 && (
        <section data-od-id="home-continue-reading">
          <SectionTitle eyebrow="Tu progreso" title="Continuar leyendo" href="/biblioteca?f=normal" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {continues.slice(0, 6).map((item) => (
              <Link
                key={`${item.series.id}-${item.chapter.id}`}
                href={`/leer/${item.chapter.id}?page=${item.lastPageNumber}`}
                className="group flex min-h-32 overflow-hidden rounded-2xl border border-line bg-panel transition hover:border-accent hover:shadow-[var(--glow)]"
              >
                <div className="w-24 shrink-0 bg-[var(--surface-raised)]">
                  {item.series.cover_image_path && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/images/${item.series.cover_image_path}`} alt={item.series.title} className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-center p-4">
                  <p className="truncate font-display text-lg font-bold text-ink group-hover:text-accent">{item.series.title}</p>
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-subtle">
                    Cap. {item.chapter.number} · pág. {item.lastPageNumber}/{item.chapter.page_count}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section id="categorias" data-od-id="home-categories">
        <SectionTitle eyebrow="Explorar" title="Categorías" href="/biblioteca?f=normal" />
        {categories.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {categories.map((category) => (
              <Link
                key={category.slug}
                href={`/biblioteca?tag=${encodeURIComponent(category.slug)}`}
                className="group flex min-h-24 items-center justify-between rounded-2xl border border-line bg-panel px-5 transition hover:border-accent hover:bg-[var(--accent-soft)]"
              >
                <span className="font-display text-lg font-bold text-ink group-hover:text-accent">{category.name}</span>
                <span className="font-mono text-[10px] text-subtle">{category.count}</span>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title="Sin categorías disponibles" description="Las etiquetas asignadas a las series aparecerán en esta sección." />
        )}
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

      <section id="noticias" data-od-id="home-news">
        <SectionTitle eyebrow="Comunidad" title="Noticias" href="/biblioteca" />
        {announcements === null ? (
          <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
        ) : announcements.length === 0 ? (
          <EmptyState title="No hay noticias por ahora" description="Los anuncios publicados por administración aparecerán aquí." />
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {announcements.slice(0, 3).map((announcement) => (
              <article key={announcement.id} className="rounded-2xl border border-line bg-panel p-6" data-od-id={`home-news-${announcement.id}`}>
                <time className="font-mono text-[9px] uppercase tracking-[0.13em] text-accent" dateTime={announcement.created_at}>
                  {new Date(announcement.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}
                </time>
                <h3 className="mt-4 text-xl font-bold text-ink">{announcement.title}</h3>
                <p className="mt-3 line-clamp-4 whitespace-pre-line text-sm leading-6 text-subtle">{announcement.body}</p>
              </article>
            ))}
          </div>
        )}
      </section>
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
