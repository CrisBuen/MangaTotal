/**
 * Catharsis World, del lado del servidor.
 *
 * Acá vive el trabajo pesado: armar el catálogo entero desde su almacén y
 * tenerlo a mano. Lo usan la ruta de la fuente y la ruleta de Aleatorio, así
 * que no puede vivir dentro de ninguna de las dos.
 *
 * Cómo está organizado su almacén y por qué se lee así está explicado en
 * CAMBIO-DE-DOMINIO-CATHARSIS.txt.
 */

export const CW_API = "https://direct-new-catha.catharsisfood.com";

/** La carpeta raíz de la que cuelgan todas las series. */
export const CARPETA_MANGAS = "cf1f897d-9735-49f7-a96c-77a8c72d2124";

/** El catálogo entero pesa poco y cambia despacio: se arma cada media hora. */
const VIDA_CATALOGO_MS = 30 * 60 * 1000;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export interface CarpetaCw {
  id: string;
  name: string;
  parent: string | null;
}

export interface ArchivoCw {
  id: string;
  title: string | null;
  width: number | null;
  height: number | null;
}

export interface SerieCatalogoCw {
  id: string;
  nombre: string;
  portada: string | null;
  capitulos: number;
}

export async function pedirCw<T>(ruta: string, revalidar: number): Promise<T> {
  const res = await fetch(`${CW_API}${ruta}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    ...(revalidar > 0 ? { next: { revalidate: revalidar } } : { cache: "no-store" as const }),
  });
  if (!res.ok) throw new Error(`Catharsis respondió ${res.status}`);
  return (await res.json()) as T;
}

/** Sin tildes ni signos: para buscar y para casar la portada con su serie. */
export function normalizarCw(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** El primer número que aparece en un texto: "Capítulo 12.5" da 12.5 */
export function numeroCw(texto: string): number {
  const m = texto.match(/\d+(?:[.,]\d+)?/);
  return m ? Number(m[0].replace(",", ".")) : 0;
}

let catalogo: { hecho: number; series: SerieCatalogoCw[] } | null = null;

export async function catalogoCwServidor(fresco = false): Promise<SerieCatalogoCw[]> {
  if (!fresco && catalogo && Date.now() - catalogo.hecho < VIDA_CATALOGO_MS) {
    return catalogo.series;
  }

  const vida = fresco ? 0 : 1800;

  // las tres piezas son independientes entre sí: se piden juntas
  const [carpetas, cuentas, portadas] = await Promise.all([
    pedirCw<{ data: CarpetaCw[] }>(
      `/folders?filter[parent][_eq]=${CARPETA_MANGAS}&fields=id,name&limit=-1`,
      vida
    ),
    pedirCw<{ data: { parent: string | null; count: { id: string } }[] }>(
      `/folders?aggregate[count]=id&groupBy=parent&limit=-1`,
      vida
    ),
    pedirCw<{ data: ArchivoCw[] }>(
      `/files?filter[title][_starts_with]=${encodeURIComponent("Portada - ")}&fields=id,title&limit=-1`,
      vida
    ),
  ]);

  const cuantos = new Map(cuentas.data.map((c) => [c.parent ?? "", Number(c.count.id)]));

  // las portadas no cuelgan de la carpeta de su serie, así que se atan por el
  // nombre: "Portada - La corona que te quitaré"
  const porNombre = new Map<string, string>();
  for (const p of portadas.data) {
    if (!p.title) continue;
    porNombre.set(normalizarCw(p.title.replace(/^Portada\s*-\s*/i, "")), p.id);
  }

  const series = carpetas.data
    .map((c) => ({
      id: c.id,
      // algunos nombres vienen con espacios de más y desordenan el A–Z
      nombre: c.name.trim(),
      portada: porNombre.get(normalizarCw(c.name)) ?? null,
      capitulos: cuantos.get(c.id) ?? 0,
    }))
    // sin capítulos no hay nada que leer: son las novelas de texto y las
    // carpetas que quedaron vacías
    .filter((s) => s.capitulos > 0)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  catalogo = { hecho: Date.now(), series };
  return series;
}

/** Las series con capítulos subidos hace poco, de más nueva a más vieja. */
export async function novedadesCwServidor(fresco = false): Promise<SerieCatalogoCw[]> {
  const series = await catalogoCwServidor(fresco);
  const porId = new Map(series.map((s) => [s.id, s]));

  const recientes = await pedirCw<{ data: { folder: string | null }[] }>(
    `/files?sort=-created_on&limit=400&fields=folder`,
    fresco ? 0 : 300
  );

  // los archivos cuelgan de la carpeta del capítulo: hay que subir un piso
  const carpetas = [...new Set(recientes.data.map((f) => f.folder).filter(Boolean))] as string[];
  if (carpetas.length === 0) return [];

  const padres = await pedirCw<{ data: CarpetaCw[] }>(
    `/folders?filter[id][_in]=${carpetas.join(",")}&fields=id,parent&limit=-1`,
    fresco ? 0 : 300
  );
  const padreDe = new Map(padres.data.map((c) => [c.id, c.parent]));

  const vistas = new Set<string>();
  const salida: SerieCatalogoCw[] = [];
  for (const f of recientes.data) {
    const serie = f.folder ? padreDe.get(f.folder) : null;
    if (!serie || vistas.has(serie)) continue;
    vistas.add(serie);
    const s = porId.get(serie);
    if (s) salida.push(s);
  }
  return salida;
}
