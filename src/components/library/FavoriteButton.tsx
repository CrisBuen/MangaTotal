"use client";

import { useState } from "react";

export function FavoriteButton({
  seriesId,
  initialFavorite,
}: {
  seriesId: number;
  initialFavorite: boolean;
}) {
  const [fav, setFav] = useState(initialFavorite);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      if (fav) {
        await fetch(`/api/favorites/${seriesId}`, { method: "DELETE" });
        setFav(false);
      } else {
        await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ seriesId }),
        });
        setFav(true);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`rounded-lg border px-3 py-1.5 text-sm transition ${
        fav
          ? "border-amber-500 bg-amber-500/10 text-amber-400"
          : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
      }`}
    >
      {fav ? "★ En favoritos" : "☆ Agregar a favoritos"}
    </button>
  );
}
