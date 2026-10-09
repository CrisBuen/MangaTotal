# Adaptación OpenDesign · verificación

## Resultado y alcance

Adaptación del HTML entregado a las rutas y datos reales de MangaTotal.
Se conserva la composición de descubrimiento y sus movimientos, con el morado
de MangaTotal. No es una captura estática ni un duplicado del catálogo AniList:
vive en Explorar → Sección animada.

| Elemento original | Implementación real | Diferencia deliberada |
| --- | --- | --- |
| Lato 400/700/900 y superficies negras/grises | Fuente autoalojada y tokens globales | Morado autorizado en vez de naranja |
| Destacado con cambio cada 7 segundos | Carrusel con flechas, puntos, pausa y fundidos | Noticias reales en Inicio, series de cada fuente en Explorar |
| Rieles 7.2/4.2 columnas y adaptación hasta 2.3/1.15 | Deslizamiento nativo, flechas, hover 180 ms y carga diferida | Se preservan las columnas elegidas por el usuario en Biblioteca |
| Menú de géneros y secciones | 16 géneros, catálogo completo, emisión, lista y filtros | Solo los ordenamientos realmente soportados por cada fuente |
| Ficha emergente con episodios | Datos de la fuente, guardar, progreso, paginación y reproducción | Atrás cierra; Adelante restaura; sin entradas duplicadas |
| Continuar viendo | Historial real y enlace al reproductor existente | No inventa minutos ni marca episodios como vistos |
| Enlaces de ejemplo y botones de muestra | Destinos reales de noticias, ayuda, perfil, fuentes y biblioteca | No inventa calendario, juegos, doblajes ni suscripciones |

## Evaluación documentada (escala 1–5)

- Evidencia del original: **5**. HTML/CSS/JS completos, skill, tokens y prueba
  de interacciones del original. No contiene GSAP, Lenis ni WebGL.
- Estructura: **4**. Se reproduce la página de descubrimiento dentro de la
  navegación existente; los lectores conservan su estructura especializada.
- Visual: **4**. Tipografía, medidas, densidad, breakpoints y movimientos
  comparados en capturas. El contenido y el acento cambian expresamente;
  no se presenta un porcentaje de igualdad de píxeles.
- Interacción: **4**. Acciones reales verificadas con datos simulados; el
  reproductor además se comprobó con un episodio real.
- Responsividad: **4**. Web, tableta y perfiles nativos en navegador; pendiente
  de aprobación visual en los dispositivos físicos del usuario.
- Funciones: **4**. Reutiliza servicios existentes, conserva filtros y progreso.
  No se probaron todas las combinaciones de cuenta/fuente en producción.
- Sustitución de contenido: **5**. Sin catálogo ficticio, marca de ejemplo o
  botones de muestra dentro de la aplicación publicada.
- Riesgo de despliegue: **4**. Rama y preview aislados; sin migraciones ni claves.
  Dependencias externas y aprobación del usuario siguen siendo necesarias.

## Evidencias y límites

`scripts/qa-opendesign.cjs` conserva capturas y un informe en una carpeta
temporal. Las mutaciones son simuladas. Las pruebas originales de biblioteca,
fuentes, administración y reanudación siguen pasando. La herramienta de la
skill recorrió 14 rutas públicas; todas respondieron 200, incluidas fichas
de manga reales. La auditoría de restos se revisó en `CLONE_AUDIT.md`.

La inspección automática sin sesión registró avisos HTTP 401 de endpoints
privados y 500 de analítica contra la base ficticia; cero excepciones JavaScript.
No se confunden esos avisos con una prueba autenticada de producción. En las
pruebas aisladas con APIs simuladas no hay errores de React ni desbordamientos.

No se modificó la geometría de CascadeReader, la decodificación LeerCapítulo,
la sincronización, los parsers de fuentes ni los puentes de reproducción.
No se borró ninguna serie ni progreso. El nuevo aspecto de las apps instaladas
solo llegará cuando se apruebe y publique en producción; este trabajo entrega
un preview, no una actualización forzada de sus binarios.

### Aprobación posterior del preview

El 9 de octubre el usuario aprobó el resultado y solicitó publicarlo en main
con Mi lista integrada en Explorar, sin la pestaña animada duplicada de
Biblioteca. Los ajustes y la validación adicional se detallan en `NOTES.md`.
La composición del carrusel mantiene sus controles y transiciones, pero una
portada pequeña se muestra sin ampliarla; un fondo horizontal HD válido puede
sustituirla. Esta diferencia evita prometer una resolución que la fuente no
entrega. Guardados, historial y minutos de reproducción no se migran ni borran.
