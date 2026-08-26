"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RandomSeriesButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function openRandomSeries() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/series?type=normal");
      const series = response.ok ? await response.json() : [];
      if (Array.isArray(series) && series.length > 0) {
        const selected = series[Math.floor(Math.random() * series.length)];
        router.push(`/serie/${selected.slug}`);
        return;
      }
      router.push("/biblioteca?f=normal");
    } catch {
      router.push("/biblioteca?f=normal");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={openRandomSeries}
      disabled={busy}
      className="relative inline-flex min-h-11 shrink-0 items-center px-1 text-[11px] font-bold uppercase tracking-[0.12em] text-subtle transition hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 sm:px-2"
      data-od-id="random-series-button"
    >
      {busy ? "Buscando…" : "Aleatorio"}
    </button>
  );
}
