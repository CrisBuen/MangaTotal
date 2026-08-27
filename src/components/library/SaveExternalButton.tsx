"use client";

import { useEffect, useState } from "react";

export interface SerieExternaGuardable {
  source: "mangadex" | "olympus" | "tmo" | "ikigai" | "leercapitulo" | "catharsis";
  external_id: string;
  slug?: string | null;
  title: string;
  cover_url?: string | null;
  type?: string | null;
}

/**
 * Guarda una serie externa en la biblioteca del usuario. La serie queda en
 * "Biblioteca → Normal" junto al catálogo propio, y desde ahí se retoma la
 * lectura por el capítulo donde iba.
 */
export function SaveExternalButton({ serie }: { serie: SerieExternaGuardable }) {
  const [guardada, setGuardada] = useState<boolean | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [sinSesion, setSinSesion] = useState(false);

  useEffect(() => {
    fetch("/api/externo/biblioteca")
      .then((r) => (r.ok ? r.json() : []))
      .then((lista: { source: string; external_id: string }[]) => {
        setGuardada(
          lista.some((e) => e.source === serie.source && e.external_id === serie.external_id)
        );
      })
      .catch(() => setGuardada(false));
  }, [serie.source, serie.external_id]);

  async function alternar() {
    setOcupado(true);
    try {
      if (guardada) {
        await fetch(
          `/api/externo/biblioteca?source=${serie.source}&id=${encodeURIComponent(serie.external_id)}`,
          { method: "DELETE" }
        );
        setGuardada(false);
        return;
      }

      const res = await fetch("/api/externo/biblioteca", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(serie),
      });
      if (res.status === 401) {
        setSinSesion(true);
        return;
      }
      if (res.ok) setGuardada(true);
    } finally {
      setOcupado(false);
    }
  }

  if (sinSesion) {
    return (
      <a
        href="/login"
        className="inline-flex min-h-11 items-center rounded-xl border border-line px-4 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-subtle transition hover:border-accent hover:text-ink"
      >
        Iniciá sesión para guardarla
      </a>
    );
  }

  return (
    <button
      onClick={alternar}
      disabled={ocupado || guardada === null}
      className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 font-mono text-[10px] font-bold uppercase tracking-[0.12em] transition disabled:opacity-50 ${
        guardada
          ? "border-accent bg-[var(--accent-soft)] text-accent"
          : "border-line text-subtle hover:border-accent hover:text-ink"
      }`}
      data-od-id="save-external-series"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
        {guardada ? (
          <path d="M6 2h12a1 1 0 0 1 1 1v18l-7-4-7 4V3a1 1 0 0 1 1-1zm5.2 12 5-5-1.4-1.4-3.6 3.6-1.8-1.8L8 11.8l3.2 3.2z" />
        ) : (
          <path d="M6 2h12a1 1 0 0 1 1 1v18l-7-4-7 4V3a1 1 0 0 1 1-1zm1 2v14.3l5-2.9 5 2.9V4H7z" />
        )}
      </svg>
      {guardada === null ? "..." : guardada ? "En mi biblioteca" : "Guardar en biblioteca"}
    </button>
  );
}
