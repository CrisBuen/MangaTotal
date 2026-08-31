"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { UpdateChecker } from "@/components/pwa/UpdateChecker";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Feedback";
import { fieldControlClass } from "@/components/ui/Field";
import { SectionHeading, Surface } from "@/components/ui/Surface";
import { Chip } from "@/components/ui/Chip";

interface Me {
  nickname: string;
  is_admin: boolean;
  show_adult_content: boolean;
  preferred_reading_mode: string;
  avatar_path: string | null;
  birthdate: string | null;
  email: string | null;
  email_verified: boolean;
}

const inputClass = fieldControlClass;

export default function PerfilPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [saved, setSaved] = useState(false);
  const [accountEmail, setAccountEmail] = useState("");
  const [accountBirthdate, setAccountBirthdate] = useState("");
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountMessage, setAccountMessage] = useState<string | null>(null);
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
      .then((data) => {
        setMe(data);
        setAccountEmail(data.email ?? "");
        setAccountBirthdate(data.birthdate ? String(data.birthdate).slice(0, 10) : "");
      })
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

  async function saveAccount(event: React.FormEvent) {
    event.preventDefault();
    setAccountBusy(true);
    setAccountMessage(null);
    const res = await fetch("/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: accountEmail, birthdate: accountBirthdate }),
    });
    const data = await res.json().catch(() => ({}));
    setAccountBusy(false);
    if (!res.ok) {
      setAccountMessage(data.error ?? "No se pudo guardar");
      return;
    }
    setMe((current) => current ? { ...current, ...data.user } : current);
    setAccountMessage(
      data.user.email
        ? data.email_verification_sent
          ? "Guardado. Enviamos un enlace de verificación a tu correo."
          : data.user.email_verified
            ? "Datos guardados."
            : "Guardado. Falta configurar o reenviar la verificación del correo."
        : "Datos guardados.",
    );
  }

  async function resendVerification() {
    setAccountBusy(true);
    setAccountMessage(null);
    const res = await fetch("/api/auth/email/send-verification", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setAccountBusy(false);
    setAccountMessage(
      res.ok ? "Enviamos un nuevo enlace de verificación." : data.error ?? "No se pudo enviar.",
    );
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
      <section className="grid gap-6 border-b border-line pb-8 sm:grid-cols-[auto_1fr] sm:items-center" data-od-id="profile-identity">
        <div className="relative">
          <div className="h-28 w-28 overflow-hidden rounded-full border border-line-strong bg-panel">
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
            className="absolute bottom-2 right-2 min-h-11 rounded-md border border-line bg-panel px-3 text-[11px] font-bold tracking-[0.08em] text-ink transition hover:border-line-strong hover:bg-[var(--surface-raised)] disabled:opacity-50"
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
          <h2 className="truncate font-display text-[clamp(2rem,5vw,3rem)] font-bold leading-none tracking-[-0.04em] text-ink">{me.nickname}</h2>
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
        <div className="flex flex-col justify-between gap-4 border-t border-line pt-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-bold text-ink">Modo de lectura preferido</p>
            <p className="mt-1 text-[13px] text-subtle">Con el que se abre cada capítulo.</p>
          </div>
          <div className="flex gap-2">
            {(["cascade", "rtl"] as const).map((m) => (
              <Chip
                key={m}
                onClick={() => update({ preferred_reading_mode: m })}
                selected={me.preferred_reading_mode === m}
              >
                {m === "cascade" ? "Cascada" : "RTL"}
              </Chip>
            ))}
          </div>
        </div>

        {saved && <Badge tone="success">Guardado</Badge>}

        <p className="border-t border-line pt-5 text-[13px] leading-5 text-subtle">
          El contenido +18 y las opciones avanzadas se mudaron a{" "}
          <Link href="/ajustes" className="text-accent-ink hover:underline">
            Ajustes
          </Link>
          .
        </p>
      </Surface>

      <form
        onSubmit={saveAccount}
        className="space-y-5 rounded-[10px] border border-line bg-panel p-6"
        data-od-id="account-recovery-form"
      >
        <div>
          <h2 className="text-3xl text-ink">Datos de recuperación</h2>
          <p className="mt-2 text-[13px] leading-5 text-subtle">
            El correo es opcional, pero debe verificarse para recuperar una contraseña perdida.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-[13px] font-bold tracking-[0.08em] text-ink">
              Correo electrónico
            </label>
            <input
              className={inputClass}
              type="email"
              value={accountEmail}
              onChange={(event) => setAccountEmail(event.target.value)}
              autoComplete="email"
              placeholder="Opcional"
            />
            {me.email && (
              <p className={`mt-2 text-[13px] ${me.email_verified ? "text-success" : "text-subtle"}`}>
                {me.email_verified ? "Correo verificado" : "Correo pendiente de verificación"}
              </p>
            )}
          </div>
          <div>
            <label className="mb-2 block text-[13px] font-bold tracking-[0.08em] text-ink">
              Fecha de nacimiento
            </label>
            <input
              className={inputClass}
              type="date"
              value={accountBirthdate}
              onChange={(event) => setAccountBirthdate(event.target.value)}
              required
            />
          </div>
        </div>
        {accountMessage && <p className="text-sm leading-6 text-subtle">{accountMessage}</p>}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" variant="primary" disabled={accountBusy}>
            {accountBusy ? "Guardando…" : "Guardar datos"}
          </Button>
          {me.email && !me.email_verified && (
            <Button onClick={resendVerification} disabled={accountBusy}>
              Reenviar verificación
            </Button>
          )}
        </div>
      </form>

      {/* cambio de contraseña */}
      <form
        onSubmit={changePassword}
        className="space-y-5 rounded-[10px] border border-line bg-panel p-6"
        data-od-id="password-form"
      >
        <h2 className="text-3xl text-ink">Cambiar contraseña</h2>
        <div>
          <label className="mb-2 block text-[13px] font-bold tracking-[0.08em] text-ink">Contraseña actual</label>
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
            <label className="mb-2 block text-[13px] font-bold tracking-[0.08em] text-ink">
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
            <label className="mb-2 block text-[13px] font-bold tracking-[0.08em] text-ink">Repetir nueva</label>
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
