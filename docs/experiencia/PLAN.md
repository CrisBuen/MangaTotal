# Lectura y anime · preview separado

Rama: `codex/experiencia-lectura-anime`, nacida de `9285ff5` de main.
Autorizado: estabilidad → navegación → diseño, únicamente en preview.
No publicar en main hasta aprobación posterior del usuario.

## Alcance y salvaguardas

1. Cola de biblioteca tolerante a fallos; géneros y primera carga de Ikigai.
2. Entrada con cuenta existente (avatar/nombre), entrada como invitado y elección
   Lectura/Anime. No crear perfiles adicionales ni sustituir autenticación.
3. Dos experiencias con navegación propia y cambio de sección; sin el pie ni
   el menú global duplicados. Corregir títulos móviles e imágenes destacadas.
4. Pruebas por bloque, documentación y preview. Sin migraciones ni borrados;
   conservar fuentes, créditos, identidades, progreso, permisos y canales Android.

## Referencia de diseño

HTML original del proyecto OpenDesign `79120258-4b3d-4b90-99cd-9667d4cac0e3`,
entregado por su dueño. Skill `web-clone`: adaptación de composición y movimiento
al producto existente (L3 visual; cuentas y permisos L6 ya implementados).
Capturas de Crunchyroll: referencia de proporciones móviles, no copia de marca,
suscripciones, gestión de múltiples perfiles o servicios que no existen aquí.
Se mantienen Lato autoalojada, negro/gris y el acento morado de MangaTotal.
Las imágenes deben corresponder a la obra; no se sustituyen por ilustraciones
inventadas ni se promete Full HD a partir de miniaturas.

## Evidencia inicial

- La captura de biblioteca muestra 58/58 finalizado con un error. El ejecutor
  ya captura excepciones, pero cada lote espera a su integrante más lento.
  Se reemplaza esa barrera por dos trabajadores, conservando el límite de red.
- Ikigai: la ficha de «¿Ya Puedo Llorar?» contiene Fantasía, Romance, Drama y
  Familia dentro de su article. El selector global incluía el menú general.
  Su paginador expone tres páginas de capítulos; el recorrido anterior hacía
  consultas sucesivas y una adicional sin resultados antes de mostrar la ficha.

## Estado · 10/10/2026

Implementación y comprobación local completadas; publicada solo en Vercel
Preview. No se considera validada una plataforma física por simular
su navegador. La aprobación visual del dueño y las pruebas en apps instaladas
siguen siendo la condición para proponer el paso a main.

### Estabilidad, 10/10/2026

- Cola con dos trabajadores independientes, pausa/reanudación y resultados
  por serie. Una consulta atascada no frena las otras 59; 50 errores aislados
  no cancelan el lote (regresión automatizada).
- Ikigai: géneros propios, publicación progresiva de ficha y paginación de a
  dos sin perder IDs Long ni capítulos. Actualizar fuerza red y respeta aborto.
- Imágenes: máximo tres descargas, cancelación de pedidos todavía en cola al
  salir de pantalla y caché solo en RAM (24 MiB/32 entradas/90 segundos).
  No se cambia la geometría ni el orden del lector de tiras largas.
- Visor real nuevo: páginas en Qwik JSON, identificadas por capítulo exacto;
  fallback agregado conservando q:key y validación estricta de imágenes.
- Prueba HTTP + DOM Chromium de «¿Ya Puedo Llorar?»: 62 capítulos, cuatro
  géneros reales y 14 páginas en capítulo 1. Además se abrió el lector real
  de Next con el contrato nativo simulado y respuestas públicas reales:
  las primeras tres páginas se decodificaron, incluidas tiras de 16.540 y
  18.000 píxeles de alto, sin solaparse. Primera imagen en 2,9–3,9 segundos
  en la repetición de esta PC/red; no son tiempos garantizados del APK.
- Play clasifica la serie del capítulo exacto en el estado Qwik. Los géneros
  del menú global no convierten una obra apta en adulta; si no hay evidencia
  suficiente se conserva la comprobación restrictiva anterior.

### Navegación y acceso

- `/` muestra la cuenta propia existente (avatar, nombre y cerrar sesión),
  una transición breve y la elección Lectura/Anime. No crea perfiles nuevos.
  Invitados entran directamente al selector, con acceso a login/registro.
- `/lectura` conserva el antiguo inicio y suma descubrimiento de fuentes,
  búsqueda y géneros reales. Anime permanece en `/explorar?seccion=animada`,
  con sus pestañas, Mi lista y continuación existentes.
- Navegación contextual de escritorio y móvil; cambiar de sección no borra
  guardados, historial, preferencias ni minutos. Enlaces antiguos conservados.
- Lectura y anime públicos mediante GET/HEAD; cuenta, guardados, progreso y
  administración siguen protegidos. El reproductor invitado no escribe avance.
  Google Play conserva la activación de anime y sus restricciones existentes:
  el invitado de ese canal debe entrar a una cuenta para activarla.
- Pie duplicado y menú global de categorías retirados del layout. Información,
  perfil, ayuda y demás destinos siguen accesibles mediante Más.

### Diseño y correspondencia con los nueve puntos

| Pedido | Resultado de esta rama |
| --- | --- |
| 1. Título de Inicio en Android | Texto debajo del área de imagen en móvil, sin margen negativo que lo cruzaba |
| 2. Promoción de anime | Imagen grande que cubre el destacado; portada vertical móvil y fondo panorámico válido en escritorio |
| 3. Actualización con errores | Dos trabajadores independientes; cada error queda registrado y el resto continúa hasta terminar |
| 4. Pie redundante | Ya no se renderiza en el layout común |
| 5. Géneros de Ikigai | Se extraen del artículo de la obra, sin etiquetas del menú global |
| 6. Primera carga de Ikigai | Ficha progresiva, paginación acotada, parser Qwik, prioridad de imágenes y caché RAM limitada |
| 7. Referencia móvil | Proporciones y jerarquía adaptadas, sin copiar marca ni funciones inexistentes |
| 8. Categorías globales | Botón retirado; filtros dentro de cada catálogo |
| 9. Dos experiencias | Cuenta → selector → Lectura/Anime; navegación contextual y cambio de sección |

Los destacados buscan arte adicional en AniList solamente para el título
visible. Coincidencia normalizada exacta y única, con alias y temporada;
nunca una coincidencia aproximada ni obras adultas. Solo CDN permitido,
tiempo máximo de seis segundos, caché y retorno a la imagen de la fuente
si falla. El crédito enlaza AniList cuando se utiliza su arte. Fondos menores
de 1280×400, proporción insuficiente o marcadores 1×1 no pasan como panorámicos.
Esto mejora las obras con arte disponible, no inventa resolución ni garantiza
Full HD para todas las fuentes. No se descargan vídeos al explorar.

Se conserva el movimiento del HTML: siete segundos, fundido de 500 ms,
rieles de desplazamiento nativo, hover breve y movimiento reducido. Se usan
los servicios existentes, no los datos ficticios del prototipo. Los rieles de
Lectura consultan MangaDex al acercarse a pantalla; cada fuente mantiene su
adaptador, su propia ficha y los enlaces de atribución.

## Verificación reproducible

- `npx tsc --noEmit -p tsconfig.json`: correcto.
- `npx next build`: correcto; no se ejecutaron migraciones locales.
- `node --test scripts/verificar-experiencia.cjs scripts/verificar-biblioteca.cjs scripts/verificar-mihon-ikigai.cjs scripts/verificar-referencias-lectura.cjs`:
  54 casos, 52 correctos y dos omitidos explícitos (respaldo privado y suite
  opcional de fuentes en vivo). Cero fallos.
- `scripts/verificar-reanudacion-anime.cjs`: once escenarios correctos,
  incluyendo invitado sin GET/PATCH de progreso y reanudación autenticada.
- `scripts/qa-entrada.cjs`: avatar propio, foco, transición, selector, invitado
  y restricción Play; identidad simulada, sin modificar una cuenta real.
- `scripts/qa-opendesign.cjs`: web 1440, tableta 768, Windows 1280, Android
  local y Play 390; cinco perfiles correctos y sin excepciones React.
  Comprueba también Mi lista mediante navegación SPA, portada/fondo, imagen
  1×1 rechazada, título móvil, ausencia de pie y categorías duplicadas.
- `scripts/qa-ikigai-estabilidad.cjs`: fixture de paginación, orden y géneros;
  opción de consulta pública real mediante las variables del propio script.
- `scripts/qa-ikigai-lector-real.cjs`: 14 páginas reales identificadas, tres
  primeras imágenes decodificadas y tiras sin superposición en tres perfiles.
  Usa transporte simulado con descargas reales; no prueba los binarios.
- Consultas locales de servidor: catálogos JKAnime (29 obras), TioAnime
  (20 obras) y arte de One Piece, HTTP 200. Son muestras, no todo el catálogo.

Los scripts de navegador reciben `PLAYWRIGHT_MODULE`, `EDGE_PATH` y `QA_URL`.
Usan los runtimes ya instalados, sin sumar dependencias. Las evidencias van a
directorios temporales `mangatotal-opendesign-*` y `mangatotal-ikigai-real-*`;
no se publican cookies, bases privadas ni capturas de cuentas reales.
El servidor local de QA utilizó una URL de base de datos ficticia/inaccesible;
las mutaciones de interfaz se interceptaron. Ninguna prueba modificó bibliotecas.

### Evidencia de Vercel Preview

- Implementación: `dc03508` (estabilidad) y `ba73852` (experiencias/diseño).
- [Preview verificada de la implementación](https://manga-total-5jdfspta8-nyks-projects-d8d6655c.vercel.app).
- [Alias de la rama para continuar iterando](https://manga-total-git-codex-experiencia-f64db4-nyks-projects-d8d6655c.vercel.app).
- Vercel confirmó `Ready`, entorno `preview`, compilación correcta y ninguna
  migración pendiente. Main y el despliegue de producción no se modificaron.
- GET autenticado únicamente ante la protección de Vercel, sin sesión de
  MangaTotal: `/`, `/lectura` y Explorar animado renderizan correctamente;
  JKAnime devuelve 29 títulos, TioAnime 20 y el arte de One Piece está disponible.
- Fichas reales: JKAnime `one-piece`, HTTP 200; TioAnime `shuiro-no-kamen`
  (slug de su catálogo), HTTP 200. El slug supuesto `one-piece` de TioAnime
  devolvió 404; no se utiliza para construir los enlaces de la app.
- Progreso animado y biblioteca de lectura sin sesión devuelven HTTP 401.
  No se efectuaron mutaciones de cuentas, ni se reprodujeron vídeos/anuncios.
- Se conserva la protección de Vercel: abrir la preview puede pedir iniciar
  sesión en Vercel. No se deshabilitó esa protección para facilitar QA.

## Despliegue, revisión y vuelta atrás

Publicar únicamente `codex/experiencia-lectura-anime`. No hacer merge, push a
main, promoción de preview ni cambios de dominios. El despliegue de Vercel usa
la configuración existente; esta rama no agrega migraciones ni cambios de
esquema, variables, permisos nativos, versiones, claves o dependencias.

Antes de autorizar producción:

1. Revisar la preview con una cuenta propia y como invitado, sin pruebas de
   borrado ni cambio de roles. Comprobar biblioteca/progreso antes y después.
2. Probar el build de prueba en Windows y ambos canales Android: volver a
   abrir, cambiar sección, reproducir/reanudar y leer un capítulo largo.
   No se cambió la URL de los binarios instalados ni se distribuyó un APK/EXE.
3. Confirmar comportamiento de fuentes desde Vercel y desde cada dispositivo;
   la disponibilidad del proveedor y su latencia no dependen solo de la app.
4. Registrar aprobación explícita para main. Si no se aprueba, producción
   sigue intacta; se puede descartar la preview sin revertir datos de usuarios.
