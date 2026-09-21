# Biblioteca: actualización persistente y controles

Implementado el 21/09/2026. No se importaron respaldos ni se modificaron cuentas durante QA.

## Icono y paquetes

- El logo original en mobile/recursos se copia a todas las densidades desde scripts/iconos.mjs, llamado por patch.mjs en ambas variantes.
- Incluye iconos clásicos, redondos y adaptativos. Regenerar android/ ya no vuelve a dejar el logo genérico de Capacitor.
- APK local 1.9.9 (22), firma histórica y applicationId verificados por publicar-apk.mjs.
- AAB Play 1.0.2 (3) compilado; queda fuera de Git en playstore/. Debe cargarse en Play Console, declarar el servicio dataSync y completar la revisión de Google. No se publicó en la tienda automáticamente.
- SDK objetivo local 34 / Play 36 conservados. No se cambian claves, permisos de fuentes ni transporte de imágenes.

## Actualizar todo

ActualizacionesBiblioteca vive en el layout raíz, fuera de Biblioteca y de los lectores.
Colas independientes para lectura, anime de fuentes externas y AniList; dos fichas por lote y guardado después de cada resultado.
Solo metadatos: identificadores, números de capítulos, fechas y estados. No se descargan imágenes/vídeos ni se agrega un proxy a Vercel/R2.

- La navegación interna conserva la revisión. Pausar/continuar y reintentar únicamente las fallidas.
- Cada cuenta y variante tiene su propia clave local. Web Locks evita duplicados entre pestañas compatibles; cierre de sesión detiene y limpia la cola.
- Sin conexión no avanza; al recuperar red o volver a la app retoma lo pendiente. Una consulta fallida no borra la última ficha buena.
- Cerrar el proceso no significa seguir ejecutando código: en web/Windows y ante cierre forzado por Android se guarda el punto y se reanuda al volver. Los navegadores pueden suspender pestañas.
- Android mantiene las revisiones explícitas mediante un servicio dataSync con notificación y wake lock parcial acotado. Al terminar, pausar, cerrar la tarea o pasar tres minutos sin progreso, libera el servicio y vuelve al ahorro de batería.
- No se usa un servicio permanente ni se evita el cierre forzado del sistema. El usuario puede pausar desde la biblioteca.
- Si el almacenamiento está lleno, conserva memoria y avisa que no se debe cerrar. No oculta ese fallo.

## Menú de biblioteca

Tres puntos en Lectura y Anime animado: Filtrar / Ordenar / Apariencia.
Filtros combinables de pendientes, empezados, favoritos y series finalizadas.
Orden por título, cantidad publicada, última lectura, comprobación, pendientes, capítulo más reciente, detección de novedades, antigüedad y azar estable.
Vista cómoda, compacta o lista, y títulos opcionales.
Preferencias y estrellas de fuentes externas son locales por cuenta y sección; no modifican ni reemplazan el guardado existente.

Descargados aparece deshabilitado: MangaTotal no descarga capítulos/vídeos.
La fecha de detección no se presenta como una fecha de descarga.
Los estados/cantidades que una fuente no proporciona quedan desconocidos; no se inventa un estado terminado.
Los pendientes de lectura se recalculan contra los números publicados, incluso si hay saltos o decimales.

## Verificación

- TypeScript y next build completos.
- 60 pruebas automatizadas aprobadas y 2 de datos externos opcionales omitidas: cola, fuentes, importación, caché, publicación y API.
- scripts/qa-biblioteca-ui.cjs: Playwright con APIs artificiales, perfiles web, Windows, Android local y Android Play. Verifica menús, preferencias, favoritos, navegación a Explorar, pausa/recarga, dos pestañas, actualización de anime y separación entre cuentas. No inicia sesión en una cuenta real.
- Compilaciones Android assembleDebug y bundleRelease exitosas.
- Icono incluido en el APK comparado píxel a píxel con el original redimensionado; user agents y SHA-256 verificados.
- No hubo dispositivo físico conectado: no se certifica aquí el comportamiento de suspensión de cada fabricante Android. Esa comprobación requiere instalar el APK/AAB en un teléfono.
