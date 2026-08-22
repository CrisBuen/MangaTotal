# 7. Especificación de API

Todas las rutas viven bajo `/api`. Autenticación por cookie de sesión.
Respuestas en JSON.

**Rutas accesibles sin sesión (modo visitante)**: `login`, `register`,
`GET /api/series` (y `:slug`, `:slug/chapters`), `GET /api/announcements`,
`GET /api/images/*`. Un visitante nunca recibe contenido +18. El resto de las
rutas exige sesión (y las de `/api/admin/*`, rol admin).

## 7.1 Auth y perfil

| Método | Ruta | Body | Respuesta | Notas |
|---|---|---|---|---|
| POST | `/api/auth/register` | `{ nickname, password, birthdate }` | `201 { user }` / `409` si el apodo existe | primer usuario creado = `is_admin: true` automáticamente; `show_adult_content` se precarga según edad |
| POST | `/api/auth/login` | `{ nickname, password }` | `200 + cookie` / `401` | |
| POST | `/api/auth/logout` | — | `200` | invalida cookie |
| GET | `/api/auth/me` | — | `200 { id, nickname, is_admin, show_adult_content, preferred_reading_mode, avatar_path, birthdate }` | usado para hidratar sesión en frontend |
| PATCH | `/api/auth/me` | `{ show_adult_content?, preferred_reading_mode? }` | `200 { user }` | preferencias propias |
| POST | `/api/auth/password` | `{ current_password, new_password }` | `200` / `401` si la actual no coincide | nueva ≥ 8 caracteres |
| POST | `/api/auth/avatar` | `multipart/form-data` (`file`) | `200 { avatar_path }` | recorta a 256×256 webp con sharp; máx. 10 MB; **excluida del middleware** (valida sesión por su cuenta) |
| DELETE | `/api/auth/avatar` | — | `204` | quita la foto de perfil |

## 7.2 Series

| Método | Ruta | Query/Body | Respuesta | Notas |
|---|---|---|---|---|
| GET | `/api/series` | `?type=normal\|adult&search=&favorites=true&all=true` | `200 [Series]` | pública; respeta `show_adult_content` (visitante = solo normal); `all=true` es la vista de gestión del admin (ignora el filtro); `favorites=true` sin sesión devuelve `[]` |
| GET | `/api/series/:slug` | — | `200 { Series, chapters: [...] }` | |
| POST | `/api/series` | `{ title, type, description?, status? }` | `201 { Series }` | **solo admin** |
| PATCH | `/api/series/:id` | campos parciales | `200 { Series }` | **solo admin** |
| DELETE | `/api/series/:id` | — | `204` | **solo admin**; borra también carpeta en `storage/` |

## 7.3 Capítulos y páginas

| Método | Ruta | Respuesta | Notas |
|---|---|---|---|
| GET | `/api/series/:slug/chapters` | `200 [Chapter]` | incluye `progress` del usuario actual si existe |
| GET | `/api/chapters/:id/pages` | `200 [Page]` | ordenadas por `page_number` |
| DELETE | `/api/chapters/:id` | `204` | **solo admin** |

## 7.4 Imágenes

| Método | Ruta | Respuesta | Notas |
|---|---|---|---|
| GET | `/api/images/:...path` | stream binario de la imagen | pública dentro de la red (las portadas se ven en la biblioteca de visitante); bloquea path traversal; headers `Cache-Control: private, max-age=31536000, immutable` (el archivo nunca cambia una vez subido; los avatares cambian de nombre de archivo al reemplazarse) |

## 7.5 Progreso y favoritos

| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| PATCH | `/api/progress` | `{ chapterId, pageNumber }` | `200 { ReadingProgress }` |
| GET | `/api/progress/continue` | — | `200 [ { series, chapter, lastPageNumber } ]` — para la sección "Continuar leyendo" |
| POST | `/api/favorites` | `{ seriesId }` | `201` |
| DELETE | `/api/favorites/:seriesId` | — | `204` |

## 7.6 Noticias

| Método | Ruta | Body | Respuesta | Notas |
|---|---|---|---|---|
| GET | `/api/announcements` | — | `200 [Announcement]` | pública; más recientes primero (máx. 30). Alimenta la pestaña "Todo" |
| POST | `/api/announcements` | `{ title, body }` | `201 { announcement }` | **solo admin** |
| PATCH | `/api/announcements/:id` | `{ title?, body? }` | `200 { announcement }` | **solo admin** |
| DELETE | `/api/announcements/:id` | — | `204` | **solo admin** |

## 7.7 Admin — ingesta

| Método | Ruta | Body | Respuesta | Notas |
|---|---|---|---|---|
| POST | `/api/admin/upload` | `multipart/form-data` (`file`, `seriesId?` \| `newSeriesTitle?`, `type?`, `chapterNumber`, `chapterTitle?`) | `202 { jobId }` | procesamiento asíncrono; **excluida del middleware** para permitir zips grandes (ver docs/04 §4.5); valida admin por su cuenta |
| GET | `/api/admin/upload/:jobId` | — | `200 { status, error_message?, chapterId? }` | usado para polling desde el frontend |
| GET | `/api/admin/upload` | `?limit=50` | `200 [IngestionJob]` | historial completo, para la tabla del dashboard |

## 7.8 Admin — usuarios

| Método | Ruta | Body | Respuesta | Notas |
|---|---|---|---|---|
| GET | `/api/admin/users` | — | `200 [User]` | sin `password_hash` en la respuesta |
| PATCH | `/api/admin/users/:id` | `{ is_admin? }` | `200 { User }` | promover/degradar cuentas de confianza; no podés quitarte el rol a vos mismo |
| DELETE | `/api/admin/users/:id` | — | `204` | no podés borrar tu propia cuenta |

## 7.9 Códigos de error comunes

| Código | Significado |
|---|---|
| 400 | Body inválido / campos faltantes |
| 401 | Sin sesión o sesión expirada |
| 403 | Sesión válida pero sin permiso de admin |
| 404 | Recurso no encontrado (serie/capítulo/usuario) |
| 409 | Conflicto (apodo duplicado, capítulo duplicado por checksum) |
| 422 | El `.zip` subido no contiene páginas válidas |
| 500 | Error interno (ver `ingestion_jobs.error_message` para casos de ingesta) |
