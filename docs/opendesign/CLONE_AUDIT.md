# Clone Audit

- Project: D:\Pagina Web mangastotal\src\components\discover
- Scanned files: 5
- Findings: 6

## 保真度硬伤（字体 / 图片 / 颜色）
- 未发现

## 追踪脚本 / 统计像素
- 未发现

## 原站品牌残留
- 未发现

## 日文残留
- 未发现

## TODO / 占位内容
- AnimeDiscover.tsx:49 · TODO / placeholder content · `todo`
- AnimeDiscover.tsx:223 · TODO / placeholder content · `Todo`
- AnimeDiscover.tsx:256 · TODO / placeholder content · `Todo`
- MediaRail.tsx:6 · TODO / placeholder content · `todo`

## 外部依赖 / 外链风险
- AnimeDiscover.tsx:257 · external URL · `https://jkanime.net/`
- AnimeDiscover.tsx:257 · external URL · `https://tioanime.com/`

## Revisión manual de los seis avisos

- Las cuatro coincidencias `todo` son palabras españolas ("todo", "todos") y
  comentarios explicativos, no marcadores de implementación pendiente.
- Los dos enlaces externos son créditos oficiales de las fuentes. Son
  necesarios, están autorizados y se mantienen con `noopener noreferrer`.
- No hay marcas ficticias, telemetría añadida ni imágenes de muestra en la
  implementación. La analítica preexistente de MangaTotal se conserva.
- La comprobación de navegador confirma Lato autoalojada mediante Next y los
  colores originales, salvo la sustitución de naranja por morado solicitada.
- Las imágenes del producto son datos de las fuentes, no archivos copiados
  del prototipo. No se ejecutó una reescritura de URLs relativas: rompería las
  rutas Next existentes y el usuario pidió conservar el proyecto real.

Resultado: avisos explicados, sin restos que impidan un despliegue de preview.

## Revisión adicional · 10/10/2026

La rama `codex/experiencia-lectura-anime` conserva la fuente autoalojada y el
morado. El pie y el menú global no se renderizan. Se agrega una consulta
opcional de arte a AniList, limitada al título visible y al CDN validado;
no recibe URLs arbitrarias, credenciales ni bibliotecas privadas. Su fallo
conserva la imagen original. No se añade telemetría ni vídeos precargados.

Las entradas Lectura/Anime usan SVG de interfaz, no ilustraciones para
suplantar portadas. Las carátulas y datos de catálogo son reales; las pruebas
aisladas utilizan fixtures que no llegan a producción. Estado y comprobaciones
actualizadas: [plan de la preview](../experiencia/PLAN.md).
