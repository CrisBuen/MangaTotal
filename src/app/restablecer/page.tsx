"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthCard, buttonClass, inputClass } from "@/components/ui/AuthCard";
import { Field } from "@/components/ui/Field";

export default function RestablecerPage() {
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== repeat) return setMessage("Las contraseñas no coinciden.");
    const token = new URLSearchParams(window.location.search).get("token") ?? "";
    setLoading(true);
    const res = await fetch("/api/auth/recovery/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    setOk(res.ok);
    setMessage(res.ok ? "Contraseña actualizada. Ya podés iniciar sesión." : data.error);
  }

  return (
    <AuthCard title="Creá una contraseña nueva">
      {ok ? (
        <>
          <p className="text-sm text-success">{message}</p>
          <Link href="/login" className="mt-6 block text-center text-sm font-bold text-ink underline">
            Iniciar sesión
          </Link>
        </>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field id="reset-password" label="Contraseña nueva" hint="Mínimo 8 caracteres.">
            <input id="reset-password" className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
          </Field>
          <Field id="reset-repeat" label="Repetir contraseña">
            <input id="reset-repeat" className={inputClass} type="password" value={repeat} onChange={(e) => setRepeat(e.target.value)} minLength={8} required />
          </Field>
          {message && <p className="text-sm text-danger">{message}</p>}
          <button className={buttonClass} disabled={loading}>
            {loading ? "Guardando…" : "Cambiar contraseña"}
          </button>
        </form>
      )}
    </AuthCard>
  );
}
