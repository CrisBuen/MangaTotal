# Importación de Mihon y descarga directa de Ikigai

## Importar un respaldo

En Ajustes → Importar desde Mihon, elegir un .tachibk / .proto.gz.
El respaldo se descomprime y lee en un Web Worker del dispositivo. Se muestra
un resumen por fuente y se pide confirmación antes de guardar.

- Compatibles: Ikigai, Olympus por ID numérico, LeerCapítulo con ruta
  /manga/id/slug/ y TMO con ruta /library/tipo/id/slug/.
- No se deduce una fuente desconocida por título. Catharsis usa UUIDs en
  MangaTotal y las extensiones antiguas usan slugs: queda pendiente esa
  correspondencia, igual que LeerCapítulo sin ID.
- Se importa únicamente lo marcado como favorito en Mihon.
- Se recupera el último capítulo y página según el historial; sin historial,
  se usa el capítulo más avanzado marcado como leído o con páginas leídas.
  No es una copia completa de las marcas individuales de capítulos,
  categorías, descargas ni servicios de seguimiento.
- TMO antiguo (view_uploads) puede aportar la serie, pero no un capítulo
  válido para el API actual. La vista previa advierte esa limitación.
- Olympus se vincula por ID con su catálogo actual y se respetan los aliases
  de entradas ya guardadas. Nunca se busca por parecido de título.
- El progreso existente en MangaTotal tiene prioridad. Los reintentos son
  idempotentes gracias a la clave única por usuario/fuente/identificador.
- El usuario elige las fuentes y puede detenerse entre lotes de 25 series.
  No se elimina ninguna entrada.

No subir respaldos reales al repositorio. No se decodifican preferencias,
credenciales, notas privadas ni configuración de extensiones. El servidor
solo recibe los metadatos normalizados que se confirmaron. Límites: 20 MB
comprimidos, 64 MB descomprimidos, 15.000 series, 500.000 registros de
capítulos/historial. El endpoint exige sesión, mismo origen y cuerpos de
hasta 128 KB. No acepta un userId enviado por el cliente.

Formato de referencia:
https://github.com/mihonapp/mihon/tree/main/app/src/main/java/eu/kanade/tachiyomi/data/backup/models

## Ikigai: no hay proxy de imágenes

El nuevo comando traerImagen (Android) / traer_imagen (Windows) descarga
únicamente imágenes HTTPS de image2.ikigaimangas.cloud y
image3.ikigaimangas.cloud. No admite otros dominios, cookies elegidas por
la web, SVG, redirecciones, credenciales en URL ni URLs de proxy.

Cabeceras fijas requeridas, comprobadas con una página pública real:

- Referer: https://visorikigai.gettocaboca.com/
- Sec-Fetch-Mode: cors

La referencia sola recibe un 302 hacia IkigaiAviso.png. La redirección
se rechaza: no debe guardarse ni mostrarse como la página original.
Se valida MIME, firma binaria, límite de 20 MB y tiempo de espera. Hay
como máximo tres descargas simultáneas desde la interfaz, compartidas
cuando se pide la misma imagen. Los Object URLs se liberan al desmontar.

El recorrido es dispositivo → Ikigai → memoria del dispositivo.
No pasa por Vercel ni R2 ni por /api/externo/imagen. Las demás fuentes
conservan su transporte. La lógica de tamaños de CascadeReader no se toca.

Hace falta instalar Android local 1.9.7 (20), Play 1.0.1 (2) o Windows
1.9.0 (10). La web conserva la limitación previa de Ikigai: necesita que
la fuente permita al navegador acceder directamente. No se habilita un
proxy como alternativa ni se modifica la protección de contenido de Play.

## Comprobaciones

- node --test scripts/verificar-mihon-ikigai.cjs
- node --test scripts/verificar-referencias-lectura.cjs scripts/verificar-cache-catalogo.cjs
- node node_modules/typescript/bin/tsc --noEmit --incremental false -p tsconfig.json
- node node_modules/next/dist/bin/next build
- cargo test --manifest-path desktop/src-tauri/Cargo.toml

Para probar un respaldo privado, definir MIHON_BACKUP con su ruta.
Solo se imprimen totales, no títulos ni preferencias. Las pruebas
sintéticas no contienen datos de usuarios.

La prueba Rust imagen_real_por_el_mismo_comando_nativo es optativa
(-- --ignored --nocapture) y toma MANGATOTAL_TEST_IMAGE_URL; puede guardar
una imagen de QA en MANGATOTAL_TEST_IMAGE_OUTPUT. Las rutas se suministran
al ejecutar; nunca se incluyen respaldos ni páginas de manga en Git.

Validación realizada: lectura del respaldo proporcionado; flujo móvil en
Edge headless (390 px), worker y confirmación con todos los POST simulados;
tipos, compilación web y paquetes Android local/Play/Windows; descarga y
revisión visual de una página real a través del comando Rust. Las escrituras
de importación se probaron con una base simulada, no con cuentas reales.
No hubo dispositivo Android conectado para un ensayo instalado.
