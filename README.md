# Lector Total — Documentación del proyecto

Lector de manga/manhwa/manhua/doujinshi **personal y privado**. Pensado para
un solo usuario administrador (vos) con la posibilidad de crear cuentas
adicionales de confianza si en el futuro querés compartir acceso dentro de
tu red local. **No está diseñado ni preparado para exposición pública en
internet.**

## Índice de documentos

| # | Documento | Contenido |
|---|-----------|-----------|
| 1 | [Visión general](docs/01-overview.md) | Objetivo, alcance, features principales |
| 2 | [Arquitectura](docs/02-architecture.md) | Stack técnico, diagrama de componentes, estructura de carpetas |
| 3 | [Base de datos](docs/03-database-schema.md) | Diagrama ER, tablas, columnas, relaciones |
| 4 | [Pipeline de ingesta](docs/04-ingestion-pipeline.md) | Cómo se procesa un .zip de Koharu hasta quedar en la biblioteca |
| 5 | [Flujos de usuario](docs/05-user-flows.md) | Registro, login, lectura, administración (diagramas de secuencia) |
| 6 | [Modos de lectura (UX)](docs/06-reading-modes-ux.md) | Cascada, RTL (manga), pantalla completa |
| 7 | [Especificación de API](docs/07-api-spec.md) | Endpoints REST, payloads, códigos de respuesta |
| 8 | [Roadmap de implementación](docs/08-roadmap.md) | Fases sugeridas para construir esto en Claude Code |

## Estado

**Implementado y funcionando** (Fases 0–5 del roadmap completas). Se arranca con
`npm run dev` y se entra en `http://localhost:3000`. La primera cuenta que se
registra queda como administradora.

## Resumen rápido

- **Stack**: Next.js (React + TypeScript) full-stack, SQLite + Prisma, Tailwind CSS.
- **Alcance de red**: `localhost` / red local (LAN). Sin dominio público, sin puertos reenviados a internet.
- **Acceso**: la biblioteca se puede **navegar como visitante** (sin cuenta); leer capítulos, guardar progreso y marcar favoritos requiere registrarse o iniciar sesión desde el menú.
- **Portada ("Todo")**: muestra las **Noticias** que publica el admin (anuncios, cosas por venir). Los mangas nunca aparecen ahí: viven en su catálogo.
- **Contenido**: se organiza en dos secciones — *Normal* y *+18* — como un filtro de biblioteca, no como un gate legal (la app entera es privada). La pestaña +18 solo la ven usuarios con esa preferencia activada.
- **Ingesta**: subís el `.zip` que exporta Koharu (páginas `.png` numeradas), la app lo procesa solo, ordena las páginas y arma el capítulo automáticamente, sin recomprimir ni perder calidad.
- **Lectura**: modo cascada (scroll continuo tipo webtoon), modo página a página derecha→izquierda (manga tradicional), y modo pantalla completa.
- **Perfil**: foto de perfil estilo red social, cambio de contraseña, preferencia +18 y modo de lectura preferido.
