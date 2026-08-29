# MangaTotal para escritorio (Windows)

App nativa que muestra MangaTotal en su propia ventana, con ícono en el
escritorio y sin barra del navegador. Pesa unos pocos MB porque usa el
WebView2 que ya trae Windows, no un navegador embebido.

La app carga `https://www.mangatotal.com`, así que **siempre está
actualizada**: cada deploy de la web se ve en el acto, sin reinstalar nada.

## Qué hay que instalar una sola vez

1. **Rust** — https://rustup.rs → descargar `rustup-init.exe` y ejecutarlo
   (opción 1, la predeterminada).
2. **Herramientas de compilación de Microsoft C++** — el propio instalador de
   Rust avisa si faltan. Se bajan desde
   https://visualstudio.microsoft.com/visual-cpp-build-tools/ marcando
   "Desarrollo para el escritorio con C++".

WebView2 ya viene incluido en Windows 11.

Para verificar que quedó todo:

```powershell
rustc --version
cargo --version
```

## Generar el instalador

```powershell
cd "D:\Pagina Web mangastotal\desktop"
npm install
npm run build
```

La primera compilación tarda varios minutos (Rust compila sus dependencias);
las siguientes son mucho más rápidas.

El instalador queda en:

```
desktop\src-tauri\target\release\bundle\nsis\MangaTotal_1.4.0_x64-setup.exe
```

Ese `.exe` es el que se instala y se puede compartir.

## Probar sin generar instalador

```powershell
npm run dev
```

Abre la app directamente para ver cómo queda.

## Notas

- La app necesita internet: la biblioteca, las portadas y el progreso viven
  en el servidor. Sin conexión aparece la pantalla "Sin conexión".
- Para cambiar la versión, editar `version` en `src-tauri/tauri.conf.json`.
- Si algún día se usa un dominio propio, actualizar `build.frontendDist` en
  `src-tauri/tauri.conf.json`.
