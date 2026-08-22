# 1. Visión general

## 1.1 Qué es "Lector Total"

Una aplicación web privada, autoalojada en tu propia PC, para leer tu
biblioteca personal de manga/manhwa/manhua/doujinshi traducidos con Koharu
(y cualquier otro cómic en formato imagen). Reemplaza el "arrastrar PNGs a
un visor de imágenes" por una biblioteca organizada, con progreso de
lectura, portadas, y modos de lectura pensados para cómic asiático.

## 1.2 Alcance (importante)

- Corre en `localhost` (o en tu red local si querés leerlo desde el celu/tablet en casa).
- **No** tiene dominio público, **no** tiene certificados SSL de producción, **no** está pensada para exponerse a internet.
- El registro de usuarios es solo para vos (y quien vos decidas dentro de tu casa/red). No hay flujo de "recuperar contraseña por email" porque no hay email — es un sistema cerrado. La contraseña se puede cambiar desde el perfil (sabiendo la actual).
- **Modo visitante**: al entrar sin sesión no se fuerza el login — se ve la
  biblioteca con el menú normal (noticias y catálogo Normal). Registrarse o
  iniciar sesión (botones en el menú) hace falta para **leer**, guardar
  progreso y marcar favoritos. Los visitantes nunca ven la sección +18.

## 1.3 Problema que resuelve

| Problema actual | Solución en Lector Total |
|---|---|
| Los PNG exportados de Koharu quedan sueltos en carpetas | Se importan como capítulos ordenados dentro de una serie |
| No hay forma de "seguir donde quedaste" | Progreso de lectura por usuario y por capítulo |
| Mezclar todo en una sola carpeta gigante | Biblioteca separada en series, con portada y metadatos |
| Doujinshi H mezclado con manga normal | Separación por sección: Normal vs +18 |
| Ver manga en un visor de fotos no está pensado para el formato | Modo cascada, modo RTL, pantalla completa |

## 1.4 Features principales

1. **Login / registro** — apodo + contraseña, fecha de nacimiento (dato
   informativo/preferencia personal, no gate legal ya que la app es privada).
   El primer usuario registrado queda como admin automáticamente.
2. **Dashboard de administrador** (rol `is_admin`) — subir `.zip`, crear/editar
   series, publicar noticias, ver historial de ingestas, gestionar usuarios.
3. **Biblioteca del lector** — pestañas: **Todo** (noticias/anuncios),
   **Normal** y **+18** (catálogos de series con portada y búsqueda; cada uno
   con su propia fila de "Continuar leyendo"), y **★ Favoritos** (solo con
   sesión iniciada).
4. **Noticias** — el admin publica anuncios y novedades desde el dashboard;
   aparecen en la pestaña "Todo" de la biblioteca. Los mangas nunca van a
   "Todo": solo a su catálogo (Normal o +18).
5. **Ingesta automática de `.zip`** — sube el archivo, la app extrae,
   ordena y publica el capítulo sin intervención manual.
6. **Lector de páginas** — 3 modos: cascada, RTL paginado, pantalla completa.
7. **Progreso de lectura** — recuerda la última página leída por serie/usuario.
8. **Perfil** — foto de perfil estilo red social (subir/quitar), cambio de
   contraseña, preferencia +18 y modo de lectura preferido.
9. **Calidad de imagen intacta** — las páginas se sirven tal cual se
   extraen del `.zip`, sin recompresión con pérdida (el único procesado de
   imagen es para miniaturas de portada y avatares).

## 1.5 Fuera de alcance (v1)

- Verificación de edad legal / cumplimiento normativo de plataformas públicas.
- Traducción automática (eso ya lo resuelve Koharu, esta app solo consume el resultado).
- Comentarios, likes públicos, redes sociales.
- Apps móviles nativas (la web responsive alcanza para uso personal).
- Multi-idioma de interfaz (queda en español).
