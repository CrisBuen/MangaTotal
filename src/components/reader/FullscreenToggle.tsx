"use client";

/**
 * Toggle de pantalla completa vía Fullscreen API (docs/06 §6.4).
 * El estado real lo maneja el Reader escuchando "fullscreenchange".
 */
export function FullscreenToggle({
  isFullscreen,
  onToggle,
}: {
  isFullscreen: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      title={isFullscreen ? "Salir de pantalla completa (Esc)" : "Pantalla completa"}
      className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-sm text-zinc-300 transition hover:border-zinc-500"
    >
      {isFullscreen ? "⛶ Salir" : "⛶"}
    </button>
  );
}
