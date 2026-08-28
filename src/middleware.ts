import { unsealData } from "iron-session";
import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "lector_total_session";
const TTL = 60 * 60 * 24 * 30;

// Rutas visibles sin sesión: la biblioteca se puede navegar como visitante,
// y desde el menú se inicia sesión o se registra. Leer capítulos, el perfil
// y todo lo de admin siguen exigiendo cuenta.
const PUBLIC_EXACT = new Set([
  "/",
  "/biblioteca",
  "/explorar",
  "/aleatorio",
  "/noticias",
  "/mas",
  "/ajustes",
  "/estadisticas",
  "/acerca-de",
  "/anime",
  "/login",
  "/registro",
  "/api/auth/login",
  "/api/auth/register",
  "/api/series",
  "/api/announcements",
  "/api/tags",
]);
// el catálogo externo se navega como visitante; leer capítulos exige sesión
const PUBLIC_PREFIXES = [
  "/serie/",
  "/externo/",
  "/api/images/",
  "/api/series/",
  "/api/externo/series",
  // el catálogo y sus filtros son públicos; el capítulo valida sesión por su cuenta
  // las noticias son públicas, como la página que las muestra
  "/api/noticias",
  "/api/externo/olympus",
  "/api/externo/tmo",
  "/api/externo/leercapitulo",
  "/api/externo/catharsis",
  // la ruleta sortea entre los catálogos, que son públicos
  "/api/aleatorio",
  // el catálogo de anime se navega como visitante; la lista exige sesión
  "/anime/",
  "/api/anime",
];

interface SessionData {
  userId?: number;
  isAdmin?: boolean;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    PUBLIC_EXACT.has(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))
  ) {
    // los handlers de API validan sesión/admin por su cuenta para mutaciones
    return NextResponse.next();
  }

  let session: SessionData | null = null;
  const sealed = req.cookies.get(COOKIE_NAME)?.value;
  if (sealed) {
    try {
      session = await unsealData<SessionData>(sealed, {
        password: process.env.SESSION_SECRET as string,
        ttl: TTL,
      });
    } catch {
      session = null;
    }
  }

  const isApi = pathname.startsWith("/api");

  if (!session?.userId) {
    if (isApi) {
      return NextResponse.json({ error: "Sin sesión o sesión expirada" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Zona admin: exige is_admin
  if ((pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) && !session.isAdmin) {
    if (isApi) {
      return NextResponse.json({ error: "Requiere permiso de administrador" }, { status: 403 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/biblioteca";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // las rutas de subida de archivos (zip de capítulos, avatar) se excluyen del
  // middleware: si pasan por acá, Next corta el body en 10MB y la subida falla.
  // Ambos handlers validan sesión/admin por su cuenta.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|sw.js|manifest.webmanifest|offline|icons/|descargas/|api/admin/upload|api/auth/avatar).*)",
  ],
};
