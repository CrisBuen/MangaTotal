import Link from "next/link";
import { db } from "@/lib/db";
import { REALTIME_WINDOW_SECONDS } from "@/lib/adminAnalytics";
import { JobsTable, type IngestionJobItem } from "@/components/dashboard/JobsTable";
import { buttonStyles } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

const numero = new Intl.NumberFormat("es-CL");

const STATUS_LABEL: Record<string, string> = {
  ongoing: "En curso",
  completed: "Completada",
  dropped: "Abandonada",
};

export default async function AdminDashboard() {
  const activeSince = new Date(Date.now() - REALTIME_WINDOW_SECONDS * 1000);

  // Un solo lote en paralelo en SSR: evita roundtrips extra desde el navegador al abrir /admin.
  const [
    seriesCount,
    adultSeriesCount,
    chapterCount,
    pageCount,
    userCount,
    adminCount,
    activeNowCount,
    recentJobsRaw,
    recentSeries,
    recentNews,
  ] = await Promise.all([
    db.series.count(),
    db.series.count({ where: { type: "adult" } }),
    db.chapter.count(),
    db.page.count(),
    db.user.count(),
    db.user.count({ where: { isAdmin: true } }),
    db.analyticsPresence.count({ where: { lastSeen: { gte: activeSince } } }),
    db.ingestionJob.findMany({
      orderBy: { startedAt: "desc" },
      take: 30,
      include: {
        series: { select: { title: true, slug: true } },
        chapter: { select: { number: true } },
      },
    }),
    db.series.findMany({
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        slug: true,
        type: true,
        status: true,
        _count: { select: { chapters: true } },
      },
    }),
    db.announcement.findMany({
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { id: true, title: true, createdAt: true },
    }),
  ]);

  const initialJobs: IngestionJobItem[] = recentJobsRaw.map((j) => ({
    id: j.id,
    original_filename: j.originalFilename,
    status: j.status,
    error_message: j.errorMessage,
    series: j.series ? { title: j.series.title, slug: j.series.slug } : null,
    chapter_number: j.chapter?.number ?? null,
    started_at: j.startedAt.toISOString(),
    finished_at: j.finishedAt ? j.finishedAt.toISOString() : null,
  }));

  const avgPages = chapterCount > 0 ? Math.round(pageCount / chapterCount) : 0;

  const kpis = [
    {
      label: "Activos ahora",
      value: activeNowCount,
      hint: `Últimos ${REALTIME_WINDOW_SECONDS} s`,
      live: true,
      accent: "text-success border-success/30 bg-success/10",
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      ),
    },
    {
      label: "Series locales",
      value: seriesCount,
      hint: adultSeriesCount > 0 ? `${adultSeriesCount} en +18` : "Catálogo propio",
      accent: "text-accent-ink border-accent/30 bg-[var(--accent-soft)]",
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
        </svg>
      ),
    },
    {
      label: "Capítulos",
      value: chapterCount,
      hint: avgPages > 0 ? `~${avgPages} págs. promedio` : "Publicados",
      accent: "text-accent-ink border-accent/30 bg-[var(--accent-soft)]",
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
        </svg>
      ),
    },
    {
      label: "Páginas",
      value: pageCount,
      hint: "Imágenes indexadas",
      accent: "text-subtle border-line-strong bg-[var(--surface-raised)]",
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
        </svg>
      ),
    },
    {
      label: "Usuarios",
      value: userCount,
      hint: `${adminCount} ${adminCount === 1 ? "admin" : "admins"}`,
      accent: "text-subtle border-line-strong bg-[var(--surface-raised)]",
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
        </svg>
      ),
    },
  ];

  const shortcuts = [
    {
      href: "/admin/subir",
      title: "Subir capítulo .zip",
      desc: "Procesar exportación Koharu",
    },
    {
      href: "/admin/series",
      title: "Gestionar series",
      desc: "Crear, editar tags y estados",
    },
    {
      href: "/admin/noticias",
      title: "Publicar noticia",
      desc: "Avisos visibles en la app",
    },
    {
      href: "/admin/analiticas",
      title: "Ver analíticas",
      desc: "Actividad, fuentes y CSV",
    },
  ];

  return (
    <div className="space-y-8" data-od-id="admin-dashboard">
      {/* Cabecera ejecutiva */}
      <div className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-ink">
            Control editorial
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-[-0.03em] text-ink sm:text-4xl">
            Resumen general
          </h1>
          <p className="mt-2 text-sm text-subtle">
            Estado del catálogo, comunidad e ingestas recientes en una sola consulta ligera.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/analiticas"
            prefetch={false}
            className={buttonStyles({ variant: "secondary", size: "sm", className: "rounded-lg" })}
          >
            Ver analíticas
          </Link>
          <Link
            href="/admin/subir"
            prefetch={false}
            className={buttonStyles({ variant: "primary", size: "sm", className: "rounded-lg" })}
            data-od-id="upload-chapter-link"
          >
            + Subir capítulo .zip
          </Link>
        </div>
      </div>

      {/* Tarjetas KPI */}
      <section className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 xl:grid-cols-5">
        {kpis.map((s) => (
          <div
            key={s.label}
            className="group relative overflow-hidden rounded-xl border border-line bg-panel p-4 transition-colors hover:border-line-strong sm:p-5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-subtle">
                {s.live && <span className="h-2 w-2 animate-pulse rounded-full bg-success" />}
                {s.label}
              </span>
              <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${s.accent}`}>
                {s.icon}
              </span>
            </div>
            <p className="mt-4 font-display text-3xl font-bold leading-none tabular-nums text-ink sm:text-4xl">
              {numero.format(s.value)}
            </p>
            <p className="mt-2 text-xs text-faint">{s.hint}</p>
          </div>
        ))}
      </section>

      {/* Accesos rápidos */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {shortcuts.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            className="group flex items-center justify-between gap-3 rounded-xl border border-line bg-[var(--surface-soft)] px-4 py-3.5 transition-colors hover:border-accent/60 hover:bg-panel"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-ink group-hover:text-accent-ink">
                {item.title}
              </p>
              <p className="mt-0.5 truncate text-xs text-subtle">{item.desc}</p>
            </div>
            <span className="text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-accent-ink" aria-hidden="true">
              →
            </span>
          </Link>
        ))}
      </section>

      {/* Cuerpo principal: Ingestas + Actividad lateral */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(290px,0.8fr)]">
        <section className="min-w-0 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-ink">Historial de ingestas</h2>
              <p className="text-xs text-subtle">
                Últimas 30 cargas .zip · sin consultas automáticas en reposo
              </p>
            </div>
          </div>
          <JobsTable initialJobs={initialJobs} />
        </section>

        <aside className="space-y-6">
          {/* Series recientes */}
          <div className="rounded-xl border border-line bg-panel p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-ink">Series actualizadas</h2>
              <Link
                href="/admin/series"
                prefetch={false}
                className="font-mono text-[11px] font-semibold text-accent-ink hover:underline"
              >
                Ver todas →
              </Link>
            </div>
            {recentSeries.length === 0 ? (
              <p className="text-xs text-subtle">Todavía no hay series locales cargadas.</p>
            ) : (
              <ul className="divide-y divide-line/70">
                {recentSeries.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <Link
                        href={`/serie/${s.slug}`}
                        prefetch={false}
                        className="block truncate text-sm font-semibold text-ink hover:text-accent-ink"
                      >
                        {s.title}
                      </Link>
                      <p className="mt-0.5 text-[11px] text-subtle">
                        {STATUS_LABEL[s.status] ?? s.status}
                        {s.type === "adult" ? " · +18" : ""}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-md border border-line bg-[var(--surface-soft)] px-2 py-0.5 font-mono text-[11px] tabular-nums text-subtle">
                      {s._count.chapters} cap.
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Últimas noticias */}
          <div className="rounded-xl border border-line bg-panel p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-ink">Últimas noticias</h2>
              <Link
                href="/admin/noticias"
                prefetch={false}
                className="font-mono text-[11px] font-semibold text-accent-ink hover:underline"
              >
                Gestionar →
              </Link>
            </div>
            {recentNews.length === 0 ? (
              <p className="text-xs text-subtle">Aún no publicaste anuncios.</p>
            ) : (
              <ul className="divide-y divide-line/70">
                {recentNews.map((n) => (
                  <li key={n.id} className="py-2.5 first:pt-0 last:pb-0">
                    <p className="truncate text-sm font-semibold text-ink">{n.title}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-faint">
                      {new Date(n.createdAt).toLocaleDateString("es-AR")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
