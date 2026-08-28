# 1. Qué es MangaTotal

## 1.1 En una frase

Una biblioteca de manga, manhwa y manhua que junta **el catálogo propio** (lo
que sube el administrador) con **el de seis sitios externos** que dieron
permiso por escrito, todo con el mismo lector y el mismo progreso de lectura.

Vive en **https://manga-total.vercel.app** y se distribuye además como app de
**Windows** y de **Android**.

## 1.2 Cómo llegó a ser esto

El proyecto nació como "Lector Total": una app privada, autoalojada en la PC
del dueño, con SQLite, para leer capítulos propios exportados en `.zip`.

Hoy es otra cosa:

| Antes | Ahora |
|---|---|
| Autoalojado en una PC | Vercel, público |
| SQLite (un archivo) | Postgres en Neon |
| Solo capítulos propios | Propios + seis fuentes externas |
| Solo web | Web + Windows (Tauri) + Android (Capacitor) |

Si encontrás documentación o comentarios que hablen de SQLite, de "tu propia
PC" o de "Lector Total", **están viejos**. La verdad está en el código y en
estos documentos.

## 1.3 Qué hace

- **Biblioteca propia**: el administrador sube capítulos en `.zip` y quedan
  como series navegables.
- **Fuentes externas**: MangaDex, Olympus, ZonaTMO, Ikigai, Catharsis World y
  LeerCapítulo (esta última apagada, ver
  [`08-fuentes-externas.md`](08-fuentes-externas.md)). Se leen dentro de
  MangaTotal, con el mismo lector.
- **Progreso unificado**: en qué capítulo y en qué página vas, sea la serie
  propia o externa.
- **Historial**: las series que abriste a leer y no llegaste a guardar.
- **Anime**: seguimiento de series animadas vía AniList. **No se reproduce
  video**: cada ficha lleva a las plataformas con licencia.
- **Aleatorio**: una ruleta que sortea entre todas las fuentes.

## 1.4 Qué NO hace, a propósito

- **No aloja imágenes de las fuentes externas.** Las portadas y las páginas se
  cargan siempre desde los servidores de cada sitio. MangaTotal solo guarda
  direcciones y progreso.
- **No reproduce anime.** La sección de anime es seguimiento y descubrimiento;
  reproducir sería redistribuir material licenciado que nadie autorizó.
- **No integra fuentes sin permiso.** Las seis integradas dieron permiso por
  escrito. Ese permiso cubre el sitio de cada una, no las traducciones de
  terceros que republiquen.

Esto no es un detalle legal decorativo: es lo que hace que la app se pueda
publicar en Play Store. Agregar reproducción de video o una fuente sin
permiso pone en riesgo la publicación y al dueño del proyecto.

## 1.5 Los tres lugares donde corre

| Dónde | Qué es | Cómo se actualiza |
|---|---|---|
| **Web** | Next.js en Vercel | Cada push a `main` |
| **Windows** | Tauri: una ventana que carga la web, más un puente nativo | Instalador nuevo, avisado desde la app |
| **Android** | Capacitor: un WebView que carga la web, más un puente nativo | APK nuevo, avisado desde la app |

Lo importante: **las dos apps cargan la misma web de Vercel**. Un cambio de
interfaz o de una fuente llega a todo el mundo con un push, sin recompilar
nada. Solo hay que recompilar cuando cambia el **código nativo** (el puente
de las fuentes, el actualizador, los permisos).

Ver [`10-apps-y-publicacion.md`](10-apps-y-publicacion.md).
