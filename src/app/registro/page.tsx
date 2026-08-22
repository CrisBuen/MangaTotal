"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthCard, buttonClass, inputClass } from "@/components/ui/AuthCard";

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
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">Apodo</label>
          <input
            className={inputClass}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            autoComplete="username"
            placeholder="sin espacios"
            autoFocus
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">
            Contraseña (mínimo 8 caracteres)
          </label>
          <input
            className={inputClass}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">
            Fecha de nacimiento
          </label>
          <input
            className={inputClass}
            type="date"
            value={birthdate}
            onChange={(e) => setBirthdate(e.target.value)}
            required
          />
          <p className="mt-1 text-[11px] text-zinc-500">
            Dato personal — solo se usa para precargar tus preferencias.
          </p>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button className={buttonClass} disabled={loading}>
          {loading ? "Creando cuenta..." : "Crear cuenta"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-zinc-400">
        ¿Ya tenés cuenta?{" "}
        <Link href="/login" className="text-violet-400 hover:underline">
          Iniciá sesión
        </Link>
      </p>
    </AuthCard>
  );
}
