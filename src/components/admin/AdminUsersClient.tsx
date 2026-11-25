"use client";

import { useCallback, useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/Feedback";
import { Button } from "@/components/ui/Button";
import { UserSettingsDialog, type AdminUser } from "@/components/admin/UserSettingsDialog";

type UserFilter = "all" | "admin" | "reader" | "verified" | "unverified";

export function AdminUsersClient({
  initialUsers,
  currentUserId,
}: {
  initialUsers: AdminUser[];
  currentUserId: number;
}) {
  const [users, setUsers] = useState<AdminUser[]>(initialUsers);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [filter, setFilter] = useState<UserFilter>("all");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setError(null);
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo cargar la lista de usuarios.");
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la lista de usuarios.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  const stats = useMemo(() => {
    return {
      total: users.length,
      admins: users.filter((u) => u.is_admin).length,
      verified: users.filter((u) => u.email_verified).length,
      adult: users.filter((u) => u.show_adult_content).length,
    };
  }, [users]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (filter === "admin" && !u.is_admin) return false;
      if (filter === "reader" && u.is_admin) return false;
      if (filter === "verified" && !u.email_verified) return false;
      if (filter === "unverified" && u.email_verified) return false;
      if (!q) return true;
      return (
        u.nickname.toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q)
      );
    });
  }, [filter, query, users]);

  return (
    <div className="space-y-6" data-od-id="admin-users-page">
      <div className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-ink">
            Acceso y permisos
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-[-0.03em] text-ink sm:text-4xl">
            Usuarios
          </h1>
          <p className="mt-2 text-sm text-subtle">
            Administrá roles, recuperación de contraseñas y cuentas registradas desde /registro.
          </p>
        </div>

        <Button
          size="sm"
          variant="secondary"
          className="self-start rounded-lg sm:self-auto"
          onClick={() => void load()}
          disabled={refreshing}
        >
          {refreshing ? "Actualizando…" : "↻ Actualizar lista"}
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total cuentas", value: stats.total },
          { label: "Administradores", value: stats.admins },
          { label: "Correos verificados", value: stats.verified },
          { label: "Acceso +18 activo", value: stats.adult },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-line bg-panel px-4 py-3.5">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-faint">
              {item.label}
            </p>
            <p className="mt-1.5 font-display text-2xl font-bold tabular-nums text-ink">
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/50 bg-danger/10 p-4 text-sm text-danger" role="alert">
          <span>{error}</span>
          <Button size="sm" onClick={() => void load()}>
            Reintentar
          </Button>
        </div>
      )}

      {/* Tabla con búsqueda y filtros client-side */}
      <section className="overflow-hidden rounded-xl border border-line bg-panel">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: "all", label: "Todos" },
                { id: "admin", label: "Admins" },
                { id: "reader", label: "Lectores" },
                { id: "verified", label: "Verificados" },
                { id: "unverified", label: "Sin verificar" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  filter === tab.id
                    ? "border-accent/60 bg-[var(--accent-soft)] text-accent-ink"
                    : "border-line bg-[var(--surface-soft)] text-subtle hover:border-line-strong hover:text-ink"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar apodo o correo…"
            aria-label="Buscar usuarios"
            className="min-h-9 w-full rounded-lg border border-line bg-[var(--surface-soft)] px-3 text-xs text-ink placeholder:text-faint focus:border-accent focus:outline-none sm:w-64"
          />
        </div>

        {users.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No hay usuarios"
              description="Las cuentas registradas aparecerán en esta tabla."
            />
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-subtle">
            Ninguna cuenta coincide con los filtros actuales.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[660px] text-left text-sm">
              <thead className="border-b border-line bg-[var(--surface-soft)] font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
                <tr>
                  <th className="px-4 py-3 font-semibold">Usuario</th>
                  <th className="px-4 py-3 font-semibold">Rol</th>
                  <th className="px-4 py-3 font-semibold">Correo</th>
                  <th className="px-4 py-3 font-semibold">+18</th>
                  <th className="px-4 py-3 font-semibold">Alta</th>
                  <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/80">
                {filtered.map((u) => {
                  const isMe = currentUserId === u.id;
                  const initial = (u.nickname.trim()[0] ?? "?").toUpperCase();
                  return (
                    <tr key={u.id} className="transition-colors hover:bg-[var(--surface-raised)]/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-display text-xs font-bold ${
                              u.is_admin
                                ? "border-accent/50 bg-[var(--accent-soft)] text-accent-ink"
                                : "border-line bg-[var(--surface-soft)] text-subtle"
                            }`}
                            aria-hidden="true"
                          >
                            {initial}
                          </span>
                          <span className="font-semibold text-ink">{u.nickname}</span>
                          {isMe && (
                            <span className="rounded-md border border-line bg-[var(--surface-soft)] px-1.5 py-0.5 font-mono text-[10px] text-subtle">
                              vos
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {u.is_admin ? (
                          <span className="inline-flex rounded-full border border-accent/50 bg-[var(--accent-soft)] px-2.5 py-0.5 text-[11px] font-semibold text-accent-ink">
                            Admin
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full border border-line bg-[var(--surface-soft)] px-2.5 py-0.5 text-[11px] text-subtle">
                            Lector
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-subtle">
                        {u.email ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-ink">{u.email}</span>
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                u.email_verified
                                  ? "border-success/40 bg-success/10 text-success"
                                  : "border-warning/40 bg-warning/10 text-warning"
                              }`}
                            >
                              {u.email_verified ? "verificado" : "pendiente"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-faint">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {u.show_adult_content ? (
                          <span className="rounded-full border border-danger/40 bg-danger/10 px-2 py-0.5 text-[11px] font-semibold text-danger">
                            Sí
                          </span>
                        ) : (
                          <span className="text-xs text-faint">No</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-subtle">
                        {new Date(u.created_at).toLocaleDateString("es-AR")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!isMe && (
                          <button
                            type="button"
                            onClick={() => setSelected(u)}
                            aria-haspopup="dialog"
                            aria-label={`Ajustes de ${u.nickname}`}
                            className="rounded-lg border border-line bg-[var(--surface-soft)] px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-accent hover:text-accent-ink"
                          >
                            Ajustes
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected && (
        <UserSettingsDialog
          key={selected.id}
          user={selected}
          onClose={() => setSelected(null)}
          onUpdated={(updated) => {
            setUsers((actuales) =>
              actuales.map((u) => (u.id === updated.id ? updated : u))
            );
            setSelected(updated);
          }}
          onDeleted={(id) => {
            setUsers((actuales) => actuales.filter((u) => u.id !== id));
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}
