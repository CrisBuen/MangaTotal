# MangaTotal · adaptación integral de OpenDesign

## Referencia y alcance

HTML del usuario: `descubrir-streaming.html`, proyecto OpenDesign
`79120258-4b3d-4b90-99cd-9667d4cac0e3`. Se conserva intacto fuera del repositorio.
Skill aplicada: `web-clone`, junto a `brand-spec.md` y lectura del código real.
Adaptación autorizada por el usuario: marca MangaTotal, naranja → morado.

Complejidad: L3 de presentación, con integración L6 ya existente (cuentas y permisos).
Modo: adaptación fiel de composición y comportamiento al producto real.
No se clonan ni reemplazan autenticación, base de datos, parsers o puentes.
La referencia tiene catálogo ficticio y enlaces vacíos; no se copiarán como
funciones reales ni se inventarán datos, calendarios, doblajes o tendencias.

## Plan y límites

1. Rama `codex/opendesign-integral` desde producción. Nunca publicar en main.
2. Tipografía Lato autoalojada, tokens originales, navegación y superficies.
3. Carrusel, rieles, géneros y ficha emergente con APIs existentes.
4. Conservar biblioteca, filtros, roles, actualizaciones, fuentes y reproducción.
5. Comprobar web 1440, tableta 768, móvil 390, UA de Tauri y ambos canales Android.
6. Compilar y publicar únicamente un preview. No cambiar las URLs de las apps
   instaladas ni las claves/versiones de Android.

## Evidencia del HTML

- Líneas 12–46: tokens, 7.2 carátulas/4.2 miniaturas, breakpoints hasta 2.3/1.15.
- 105–164: héroe, fundido 500 ms, texto 180/340 ms, CTA, puntos y flechas.
- 166–245: rieles, hover 1.035, metadatos y progreso.
- 247–266: ficha modal y episodios.
- 558–610: géneros, composición de rieles y rotación de 7 segundos.
- 725–785: ficha original, botones de reproducción y enlaces sin backend.

## Salvaguardas

No migraciones de datos, no borrado de bibliotecas, no modificación de fuentes
ni de los tamaños del lector. No precargar vídeos. Catálogos paginados y rieles
diferidos para no pedir todas las fuentes/géneros al abrir la página. Mantener
preferencias +18, exclusiones de Google Play y activación de anime en Android.

## Comprobaciones

- `npx tsc --noEmit -p tsconfig.json` y `npx next build`: correctos.
- 23 comprobaciones de biblioteca, cola de actualización, favoritos, JKAnime y
  recuperación administrativa: correctas, sin cuentas reales.
- Interfaz en 1440/768/1280/390 px, perfil Windows y Android local/Play:
  navegación, modal, guardar, géneros, búsqueda, paginación persistente,
  cambio de fuente, error/reintento y movimiento reducido.
- Una sola consulta de catálogo inicial por perfil; los demás rieles esperan
  a estar cerca de la pantalla. No se descargan reproductores al ver portadas.
- Auditoría independiente: se corrigieron ancho del modal móvil, historial
  Atrás/Adelante, búsqueda residual al cambiar fuente y permisos Play.
- Reanudación del reproductor: diez escenarios simulados y un episodio real
  de JKAnime desde 12:00. El guardado se intercepta, sin cuenta real.
- `qa-biblioteca-ui.cjs`: cuatro perfiles, favoritos, orden, actualización,
  pausa y reanudación; ninguna escritura real.
- `route-crawl.mjs`: 14 rutas públicas y fichas, todas HTTP 200. Las rutas que
  requieren cuenta conservan su redirección a Login; esto no prueba su contenido
  autenticado en producción.

Las pruebas de perfiles nativos emulan viewport y agente de usuario en Edge.
No se recompilaron APK/EXE ni se probaron dispositivos físicos. El preview no
sustituye la producción instalada. La disponibilidad y velocidad de cada
fuente sigue dependiendo de su servidor; no se promete un tiempo fijo de carga.

## Mapa de implementación

- Tema y breakpoints: `src/app/opendesign.css`.
- Fuente Lato autoalojada: `src/app/layout.tsx` con `next/font`.
- Carrusel y rieles: `src/components/discover/HeroCarousel.tsx` y `MediaRail.tsx`.
- Géneros, menús y pie: `DiscoverMenu.tsx` y `AppFooter.tsx`.
- Catálogo animado y ficha: `AnimeDiscover.tsx`, usando las APIs existentes.
- Directorios completos: `JkanimeCatalog.tsx` y `TioanimeCatalog.tsx`.
- Inicio: `HomeExperience.tsx` y `TopSemanal.tsx`.
- Biblioteca, administración, formularios y otras páginas reciben los tokens
  compartidos; se conservan sus componentes y sus reglas específicas.

## Repetir QA

Compilar y levantar Next en un puerto local. Ejecutar
`node scripts/qa-opendesign.cjs` con `QA_URL`, `PLAYWRIGHT_MODULE` y `EDGE_PATH`
según el entorno; `OD_REFERENCE` apunta al HTML original. Reutilizar el runtime
de Playwright y Edge ya instalados, sin agregar dependencias al proyecto.
El script crea evidencias temporales y devuelve la ruta de `report.json`.
Los SVG del original se usan solo como datos de prueba: no llegan al producto.

## Autoría y despliegue

Referencia entregada por el dueño para esta adaptación; no se incorpora la
marca ficticia ni se redistribuye su HTML o skill. La fuente conserva sus
créditos y el proyecto conserva su licencia. No hay cambios de dependencia,
base de datos, claves ni configuración de producción.
Publicación autorizada: rama `codex/opendesign-integral` y preview de Vercel.
