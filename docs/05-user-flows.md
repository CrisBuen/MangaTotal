# 5. Flujos de usuario

## 5.0 Visitante (sin cuenta) y pestañas de la biblioteca

Al entrar a la página **no se fuerza el login**: la raíz redirige a
`/biblioteca` y se ve el menú normal. En el menú aparecen los botones
**"Iniciar sesión"** y **"Registrarse"** para quien no tenga cuenta.

| Pestaña | Qué muestra | Visitante | Usuario logueado |
|---|---|---|---|
| **Todo** | Solo **Noticias** (anuncios del admin, cosas por venir). Nunca mangas. | ✅ (más invitación a registrarse) | ✅ |
| **Normal** | Catálogo de series de la sección Normal + fila "Continuar leyendo" de esa sección | ✅ (sin "Continuar leyendo") | ✅ |
| **+18** | Catálogo +18 + su fila "Continuar leyendo" | ❌ (no se muestra) | Solo si `show_adult_content` está activado |
| **★ Favoritos** | Series marcadas con ★ por el usuario | ❌ (pestaña oculta) | ✅ |

El visitante puede abrir la ficha de una serie y ver sus capítulos, pero al
intentar **leer** (`/leer/...`) el middleware lo manda a `/login` — ese es el
momento natural de registrarse. El progreso y los favoritos requieren cuenta.

## 5.1 Registro

Apodo + contraseña + fecha de nacimiento (con selector tipo calendario).
Como la app es privada, la fecha de nacimiento se usa solo como dato
personal/preferencia (por ejemplo, para eventualmente saludar tu
cumpleaños o precargar el filtro `show_adult_content`), **no** como
control de acceso legal.

```mermaid
sequenceDiagram
    participant U as Usuario
    participant F as Frontend (/registro)
    participant A as API /api/auth/register
    participant DB as SQLite

    U->>F: Completa apodo, contraseña, fecha nacimiento
    F->>F: Valida en cliente (campos no vacíos, contraseña >= 8 caracteres)
    F->>A: POST { nickname, password, birthdate }
    A->>DB: SELECT users WHERE nickname = ?
    alt nickname ya existe
        DB-->>A: fila encontrada
        A-->>F: 409 Conflict "apodo en uso"
        F-->>U: Muestra error
    else nickname libre
        A->>A: bcrypt.hash(password)
        A->>DB: INSERT INTO users (...)
        DB-->>A: usuario creado (id)
        A->>A: crea sesión (cookie firmada)
        A-->>F: 201 Created + cookie de sesión
        F-->>U: Redirige a /biblioteca
    end
```

## 5.2 Login

```mermaid
sequenceDiagram
    participant U as Usuario
    participant F as Frontend (/login)
    participant A as API /api/auth/login
    participant DB as SQLite

    U->>F: Apodo + contraseña
    F->>A: POST { nickname, password }
    A->>DB: SELECT * FROM users WHERE nickname = ?
    alt usuario no existe o contraseña incorrecta
        A-->>F: 401 Unauthorized
        F-->>U: "Apodo o contraseña incorrectos"
    else credenciales correctas
        A->>A: bcrypt.compare(password, password_hash)
        A->>A: crea sesión (cookie firmada, expira en 30 días)
        A-->>F: 200 OK + cookie
        F-->>U: Redirige a /biblioteca (o /admin si is_admin)
    end
```

## 5.3 Navegar la biblioteca y leer

```mermaid
sequenceDiagram
    participant U as Usuario
    participant F as Frontend (/biblioteca)
    participant A as API
    participant DB as SQLite
    participant IMG as API /api/images/[...path]

    U->>F: Abre /biblioteca
    F->>A: GET /api/series?type=normal|adult&favoritos=?
    A->>DB: SELECT series WHERE type = ? (según filtro activo del usuario)
    DB-->>A: lista de series + portadas
    A-->>F: JSON series
    F-->>U: Grilla de portadas

    U->>F: Click en una serie
    F->>A: GET /api/series/{slug}/chapters
    A->>DB: SELECT chapters WHERE series_id = ? ORDER BY number
    DB-->>A: lista de capítulos
    A-->>F: JSON capítulos (marca cuál tiene progreso guardado)
    F-->>U: Lista de capítulos + botón "Continuar"

    U->>F: Click en un capítulo
    F->>A: GET /api/chapters/{id}/pages
    A->>DB: SELECT pages WHERE chapter_id = ? ORDER BY page_number
    DB-->>A: lista de páginas (rutas relativas)
    A-->>F: JSON páginas
    F->>IMG: GET cada página según modo de lectura (lazy load)
    IMG-->>F: bytes de imagen (stream directo, sin recomprimir)
    F-->>U: Renderiza en modo Cascada / RTL / Pantalla completa

    loop mientras el usuario avanza páginas
        F->>A: PATCH /api/progress { chapterId, pageNumber }
        A->>DB: UPSERT reading_progress
    end
```

## 5.4 Subida de capítulo (admin)

```mermaid
sequenceDiagram
    participant AD as Admin
    participant F as Frontend (/admin/subir)
    participant A as API /api/admin/upload
    participant ING as Servicio de ingesta
    participant DB as SQLite
    participant FS as storage/

    AD->>F: Selecciona .zip, (opcional) serie/capítulo/sección
    F->>A: POST multipart/form-data
    A->>DB: INSERT ingestion_jobs (status=pending)
    A-->>F: 202 Accepted { jobId }
    F-->>AD: Muestra "Procesando..." con jobId

    A->>ING: procesar(zip, jobId)
    ING->>ING: extraer, validar, ordenar, checksum
    ING->>DB: crear/actualizar series, chapters, pages
    ING->>FS: copiar páginas ordenadas
    ING->>DB: UPDATE ingestion_jobs SET status=success

    loop polling cada 2s
        F->>A: GET /api/admin/upload/{jobId}
        A->>DB: SELECT ingestion_jobs WHERE id = jobId
        DB-->>A: status actual
        A-->>F: JSON { status, error_message? }
    end
    F-->>AD: ✅ "Capítulo publicado" o ❌ error con detalle
```

## 5.5 Diferencia Dashboard (admin) vs Biblioteca (lector)

| | Dashboard (`is_admin = true`) | Biblioteca (cualquier usuario) |
|---|---|---|
| Ruta base | `/admin` | `/biblioteca` |
| Subir capítulos | ✅ | ❌ |
| Crear/editar series | ✅ | ❌ |
| Publicar/editar/borrar noticias | ✅ (`/admin/noticias`) | ❌ (solo las lee en "Todo") |
| Ver historial de ingestas | ✅ | ❌ |
| Gestionar usuarios (crear cuentas de confianza) | ✅ | ❌ |
| Leer, marcar favoritos, progreso | ✅ (también puede leer) | ✅ |
| Filtro Normal / +18 | ✅ | ✅ (según `show_adult_content`) |

## 5.6 Perfil del usuario

En `/perfil` cada usuario puede:

- **Foto de perfil** estilo red social: subir una imagen (se recorta a
  cuadrado 256×256 webp con sharp) o quitarla. Se muestra en el menú superior
  junto al apodo.
- **Cambiar contraseña**: contraseña actual + nueva (mínimo 8 caracteres) +
  repetición.
- **Preferencias**: mostrar contenido +18 (filtro de biblioteca) y modo de
  lectura preferido (cascada/RTL). El modo también se actualiza solo al
  cambiarlo dentro del lector.
