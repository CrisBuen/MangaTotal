# 6. El lector

Hay dos lectores en rutas distintas, pero comparten los componentes:

- `/leer/[chapterId]` — capítulos **propios**
- `/leer-externo/<fuente>/[id]` — capítulos **externos**, uno por fuente

Los componentes viven en `src/components/reader/`.

## 6.1 Modos de lectura

| Modo | Para qué | Componente |
|---|---|---|
| **Cascada** | Webtoon: scroll vertical continuo | `CascadeReader.tsx` |
| **RTL** | Manga: página por página, de derecha a izquierda | `RtlReader.tsx` |

Se elige en la barra del lector y queda guardado en
`User.preferredReadingMode`, así que no hay que elegirlo cada vez.

## 6.2 El bug de las tiras cortadas — y por qué `CascadeReader` es así

Esta es la parte del proyecto que más veces se va a querer "limpiar". **No
hacerlo.**

El lector le reserva a cada página un hueco antes de que la imagen cargue,
para que el scroll no salte. Cuando la fuente no dice cuánto mide, usaba una
proporción fija de 2:3 — forma de página de manga — y la corregía al cargar,
tocando el estilo a mano.

Eso aguanta con páginas de manga. No con tiras de webtoon: LeerCapítulo
sirve imágenes de **1000 × 14000**. Metidas en un hueco 2:3 se desbordan unas
quince veces su alto y se montan sobre las de abajo. En pantalla se ve como
páginas mal cortadas.

De las seis fuentes, **solo Catharsis informa las medidas reales**. Las otras
cinco pasan cero, así que el problema estaba en todas; en las demás el 2:3 se
acerca lo suficiente como para que no se note.

Cómo está resuelto ahora:

1. El hueco sale de la **medida real que revela cada imagen al cargar**.
2. Esa medida se guarda **en el estado de React**, no escribiendo sobre el
   DOM. Escribirla sobre el DOM se perdía en el siguiente redibujado, que
   ocurre en cada scroll.
3. Las páginas que todavía no cargaron usan de molde **la proporción de la
   primera que sí cargó**. Las páginas de un capítulo se parecen entre sí, no
   cuesta un pedido más y se acomoda solo a cada capítulo.
4. Una imagen que ya venía en la caché **nunca dispara `onLoad`**, así que
   también se mide al montarse.

Los cuatro puntos hacen falta. Sacar cualquiera trae el bug de vuelta, y
**no salta en una prueba rápida**: solo en capítulos largos de webtoon.

## 6.3 Progreso

- Propio → `ReadingProgress`.
- Externo → los campos `lastChapter*` y `lastPageNumber` de `ExternalSeries`.

Lo maneja `useProgresoExterno.ts`, con dos cuidados:

**Al abrir un capítulo se reafirma la página de entrada, no la 1.** Si no,
abrir y salir borraba por dónde ibas.

**El avance dentro del capítulo se manda con pausa** (1,5 s), no en cada
imagen que pasa.

En la ficha, el capítulo actual queda marcado y los anteriores se ven
apagados (`useProgresoSerie.ts`).

## 6.4 Volver

`BotonVolver.tsx`. Vuelve a **la pantalla anterior de verdad**: si entraste
desde la biblioteca, vuelve a la biblioteca; si entraste desde la ficha,
vuelve a la ficha. Solo cuando no hay nada atrás —un enlace abierto
directo— va a la ficha.

Antes siempre iba a la ficha, y volver desde la biblioteca te sacaba del
lugar donde estabas.

## 6.5 Cuando una fuente falla

`AvisoFuente.tsx` distingue dos cosas que se parecen:

- **El sitio pide comprobar que hay una persona** → botón para abrir la
  casilla de Cloudflare, y reintenta solo. En la web, donde no se puede,
  explica que hace falta la app.
- **Cualquier otro problema** → el mensaje y un reintento.

Vive en un solo lugar para que las fuentes que se agreguen después lo hereden
sin tener que acordarse.

## 6.6 Antes de dar por bueno un cambio en el lector

**Abrir un capítulo de verdad**, y que sea largo y de webtoon. Todos los bugs
de esta parte compilaban perfecto y pasaban el chequeo de tipos.
