# Documentación de MangaTotal

Para quien llega al proyecto por primera vez — persona o agente.

## Empezá por acá

1. **[`../AGENTS.md`](../AGENTS.md)** — qué **no** tocar y por qué. Es lo
   primero. Este proyecto tiene varias cosas que parecen un error y no lo
   son: casi todas se arreglaron persiguiendo un bug difícil, y "limpiarlas"
   lo trae de vuelta.
2. [`01-overview.md`](01-overview.md) — qué es MangaTotal hoy.
3. [`02-arquitectura.md`](02-arquitectura.md) — las piezas y cómo encajan.

## El resto

| Documento | De qué trata |
|---|---|
| [`01-overview.md`](01-overview.md) | Qué es, para quién, qué hace y qué **no** hace |
| [`02-arquitectura.md`](02-arquitectura.md) | Stack, estructura de carpetas, decisiones y por qué |
| [`03-base-de-datos.md`](03-base-de-datos.md) | Los diez modelos de Prisma y las trampas de cada uno |
| [`04-subida-de-capitulos.md`](04-subida-de-capitulos.md) | Cómo entra un `.zip` propio y se convierte en capítulo |
| [`05-flujos-de-usuario.md`](05-flujos-de-usuario.md) | Visitante, lector, admin: qué ve cada uno |
| [`06-lector.md`](06-lector.md) | Modos de lectura, progreso y el arreglo de las tiras |
| [`07-api.md`](07-api.md) | Todas las rutas, quién puede llamarlas y qué devuelven |
| **[`08-fuentes-externas.md`](08-fuentes-externas.md)** | **Las seis fuentes: cómo se conectó cada una y sus trampas** |
| [`09-despliegue-vercel.md`](09-despliegue-vercel.md) | Vercel, Neon, variables de entorno, qué rompe el deploy |
| [`10-apps-y-publicacion.md`](10-apps-y-publicacion.md) | Windows (Tauri), Android (Capacitor), firmas y Play Store |

## Además, en la raíz del proyecto

Cada fuente externa tiene su propio archivo con el detalle fino: cómo se
averiguó su funcionamiento, qué se probó, y qué hacer el día que cambien
algo. **Leer el que corresponda antes de tocar esa fuente**, porque ahí está
justo lo que no se deduce del código.

- `CAMBIO-DE-DOMINIO-ZONATMO.txt` — y además la receta para recompilar las apps
- `CAMBIO-DE-DOMINIO-IKIGAI.txt`
- `CAMBIO-DE-DOMINIO-OLYMPUS.txt`
- `CAMBIO-DE-DOMINIO-LEERCAPITULO.txt` — su alfabeto propio y cómo se
  deshace el barajado de las páginas
- `CAMBIO-DE-DOMINIO-CATHARSIS.txt`
- `FIRMA-Y-PLAY-STORE.txt` — las dos claves de firma y qué pasa al publicar
- `WINDOWS-DICE-QUE-ES-UN-VIRUS.txt` — el falso positivo de Defender
- `deployment-vercel.md` — notas de despliegue

## Cómo comprobar que no rompiste nada

```bash
npx tsc --noEmit -p tsconfig.json   # tipos
npx next build                      # compilación real
```

No hay suite de tests automatizados. Un cambio en el lector o en una fuente
**se comprueba abriendo un capítulo de verdad**, no solo compilando: casi
todos los bugs de este proyecto compilaban perfecto.
