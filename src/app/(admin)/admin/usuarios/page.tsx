"use client";

import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/Feedback";
import { SectionHeading } from "@/components/ui/Surface";

interface AdminUser {
  id: number;
  nickname: string;
  is_admin: boolean;
  show_adult_content: boolean;
  created_at: string;
}

export default function AdminUsuariosPage() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [me, setMe] = useState<{ id: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    if (res.ok) setUsers(await res.json());
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(setMe)
      .catch(() => {});
    load();
  }, [load]);

  async function toggleAdmin(u: AdminUser) {
    setError(null);
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_admin: !u.is_admin }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo actualizar");
      return;
    }
    await load();
  }

  async function remove(u: AdminUser) {
    setError(null);
    const ok = window.confirm(
      `¿Borrar la cuenta "${u.nickname}"? Se pierde su progreso de lectura y favoritos.`
    );
    if (!ok) return;
    const res = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
    if (!res.ok && res.status !== 204) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo borrar");
      return;
    }
    await load();
  }

  return (
    <div className="space-y-10" data-od-id="admin-users-page">
      <SectionHeading eyebrow="Acceso" title="Usuarios" description="Cuentas de confianza de tu red local. Las cuentas nuevas se crean desde /registro." />

      {error && <p className="border-l-2 border-danger pl-3 text-sm text-danger" role="alert">{error}</p>}

      {users === null ? (
        <p className="py-6 text-center text-sm text-subtle">Cargando…</p>
      ) : users.length === 0 ? (
        <EmptyState title="No hay usuarios" description="Las cuentas registradas aparecerán en esta tabla." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-panel">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-line bg-[var(--surface-raised)] text-[10px] uppercase tracking-[0.1em] text-subtle">
              <tr>
                <th className="px-4 py-2.5">Apodo</th>
                <th className="px-4 py-2.5">Rol</th>
                <th className="px-4 py-2.5">+18</th>
                <th className="px-4 py-2.5">Creado</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-line">
              {users.map((u) => (
                <tr key={u.id} className="bg-panel hover:bg-[var(--surface-raised)]">
                  <td className="px-4 py-2.5 font-medium">
                    {u.nickname}
                    {me?.id === u.id && <span className="ml-1 text-xs text-subtle">(vos)</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    {u.is_admin ? (
                      <span className="rounded-full border border-accent bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-semibold text-accent">
                        Admin
                      </span>
                    ) : (
                      <span className="text-subtle">Lector</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-subtle">
                    {u.show_adult_content ? "Sí" : "No"}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[10px] text-subtle">
                    {new Date(u.created_at).toLocaleDateString("es-AR")}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {me?.id !== u.id && (
                      <>
                        <button
                          onClick={() => toggleAdmin(u)}
                          className="mr-3 min-h-11 text-xs font-bold uppercase text-ink underline underline-offset-4"
                        >
                          {u.is_admin ? "Quitar admin" : "Hacer admin"}
                        </button>
                        <button
                          onClick={() => remove(u)}
                          className="min-h-11 text-xs font-bold uppercase text-danger underline underline-offset-4"
                        >
                          Borrar
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
