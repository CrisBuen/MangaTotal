import { AnalyticsDashboard } from "@/components/dashboard/AnalyticsDashboard";
import { SectionHeading } from "@/components/ui/Surface";

export const dynamic = "force-dynamic";

export default function AdminAnalyticsPage() {
  return (
    <div className="space-y-8" data-od-id="admin-analytics">
      <SectionHeading
        eyebrow="Actividad real"
        title="Analíticas"
        description="Usuarios activos, consumo por fuente e historial exportable. Los datos se actualizan sin guardar cuentas, apodos ni direcciones IP."
      />
      <AnalyticsDashboard />
    </div>
  );
}
