"use client";

import { useEffect, useRef, useState } from "react";
import { AjustesFuentes } from "@/components/fuentes/AjustesFuentes";
import { UpdateChecker } from "@/components/pwa/UpdateChecker";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Feedback";
import { fieldControlClass } from "@/components/ui/Field";
import { SectionHeading, Surface } from "@/components/ui/Surface";

interface Me {
  nickname: string;
  is_admin: boolean;
  show_adult_content: boolean;
  preferred_reading_mode: string;
  avatar_path: string | null;
  birthdate: string | null;
}

const inputClass = fieldControlClass;

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

  if (!me) return <p className="py-12 text-center text-subtle">Cargando…</p>;

  return (
    <div className="mx-auto max-w-4xl space-y-10" data-od-id="profile-page">
      <SectionHeading
        eyebrow="Cuenta"
        title="Perfil"
        description="Administrá tu identidad, preferencias de contenido y forma de lectura."
      />
      {/* cabecera con avatar estilo red social */}
      <section className="grid gap-6 border-b-2 border-line pb-8 sm:grid-cols-[auto_1fr] sm:items-center" data-od-id="profile-identity">
        <div className="relative">
          <div className="h-28 w-28 overflow-hidden rounded-2xl border border-accent bg-panel shadow-[var(--glow)]">
            {me.avatar_path ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/images/${me.avatar_path}`}
                alt={me.nickname}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-display text-5xl font-bold text-ink">
                {me.nickname.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={avatarBusy}
            title="Cambiar foto de perfil"
            className="absolute bottom-2 right-2 min-h-11 rounded-xl border border-line bg-panel px-3 text-[10px] font-bold uppercase tracking-[0.08em] text-ink transition hover:border-accent hover:bg-[var(--surface-raised)] disabled:opacity-50"
            data-od-id="avatar-upload-trigger"
          >
            Cambiar
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
        <div className="min-w-0">
          <h2 className="truncate text-5xl leading-none text-ink">{me.nickname}</h2>
          <p className="mt-2 text-sm text-subtle">
            {me.is_admin && "administrador · "}
            {me.birthdate && new Date(me.birthdate).toLocaleDateString("es-AR")}
          </p>
          {me.avatar_path && (
            <Button
              onClick={removeAvatar}
              disabled={avatarBusy}
              variant="ghost"
              size="sm"
              className="mt-2"
            >
              Quitar foto
            </Button>
          )}
        </div>
      </section>
      {avatarError && <p className="border-l-2 border-danger pl-3 text-sm text-danger" role="alert">{avatarError}</p>}

      {/* preferencias */}
      <Surface className="space-y-6 p-6" data-od-id="profile-preferences">
        <h2 className="text-3xl text-ink">Preferencias</h2>
        <div className="flex items-center justify-between gap-6 border-t-2 border-line pt-5">
          <div>
            <p className="text-sm font-bold text-ink">Mostrar contenido +18</p>
            <p className="mt-1 text-xs text-subtle">
              Filtro de biblioteca: activa la sección de doujinshi/+18.
            </p>
          </div>
          <button
            onClick={() => update({ show_adult_content: !me.show_adult_content })}
            className={`min-h-11 w-16 shrink-0 rounded-full border border-line p-1 transition ${
              me.show_adult_content ? "bg-accent shadow-[var(--glow)]" : "bg-panel"
            }`}
            aria-pressed={me.show_adult_content}
          >
            <span
              className={`block h-7 w-7 rounded-full border border-line bg-ink transition ${
                me.show_adult_content ? "translate-x-6" : ""
              }`}
            />
          </button>
        </div>

        <div className="flex flex-col justify-between gap-4 border-t-2 border-line pt-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-bold text-ink">Modo de lectura preferido</p>
            <p className="mt-1 text-xs text-subtle">Con el que se abre cada capítulo.</p>
          </div>
          <div className="flex rounded-xl border border-line bg-panel p-1">
            {(["cascade", "rtl"] as const).map((m) => (
              <button
                key={m}
                onClick={() => update({ preferred_reading_mode: m })}
                className={`min-h-11 px-3 text-xs font-bold uppercase tracking-[0.08em] transition ${
                  me.preferred_reading_mode === m
                    ? "rounded-lg bg-[var(--accent-soft)] text-accent shadow-[var(--glow)]"
                    : "rounded-lg text-subtle hover:bg-[var(--surface-raised)] hover:text-ink"
                }`}
              >
                {m === "cascade" ? "Cascada" : "RTL"}
              </button>
            ))}
          </div>
        </div>

        {saved && <Badge tone="success">Guardado</Badge>}
      </Surface>

      <AjustesFuentes />

      {/* cambio de contraseña */}
      <form
        onSubmit={changePassword}
        className="space-y-5 rounded-2xl border border-line bg-panel p-6"
        data-od-id="password-form"
      >
        <h2 className="text-3xl text-ink">Cambiar contraseña</h2>
        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-ink">Contraseña actual</label>
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
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-ink">
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
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-ink">Repetir nueva</label>
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
        {pwError && <p className="border-l-2 border-danger pl-3 text-sm text-danger" role="alert">{pwError}</p>}
        {pwOk && <p className="text-sm text-success">Contraseña actualizada</p>}
        <Button
          disabled={pwBusy}
          variant="primary"
          data-od-id="password-submit"
        >
          {pwBusy ? "Guardando..." : "Cambiar contraseña"}
        </Button>
      </form>

      <UpdateChecker />
    </div>
  );
}
