/** Cola pequeña de metadatos: nunca almacena imágenes, vídeos ni credenciales. */
export type TipoCola = "lectura" | "anime" | "animelist";
export interface TareaBiblioteca {
  source: string; external_id: string; slug: string | null; type: string | null;
  last_chapter_name: string | null;
}
export interface ResultadoBiblioteca {
  ultimo: string | null; total?: number; sinLeer: number; estado?: string | null;
  publicado?: number | null; comprobado: number; obtenido: number; numeros?: number[];
  anilist?: Record<string, { emitidos: number | null; total: number | null; sinVer: number; enEmision: boolean }>;
}
export interface TrabajoBiblioteca {
  id: string; tipo: TipoCola; tareas: TareaBiblioteca[]; hechas: string[];
  errores: Record<string, string>; resultados: Record<string, ResultadoBiblioteca>;
  estado: "activo" | "pausado" | "terminado"; actualizado: number;
}
export const claveTarea = (t: Pick<TareaBiblioteca, "source" | "external_id">) => `${t.source}-${t.external_id}`;
const fuentes = new Set(["mangadex", "olympus", "tmo", "ikigai", "leercapitulo", "catharsis", "jkanime", "tioanime", "hentaitv", "anilist"]);
export function tareaValida(t: TareaBiblioteca): boolean {
  return !!t && fuentes.has(t.source) && typeof t.external_id === "string" &&
    t.external_id.length > 0 && t.external_id.length <= 500 && !/[?#\\\u0000-\u001f]/.test(t.external_id) &&
    !t.external_id.split("/").some(p => !p || p === "." || p === "..") &&
    (t.slug === null || (typeof t.slug === "string" && /^[\w-]{1,500}$/.test(t.slug))) &&
    (t.last_chapter_name === null || typeof t.last_chapter_name === "string");
}
export function trabajoNuevo(tipo: TipoCola, tareas: TareaBiblioteca[], previo?: TrabajoBiblioteca): TrabajoBiblioteca {
  const unicas = [...new Map(tareas.filter(tareaValida).map(t => [claveTarea(t), t])).values()].slice(0, 6000);
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, tipo, tareas: unicas, hechas: [], errores: {},
    resultados: previo?.resultados ?? {}, estado: unicas.length ? "activo" : "terminado", actualizado: Date.now() };
}
export function leerTrabajo(texto: string | null): TrabajoBiblioteca | null {
  try {
    if (!texto || texto.length > 6_000_000) return null;
    const j = JSON.parse(texto) as TrabajoBiblioteca;
    if (!j || !["lectura", "anime", "animelist"].includes(j.tipo) || typeof j.id !== "string" ||
      !["activo", "pausado", "terminado"].includes(j.estado) || !Array.isArray(j.tareas) || j.tareas.length > 6000 ||
      !j.tareas.every(tareaValida) || !Array.isArray(j.hechas) || !j.hechas.every(k => typeof k === "string") ||
      !j.resultados || typeof j.resultados !== "object" || Array.isArray(j.resultados) || !j.errores || typeof j.errores !== "object" || Array.isArray(j.errores) ||
      !Number.isFinite(j.actualizado) || Date.now() - j.actualizado > 30 * 86400000) return null;
    for (const r of Object.values(j.resultados)) {
      if (!r || !Number.isFinite(r.comprobado) || !Number.isFinite(r.sinLeer) ||
        !(r.ultimo === null || typeof r.ultimo === "string") ||
        (r.numeros !== undefined && (!Array.isArray(r.numeros) || r.numeros.length > 10000 || !r.numeros.every(Number.isFinite)))) return null;
    }
    return j;
  } catch { return null; }
}

/** Recalcula tras seguir leyendo, sin conservar un contador antiguo ni asumir numeración continua. */
export function pendientesBiblioteca(r: ResultadoBiblioteca | undefined, leido: string | null): number | null {
  if (!r) return null;
  const punto = leido === null || !leido.trim() ? -1 : Number(leido);
  if (!Number.isFinite(punto)) return null;
  if (r.numeros) return r.numeros.filter(n => n > punto).length;
  return r.ultimo === null ? null : Math.max(0, Math.round(Number(r.ultimo) - Math.max(0, punto)));
}

/** Guarda cada resultado antes de tomar otro lote; cerrar la app repite solo lo pendiente. */
export async function ejecutarCola(
  leer: () => TrabajoBiblioteca | null,
  guardar: (j: TrabajoBiblioteca) => void,
  consultar: (t: TareaBiblioteca, signal: AbortSignal) => Promise<ResultadoBiblioteca>,
  signal: AbortSignal,
  conectado: () => boolean = () => true,
): Promise<void> {
  const id = leer()?.id;
  while (!signal.aborted && conectado()) {
    const j = leer();
    if (!j || j.id !== id || j.estado !== "activo") return;
    const pendientes = j.tareas.filter(t => !j.hechas.includes(claveTarea(t))).slice(0, 2);
    if (!pendientes.length) { guardar({ ...j, estado: "terminado", actualizado: Date.now() }); return; }
    await Promise.all(pendientes.map(async t => {
      let resultado: ResultadoBiblioteca | undefined, error: string | undefined;
      const controlador = new AbortController();
      const cancelar = () => controlador.abort();
      signal.addEventListener("abort", cancelar, { once: true });
      let temporizador: ReturnType<typeof setTimeout> | undefined;
      try {
        resultado = await Promise.race([
          consultar(t, controlador.signal),
          new Promise<never>((_, reject) => {
            temporizador = setTimeout(() => { controlador.abort(); reject(new Error("La fuente tardó demasiado")); }, 120000);
            controlador.signal.addEventListener("abort", () => reject(new Error("Consulta interrumpida")), { once: true });
          }),
        ]);
      } catch (e) { error = e instanceof Error ? e.message.slice(0, 180) : "No se pudo consultar la fuente"; }
      finally { clearTimeout(temporizador); signal.removeEventListener("abort", cancelar); }
      const actual = leer();
      if (signal.aborted || !conectado() || !actual || actual.id !== id || actual.estado !== "activo") return;
      const clave = claveTarea(t);
      const resultados = { ...actual.resultados }, errores = { ...actual.errores };
      if (resultado) {
        const anterior = resultados[clave];
        resultados[clave] = { ...resultado, obtenido: anterior?.ultimo === resultado.ultimo ? anterior.obtenido : resultado.obtenido };
        delete errores[clave];
      } else { errores[clave] = error ?? "Sin datos de la fuente"; }
      guardar({ ...actual, resultados, errores, hechas: [...new Set([...actual.hechas, clave])], actualizado: Date.now() });
    }));
  }
}
