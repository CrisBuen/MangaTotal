# MangaTotal

Biblioteca de manga, manhwa y manhua que junta el **catálogo propio** con el
de **seis sitios externos** que dieron permiso por escrito, todo con el mismo
lector y el mismo progreso de lectura.

**https://manga-total.vercel.app** · también como app de **Windows** y de
**Android**.

## Si venís a tocar el código, empezá acá

1. **[`AGENTS.md`](AGENTS.md)** — qué **no** tocar y por qué. Este proyecto
   tiene varias cosas que parecen un error y no lo son: casi todas se
   arreglaron persiguiendo un bug difícil, y "limpiarlas" lo trae de vuelta.
2. **[`docs/00-INDICE.md`](docs/00-INDICE.md)** — la documentación completa.

## Documentación

| # | Documento | De qué trata |
|---|---|---|
| 1 | [Visión general](docs/01-overview.md) | Qué es, qué hace y qué no hace a propósito |
| 2 | [Arquitectura](docs/02-arquitectura.md) | Stack, carpetas, decisiones y su porqué |
| 3 | [Base de datos](docs/03-base-de-datos.md) | Los modelos de Prisma y sus trampas |
| 4 | [Subida de capítulos](docs/04-subida-de-capitulos.md) | Cómo entra un `.zip` propio |
| 5 | [Flujos de usuario](docs/05-flujos-de-usuario.md) | Visitante, lector, admin |
| 6 | [El lector](docs/06-lector.md) | Modos de lectura, progreso, el arreglo de las tiras |
| 7 | [API](docs/07-api.md) | Todas las rutas y quién puede llamarlas |
| 8 | **[Fuentes externas](docs/08-fuentes-externas.md)** | **Las seis fuentes: cómo se conectó cada una** |
| 9 | [Despliegue](docs/09-despliegue-vercel.md) | Vercel, Neon, variables, qué rompe el deploy |
| 10 | [Apps y publicación](docs/10-apps-y-publicacion.md) | Tauri, Capacitor, firmas, Play Store |

En la raíz hay además un `CAMBIO-DE-DOMINIO-*.txt` por cada fuente, con el
detalle fino de cómo funciona y qué hacer si cambian algo.

## En resumen

- **Stack**: Next.js 15 (App Router, TypeScript), Prisma 6 sobre Postgres en
  Neon, Tailwind. Imágenes propias en Vercel Blob.
- **Apps**: Windows con Tauri (`desktop/`), Android con Capacitor
  (`mobile/`). Las dos cargan la misma web, así que un cambio de interfaz o
  de fuentes llega con un push, sin recompilar.
- **Acceso**: los catálogos se miran sin cuenta; leer un capítulo, guardar
  progreso y marcar favoritos exige registrarse.
- **Fuentes externas**: MangaDex, Olympus, ZonaTMO, Ikigai, Catharsis World y
  LeerCapítulo, todas con permiso por escrito de cada sitio.
- **No se aloja nada de las fuentes**: portadas y páginas se cargan desde sus
  servidores. Tampoco se reproduce anime: esa sección es solo seguimiento.

## Desarrollo

```bash
npm install
npm run dev            # http://localhost:3000
```

Antes de subir cambios:

```bash
npx tsc --noEmit -p tsconfig.json
npx next build
```

No hay tests automatizados. Un cambio en el lector o en una fuente **se
comprueba abriendo un capítulo de verdad**: casi todos los bugs de este
proyecto compilaban perfecto.
