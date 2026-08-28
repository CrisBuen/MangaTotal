# 9. Despliegue en Vercel

**https://manga-total.vercel.app** — se despliega solo con cada push a
`main`. No hay paso manual.

Y las dos apps (Windows y Android) cargan **esta misma web**. Un cambio acá
llega a todo el mundo enseguida; romperla rompe las tres plataformas a la
vez.

## 9.1 Qué corre en cada deploy

```
vercel-build = prisma generate && prisma migrate deploy && next build
```

Las **migraciones se aplican solas**. Consecuencia directa: una migración
rota no rompe una parte, tumba el deploy entero y la web se queda en la
versión anterior.

## 9.2 Variables de entorno

Se configuran en Vercel → Settings → Environment Variables.

| Variable | Obligatoria | Para qué |
|---|---|---|
| `DATABASE_URL` | sí | Postgres de Neon. **La administra la integración de Neon**: es de solo lectura y se resincroniza sola |
| `SESSION_SECRET` | sí | Firma la cookie de sesión. Mínimo 32 caracteres |
| `STORAGE_PROVIDER` | sí en Vercel | `local` \| `blob` \| `r2`. En Vercel **nunca `local`** |
| `BLOB_READ_WRITE_TOKEN` | si es `blob` | Vercel → Storage → Blob |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | si es `r2` | Cloudflare R2 |

`src/lib/env.ts` valida todo esto al arrancar y lanza un error **con nombre y
lugar** si falta algo. Eso es a propósito: sin esa validación, faltar una
variable daba un "server-side exception" genérico imposible de diagnosticar
desde los logs.

## 9.3 Las dos trampas de Postgres sin servidor propio

Están resueltas en `src/lib/db.ts`. **No simplificar ese archivo.**

**Una conexión por instancia.** Vercel levanta muchas instancias, cada una
vive poco y cada una abriría su propio grupo de conexiones. Con poca gente no
se nota; con tráfico, Postgres se queda sin conexiones y aparecen errores
intermitentes — los peores de diagnosticar, porque no se reproducen en
pruebas. Por eso se fuerza `connection_limit=1`.

**PgBouncer.** Si el endpoint de Neon lleva `-pooler`, hay un PgBouncer en
modo transacción delante, y Prisma necesita saberlo. Sin eso salen errores de
`prepared statement already exists`, también intermitentes y también solo con
tráfico.

Las dos cosas se ajustan **desde el código, no desde la variable de
entorno**, porque `DATABASE_URL` la maneja la integración de Neon: es de solo
lectura y se resincroniza sola cada vez que cambia la contraseña. Lo que se
ponga a mano en esa variable se pierde.

## 9.4 Almacenamiento de imágenes

Solo aplica al **catálogo propio**. Las imágenes de las fuentes externas se
cargan desde sus servidores y no pasan por acá.

- `local` — disco. Sirve en desarrollo. **En Vercel se pierde**: no hay disco
  persistente entre peticiones.
- `blob` — Vercel Blob. Es lo que se usa.
- `r2` — Cloudflare R2, alternativa.

## 9.5 Quién puede entrar sin cuenta

Lo decide `src/middleware.ts`. La idea: **los catálogos se miran sin cuenta,
leer un capítulo exige sesión.**

Si agregás una ruta de API para el catálogo de una fuente y no la sumás a
`PUBLIC_PREFIXES`, los visitantes reciben `401` y la pestaña se ve rota solo
para ellos — con la sesión abierta anda perfecto, así que es fácil no darse
cuenta.

## 9.6 Antes de hacer push

```bash
npx tsc --noEmit -p tsconfig.json
npx next build
```

`next build` es el que de verdad importa: encuentra cosas que el chequeo de
tipos deja pasar.

## 9.7 Cuando el deploy falla

1. Vercel → Deployments → el que falló → los logs.
2. Los sospechosos habituales, en orden:
   - una migración de Prisma que choca con lo que ya hay en la base
   - una variable de entorno que falta (el error dice cuál)
   - un error de tipos que no se corrió en local
3. Si la web quedó caída, **Redeploy del último deploy que funcionó** es más
   rápido que arreglar a las apuradas.

## 9.8 Lo que rompe el despliegue

- **Volver a SQLite** o guardar cualquier cosa en disco esperando que
  sobreviva.
- **Simplificar `src/lib/db.ts`.** Los dos ajustes parecen de más y no lo
  son.
- **Editar una migración ya aplicada en producción.** Se crea una nueva.
- **Cachear respuestas de fuentes que devuelven direcciones de un solo uso.**
- **Poner secretos en el repositorio.** Es público. Ver
  [`AGENTS.md`](../AGENTS.md).
