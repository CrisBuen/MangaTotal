import { NextResponse } from "next/server";

/**
 * Puente del servidor hacia Catharsis World (integrada con su permiso).
 *
 * Su web no se puede leer desde un servidor: Cloudflare le pide a cada
 * visitante que compruebe que es una persona, y además dibuja las páginas en
 * un lienzo, así que en el documento no queda ninguna dirección de imagen.
 *
 * Pero el sitio guarda todo en un Directus, y ese sí contesta a cualquiera:
 *
 *   Mangas ── carpeta por serie ── carpeta por capítulo ── un archivo por
 *                                                          página
 *
 * El nombre de cada carpeta es el título y el número, y el título de cada
 * archivo dice a qué serie, capítulo y página pertenece. Con eso se arma todo
 * sin tocar la web, y funciona igual en el navegador que en las apps.
 */
const API = "https://direct-new-catha.catharsisfood.com";

/** La carpeta raíz de la que cuelgan todas las series. */
const CARPETA_MANGAS = "cf1f897d-9735-49f7-a96c-77a8c72d2124";

const POR_PAGINA = 24;

/** El catálogo entero pesa poco y cambia despacio: se arma cada media hora. */
const VIDA_CATALOGO_MS = 30 * 60 * 1000;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

interface Carpeta {
  id: string;
  name: string;
  parent: string | null;
}

interface Archivo {
  id: string;
  title: string | null;
  width: number | null;
  height: number | null;
}

interface SerieCatalogo {
  id: string;
  nombre: string;
  portada: string | null;
  capitulos: number;
}

async function pedir<T>(ruta: string, revalidar: number): Promise<T> {
  const res = await fetch(`${API}${ruta}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    ...(revalidar > 0 ? { next: { revalidate: revalidar } } : { cache: "no-store" as const }),
  });
  if (!res.ok) throw new Error(`Catharsis respondió ${res.status}`);
  return (await res.json()) as T;
}

/** Sin tildes ni signos: para buscar y para casar la portada con su serie. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** El primer número que aparece en un texto: "Capítulo 12.5" da 12.5 */
function numeroDe(texto: string): number {
  const m = texto.match(/\d+(?:[.,]\d+)?/);
  return m ? Number(m[0].replace(",", ".")) : 0;
}

let catalogo: { hecho: number; series: SerieCatalogo[] } | null = null;

async function armarCatalogo(fresco: boolean): Promise<SerieCatalogo[]> {
  if (!fresco && catalogo && Date.now() - catalogo.hecho < VIDA_CATALOGO_MS) {
    return catalogo.series;
  }

  const vida = fresco ? 0 : 1800;

  // las tres piezas son independientes entre sí: se piden juntas
  const [carpetas, cuentas, portadas] = await Promise.all([
    pedir<{ data: Carpeta[] }>(
      `/folders?filter[parent][_eq]=${CARPETA_MANGAS}&fields=id,name&limit=-1`,
      vida
    ),
    pedir<{ data: { parent: string | null; count: { id: string } }[] }>(
      `/folders?aggregate[count]=id&groupBy=parent&limit=-1`,
      vida
    ),
    pedir<{ data: Archivo[] }>(
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
    porNombre.set(normalizar(p.title.replace(/^Portada\s*-\s*/i, "")), p.id);
  }

  const series = carpetas.data
    .map((c) => ({
      id: c.id,
      // algunos nombres vienen con espacios de más y desordenan el A–Z
      nombre: c.name.trim(),
      portada: porNombre.get(normalizar(c.name)) ?? null,
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
async function novedades(fresco: boolean): Promise<SerieCatalogo[]> {
  const series = await armarCatalogo(fresco);
  const porId = new Map(series.map((s) => [s.id, s]));

  const recientes = await pedir<{ data: { folder: string | null }[] }>(
    `/files?sort=-created_on&limit=400&fields=folder`,
    fresco ? 0 : 300
  );

  // los archivos cuelgan de la carpeta del capítulo: hay que subir un piso
  const carpetas = [...new Set(recientes.data.map((f) => f.folder).filter(Boolean))] as string[];
  if (carpetas.length === 0) return [];

  const padres = await pedir<{ data: Carpeta[] }>(
    `/folders?filter[id][_in]=${carpetas.join(",")}&fields=id,parent&limit=-1`,
    fresco ? 0 : 300
  );
  const padreDe = new Map(padres.data.map((c) => [c.id, c.parent]));

  const vistas = new Set<string>();
  const salida: SerieCatalogo[] = [];
  for (const f of recientes.data) {
    const serie = f.folder ? padreDe.get(f.folder) : null;
    if (!serie || vistas.has(serie)) continue;
    vistas.add(serie);
    const s = porId.get(serie);
    if (s) salida.push(s);
  }
  return salida;
}

const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const accion = params.get("accion") ?? "catalogo";
  const fresco = params.get("fresco") === "1";

  try {
    if (accion === "catalogo") {
      const orden = params.get("orden") ?? "nombre";
      const busqueda = normalizar(params.get("q") ?? "");
      const pagina = Math.max(1, Number(params.get("pagina")) || 1);

      let series = orden === "novedades" ? await novedades(fresco) : await armarCatalogo(fresco);
      if (busqueda) series = series.filter((s) => normalizar(s.nombre).includes(busqueda));
      if (orden === "capitulos") series = [...series].sort((a, b) => b.capitulos - a.capitulos);

      const desde = (pagina - 1) * POR_PAGINA;
      const respuesta = NextResponse.json({
        series: series.slice(desde, desde + POR_PAGINA),
        total: series.length,
        paginas: Math.max(1, Math.ceil(series.length / POR_PAGINA)),
      });
      if (fresco) respuesta.headers.set("Cache-Control", "no-store");
      return respuesta;
    }

    if (accion === "serie") {
      const id = params.get("id") ?? "";
      if (!ES_UUID.test(id)) {
        return NextResponse.json({ error: "Serie inválida" }, { status: 400 });
      }

      const [carpetas, series] = await Promise.all([
        pedir<{ data: Carpeta[] }>(
          `/folders?filter[parent][_eq]=${id}&fields=id,name&limit=-1`,
          fresco ? 0 : 300
        ),
        armarCatalogo(false),
      ]);

      const capitulos = carpetas.data
        .map((c) => ({ id: c.id, numero: numeroDe(c.name), etiqueta: c.name }))
        .sort((a, b) => a.numero - b.numero);

      const serie = series.find((s) => s.id === id);
      const respuesta = NextResponse.json({
        id,
        nombre: serie?.nombre ?? "",
        portada: serie?.portada ?? null,
        capitulos,
      });
      if (fresco) respuesta.headers.set("Cache-Control", "no-store");
      return respuesta;
    }

    if (accion === "capitulo") {
      const id = params.get("id") ?? "";
      if (!ES_UUID.test(id)) {
        return NextResponse.json({ error: "Capítulo inválido" }, { status: 400 });
      }

      const archivos = await pedir<{ data: Archivo[] }>(
        `/files?filter[folder][_eq]=${id}&fields=id,title,width,height&limit=-1`,
        fresco ? 0 : 3600
      );

      // el título de cada archivo termina en "Tira 7", que es el número de
      // página; si no lo trae, se cae al orden en que vinieron
      const paginas = archivos.data
        .map((a, i) => ({
          orden: a.title ? numeroDe(a.title.split(" - ").pop() ?? "") || i + 1 : i + 1,
          id: a.id,
          ancho: a.width ?? 0,
          alto: a.height ?? 0,
        }))
        .sort((a, b) => a.orden - b.orden)
        .map((p, i) => ({ numero: i + 1, id: p.id, ancho: p.ancho, alto: p.alto }));

      return NextResponse.json({ id, paginas });
    }

    return NextResponse.json({ error: "Acción desconocida" }, { status: 400 });
  } catch {
    return NextResponse.json(
      { error: "No se pudo contactar con Catharsis World", bloqueado: true },
      { status: 502 }
    );
  }
}
