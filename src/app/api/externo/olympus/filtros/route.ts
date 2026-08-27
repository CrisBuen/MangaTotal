import { NextResponse } from "next/server";
import {
  OLYMPUS_ESTADOS,
  OLYMPUS_GENEROS,
  OLYMPUS_ORDENES,
  OLYMPUS_TIPOS,
} from "@/lib/olympus";

/** GET /api/externo/olympus/filtros — opciones para el panel de filtros. */
export async function GET() {
  return NextResponse.json({
    generos: OLYMPUS_GENEROS,
    estados: OLYMPUS_ESTADOS,
    tipos: OLYMPUS_TIPOS,
    ordenes: OLYMPUS_ORDENES,
  });
}
