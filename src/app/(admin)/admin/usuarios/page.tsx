"use client";

import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/Feedback";
import { SectionHeading } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { UserSettingsDialog, type AdminUser } from "@/components/admin/UserSettingsDialog";

export default function AdminUsuariosPage() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [me, setMe] = useState<{ id: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminUser | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo cargar la lista de usuarios.");
      setUsers(data);
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo cargar la lista de usuarios.");
    }
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(setMe)
      .catch(() => {});
    load();
  }, [load]);

  return (
    <div className="space-y-10" data-od-id="admin-users-page">
      <SectionHeading eyebrow="Acceso" title="Usuarios" description="Cuentas de confianza de tu red local. Las cuentas nuevas se crean desde /registro." />

      {error && <div className="space-y-3"><p className="border-l-2 border-danger pl-3 text-sm text-danger" role="alert">{error}</p><Button onClick={load}>Reintentar</Button></div>}

      {users === null ? (
        !error && <p className="py-6 text-center text-sm text-subtle">Cargando…</p>
      ) : users.length === 0 ? (
        <EmptyState title="No hay usuarios" description="Las cuentas registradas aparecerán en esta tabla." />
      ) : (
        <div className="overflow-x-auto rounded-[10px] border border-line bg-panel">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-line bg-[var(--surface-raised)] text-[11px] tracking-[0.1em] text-subtle">
              <tr>
                <th className="px-4 py-2.5">Apodo</th>
                <th className="px-4 py-2.5">Rol</th>
                <th className="px-4 py-2.5">Correo</th>
                <th className="px-4 py-2.5">+18</th>
                <th className="px-4 py-2.5">Creado</th>
                <th className="px-4 py-2.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-line">
              {users.map((u) => (
                <tr key={u.id} className="bg-panel hover:bg-[var(--surface-raised)]">
                  <td className="px-4 py-2.5 font-medium">
                    {u.nickname}
                    {me?.id === u.id && <span className="ml-1 text-[13px] text-subtle">(vos)</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    {u.is_admin ? (
                      <span className="rounded-full border border-accent bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-semibold text-accent-ink">
                        Admin
                      </span>
                    ) : (
                      <span className="text-subtle">Lector</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-subtle">
                    {u.email ? (
                      <span>
                        {u.email}
                        <span className="ml-2 text-[11px]">
                          {u.email_verified ? "verificado" : "pendiente"}
                        </span>
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-subtle">
                    {u.show_adult_content ? "Sí" : "No"}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-subtle">
                    {new Date(u.created_at).toLocaleDateString("es-AR")}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {me && me.id !== u.id && (
                      <Button onClick={() => setSelected(u)} aria-haspopup="dialog" aria-label={`Ajustes de ${u.nickname}`}>
                        Ajustes
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {selected && <UserSettingsDialog key={selected.id} user={selected} onClose={() => setSelected(null)}
        onUpdated={(updated) => {
          setUsers((actuales) => actuales?.map((u) => u.id === updated.id ? updated : u) ?? null);
          setSelected(updated);
        }}
        onDeleted={(id) => {
          setUsers((actuales) => actuales?.filter((u) => u.id !== id) ?? null);
          setSelected(null);
        }} />}
    </div>
  );
}
