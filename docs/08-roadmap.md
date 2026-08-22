# 8. Roadmap de implementación

Pensado para construirse en fases con Claude Code, cada una entregando
algo funcional antes de pasar a la siguiente.

## Fase 0 — Setup del proyecto ✅
- ✅ Next.js inicializado (TypeScript, App Router, Tailwind).
- ✅ Prisma + `schema.prisma` según [03-database-schema.md](03-database-schema.md), con migraciones en `prisma/migrations/`.
- ✅ `.env` (DATABASE_URL) y `.env.local` (SESSION_SECRET) creados.
- ✅ `storage/` y `lector-total.db` en `.gitignore`.

## Fase 1 — Auth ✅
- ✅ Registro (`/registro`) y login (`/login`) según [05-user-flows.md](05-user-flows.md) §5.1–5.2.
- ✅ Primer usuario registrado = admin automáticamente.
- ✅ Middleware que protege las rutas privadas (ver nota de la Fase 6b: la
  biblioteca pasó a ser navegable como visitante).

## Fase 2 — Modelo de datos y biblioteca ✅
- ✅ Migraciones de Prisma.
- ✅ Página `/biblioteca` con pestañas Todo / Normal / +18 / ★ Favoritos.
- ✅ CRUD de series desde `/admin/series`.

## Fase 3 — Ingesta de `.zip` ✅
- ✅ Endpoint `/api/admin/upload` + servicio de ingesta completo según
  [04-ingestion-pipeline.md](04-ingestion-pipeline.md).
- ✅ Tabla de historial de ingestas en el dashboard (con polling).
- ✅ Probado con un `.zip` real exportado de Koharu (69 MB, 53 páginas).
- ✅ Corregido el límite de 10 MB del middleware para subidas grandes
  ([04-ingestion-pipeline.md](04-ingestion-pipeline.md) §4.5).

## Fase 4 — Lector ✅
- ✅ Modo Cascada (lazy load, barra lateral de progreso).
- ✅ Modo RTL paginado (zonas de click y teclado invertidos, contador).
- ✅ Toggle de pantalla completa (controles que se ocultan solos).
- ✅ Guardado de progreso de lectura (con debounce, y al salir).

## Fase 5 — Pulido ✅
- ✅ Favoritos (pestaña propia, solo usuarios con sesión).
- ✅ Sección "Continuar leyendo" dentro de cada catálogo (Normal/+18).
- ✅ Búsqueda de series.
- ✅ Gestión de usuarios de confianza desde el dashboard.

## Fase 5b — Agregados posteriores (no estaban en el plan original) ✅
- ✅ **Modo visitante**: la biblioteca se navega sin cuenta; login/registro
  desde el menú; leer requiere sesión ([05-user-flows.md](05-user-flows.md) §5.0).
- ✅ **Noticias**: el admin publica anuncios desde `/admin/noticias`; se
  muestran en la pestaña "Todo" (lo único que aparece ahí — los mangas van
  solo a su catálogo).
- ✅ **Perfil**: foto de perfil estilo red social (subir/quitar, 256×256
  webp) y cambio de contraseña ([05-user-flows.md](05-user-flows.md) §5.6).

## Fase 6 — (opcional, futuro) Acceso desde otros dispositivos
- El dev server ya escucha en la red local (Next muestra la URL "Network:
  http://IP-local:3000" al arrancar) — desde el celu/tablet en la misma
  red wifi ya se puede entrar por esa IP.
- Para acceso desde fuera de casa, la opción evaluada es un túnel privado
  (Cloudflare Tunnel + Access, o Tailscale) restringido a personas
  invitadas. **No** exponer la app abierta a internet: el contenido no es
  redistribuible públicamente y la app no está endurecida para tráfico
  público.

## Checklist de "listo para usar todos los días"
- [x] Puedo registrarme y loguearme.
- [x] Puedo subir un `.zip` de Koharu y aparece como capítulo nuevo.
- [x] Las páginas se ven en el orden correcto, sin pérdida de calidad.
- [x] Puedo leer en modo cascada y en modo RTL.
- [x] Pantalla completa funciona en ambos modos.
- [x] Si cierro el navegador y vuelvo, "Continuar leyendo" me lleva a la
      página exacta donde quedé.
- [x] El filtro +18 separa correctamente el contenido.
- [x] Los visitantes ven la biblioteca y las noticias sin cuenta, y nunca
      ven la sección +18.
