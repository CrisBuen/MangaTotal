"use client";

import { useCallback, useEffect, useState } from "react";

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
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Usuarios</h1>
        <p className="text-sm text-zinc-500">
          Cuentas de confianza de tu red local. Para crear una nueva, esa persona entra a{" "}
          <span className="text-violet-300">/registro</span> desde tu red.
        </p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {users === null ? (
        <p className="py-6 text-center text-sm text-zinc-500">Cargando...</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-zinc-900 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-2.5">Apodo</th>
                <th className="px-4 py-2.5">Rol</th>
                <th className="px-4 py-2.5">+18</th>
                <th className="px-4 py-2.5">Creado</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {users.map((u) => (
                <tr key={u.id} className="bg-zinc-950/50">
                  <td className="px-4 py-2.5 font-medium">
                    {u.nickname}
                    {me?.id === u.id && <span className="ml-1 text-xs text-zinc-500">(vos)</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    {u.is_admin ? (
                      <span className="rounded bg-violet-600/20 px-1.5 py-0.5 text-[11px] font-semibold text-violet-300">
                        Admin
                      </span>
                    ) : (
                      <span className="text-zinc-400">Lector</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-zinc-400">
                    {u.show_adult_content ? "Sí" : "No"}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-zinc-500">
                    {new Date(u.created_at).toLocaleDateString("es-AR")}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {me?.id !== u.id && (
                      <>
                        <button
                          onClick={() => toggleAdmin(u)}
                          className="mr-2 text-xs text-violet-400 hover:underline"
                        >
                          {u.is_admin ? "Quitar admin" : "Hacer admin"}
                        </button>
                        <button
                          onClick={() => remove(u)}
                          className="text-xs text-red-400 hover:underline"
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
