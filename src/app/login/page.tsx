"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthCard, buttonClass, inputClass } from "@/components/ui/AuthCard";

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
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">Apodo</label>
          <input
            className={inputClass}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            autoComplete="username"
            autoFocus
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">Contraseña</label>
          <input
            className={inputClass}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button className={buttonClass} disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-zinc-400">
        ¿No tenés cuenta?{" "}
        <Link href="/registro" className="text-violet-400 hover:underline">
          Registrate
        </Link>
      </p>
    </AuthCard>
  );
}
