import { NextResponse } from "next/server";
import {
  catalogoCwServidor,
  normalizarCw,
  novedadesCwServidor,
  numeroCw,
  pedirCw,
  type ArchivoCw,
  type CarpetaCw,
} from "@/lib/catharsisServidor";

/**
 * Puente del servidor hacia Catharsis World (integrada con su permiso).
 *
 * Su web no se puede leer desde un servidor: Cloudflare le pide a cada
 * visitante que compruebe que es una persona, y además dibuja las páginas en
 * un lienzo, así que en el documento no queda ninguna dirección de imagen.
 *
 * Pero el sitio guarda todo en un Directus, y ese sí contesta a cualquiera.
 * Cómo está organizado su almacén está en src/lib/catharsisServidor.ts y, con
 * más detalle, en CAMBIO-DE-DOMINIO-CATHARSIS.txt.
 */

const POR_PAGINA = 24;

const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const accion = params.get("accion") ?? "catalogo";
  const fresco = params.get("fresco") === "1";

  try {
    if (accion === "catalogo") {
      const orden = params.get("orden") ?? "nombre";
      const busqueda = normalizarCw(params.get("q") ?? "");
      const pagina = Math.max(1, Number(params.get("pagina")) || 1);

      let series =
        orden === "novedades" ? await novedadesCwServidor(fresco) : await catalogoCwServidor(fresco);
      if (busqueda) series = series.filter((s) => normalizarCw(s.nombre).includes(busqueda));
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
        pedirCw<{ data: CarpetaCw[] }>(
          `/folders?filter[parent][_eq]=${id}&fields=id,name&limit=-1`,
          fresco ? 0 : 300
        ),
        catalogoCwServidor(),
      ]);

      const capitulos = carpetas.data
        .map((c) => ({ id: c.id, numero: numeroCw(c.name), etiqueta: c.name }))
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

      const archivos = await pedirCw<{ data: ArchivoCw[] }>(
        `/files?filter[folder][_eq]=${id}&fields=id,title,width,height&limit=-1`,
        fresco ? 0 : 3600
      );

      // el título de cada archivo termina en "Tira 7", que es el número de
      // página. Nunca hay que confiar en el orden en que llegan: vienen
      // mezcladas, y sin esto el capítulo se lee salteado.
      const paginas = archivos.data
        .map((a, i) => ({
          orden: a.title ? numeroCw(a.title.split(" - ").pop() ?? "") || i + 1 : i + 1,
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
