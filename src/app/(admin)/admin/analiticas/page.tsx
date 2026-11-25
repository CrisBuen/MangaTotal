import { AnalyticsDashboard } from "@/components/dashboard/AnalyticsDashboard";

export const dynamic = "force-dynamic";

export default function AdminAnalyticsPage() {
  return (
    <div className="space-y-6" data-od-id="admin-analytics">
      <div className="border-b border-line pb-6">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-ink">
          Actividad real
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-[-0.03em] text-ink sm:text-4xl">
          Analíticas
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-subtle">
          Usuarios activos, consumo por fuente y exportación para Power BI. Sin auto-polling
          constante para ahorrar cuota de Vercel; conteo anónimo sin IP, apodos ni títulos leídos.
        </p>
      </div>
      <AnalyticsDashboard />
    </div>
  );
}
