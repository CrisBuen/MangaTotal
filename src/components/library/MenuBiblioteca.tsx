"use client";
import { useEffect, useId, useRef, useState } from "react";
import { fechaBiblioteca, leerOpciones, opcionesIniciales, ordenes, type FiltroBiblioteca, type OpcionesBiblioteca } from "@/lib/opcionesBiblioteca";
import { useActualizaciones } from "./ActualizacionesBiblioteca";
export { fechaBiblioteca };

export function useOpcionesBiblioteca(seccion: "lectura" | "anime") {
  const { usuario } = useActualizaciones();
  const key = `mangatotal:biblioteca-opciones:v1:${usuario ?? "visitante"}:${seccion}`;
  const [estado, setEstado] = useState<{ key: string; opciones: OpcionesBiblioteca }>({ key: "", opciones: opcionesIniciales });
  useEffect(() => {
    const leer = () => { try { setEstado({ key, opciones: leerOpciones(localStorage.getItem(key)) }); } catch { setEstado({ key, opciones: opcionesIniciales }); } };
    const cambio = (e: StorageEvent) => { if (e.key === key) leer(); };
    leer(); window.addEventListener("storage", cambio); return () => window.removeEventListener("storage", cambio);
  }, [key]);
  const opciones = estado.key === key ? estado.opciones : opcionesIniciales;
  const cambiar = (nuevo: OpcionesBiblioteca) => {
    setEstado({ key, opciones: nuevo });
    try { localStorage.setItem(key, JSON.stringify(nuevo)); } catch { /* Sigue disponible durante esta sesión. */ }
  };
  const favorito = (id: string) => cambiar({ ...opciones, favoritos: opciones.favoritos.includes(id) ? opciones.favoritos.filter(k => k !== id) : [...opciones.favoritos, id] });
  return { opciones, cambiar, favorito };
}
export function grillaBiblioteca(o: OpcionesBiblioteca) {
  return `biblioteca-grid grid gap-x-4 gap-y-8 ${o.vista === "lista" ? "grid-cols-1 md:grid-cols-2" : o.vista === "compacta" ? "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-8" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"}`;
}
export function FavoritoBiblioteca({ activo, titulo, onClick }: { activo: boolean; titulo: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} aria-label={`${activo ? "Quitar" : "Marcar"} favorito: ${titulo}`} aria-pressed={activo}
    className="absolute bottom-1 right-1 z-10 grid h-9 w-9 place-items-center rounded-full border border-line bg-panel text-accent-ink">{activo ? "★" : "☆"}</button>;
}
export function MenuBiblioteca({ opciones, cambiar, anime = false }: { opciones: OpcionesBiblioteca; cambiar: (o: OpcionesBiblioteca) => void; anime?: boolean }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const tituloId = useId();
  const [pestana, setPestana] = useState("filtrar");
  const etiquetas: [FiltroBiblioteca, string][] = [["pendientes", anime ? "Con episodios sin ver" : "Con capítulos sin leer"], ["empezados", "Empezados"], ["favoritos", "Favoritos"], ["completados", "Completados (serie finalizada)"]];
  const cambiarFiltro = (f: FiltroBiblioteca) => cambiar({ ...opciones, filtros: opciones.filtros.includes(f) ? opciones.filtros.filter(x => x !== f) : [...opciones.filtros, f] });
  return <>
    <button type="button" onClick={() => dialogo.current?.showModal()} aria-haspopup="dialog" aria-label={anime ? "Opciones de biblioteca animada" : "Opciones de biblioteca de lectura"}
      className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-line text-2xl text-ink hover:border-accent">⋮</button>
    <dialog ref={dialogo} aria-labelledby={tituloId} onClick={e => { if (e.target === e.currentTarget) dialogo.current?.close(); }}
      className="m-auto mb-0 max-h-[85dvh] w-full max-w-xl overflow-y-auto rounded-t-2xl border border-line bg-panel p-5 text-ink backdrop:bg-black/60 sm:mb-auto sm:rounded-2xl">
      <div className="mb-4 flex items-center justify-between gap-4"><h2 id={tituloId} className="text-lg font-semibold">Biblioteca · {anime ? "Anime animado" : "Lectura"}</h2><button type="button" aria-label="Cerrar opciones" onClick={() => dialogo.current?.close()} className="h-10 w-10 text-xl">×</button></div>
      <div className="mb-5 flex gap-2" role="tablist" aria-label="Opciones de biblioteca">
        {["filtrar", "ordenar", "apariencia"].map(p => <button key={p} type="button" role="tab" aria-selected={pestana === p}
          onClick={() => setPestana(p)} className={`min-h-11 flex-1 rounded-md px-2 capitalize ${pestana === p ? "bg-[var(--accent-soft)] text-accent-ink" : "text-subtle"}`}>{p}</button>)}
      </div>
      {pestana === "filtrar" && <div className="space-y-3">
        <label className="flex min-h-11 items-center gap-3 text-faint"><input type="checkbox" disabled />Descargados · no disponible</label>
        {etiquetas.map(([f, label]) => <label key={f} className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={opciones.filtros.includes(f)} onChange={() => cambiarFiltro(f)} className="h-5 w-5 accent-[var(--accent)]" />{label}</label>)}
        <p className="text-xs text-subtle">Los filtros se combinan. «Actualizar todo» obtiene los datos de las fuentes. Si no informan estado o cantidad, no se inventan. La app no descarga capítulos ni vídeos.</p>
        <button type="button" onClick={() => cambiar({ ...opciones, filtros: [] })} className="min-h-11 text-accent-ink">Limpiar filtros</button>
      </div>}
      {pestana === "ordenar" && <div className="space-y-1">
        <button type="button" onClick={() => cambiar({ ...opciones, descendente: !opciones.descendente })} className="mb-3 min-h-11 rounded-md border border-line px-4">{opciones.descendente ? "↓ Descendente" : "↑ Ascendente"}</button>
        {ordenes.map(o => <label key={o.valor} className="flex min-h-11 items-center gap-3"><input type="radio" name={anime ? "orden-anime" : "orden-lectura"} checked={opciones.orden === o.valor}
          onChange={() => cambiar({ ...opciones, orden: o.valor, ...(o.valor === "titulo" ? { descendente: false } : {}) })} />{o.titulo}</label>)}
        {opciones.orden === "azar" && <button type="button" onClick={() => cambiar({ ...opciones, semilla: Date.now() })} className="min-h-11 text-accent-ink">Volver a mezclar</button>}
        <p className="pt-3 text-xs text-subtle">La detección indica cuándo se encontró una novedad, no una descarga. Los datos desconocidos quedan al final.</p>
      </div>}
      {pestana === "apariencia" && <div className="space-y-4">
        {(["comoda", "compacta", "lista"] as const).map(v => <label key={v} className="flex min-h-11 items-center gap-3"><input type="radio" name={anime ? "vista-anime" : "vista-lectura"} checked={opciones.vista === v} onChange={() => cambiar({ ...opciones, vista: v })} />{v === "comoda" ? "Cuadrícula cómoda" : v === "compacta" ? "Cuadrícula compacta" : "Lista"}</label>)}
        <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={opciones.titulos} onChange={e => cambiar({ ...opciones, titulos: e.target.checked })} />Mostrar títulos</label>
      </div>}
      <p className="mt-5 border-t border-line pt-3 text-xs text-subtle">Opciones y estrellas de fuentes externas guardadas en este dispositivo, por cuenta y sección.</p>
    </dialog>
  </>;
}
