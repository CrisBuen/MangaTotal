"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthCard, buttonClass, inputClass } from "@/components/ui/AuthCard";
import { Field } from "@/components/ui/Field";

export default function LoginPage() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Apodo o contraseña incorrectos");
        return;
      }
      router.push(data.user.is_admin ? "/admin" : "/biblioteca");
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard title="Iniciá sesión para entrar a tu biblioteca">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field id="login-nickname" label="Apodo">
          <input
            id="login-nickname"
            className={inputClass}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            autoComplete="username"
            autoFocus
            required
          />
          </Field>
        <Field id="login-password" label="Contraseña">
          <input
            id="login-password"
            className={inputClass}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          </Field>
        {error && <p className="border-l-2 border-danger pl-3 text-sm text-danger" role="alert">{error}</p>}
        <button className={buttonClass} disabled={loading} data-od-id="login-submit">
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
      <Link
        href="/recuperar"
        className="mt-4 block text-center text-sm text-subtle underline underline-offset-4"
      >
        ¿Olvidaste tu contraseña?
      </Link>
      <p className="mt-5 text-center text-sm text-subtle">
        ¿No tenés cuenta?{" "}
        <Link href="/registro" className="font-bold text-ink underline underline-offset-4">
          Registrate
        </Link>
      </p>
    </AuthCard>
  );
}
