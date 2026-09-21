"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ejecutarCola, leerTrabajo, trabajoNuevo, type TareaBiblioteca, type TipoCola, type TrabajoBiblioteca } from "@/lib/colaBiblioteca";
import { isPlayStoreApp } from "@/lib/appVersion";

type Trabajos = Partial<Record<TipoCola, TrabajoBiblioteca>>;
interface Contexto { usuario: number | null; trabajos: Trabajos; aviso: string; iniciar: (tipo: TipoCola, tareas: TareaBiblioteca[]) => void; pausar: (tipo: TipoCola) => void; reanudar: (tipo: TipoCola, fallidas?: boolean) => void; }
const Contexto = createContext<Contexto>({ usuario: null, trabajos: {}, aviso: "", iniciar() {}, pausar() {}, reanudar() {} });
export const useActualizaciones = () => useContext(Contexto);
const tipos: TipoCola[] = ["lectura", "anime", "animelist"];
const prefijo = "mangatotal:biblioteca-cola:v1:";
const clave = (usuario: number, tipo: TipoCola) => `${prefijo}${usuario}:${isPlayStoreApp() ? "play" : "general"}:${tipo}`;

export async function servicioBiblioteca(activo: boolean, hechas = 0, total = 0) {
  const w = window as unknown as { Capacitor?: { Plugins?: { Actualizacion?: { estado: (datos: { activo: boolean; hechas: number; total: number }) => Promise<unknown> } } } };
  try { await w.Capacitor?.Plugins?.Actualizacion?.estado({ activo, hechas, total }); } catch { /* La cola sigue guardada en versiones anteriores o si Android suspende el servicio. */ }
}
export function limpiarActualizacionesBiblioteca() {
  window.dispatchEvent(new Event("biblioteca:salir"));
  try { for (const k of Object.keys(localStorage)) if (k.startsWith(prefijo)) localStorage.removeItem(k); } catch { /* almacenamiento no disponible */ }
  void servicioBiblioteca(false);
}

export function ActualizacionesBiblioteca({ children }: { children: ReactNode }) {
  const ruta = usePathname();
  const [usuario, setUsuario] = useState<number | null>(null);
  const [trabajos, setTrabajos] = useState<Trabajos>({});
  const [aviso, setAviso] = useState("");
  const actuales = useRef<Trabajos>({});
  const dueno = useRef<number | null>(null);
  const sesion = useRef(0);
  const sinGuardar = useRef(new Set<TipoCola>());
  const despertar = useRef<() => void>(() => {});
  const guardar = useCallback((j: TrabajoBiblioteca) => {
    if (!usuario) return;
    actuales.current = { ...actuales.current, [j.tipo]: j };
    setTrabajos(actuales.current);
    try { localStorage.setItem(clave(usuario, j.tipo), JSON.stringify(j)); sinGuardar.current.delete(j.tipo); }
    catch { sinGuardar.current.add(j.tipo); setAviso("No hay espacio para guardar el avance. Mantené la app abierta hasta terminar."); }
  }, [usuario]);

  useEffect(() => {
    let vigente = true;
    const controller = new AbortController();
    const verificar = async () => {
      const revision = sesion.current;
      try {
        const r = await fetch("/api/auth/me", { cache: "no-store", signal: controller.signal });
        if (!vigente || revision !== sesion.current) return;
        if (r.status === 401) { setUsuario(null); setTrabajos({}); actuales.current = {}; return; }
        if (!r.ok) return;
        const me = await r.json();
        if (vigente && revision === sesion.current) setUsuario(Number.isSafeInteger(me.id) ? me.id : null);
      } catch { /* Una desconexión no borra el avance ni inventa una sesión. */ }
    };
    void verificar();
    window.addEventListener("online", verificar);
    return () => { vigente = false; controller.abort(); window.removeEventListener("online", verificar); };
  }, [ruta]);

  useEffect(() => {
    if (!usuario) return;
    const controller = new AbortController();
    let ocupado = false;
    if (dueno.current !== usuario) { actuales.current = {}; sinGuardar.current.clear(); dueno.current = usuario; }
    const restaurar = () => {
      const copia: Trabajos = { ...actuales.current };
      for (const t of tipos) {
        if (sinGuardar.current.has(t)) continue;
        try { const j = leerTrabajo(localStorage.getItem(clave(usuario, t))); if (j?.tipo === t) copia[t] = j; }
        catch { /* Navegación privada: se conserva lo que vive en memoria. */ }
      }
      actuales.current = copia; setTrabajos(copia);
    };
    restaurar();
    const ejecutar = async () => {
      // Web Locks evita dos consultas simultáneas de la misma cola en dos pestañas.
      if (ocupado || controller.signal.aborted || !navigator.onLine) return;
      ocupado = true;
      const trabajar = async () => {
        restaurar();
        const activos = () => Object.values(actuales.current).filter(j => j.estado === "activo");
        if (!activos().length || controller.signal.aborted) return;
        const actualizarServicio = () => {
          const lista = activos();
          void servicioBiblioteca(!!lista.length && navigator.onLine, lista.reduce((n,j) => n+j.hechas.length,0), lista.reduce((n,j) => n+j.tareas.length,0));
        };
        const lista = activos();
        await servicioBiblioteca(true, lista.reduce((n,j) => n+j.hechas.length,0), lista.reduce((n,j) => n+j.tareas.length,0));
        try {
          const { consultarBiblioteca } = await import("@/lib/consultarBiblioteca");
          for (const tipo of tipos) {
            await ejecutarCola(() => actuales.current[tipo] ?? null, j => { guardar(j); actualizarServicio(); },
              (t, signal) => consultarBiblioteca(tipo, t, signal), controller.signal, () => navigator.onLine);
          }
        } finally { await servicioBiblioteca(false); }
      };
      try {
        if (navigator.locks) await navigator.locks.request(`biblioteca-${usuario}`, { ifAvailable: true }, async lock => { if (lock) await trabajar(); });
        else await trabajar();
      } catch { setAviso("La revisión se interrumpió; se retomará desde lo pendiente."); }
      finally { ocupado = false; }
    };
    despertar.current = () => { void ejecutar(); };
    const sincronizar = (e: StorageEvent) => {
      if (e.key?.startsWith(`${prefijo}${usuario}:`)) {
        if (e.newValue === null) {
          const tipo = tipos.find(t => clave(usuario, t) === e.key);
          if (tipo) { delete actuales.current[tipo]; setTrabajos({ ...actuales.current }); }
          if (!Object.values(actuales.current).some(t => t.estado === "activo")) void servicioBiblioteca(false);
          return;
        }
        // Una pausa desde otra pestaña debe llegar también al lote en vuelo.
        restaurar(); if (!ocupado) void ejecutar();
      }
    };
    const salir = () => { sesion.current++; controller.abort(); actuales.current = {}; setTrabajos({}); setUsuario(null); };
    const visible = () => { if (document.visibilityState === "visible") void ejecutar(); };
    window.addEventListener("storage", sincronizar);
    window.addEventListener("biblioteca:salir", salir);
    window.addEventListener("online", ejecutar);
    document.addEventListener("visibilitychange", visible);
    const reloj = setInterval(() => void ejecutar(), 15000);
    void ejecutar();
    return () => {
      controller.abort(); despertar.current = () => {}; clearInterval(reloj);
      window.removeEventListener("storage", sincronizar); window.removeEventListener("biblioteca:salir", salir);
      window.removeEventListener("online", ejecutar); document.removeEventListener("visibilitychange", visible);
      void servicioBiblioteca(false);
    };
  }, [usuario, guardar]);

  const iniciar = (tipo: TipoCola, tareas: TareaBiblioteca[]) => {
    if (!usuario) return;
    try { const j = leerTrabajo(localStorage.getItem(clave(usuario, tipo))); if (j && !sinGuardar.current.has(tipo)) actuales.current[tipo] = j; } catch { /* conserva memoria */ }
    if (actuales.current[tipo]?.estado === "activo") return;
    guardar(trabajoNuevo(tipo, tareas, actuales.current[tipo])); despertar.current();
  };
  const pausar = (tipo: TipoCola) => {
    const j = actuales.current[tipo]; if (j) guardar({ ...j, estado: "pausado", actualizado: Date.now() });
    if (!Object.values(actuales.current).some(t => t.estado === "activo")) void servicioBiblioteca(false);
  };
  const reanudar = (tipo: TipoCola, fallidas = false) => {
    const j = actuales.current[tipo]; if (!j) return;
    guardar({ ...j, estado: "activo", hechas: fallidas ? j.hechas.filter(k => !j.errores[k]) : j.hechas, actualizado: Date.now() });
    despertar.current();
  };
  return <Contexto.Provider value={{ usuario, trabajos, aviso, iniciar, pausar, reanudar }}>{children}</Contexto.Provider>;
}

export function EstadoActualizacion({ tipo }: { tipo: TipoCola }) {
  const { trabajos, aviso, pausar, reanudar } = useActualizaciones();
  const j = trabajos[tipo]; if (!j) return null;
  const errores = Object.keys(j.errores).length;
  return <div className="mt-3 space-y-2 text-sm text-subtle" role="status">
    <p>{j.estado === "terminado" ? "Revisión terminada" : j.estado === "pausado" ? "Revisión pausada" : "Revisando en segundo plano"}: {j.hechas.length}/{j.tareas.length} · {errores} con error.</p>
    {j.estado === "activo" && <button type="button" onClick={() => pausar(tipo)} className="underline">Pausar</button>}
    {j.estado === "pausado" && <button type="button" onClick={() => reanudar(tipo)} className="underline">Continuar revisión</button>}
    {j.estado === "terminado" && errores > 0 && <button type="button" onClick={() => reanudar(tipo, true)} className="underline">Reintentar solo las fallidas</button>}
    {aviso && <p>{aviso}</p>}
  </div>;
}
