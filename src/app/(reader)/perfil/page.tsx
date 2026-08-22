"use client";

import { useEffect, useRef, useState } from "react";

interface Me {
  nickname: string;
  is_admin: boolean;
  show_adult_content: boolean;
  preferred_reading_mode: string;
  avatar_path: string | null;
  birthdate: string | null;
}

const inputClass =
  "w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-violet-500";

export default function PerfilPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwRepeat, setPwRepeat] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwOk, setPwOk] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(setMe)
      .catch(() => {});
  }, []);

  function flashSaved() {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function update(patch: Partial<Pick<Me, "show_adult_content" | "preferred_reading_mode">>) {
    const res = await fetch("/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const data = await res.json();
      setMe((m) =>
        m
          ? {
              ...m,
              show_adult_content: data.user.show_adult_content,
              preferred_reading_mode: data.user.preferred_reading_mode,
            }
          : m
      );
      flashSaved();
    }
  }

  async function uploadAvatar(file: File) {
    setAvatarError(null);
    setAvatarBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch("/api/auth/avatar", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setAvatarError(data.error ?? "No se pudo subir la imagen");
        return;
      }
      setMe((m) => (m ? { ...m, avatar_path: data.avatar_path } : m));
      flashSaved();
    } catch {
      setAvatarError("No se pudo conectar con el servidor");
    } finally {
      setAvatarBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeAvatar() {
    setAvatarBusy(true);
    try {
      await fetch("/api/auth/avatar", { method: "DELETE" });
      setMe((m) => (m ? { ...m, avatar_path: null } : m));
      flashSaved();
    } finally {
      setAvatarBusy(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwOk(false);
    if (pwNew.length < 8) return setPwError("La contraseña nueva necesita al menos 8 caracteres");
    if (pwNew !== pwRepeat) return setPwError("Las contraseñas nuevas no coinciden");

    setPwBusy(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: pwCurrent, new_password: pwNew }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPwError(data.error ?? "No se pudo cambiar la contraseña");
        return;
      }
      setPwOk(true);
      setPwCurrent("");
      setPwNew("");
      setPwRepeat("");
    } catch {
      setPwError("No se pudo conectar con el servidor");
    } finally {
      setPwBusy(false);
    }
  }

  if (!me) return <p className="py-12 text-center text-zinc-500">Cargando...</p>;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      {/* cabecera con avatar estilo red social */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="h-20 w-20 overflow-hidden rounded-full border-2 border-violet-600 bg-zinc-800">
            {me.avatar_path ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/images/${me.avatar_path}`}
                alt={me.nickname}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-violet-400">
                {me.nickname.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={avatarBusy}
            title="Cambiar foto de perfil"
            className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-violet-600 text-sm text-white shadow transition hover:bg-violet-500 disabled:opacity-50"
          >
            ✎
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadAvatar(f);
            }}
          />
        </div>
        <div>
          <h1 className="text-xl font-bold">{me.nickname}</h1>
          <p className="text-sm text-zinc-500">
            {me.is_admin && "administrador · "}
            {me.birthdate && new Date(me.birthdate).toLocaleDateString("es-AR")}
          </p>
          {me.avatar_path && (
            <button
              onClick={removeAvatar}
              disabled={avatarBusy}
              className="mt-1 text-xs text-zinc-500 hover:text-red-400"
            >
              Quitar foto
            </button>
          )}
        </div>
      </div>
      {avatarError && <p className="text-sm text-red-400">{avatarError}</p>}

      {/* preferencias */}
      <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="text-sm font-semibold text-zinc-300">Preferencias</h2>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Mostrar contenido +18</p>
            <p className="text-xs text-zinc-500">
              Filtro de biblioteca: activa la sección de doujinshi/+18.
            </p>
          </div>
          <button
            onClick={() => update({ show_adult_content: !me.show_adult_content })}
            className={`h-6 w-11 shrink-0 rounded-full p-0.5 transition ${
              me.show_adult_content ? "bg-violet-600" : "bg-zinc-700"
            }`}
            aria-pressed={me.show_adult_content}
          >
            <span
              className={`block h-5 w-5 rounded-full bg-white transition ${
                me.show_adult_content ? "translate-x-5" : ""
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Modo de lectura preferido</p>
            <p className="text-xs text-zinc-500">Con el que se abre cada capítulo.</p>
          </div>
          <div className="flex rounded-lg bg-zinc-800 p-0.5">
            {(["cascade", "rtl"] as const).map((m) => (
              <button
                key={m}
                onClick={() => update({ preferred_reading_mode: m })}
                className={`rounded-md px-3 py-1 text-xs transition ${
                  me.preferred_reading_mode === m
                    ? "bg-violet-600 text-white"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {m === "cascade" ? "Cascada" : "RTL"}
              </button>
            ))}
          </div>
        </div>

        {saved && <p className="text-xs text-green-400">Guardado ✓</p>}
      </div>

      {/* cambio de contraseña */}
      <form
        onSubmit={changePassword}
        className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900 p-5"
      >
        <h2 className="text-sm font-semibold text-zinc-300">Cambiar contraseña</h2>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">Contraseña actual</label>
          <input
            className={inputClass}
            type="password"
            value={pwCurrent}
            onChange={(e) => setPwCurrent(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">
              Contraseña nueva
            </label>
            <input
              className={inputClass}
              type="password"
              value={pwNew}
              onChange={(e) => setPwNew(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">Repetir nueva</label>
            <input
              className={inputClass}
              type="password"
              value={pwRepeat}
              onChange={(e) => setPwRepeat(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
        </div>
        {pwError && <p className="text-sm text-red-400">{pwError}</p>}
        {pwOk && <p className="text-sm text-green-400">Contraseña actualizada ✓</p>}
        <button
          disabled={pwBusy}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
        >
          {pwBusy ? "Guardando..." : "Cambiar contraseña"}
        </button>
      </form>
    </div>
  );
}
