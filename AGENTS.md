# MangaTotal — antes de tocar nada

Biblioteca de manga en Next.js 15 + Prisma, que además se distribuye como app
de Windows (Tauri, en `desktop/`) y de Android (Capacitor, en `mobile/`).

Este archivo existe porque el proyecto tiene **varias cosas que parecen un
error y no lo son**. Casi todas se arreglaron después de perseguir un bug
difícil, y "limpiarlas" lo trae de vuelta.

---

## Nunca subir al repositorio

El repo es **público**. Estos archivos están en `.gitignore` y ahí se quedan:

- `mobile/firma.local.json` — contraseña de la clave de firma de Android
- `*.jks`, `*.keystore` — claves de firma
- `mobile/android/keystore.properties` — lo genera `patch.mjs`
- `/playstore/` — artefactos firmados

Si alguno termina en un commit, la clave de publicación queda quemada y hay
que regenerarla. **No editar `.gitignore` para meter estos archivos.**

---

## Lo que parece un error y no hay que "arreglar"

### `src/components/reader/CascadeReader.tsx`
La lógica de `aspectRatio` parece enredada y con estado de más. Es el arreglo
de las tiras de webtoon: LeerCapítulo sirve imágenes de 1000x14000, y con un
hueco de proporción fija se desbordan y se pisan entre sí. Se ve como páginas
mal cortadas y no salta en pruebas rápidas, solo en capítulos largos.
**Simplificarlo reintroduce el bug.**

### `LC_HABILITADA` en `src/lib/leercapitulo.ts`
Parece una bandera olvidada. Es el interruptor de la fuente: hoy está en
`true`, y ponerlo en `false` la oculta de Explorar sin tocar nada más. Es la
salida rápida si LeerCapítulo vuelve a romperse.

### `paginasDelHtml()` en `src/lib/leercapituloCodigo.ts`
Recorre **todos** los `<meta>` buscando el que produzca una permutación
válida, en vez de ir directo al que hoy trae la clave. No es rebusque: ese
nombre está disfrazado a propósito y va a cambiar.

Y si ninguno sirve, **lanza un error en vez de devolver el orden crudo**. Es
deliberado: un capítulo desordenado se lee como que la app entera está rota,
mientras que un error se ve y se arregla.

La clave y las direcciones **tienen que salir de la misma respuesta**.
Cambian juntas en cada pedido: pedir el capítulo dos veces mezcla dos
barajados y da un resultado que parece bueno y no lo es.

### `src/lib/leercapituloOrden.ts`
Parece código muerto y ya no se usa, pero **no lo borres**. Es el camino
viejo —reconstruir el orden descargando todas las imágenes y comparando
bordes— y queda como registro de por qué se buscó donde se buscó antes de
encontrar el `<meta>`.

### Las páginas de cada fuente (`src/app/(reader)/externo/*`)
Se parecen entre sí pero están escritas distinto **a pedido del dueño del
proyecto**. No unificarlas ni extraer un componente común "para quitar
duplicación": esa variedad es intencional.

### Los comentarios en español
Explican **por qué**, no qué. Son el registro de cosas que costó averiguar
(alfabetos reconstruidos, APIs sin documentar, trampas de cada sitio). No
borrarlos ni traducirlos.

---

## La versión de Android se toca en un solo lugar

`mobile/version.json`. De ahí, `npm run patch` la escribe en:

- `mobile/android/app/build.gradle`
- `mobile/capacitor.config.json` (`appendUserAgent`)
- `mobile/android/app/src/main/assets/capacitor.config.json`

Los tres tienen que coincidir. Si no, la app se presenta con un número que no
es el suyo y **el aviso de actualización queda saliendo para siempre**. Ya
pasó una vez, por compilar sin sincronizar.

Lo mismo vale para los **niveles de SDK**: los escribe `patch.mjs` en
`variables.gradle` según la variante, y son distintos a propósito —
`targetSdk` 36 en el paquete de Google Play (lo exige desde el 31/08/2026) y
34 en el APK local, porque desde 36 Android obliga al modo borde a borde y
esa variante no necesita ese cambio. **Editar `variables.gradle` a mano no
sirve**: se regenera y el cambio se pierde en silencio.

`mobile/android/` no se versiona: Capacitor la regenera. Los cambios nativos
viven en `mobile/patches/` y los copia `npm run patch`.

---

## Fuentes externas

Cada una tiene su archivo `CAMBIO-DE-DOMINIO-*.txt` en la raíz, con cómo
funciona, qué se probó y qué hacer si cambia. **Leer el que corresponda antes
de tocar una fuente.** Ahí está lo que no se deduce del código.

Todas están integradas con permiso por escrito de cada sitio. No sacar sus
nombres ni los enlaces a sus páginas.

---

## Comprobar antes de dar algo por hecho

```bash
npx tsc --noEmit -p tsconfig.json   # tipos
npx next build                       # compilación real
```

No hay suite de tests. Un cambio en el lector o en una fuente **se comprueba
abriendo un capítulo de verdad**, no solo compilando.

---

## Cómo trabajar acá

- Rama aparte, nunca directo sobre `main`.
- Cambios acotados a lo que se pidió. Nada de rediseños ni reformateos
  masivos: ensucian el diff y esconden lo que de verdad cambió.
- Los comentarios y los mensajes de commit, en español, explicando el porqué.
- Si algo parece mal diseñado, preguntá antes de cambiarlo. Suele haber un
  motivo escrito en algún `.txt` de la raíz.
