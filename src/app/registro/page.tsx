"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthCard, buttonClass, inputClass } from "@/components/ui/AuthCard";
import { Field } from "@/components/ui/Field";

export default function RegistroPage() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (nickname.trim().length < 2 || /\s/.test(nickname)) {
      setError("El apodo no puede tener espacios y necesita al menos 2 caracteres");
      return;
    }
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname.trim(), password, birthdate }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo crear la cuenta");
        return;
      }
      router.push("/biblioteca");
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard title="Creá tu cuenta (la primera cuenta será administradora)">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field id="register-nickname" label="Apodo" hint="Sin espacios; mínimo 2 caracteres.">
          <input
            id="register-nickname"
            className={inputClass}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            autoComplete="username"
            placeholder="sin espacios"
            autoFocus
            required
          />
        </Field>
        <Field id="register-password" label="Contraseña" hint="Mínimo 8 caracteres.">
          <input
            id="register-password"
            className={inputClass}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </Field>
        <Field id="register-birthdate" label="Fecha de nacimiento" hint="Solo se usa para precargar tus preferencias.">
          <input
            id="register-birthdate"
            className={inputClass}
            type="date"
            value={birthdate}
            onChange={(e) => setBirthdate(e.target.value)}
            required
          />
        </Field>
        {error && <p className="border-l-2 border-danger pl-3 text-sm text-danger" role="alert">{error}</p>}
        <button className={buttonClass} disabled={loading} data-od-id="register-submit">
          {loading ? "Creando cuenta..." : "Crear cuenta"}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-subtle">
        ¿Ya tenés cuenta?{" "}
        <Link href="/login" className="font-bold text-ink underline underline-offset-4">
          Iniciá sesión
        </Link>
      </p>
    </AuthCard>
  );
}
