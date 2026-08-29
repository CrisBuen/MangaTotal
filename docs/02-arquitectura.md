# 2. Arquitectura

## 2.1 Stack

| Capa | Qué se usa | Por qué |
|---|---|---|
| Web (UI + API) | **Next.js 15**, App Router, TypeScript | Un solo proyecto sirve la interfaz y la API |
| Estilos | **Tailwind CSS** | Todo el diseño vive en las clases; no hay hojas de estilo sueltas |
| Base de datos | **Postgres en Neon**, vía **Prisma 6** | Vercel no tiene disco persistente: SQLite no sirve |
| Sesión | Cookie firmada (`SESSION_SECRET`) + `bcrypt` | Login por apodo y contraseña, sin OAuth |
| Imágenes propias | **Vercel Blob** (o R2, o disco local) | Ver `STORAGE_PROVIDER` en [`09`](09-despliegue-vercel.md) |
| Miniaturas y análisis de imagen | **sharp** | Portadas, y medir bordes de tiras en LeerCapítulo |
| App Windows | **Tauri v2** (Rust) | `desktop/` |
| App Android | **Capacitor 6** | `mobile/` |

## 2.2 Estructura

```
src/
  app/
    (reader)/          páginas con la barra de navegación
      biblioteca/      catálogo propio + guardadas + historial
      explorar/        catálogo de las fuentes externas (una pestaña c/u)
      externo/         fichas de series externas, una carpeta por fuente
      serie/           ficha de una serie propia
      anime/           JKAnime (reproducción oficial) + seguimiento vía AniList
      aleatorio/       la ruleta
      perfil/          cuenta, preferencias y ajustes de fuentes
    (admin)/           subir capítulos, usuarios, noticias
    leer/              lector de capítulos PROPIOS
    leer-externo/      lector de capítulos EXTERNOS, uno por fuente
    api/               todas las rutas de servidor
  components/
    reader/            el lector: cascada, RTL, progreso, volver
    library/           tarjetas, guardado, historial, progreso
    fuentes/           avisos y ajustes de fuentes externas
    ui/                piezas sueltas reutilizables
  lib/                 la lógica: una fuente = un archivo
prisma/                esquema y migraciones
desktop/               app de Windows (Tauri)
mobile/                app de Android (Capacitor)
docs/                  esto
```

## 2.3 La regla que ordena todo: una fuente, un archivo

Cada fuente externa vive en `src/lib/<fuente>.ts` y expone siempre lo mismo:
catálogo, ficha y páginas de un capítulo. Las páginas de `src/app` solo
llaman a esas funciones.

Cuando una fuente cambia su sitio, **se toca un archivo y nada más**. Esa es
la razón de que estén separadas aunque se parezcan.

> **No unificar las páginas de las fuentes.** Se parecen entre sí pero están
> escritas distinto a pedido del dueño. Extraer "un componente común para
> quitar duplicación" va contra una decisión tomada. Está también en
> [`AGENTS.md`](../AGENTS.md).

## 2.4 Los tres caminos para leer una fuente externa

Este es el concepto central del proyecto y conviene entenderlo antes de tocar
nada de `src/lib/`.

Algunos sitios bloquean a los servidores (aceptan a una persona en su casa,
pero no a una IP de centro de datos). Otros piden a Cloudflare que compruebe
que hay una persona. Por eso hay tres caminos, y cada fuente usa el que le
sirve:

```
1. Servidor          navegador → nuestra API → sitio de la fuente
   (lo normal)       Funciona en web, Windows y Android por igual.

2. Puente nativo     navegador → puente de la app → sitio de la fuente
   (si bloquean)     Sale desde la conexión de la persona.
                     Solo Windows y Android. En la web no hay forma.

3. Verificación      se abre una ventana con la casilla de Cloudflare,
   (si la piden)     la resuelve una persona, y el permiso queda guardado
                     para los pedidos siguientes. Solo Windows y Android.
```

Las piezas:

| Archivo | Qué hace |
|---|---|
| `src/lib/fuenteNativa.ts` | Elige el camino. Es el único lugar que sabe si hay puente |
| `desktop/src-tauri/src/main.rs` | Puente de Windows |
| `mobile/patches/FuentesPlugin.java` | Puente de Android |
| `mobile/patches/DesafioActivity.java` | La ventana de la casilla de Cloudflare |
| `src/components/fuentes/AvisoFuente.tsx` | Lo que ve la persona cuando falta verificar |

Los dos puentes tienen **la misma forma a propósito** (mismos nombres de
comandos, mismos avisos), así que la web no distingue una plataforma de la
otra. Si tocás uno, tocá el otro.

Los dos tienen además una **lista de dominios permitidos**. No son
navegadores de uso libre: solo dejan pedir a los sitios de las fuentes
integradas. Al agregar una fuente hay que sumar su dominio **en los dos**.

## 2.5 Decisiones que parecen raras y tienen motivo

**Postgres y no SQLite.** Vercel no guarda archivos entre peticiones. Un
`.db` en disco se pierde. Ver [`09`](09-despliegue-vercel.md).

**Una sola conexión por instancia** (`src/lib/db.ts`). Vercel levanta muchas
instancias y cada una abriría su propio grupo de conexiones. Sin esto,
Postgres se queda sin conexiones justo cuando hay tráfico, con errores
intermitentes. Ese mismo archivo detecta el endpoint agrupado de Neon y le
avisa a Prisma que hay un PgBouncer delante.

**Las imágenes externas se cargan desde el sitio de origen**, nunca se
copian. Es lo que dice el permiso de cada fuente.

**Los comentarios están en español y explican el porqué.** Son el registro de
cosas que costaron mucho averiguar. No borrarlos ni traducirlos.
