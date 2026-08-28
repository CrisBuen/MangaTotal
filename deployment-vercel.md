# MangaTotal en Vercel

Guia para desplegar MangaTotal conservando la interfaz, los flujos de lectura y la logica existente.

## Por que falla en Vercel

El proyecto actual usa SQLite (`prisma/schema.prisma`) y guarda imagenes en `storage/` mediante el disco local. Vercel usa funciones efimeras: SQLite local no es una base persistente y los archivos escritos en disco no deben usarse para manga, portadas ni avatares. Tambien hay que configurar `DATABASE_URL` y `SESSION_SECRET`; si faltan puede aparecer `Application error: a server-side exception has occurred`.

El digest del navegador no reemplaza los logs de Vercel. Revisar siempre el primer error de la funcion.

## Regla de conservacion

No cambiar el diseno, las rutas publicas, los componentes visuales, los flujos de lectura ni los nombres de los campos salvo lo imprescindible para cambiar la persistencia. Hacer un commit de respaldo y validar cada cambio con `npm run build`.

## Arquitectura de produccion

- Vercel para Next.js y Route Handlers.
- Postgres gestionado (Neon, Supabase, Vercel Postgres u otro compatible con Prisma).
- Almacenamiento de objetos (Vercel Blob, S3/R2 o Supabase Storage) para paginas, portadas y avatares.
- Variables de entorno configuradas en Vercel para Production, Preview y Development.

No subir `.env`, `.env.local`, `lector-total.db`, `node_modules`, `.next` ni `storage/`. La biblioteca local debe migrarse al almacenamiento de objetos.

## Migracion de Prisma

Cambiar solo el datasource a Postgres:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Revisar las migraciones para Postgres sin borrar modelos, tablas, relaciones ni datos. En Vercel usar `npx prisma migrate deploy`, nunca `migrate dev`. Mantener el cliente reutilizable de `src/lib/db.ts`.

Si se necesita SQLite para desarrollo local, separar la configuracion de desarrollo de la de produccion. No usar SQLite como base principal en Vercel.

## Migracion de archivos

Las rutas que hoy usan `fs.writeFile`, `fs.mkdir` o `fs.rm` deben usar un adaptador de almacenamiento de objetos. Mantener las claves relativas guardadas en la base, por ejemplo:

- `series/<slug>/cover.jpg`
- `series/<slug>/<chapter>/0001.png`
- `avatars/<user-id>.<extension>`

El adaptador debe soportar subir, leer/servir, eliminar y obtener URL. Mantener las rutas API y la UI existentes. La ingesta debe conservar orden numerico, ancho, alto, checksum e `IngestionJob`. Si los ZIP superan el limite de una funcion, mover el procesamiento a un job sin cambiar el dashboard.

## Variables de entorno

```env
DATABASE_URL="postgresql://..."
SESSION_SECRET="cadena-larga-aleatoria-de-al-menos-32-caracteres"
STORAGE_PROVIDER="blob"
BLOB_READ_WRITE_TOKEN="..."
```

### DATABASE_URL: usar la direccion con pooler

En Vercel cada peticion puede caer en una instancia distinta, y cada una abre
su propia conexion contra Postgres. Con poca gente no se nota. Con trafico se
agotan las conexiones y empiezan errores intermitentes, que aparecen justo el
dia que llega la gente y son de los mas dificiles de diagnosticar.

En Neon hay dos direcciones para la misma base. Hay que usar **la que lleva
`-pooler` en el host**:

```
  sirve       ...@ep-algo-123456-pooler.us-east-2.aws.neon.tech/...
  no sirve    ...@ep-algo-123456.us-east-2.aws.neon.tech/...
```

Se copia desde el panel de Neon, en *Connection string*, marcando la opcion
de conexion agrupada (*Pooled connection*).

Si falta, la app funciona igual pero deja un aviso en los registros de Vercel
al arrancar: `[base de datos] DATABASE_URL no parece la direccion con pooler`.

El limite de conexiones por instancia lo pone el codigo solo cuando corre en
Vercel (`src/lib/db.ts`), asi que no hay que agregar `connection_limit` a
mano. Si se agrega, se respeta el valor puesto.

Los nombres del proveedor pueden variar, pero el codigo debe validar las variables. Nunca poner secretos en el codigo, README, commits ni variables `NEXT_PUBLIC_`.

## Configuracion de Vercel

- Framework Preset: Next.js.
- Root Directory: raiz del repositorio.
- Install Command: `npm install`.
- Build Command: `npm run build`.
- No usar `next export`.
- Ejecutar `npx prisma migrate deploy` como paso controlado antes o durante el despliegue.
- Si se crea `vercel-build`, debe ejecutar `prisma generate`, la migracion controlada y `next build`.

## Checklist para Claude

- [ ] Revisar logs de Vercel y localizar el primer error real.
- [ ] Confirmar `DATABASE_URL` y `SESSION_SECRET` en Production.
- [ ] Migrar SQLite a Postgres conservando modelos y relaciones.
- [ ] Migrar `storage/` a almacenamiento de objetos persistente.
- [ ] Mantener API, UI y diseño.
- [ ] Ejecutar `npx prisma generate` y `npx prisma migrate deploy`.
- [ ] Ejecutar `npm run build` sin errores.
- [ ] Probar inicio, biblioteca, login, registro, lectura, favoritos, perfil, avatar, admin e ingesta de un ZIP pequeño.
- [ ] Probar primero un Preview Deployment.
- [ ] Confirmar que Git no contiene secretos, SQLite ni mangas.

## Orden recomendado

1. Crear Postgres y el bucket/Blob.
2. Migrar Prisma y probar localmente con las variables nuevas.
3. Crear el adaptador y migrar ingesta, imagenes y avatares.
4. Configurar variables de Vercel.
5. Desplegar Preview y revisar logs.
6. Migrar `lector-total.db` y `storage/` con un script verificable.
7. Comprobar conteos, portadas y paginas antes de Production.

Los datos locales no se suben al repositorio porque estan ignorados por Git. No borrar los originales hasta verificar el Preview.
