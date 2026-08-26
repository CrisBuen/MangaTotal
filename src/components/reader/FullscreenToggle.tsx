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
      className="min-h-11 rounded-xl border border-line bg-panel px-3 text-[10px] font-bold uppercase tracking-[0.08em] text-ink transition hover:border-accent hover:bg-[var(--surface-raised)]"
      data-od-id="fullscreen-toggle"
    >
      {isFullscreen ? "Salir" : "Pantalla completa"}
    </button>
  );
}
