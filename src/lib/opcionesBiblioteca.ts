export type OrdenBiblioteca = "titulo" | "cantidad" | "lectura" | "comprobacion" | "pendientes" | "reciente" | "obtencion" | "antiguedad" | "azar";
export type FiltroBiblioteca = "pendientes" | "empezados" | "favoritos" | "completados";
export interface OpcionesBiblioteca {
  filtros: FiltroBiblioteca[]; orden: OrdenBiblioteca; descendente: boolean;
  vista: "comoda" | "compacta" | "lista"; titulos: boolean; semilla: number; favoritos: string[];
}
export const opcionesIniciales: OpcionesBiblioteca = { filtros: [], orden: "pendientes", descendente: true, vista: "comoda", titulos: true, semilla: 1, favoritos: [] };
export const ordenes: { valor: OrdenBiblioteca; titulo: string }[] = [
  { valor: "titulo", titulo: "Alfabéticamente" }, { valor: "cantidad", titulo: "Por cantidad publicada" },
  { valor: "lectura", titulo: "Por última lectura / reproducción" }, { valor: "comprobacion", titulo: "Por última comprobación de actualizaciones" },
  { valor: "pendientes", titulo: "Por capítulos / episodios restantes" }, { valor: "reciente", titulo: "Por capítulo / episodio más reciente" },
  { valor: "obtencion", titulo: "Por fecha de detección de novedades" }, { valor: "antiguedad", titulo: "Por antigüedad en la biblioteca" },
  { valor: "azar", titulo: "Al azar" },
];
export function leerOpciones(texto: string | null): OpcionesBiblioteca {
  try {
    const p = JSON.parse(texto ?? "{}");
    return { ...opcionesIniciales,
      filtros: Array.isArray(p.filtros) ? p.filtros.filter((f: string) => ["pendientes", "empezados", "favoritos", "completados"].includes(f)) : [],
      orden: ordenes.some(o => o.valor === p.orden) ? p.orden : opcionesIniciales.orden,
      descendente: typeof p.descendente === "boolean" ? p.descendente : true,
      vista: ["comoda", "compacta", "lista"].includes(p.vista) ? p.vista : "comoda",
      titulos: p.titulos !== false, semilla: Number.isSafeInteger(p.semilla) ? p.semilla : 1,
      favoritos: Array.isArray(p.favoritos) ? p.favoritos.filter((f: unknown) => typeof f === "string" && f.length < 600).slice(0, 6000) : [],
    };
  } catch { return { ...opcionesIniciales }; }
}
export interface DatosBiblioteca {
  clave: string; titulo: string; cantidad?: number | null; lectura?: number | null; comprobacion?: number | null;
  pendientes?: number | null; reciente?: number | null; obtencion?: number | null; antiguedad?: number | null;
  empezado: boolean; favorito: boolean; completado: boolean;
}
export const fechaBiblioteca = (v?: string | null) => v && Number.isFinite(Date.parse(v)) ? Date.parse(v) : null;
export const serieFinalizada = (estado?: string | null) => !!estado && /^(completed|finished|finalizad[oa]s?|terminad[oa]s?|4)$/i.test(estado.trim());
function azar(clave: string, semilla: number) {
  let n = semilla | 0; for (const c of clave) n = Math.imul(n ^ c.charCodeAt(0), 16777619); return n >>> 0;
}
/** Sin dato no significa cero: los desconocidos quedan al final en ambos sentidos. */
export function ordenarBiblioteca<T>(lista: T[], opciones: OpcionesBiblioteca, datos: (t: T) => DatosBiblioteca): T[] {
  const signo = opciones.descendente ? -1 : 1;
  return lista.map(item => ({ item, d: datos(item) })).filter(({ d }) => opciones.filtros.every(f =>
    f === "pendientes" ? d.pendientes != null && d.pendientes > 0 : f === "empezados" ? d.empezado : f === "favoritos" ? d.favorito : d.completado
  )).sort((a, b) => {
    if (opciones.orden === "titulo") return signo * a.d.titulo.localeCompare(b.d.titulo, "es", { numeric: true, sensitivity: "base" });
    if (opciones.orden === "azar") return azar(a.d.clave, opciones.semilla) - azar(b.d.clave, opciones.semilla);
    const x = a.d[opciones.orden], y = b.d[opciones.orden];
    if (x == null && y != null) return 1; if (x != null && y == null) return -1;
    return x != null && y != null ? signo * (x - y) : 0;
  }).map(({ item }) => item);
}
