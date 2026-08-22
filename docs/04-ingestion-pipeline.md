# 4. Pipeline de ingesta de `.zip`

## 4.1 Contexto

Koharu exporta capítulos como imágenes `.png` numeradas (ej: `0001_pagina.png`,
`0002_pagina.png`, ver documentación de Koharu). Este pipeline toma ese
`.zip` (o una carpeta con esas imágenes comprimida) y lo convierte en un
capítulo navegable dentro de la biblioteca, sin tocar los píxeles
originales.

## 4.2 Diagrama de flujo

```mermaid
flowchart TD
    A[Admin sube .zip en el dashboard] --> B{Validar archivo}
    B -- "no es .zip / vacío" --> Z1[❌ Error: rechazar antes de procesar]
    B -- OK --> C[Crear registro en ingestion_jobs\nstatus = pending]
    C --> D[Extraer a carpeta temporal]
    D --> E{Contiene imágenes válidas?\npng / jpg / webp}
    E -- No --> Z2[❌ status = error\n'El zip no contiene páginas de imagen']
    E -- Sí --> F[Orden natural por nombre de archivo\n0001, 0002, 0003...]
    F --> G[Calcular checksum SHA-256 por página]
    G --> H{Serie ya existe?\npor slug o selección manual}
    H -- No --> I[Crear serie nueva\ntítulo + tipo Normal/+18]
    H -- Sí --> J[Usar serie existente]
    I --> K
    J --> K[Crear capítulo\nnúmero + título]
    K --> L[Mover páginas a\nstorage/{serie}/{capitulo}/NNNN.png]
    L --> M[Generar miniatura de portada\ncon sharp, solo si la serie no tiene]
    M --> N[Insertar filas en tabla pages]
    N --> O[status = success\nfinished_at = ahora]
    O --> P[✅ Capítulo visible en la biblioteca]

    Z1 --> Q[Mostrar error en dashboard]
    Z2 --> Q
```

## 4.3 Reglas de validación

| Regla | Motivo |
|---|---|
| Solo se aceptan `.zip` | formato de exportación de Koharu |
| Extensiones permitidas dentro: `.png`, `.jpg`, `.jpeg`, `.webp` | cualquier otro archivo dentro del zip se ignora (ej: `Thumbs.db`, carpetas `__MACOSX`) |
| Orden natural (`0001` antes que `0002`, no orden alfabético ingenuo que rompería `10` antes que `2`) | preserva el orden real de lectura |
| Checksum SHA-256 por página | detecta si volvés a subir el mismo capítulo dos veces (duplicado) |
| Sin recompresión — copia byte a byte del archivo extraído a `storage/` | cumple el requisito de "sin perder calidad" |
| Tamaño máximo configurable (ej: 500 MB por zip) | evita que un archivo corrupto/gigante cuelgue el proceso |

## 4.4 Detección de serie/capítulo desde el nombre del archivo

Para minimizar el trabajo manual, se sugiere una convención de nombre
opcional al exportar desde Koharu:

```
NombreSerie_Cap01.zip
NombreSerie_Cap01.5.zip
```

Si el nombre matchea el patrón `{serie}_Cap{numero}`, el formulario de
subida se **autocompleta** (serie y número de capítulo) pero siempre
editable antes de confirmar. Si no matchea, el admin completa el
formulario a mano (título de serie existente o nueva, número de capítulo,
sección Normal/+18).

## 4.5 Nota técnica: subidas grandes y el middleware

La ruta `POST /api/admin/upload` está **excluida del matcher del middleware**
(igual que `/api/auth/avatar`). Motivo: cuando una petición pasa por el
middleware de Next.js, el body se corta en 10 MB y cualquier `.zip` más grande
llega truncado (el síntoma era el error "Se esperaba multipart/form-data").
La ruta valida por sí misma que la sesión sea de admin, así que la protección
no se pierde. Con esto funcionan zips de hasta 500 MB (límite configurable en
`MAX_ZIP_BYTES` de `src/lib/ingest.ts`).

## 4.6 Manejo de errores

Todo el pipeline corre dentro de una transacción a nivel de aplicación:

1. Si falla en cualquier paso **después** de mover archivos a `storage/`,
   se revierte (borra los archivos ya copiados) antes de marcar
   `ingestion_jobs.status = error`.
2. El mensaje de error queda visible en el dashboard (tabla de historial
   de subidas), nunca falla en silencio.
3. Los archivos temporales de extracción se limpian siempre, haya éxito o
   error.
