"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthCard, buttonClass, inputClass } from "@/components/ui/AuthCard";
import { Field } from "@/components/ui/Field";

export default function RecuperarPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/recovery/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setMessage(data.message ?? data.error ?? "Revisá tu correo.");
    } catch {
      setMessage("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard title="Recuperá el acceso a tu cuenta">
      <form onSubmit={submit} className="space-y-4">
        <Field id="recovery-email" label="Correo verificado">
          <input
            id="recovery-email"
            className={inputClass}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
            autoFocus
          />
        </Field>
        {message && <p className="text-sm leading-6 text-subtle">{message}</p>}
        <button className={buttonClass} disabled={loading}>
          {loading ? "Enviando…" : "Enviar enlace"}
        </button>
      </form>
      <Link href="/login" className="mt-5 block text-center text-sm font-bold text-ink underline">
        Volver al inicio de sesión
      </Link>
    </AuthCard>
  );
}
