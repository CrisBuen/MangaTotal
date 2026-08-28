# 7. API

Todo bajo `/api`. Respuestas en JSON. La sesión va en una cookie firmada.

**Quién puede entrar sin cuenta lo decide `src/middleware.ts`**, no cada
ruta. La idea: los catálogos se miran sin cuenta, leer un capítulo exige
sesión. Si agregás una ruta de catálogo y no la sumás a `PUBLIC_PREFIXES`,
los visitantes reciben `401` — y con tu sesión abierta se ve perfecto, así
que es fácil no notarlo.

## 7.1 Cuenta

| Ruta | Qué hace |
|---|---|
| `POST /api/auth/register` | Crear cuenta (apodo, contraseña, fecha de nacimiento) |
| `POST /api/auth/login` | Entrar |
| `POST /api/auth/logout` | Salir |
| `GET /api/auth/me` | Datos de la sesión |
| `PATCH /api/auth/me` | Preferencias: `show_adult_content`, `preferred_reading_mode` |
| `POST /api/auth/password` | Cambiar contraseña |
| `POST /api/auth/avatar` | Subir o borrar avatar |

## 7.2 Catálogo propio

| Ruta | Notas |
|---|---|
| `GET /api/series` | Filtros: `type`, `search`, `favorites`, `tag`. Público |
| `GET /api/series/[slug]` | Ficha. Público |
| `GET /api/series/[slug]/chapters` | Capítulos. Público |
| `GET /api/chapters/[id]` · `/pages` | Un capítulo y sus páginas. **Exige sesión** |
| `GET /api/images/[...path]` | Sirve la imagen. Público |
| `GET /api/tags` | Categorías. Acepta `?tipo=normal\|adult` |
| `GET/POST/DELETE /api/favorites` | Favoritos |
| `GET/PUT /api/progress` · `GET /api/progress/continue` | Progreso propio |
| `GET /api/announcements` | Noticias del administrador. Público |

Un visitante **nunca** recibe contenido +18, ni un usuario con
`show_adult_content` en `false`.

## 7.3 Fuentes externas

### Biblioteca e historial

| Ruta | Qué hace |
|---|---|
| `GET /api/externo/biblioteca` | Series guardadas (`saved: true`) |
| `GET /api/externo/biblioteca?todo=1` | Guardadas **e** historial. Lo usa el lector |
| `PUT /api/externo/biblioteca` | Guardar, o anotar avance |
| `DELETE /api/externo/biblioteca?source=&id=` | Sacar de la biblioteca |
| `GET /api/externo/historial` | Lo leído y no guardado (`saved: false`) |
| `POST /api/externo/historial` | Anota que se abrió un capítulo |
| `DELETE /api/externo/historial?source=&id=` | Sacar del historial |

El `PUT` de biblioteca tiene **dos comportamientos según venga o no
`title`**, y no es un descuido:

- **con `title`** → guardado a mano: crea o actualiza todo, y marca
  `saved: true`.
- **sin `title`** → aviso de avance a secas: solo toca la página y el
  capítulo de una fila que ya existe. Si no existe, `404`.

Sin esa separación, cada aviso de avance pisaba el título y la portada con
valores vacíos.

### Puentes hacia cada sitio

| Ruta | Fuente |
|---|---|
| `GET /api/externo/tmo?ruta=` | ZonaTMO. Devuelve su JSON tal cual |
| `GET /api/externo/leercapitulo?ruta=` | LeerCapítulo. HTML aligerado |
| `GET /api/externo/leercapitulo?accion=capitulo&ruta=` | Capítulo ya ordenado |
| `GET /api/externo/catharsis?accion=catalogo\|serie\|capitulo` | Catharsis World |
| `GET /api/externo/olympus/...` | Olympus |
| `GET /api/externo/series` · `[id]` · `capitulos/[id]` | MangaDex |
| `GET /api/externo/imagen` | Reintento de una imagen que falló |
| `GET /api/externo/generos` | Géneros de MangaDex |

Todas aceptan `?fresco=1` para saltar la caché: es lo que usa el botón
**Actualizar**.

> Las rutas que devuelven direcciones de un solo uso (ZonaTMO, LeerCapítulo)
> se sirven con `no-store`. Cachearlas entrega imágenes rotas.

## 7.4 Anime y ruleta

| Ruta | Qué hace |
|---|---|
| `GET /api/anime` · `[id]` | Buscar y ver fichas (AniList) |
| `GET/POST/DELETE /api/anime/lista` | Lo que sigue el usuario |
| `GET /api/anime/novedades` | Cuántos episodios le faltan ver |
| `GET /api/aleatorio` | Una serie al azar de cualquier fuente |

`/api/aleatorio` sortea la fuente y después la serie. Si una falla, prueba la
siguiente: la ruleta no se traba nunca. Acepta `?evitar=` para no repetir.

## 7.5 Administración

Todo bajo `/api/admin/*` exige rol admin (lo verifica el middleware).

| Ruta | Qué hace |
|---|---|
| `POST /api/admin/upload` · `/blob` | Subir un `.zip` |
| `GET /api/admin/upload/[jobId]` | Estado de esa subida |
| `GET/PATCH/DELETE /api/admin/users` · `[id]` | Usuarios |
| `POST/PATCH/DELETE /api/announcements` · `[id]` | Noticias |
| `GET /api/estadisticas` | Números del panel |
