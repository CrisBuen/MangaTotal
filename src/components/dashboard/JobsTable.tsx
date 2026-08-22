"use client";

import { useCallback, useEffect, useState } from "react";

interface Job {
  id: number;
  original_filename: string;
  status: string;
  error_message: string | null;
  series: { title: string; slug: string } | null;
  chapter_number: number | null;
  started_at: string;
  finished_at: string | null;
}

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-zinc-600/30 text-zinc-300",
  processing: "bg-blue-600/20 text-blue-300",
  success: "bg-green-600/20 text-green-400",
  error: "bg-red-600/20 text-red-400",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  processing: "Procesando",
  success: "Éxito",
  error: "Error",
};

export function JobsTable() {
  const [jobs, setJobs] = useState<Job[] | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/upload?limit=50");
    if (res.ok) setJobs(await res.json());
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  if (jobs === null) return <p className="py-6 text-center text-sm text-zinc-500">Cargando...</p>;
  if (jobs.length === 0)
    return (
      <p className="rounded-xl border border-dashed border-zinc-800 py-8 text-center text-sm text-zinc-500">
        Todavía no subiste ningún .zip.
      </p>
    );

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-zinc-900 text-xs uppercase text-zinc-500">
          <tr>
            <th className="px-4 py-2.5">Archivo</th>
            <th className="px-4 py-2.5">Serie</th>
            <th className="px-4 py-2.5">Cap.</th>
            <th className="px-4 py-2.5">Estado</th>
            <th className="px-4 py-2.5">Detalle</th>
            <th className="px-4 py-2.5">Fecha</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {jobs.map((j) => (
            <tr key={j.id} className="bg-zinc-950/50">
              <td className="max-w-[220px] truncate px-4 py-2.5 font-mono text-xs">
                {j.original_filename}
              </td>
              <td className="max-w-[220px] truncate px-4 py-2.5">{j.series?.title ?? "—"}</td>
              <td className="px-4 py-2.5">{j.chapter_number ?? "—"}</td>
              <td className="px-4 py-2.5">
                <span
                  className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                    STATUS_STYLE[j.status] ?? ""
                  }`}
                >
                  {STATUS_LABEL[j.status] ?? j.status}
                </span>
              </td>
              <td className="max-w-[260px] truncate px-4 py-2.5 text-xs text-red-400">
                {j.error_message ?? ""}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-xs text-zinc-500">
                {new Date(j.started_at).toLocaleString("es-AR")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
