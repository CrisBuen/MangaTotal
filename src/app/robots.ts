import type { MetadataRoute } from "next";

const SITE_URL = "https://www.mangatotal.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api/",
        "/ajustes",
        "/anime",
        "/estadisticas",
        "/explorar/jkanime/",
        "/explorar/tioanime/",
        "/leer/",
        "/leer-externo/",
        "/perfil",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
