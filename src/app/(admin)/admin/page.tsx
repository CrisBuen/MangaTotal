import Link from "next/link";
import { db } from "@/lib/db";
import { JobsTable } from "@/components/dashboard/JobsTable";
import { buttonStyles } from "@/components/ui/Button";
import { SectionHeading, Surface } from "@/components/ui/Surface";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const [seriesCount, chapterCount, pageCount, userCount] = await Promise.all([
    db.series.count(),
    db.chapter.count(),
    db.page.count(),
    db.user.count(),
  ]);

  const stats = [
    { label: "Series", value: seriesCount },
    { label: "Capítulos", value: chapterCount },
    { label: "Páginas", value: pageCount },
    { label: "Usuarios", value: userCount },
  ];

  return (
    <div className="space-y-10" data-od-id="admin-dashboard">
      <SectionHeading
        eyebrow="Control editorial"
        title="Resumen"
        description="Estado del catálogo, usuarios e ingestas recientes."
        action={
        <Link
          href="/admin/subir"
          className={buttonStyles({ variant: "primary" })}
          data-od-id="upload-chapter-link"
        >
          Subir capítulo .zip
        </Link>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <Surface key={s.label} className="p-5">
            <p className="font-display text-5xl leading-none text-ink">{s.value}</p>
            <p className="mt-2 font-mono text-[11px] font-bold tracking-[0.08em] text-subtle">{s.label}</p>
          </Surface>
        ))}
      </div>

      <section>
        <h2 className="mb-5 text-3xl text-ink">Historial de ingestas</h2>
        <JobsTable />
      </section>
    </div>
  );
}
