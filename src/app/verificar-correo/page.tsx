"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthCard } from "@/components/ui/AuthCard";

export default function VerificarCorreoPage() {
  const [estado, setEstado] = useState<"loading" | "ok" | "error">("loading");
  const [mensaje, setMensaje] = useState("Verificando tu correo…");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token") ?? "";
    fetch("/api/auth/email/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "No se pudo verificar el correo");
        setEstado("ok");
        setMensaje(
          "Tu correo quedó verificado. Volvé a MangaTotal: la aplicación actualizará la confirmación automáticamente.",
        );
      })
      .catch((error) => {
        setEstado("error");
        setMensaje(error instanceof Error ? error.message : "No se pudo verificar el correo");
      });
  }, []);

  return (
    <AuthCard title="Verificación de correo">
      <p
        className={`text-sm leading-6 ${estado === "error" ? "text-danger" : "text-subtle"}`}
        role="status"
      >
        {mensaje}
      </p>
      {estado !== "loading" && (
        <Link
          href="/perfil"
          className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-md border border-accent bg-accent px-5 text-[11px] font-bold tracking-[0.1em] text-[var(--on-accent)]"
        >
          Abrir MangaTotal
        </Link>
      )}
    </AuthCard>
  );
}
