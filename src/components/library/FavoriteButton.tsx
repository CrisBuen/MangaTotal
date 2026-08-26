"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

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
    <Button
      onClick={toggle}
      disabled={busy}
      variant={fav ? "secondary" : "ghost"}
      aria-pressed={fav}
      data-od-id="favorite-toggle"
    >
      {fav ? "★ En favoritos" : "☆ Agregar a favoritos"}
    </Button>
  );
}
