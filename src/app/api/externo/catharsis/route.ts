import { NextResponse } from "next/server";
import {
  abrirCapituloCw,
  catalogoCwServidor,
  normalizarCw,
  novedadesCwServidor,
  numeroCw,
  obtenerImagenPaginaCw,
  obtenerTicketPaginaCw,
  pedirCw,
  resolverMangaV3,
  serieCwServidor,
  type CarpetaCw,
} from "@/lib/catharsisServidor";

/**
 * Puente del servidor hacia Catharsis World (Catharsis v3).
 *
 * Su nueva web corre sobre un backend protegido por Cap PoW y pases de
 * lectura firmados por IP. El servidor consulta su API pública para armar
 * el catálogo completo en memoria, resolver los UUID antiguos de las series
 * guardadas por los usuarios y generar los tickets de lectura bajo demanda.
 */

const POR_PAGINA = 24;

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
      if (fresco) {
        respuesta.headers.set("Cache-Control", "no-store");
      } else {
        respuesta.headers.set("Cache-Control", "public, s-maxage=600, stale-while-revalidate=1800");
      }
      return respuesta;
    }

    if (accion === "serie") {
      const id = params.get("id")?.trim() ?? "";
      if (!id) {
        return NextResponse.json({ error: "Serie inválida" }, { status: 400 });
      }

      const titulo = params.get("titulo")?.trim();
      const ficha = await serieCwServidor(id, fresco, titulo);

      const respuesta = NextResponse.json(ficha);
      if (fresco) {
        respuesta.headers.set("Cache-Control", "no-store");
      } else {
        respuesta.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=900");
      }
      return respuesta;
    }

    if (accion === "capitulo") {
      const id = params.get("id")?.trim() ?? "";
      const serie = params.get("serie")?.trim() ?? "";
      if (!id) {
        return NextResponse.json({ error: "Capítulo inválido" }, { status: 400 });
      }

      let mangaId = "";
      let capNum = "";

      if (id.includes("-cap-")) {
        const partes = id.split("-cap-");
        mangaId = partes[0];
        capNum = partes[1];
      } else if (id.includes("/")) {
        const partes = id.split("/");
        mangaId = partes[0];
        capNum = partes[1];
      } else if (serie) {
        const { v3Manga } = await resolverMangaV3(serie);
        mangaId = String(v3Manga.id);
        const esUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        if (esUuid) {
          try {
            const f = await pedirCw<{ data: CarpetaCw }>(`/folders/${id}`, 3600);
            capNum = String(numeroCw(f?.data?.name ?? "") || 1);
          } catch {
            capNum = "1";
          }
        } else {
          capNum = String(numeroCw(id) || id);
        }
      } else {
        return NextResponse.json({ error: "Se requiere serie para este capítulo" }, { status: 400 });
      }

      const session = await abrirCapituloCw(mangaId, capNum);
      const paginas = session.paginas.map((p, idx) => ({
        numero: idx + 1,
        id: `${mangaId}/${capNum}/${p.index}`,
        ancho: 0,
        alto: 0,
      }));

      const respuesta = NextResponse.json({
        id,
        mangaId,
        capNum,
        paginas,
      });
      respuesta.headers.set("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=86400");
      return respuesta;
    }

    if (accion === "ticket") {
      const p = params.get("p")?.trim() ?? "";
      const [mangaId, capNum, pIdxStr] = p.split("/");
      if (!mangaId || !capNum || pIdxStr === undefined) {
        return NextResponse.json({ error: "Parámetros de página inválidos" }, { status: 400 });
      }

      const ticket = await obtenerTicketPaginaCw(mangaId, capNum, Number(pIdxStr));
      const respuesta = NextResponse.json(ticket);
      respuesta.headers.set("Cache-Control", "no-store");
      return respuesta;
    }

    if (accion === "imagen") {
      const p = params.get("p")?.trim() ?? "";
      const [mangaId, capNum, pIdxStr] = p.split("/");
      if (!mangaId || !capNum || pIdxStr === undefined) {
        return new Response("Parámetros de imagen inválidos", { status: 400 });
      }

      const { buffer, contentType } = await obtenerImagenPaginaCw(mangaId, capNum, Number(pIdxStr));
      return new Response(buffer as unknown as BodyInit, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=86400, s-maxage=86400",
        },
      });
    }

    return NextResponse.json({ error: "Acción desconocida" }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "No se pudo contactar con Catharsis World";
    return NextResponse.json({ error: msg, bloqueado: true }, { status: 502 });
  }
}
