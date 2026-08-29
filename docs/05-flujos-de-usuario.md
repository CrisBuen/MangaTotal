# 5. Flujos de usuario

## 5.1 Quién ve qué

No se fuerza el login: se entra y se mira. La regla general es **catálogos
abiertos, lectura con cuenta**.

| | Visitante | Con cuenta | Admin |
|---|---|---|---|
| Ver catálogos (propio y externos) | ✅ | ✅ | ✅ |
| Ver fichas de series | ✅ | ✅ | ✅ |
| **Leer un capítulo** | ❌ va a `/login` | ✅ | ✅ |
| Guardar en biblioteca, progreso, historial | ❌ | ✅ | ✅ |
| Contenido +18 | ❌ nunca | Según su preferencia | Según su preferencia |
| Subir capítulos, usuarios, noticias | ❌ | ❌ | ✅ |

El +18 se filtra en el servidor, no escondiendo cosas en la interfaz.

## 5.2 Biblioteca

Tres bibliotecas en el mismo lugar, con un selector arriba:

- **Series de lectura** — lo que se lee.
- **AnimeList** — seguimiento informativo de AniList.
- **Anime animado** — series guardadas desde fuentes externas reproducibles.

Dentro de "Series de lectura", las pestañas son **Todo**, **Normal**, **+18**
(solo si la persona lo activó) y **Favoritos**.

Secciones, en orden:

1. **Historial** — las series que abrió a leer y no llegó a guardar. Aparece
   solo si hay algo.
2. **Continuar leyendo** — lo que tiene guardado y empezado.
3. **Categorías** — solo dentro de **Normal** o **+18**, nunca en "Todo".
   Esto es a propósito: en "Todo" quedaban a la vista las categorías del +18,
   que no corresponde. Cada pestaña muestra las suyas.
4. El catálogo.

## 5.3 Historial: cuándo se anota

**Al tocar un capítulo, no al mirar la serie.** Entrar a una ficha y volverse
no deja rastro.

Se anota desde la ficha (`anotarHistorial`), no desde el lector, porque la
ficha ya tiene el título y la portada a mano y no hace falta pedirlos otra
vez.

Cuando después se guarda esa serie, **la fila es la misma**: cambia de lado y
no se pierde por dónde iba ([`03`](03-base-de-datos.md)).

## 5.4 Explorar

Una pestaña por fuente. La de Ikigai aparece **solo en las apps**, porque su
sitio bloquea a los servidores.

Cada pestaña tiene sus propios filtros, su búsqueda y un botón **Actualizar**
que salta la caché para ver lo recién subido.

## 5.5 Aleatorio

Una ruleta. Sortea una fuente, después una serie, y muestra la ficha con
"Ver esta" y "Otra". La portada de la siguiente se precarga mientras se mira
la actual, así en una conexión mala no parpadea.

Si una fuente está caída prueba con la siguiente, así que nunca se traba.

## 5.6 Anime

Viene oculta. La persona la activa en **Ajustes → Seguridad y privacidad**;
recién entonces aparece en las barras y como **Sección animada** en Explorar.

JKAnime es la fuente predeterminada: directorio, filtros, ficha y episodios.
Al tocar un episodio se incrusta su página oficial completa, de modo que
JKAnime sigue controlando el reproductor, Desu y las fuentes alternativas.
MangaTotal no extrae ni guarda enlaces de video.

El botón **Guardar en Anime animado** conserva una referencia a la ficha de
JKAnime. Esa biblioteca está separada de las lecturas y de AnimeList, y usa
`source + externalId` para admitir más proveedores en el futuro.

AniList queda como fuente de información y seguimiento: agregar a Mi lista,
llevar episodios vistos y abrir plataformas oficiales.

## 5.7 Administración

`/admin`: subir capítulos en `.zip`, gestionar usuarios y publicar noticias
(que son lo que se ve en la pestaña Noticias).
