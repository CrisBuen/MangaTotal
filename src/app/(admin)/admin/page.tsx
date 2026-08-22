import Link from "next/link";
import { db } from "@/lib/db";
import { JobsTable } from "@/components/dashboard/JobsTable";

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
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">Dashboard</h1>
        <Link
          href="/admin/subir"
          className="ml-auto rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-violet-500"
        >
          + Subir capítulo (.zip)
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-2xl font-bold text-violet-400">{s.value}</p>
            <p className="text-sm text-zinc-400">{s.label}</p>
          </div>
        ))}
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-zinc-200">Historial de ingestas</h2>
        <JobsTable />
      </section>
    </div>
  );
}
