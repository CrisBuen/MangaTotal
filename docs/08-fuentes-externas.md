# 8. Fuentes externas

El corazón del proyecto y la parte que más fácil se rompe. Leer esto entero
antes de tocar cualquier cosa bajo `src/lib/<fuente>.ts`,
`src/app/(reader)/externo/` o `src/app/leer-externo/`.

## 8.1 Lo primero: el permiso

**Las seis fuentes están integradas con permiso por escrito de cada sitio.**
Eso es lo que hace legítimo el proyecto y lo que permite publicarlo en Play
Store.

De ahí salen tres reglas que no se negocian:

1. **No sacar el nombre de la fuente ni el enlace a su sitio.** Aparecen en
   cada ficha y en cada capítulo, a propósito.
2. **No alojar sus imágenes.** Portadas y páginas se cargan siempre desde sus
   servidores. MangaTotal guarda direcciones y progreso, nunca archivos.
3. **No agregar una fuente sin permiso.** Aunque sea fácil técnicamente.

El permiso cubre el sitio de cada uno, no las traducciones de terceros que
republiquen.

## 8.2 Las seis

| Fuente | Dominio | Cómo se lee | Estado |
|---|---|---|---|
| **MangaDex** | `api.mangadex.org` | API pública, desde el servidor | ✅ |
| **Olympus** | `olympusxyz.com` | API propia, desde el servidor | ✅ |
| **ZonaTMO** | `zonatmo.net` | API interna, desde el servidor | ✅ |
| **Ikigai** | `visorikigai.gettocaboca.com` | **Puente nativo**: bloquea servidores | ✅ solo apps |
| **Catharsis World** | `newcatharsis.dig-it.info` | Su almacén Directus, desde el servidor | ✅ |
| **LeerCapítulo** | `www.leercapitulo.co` | HTML + código propio | ⛔ **apagada** |

## 8.3 El contrato: qué expone cada fuente

Todas las fuentes tienen la misma forma, y las páginas de `src/app` solo
llaman a estas funciones:

```
catalogo<Fuente>(...)   → lista paginada, con filtros y búsqueda
serie<Fuente>(id)       → ficha: título, portada, lista COMPLETA de capítulos
paginas<Fuente>(id)     → las páginas de un capítulo, en orden
```

**Los capítulos nunca se recortan.** Hubo un límite de 40 y se quitó a
pedido: una serie de 3.000 capítulos los muestra todos.

## 8.4 Los tres caminos, y por qué existen

Está resumido en [`02-arquitectura.md`](02-arquitectura.md#24-los-tres-caminos-para-leer-una-fuente-externa).
Lo esencial:

- **Camino 1, servidor.** Lo normal. Nuestra API pide al sitio y devuelve.
  Funciona igual en web, Windows y Android.
- **Camino 2, puente nativo.** Para sitios que rechazan a las IPs de centros
  de datos pero aceptan a una persona en su casa. El pedido sale desde el
  dispositivo. **En la web no hay forma**, y eso no es un bug: un sitio no
  puede leer otro sitio desde el navegador.
- **Camino 3, verificación.** Para sitios detrás de la casilla de Cloudflare.
  Se abre una ventana, la persona toca la casilla, y el permiso queda
  guardado. Solo apps.

`src/lib/fuenteNativa.ts` es el único archivo que decide el camino. Si una
fuente falla en la web pero anda en la app, casi siempre es esto y **está
bien así**.

## 8.5 Fuente por fuente

### MangaDex
API pública y documentada. Sin sorpresas. Es la única con contenido en varios
idiomas y con varias versiones del mismo capítulo (distintos grupos), por eso
su ficha muestra un selector de versiones.

### Olympus Scanlation
API propia en `panel.olympusxyz.com`. Directa.

### ZonaTMO
API interna que se dedujo de su bundle. Dos trampas conocidas:

- **Todo viene envuelto en `data`.** La respuesta es
  `{error, message, data: {items, pagination}}`. Leer `items` del primer
  nivel devuelve vacío y parece que el sitio está caído.
- **`score` llega como texto** (`"8.50"`), no como número. Llamarle
  `.toFixed()` directo tiraba toda la ficha. Lo resuelve `puntaje()`.
- Los identificadores de tipo no siguen ningún orden: 87 es Manhwa, 31 es
  Manhua. Usar la tabla `TMO_TIPOS`, no inventarlos.

Detalle completo en `CAMBIO-DE-DOMINIO-ZONATMO.txt`.

### Ikigai Mangas
Bloquea a los servidores. **Solo funciona en las apps**, por el puente
nativo. En la web la pestaña ni siquiera aparece.

### Catharsis World
La más interesante. Su web es imposible de leer con un programa: Cloudflare
responde 403 a todo, y su lector dibuja las páginas en un `<canvas>`, así que
en el documento no queda ninguna dirección de imagen.

Pero guardan todo en un **Directus** que sí contesta a cualquiera, con las
series, capítulos y páginas en carpetas:

```
"Mangas" ── carpeta por serie ── carpeta por capítulo ── un archivo por página
```

El título de cada archivo dice a qué pertenece. Por eso Catharsis funciona
también en la web, sin verificación de por medio.

Dos cosas que hay que respetar:

- **Las páginas llegan desordenadas.** Se ordenan por el número que traen en
  el título (`Tira 7`). Nunca confiar en el orden en que vienen.
- **Su almacén sabe redimensionar**: `?width=320&quality=72&format=webp`. El
  catálogo pide portadas chicas (35 KB en vez de 85). Eso está puesto para
  que ande en una conexión mala; no quitarlo.

Detalle en `CAMBIO-DE-DOMINIO-CATHARSIS.txt`.

### LeerCapítulo — **apagada, y hay que dejarla apagada**

Interruptor: `LC_HABILITADA` en `src/lib/leercapitulo.ts`.

Su servidor entrega las páginas de cada capítulo **en orden aleatorio, y un
orden distinto en cada carga**. Encenderla hoy muestra capítulos ilegibles en
la mayoría de las series.

Lo que ya está resuelto y no hay que rehacer:

- El `array_data` de sus capítulos es base64 con **un alfabeto propio**,
  reconstruido y guardado en `src/lib/leercapituloCodigo.ts`. Funciona.
- El número de página está en los dos primeros caracteres del nombre del
  archivo, cifrado con una sustitución distinta por URL. Se sabe descifrar
  parcialmente (`src/lib/leercapituloOrden.ts`).

Lo que falta está escrito en `CAMBIO-DE-DOMINIO-LEERCAPITULO.txt`, con lo
medido para no repetirlo. **`leercapituloOrden.ts` parece código muerto y no
lo es**: es trabajo a medio terminar, dejado a propósito.

## 8.6 Agregar una fuente nueva: la lista

1. **Confirmar el permiso por escrito.** Sin eso no se sigue.
2. `src/lib/<fuente>.ts` con `catalogo`, `serie` y `paginas`.
3. Si necesita puente nativo, sumar su dominio **en los dos**:
   - `desktop/src-tauri/src/main.rs` → `PERMITIDOS`
   - `mobile/patches/FuentesPlugin.java` → `PERMITIDOS`
4. Sumar la fuente a estas listas de tipos, o TypeScript avisa:
   - `src/lib/externas.ts` → `FUENTES_EXTERNAS`, `fichaHref`, `capituloHref`
   - `src/components/reader/useProgresoExterno.ts`
   - `src/components/library/SaveExternalButton.tsx`
   - `src/components/reader/OlympusReader.tsx`
5. Páginas: `src/app/(reader)/externo/<fuente>/` y
   `src/app/leer-externo/<fuente>/`.
6. Pestaña en `src/app/(reader)/explorar/page.tsx`.
7. Si el catálogo va por nuestra API, abrirla en `src/middleware.ts`
   (`PUBLIC_PREFIXES`) para que los visitantes puedan mirar sin cuenta.
8. En la ficha, `anotarHistorial(...)` en el clic de cada capítulo.
9. Escribir `CAMBIO-DE-DOMINIO-<FUENTE>.txt` con lo que costó averiguar.

El paso 4 es el que más se olvida: la fuente anda pero no se puede guardar ni
retomar la lectura.

## 8.7 Lo que rompe las fuentes

- **Unificar las páginas de las fuentes en un componente común.** Se parecen
  a propósito distinto. Está pedido explícitamente.
- **Quitar el límite de reintentos o los avisos de `AvisoFuente`.** Es lo que
  convierte "error raro" en "tocá acá para verificar".
- **Cachear respuestas que traen direcciones firmadas.** ZonaTMO y
  LeerCapítulo dan URLs de un solo uso: cachearlas sirve imágenes rotas.
- **Tocar un puente nativo sin tocar el otro.** Quedan distintos y un bug
  aparece solo en una plataforma.
- **Suponer que lo que anda en la web anda en la app**, o al revés. Son tres
  caminos distintos. Probar donde corresponde.
