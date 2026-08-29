# 10. Apps de Windows y Android

## 10.1 Lo primero que hay que entender

Las dos apps **no tienen su propia interfaz**. Son una ventana que carga
`https://www.mangatotal.com`, más un puente nativo.

Eso decide cuándo hay que recompilar:

| Cambió… | ¿Recompilar? |
|---|---|
| Interfaz, fuentes, lector, API | **No.** Con el push a `main` alcanza |
| Puente nativo, permisos, actualizador, iconos | **Sí** |

Recompilar cuando no hacía falta no rompe nada, pero obliga a todo el mundo a
actualizar sin motivo.

## 10.2 Windows — Tauri

Vive en `desktop/`. El puente está en `desktop/src-tauri/src/main.rs` y
expone cinco comandos:

| Comando | Qué hace |
|---|---|
| `traer_pagina` | Pide una página desde la conexión de la persona |
| `resolver_desafio` | Abre la ventana con la casilla de Cloudflare |
| `limpiar_verificacion` | Borra el permiso guardado cuando queda trabado |
| `descargar_actualizacion` | Baja el instalador nuevo, con barra de progreso |
| `instalar_actualizacion` | Lo lanza y cierra la app para que se reemplace |

La versión se toca en `desktop/src-tauri/tauri.conf.json`, y después en
`public/descargas/windows-version.json` (subiendo `versionCode`), que es de
donde la app se entera de que hay algo nuevo.

```bash
cd desktop
npm run build
# el instalador sale con la versión en el nombre: MangaTotal_1.3.0_x64-setup.exe
# copiarlo a public/descargas/MangaTotal-windows-setup.exe
```

Windows Defender lo marca como virus por ser un ejecutable nuevo sin
reputación. Es un falso positivo conocido: ver
`WINDOWS-DICE-QUE-ES-UN-VIRUS.txt`.

## 10.3 Android — Capacitor

Vive en `mobile/`. El puente son dos archivos Java:

- `mobile/patches/FuentesPlugin.java` — los mismos comandos que Windows
- `mobile/patches/DesafioActivity.java` — la ventana de la casilla

**`mobile/android/` no se versiona**: Capacitor la regenera entera. Todo lo
nativo vive en `mobile/patches/` y lo copia `npm run patch`. Editar
directamente dentro de `mobile/android/` es trabajo que se pierde.

### La versión se toca en UN solo lugar

`mobile/version.json`. De ahí `npm run patch` la escribe en los tres lugares
que tienen que coincidir:

1. `mobile/android/app/build.gradle` — lo que Android usa para saber si un
   APK es más nuevo
2. `mobile/capacitor.config.json` — `appendUserAgent`
3. `mobile/android/app/src/main/assets/capacitor.config.json` — **la copia
   que viaja dentro del APK**

Si el tercero queda viejo, la app se presenta ante la web con un número que
no es el suyo, y **el aviso de actualización sale para siempre**: avisa de
una versión que ya está instalada. Ya pasó, por compilar sin sincronizar. Por
eso `patch.mjs` escribe también esa copia.

```bash
cd mobile
npx cap sync android
npm run patch
cd android && ./gradlew.bat assembleDebug
# copiar app-debug.apk a public/descargas/MangaTotal-android.apk
# y actualizar public/descargas/android-version.json
```

## 10.4 Las firmas — la parte que hay que leer

Hay **dos claves distintas** y confundirlas rompe las instalaciones de la
gente.

**La de depuración** firma el APK que se reparte desde la web. Se usa a
propósito: mientras no cambie, cada versión se instala encima de la anterior
sin desinstalar nada.

**La de publicación** (`~/.keystores/mangatotal-release.jks`) es para Play
Store. La contraseña está en `mobile/firma.local.json`, que **nunca va al
repositorio** porque es público.

> **Si se pierde esa clave o su contraseña, la app no se puede volver a
> actualizar en Play Store nunca más.** Google no las recupera. Hay que tener
> copia fuera de la máquina.

Comprobar siempre antes de publicar:

```bash
keytool -printcert -jarfile <apk>
```

El APK de la web tiene que salir con la misma huella que el ya publicado. Si
sale distinta, a la gente le va a fallar la actualización con "aplicación no
instalada".

Al publicar en Play Store la firma cambia, así que quien tenga el APK de la
web va a tener que desinstalar primero. La biblioteca y el progreso están en
la cuenta, así que vuelven al entrar.

Todo el detalle en `FIRMA-Y-PLAY-STORE.txt`.

## 10.5 Lo que rompe las apps

- **Editar dentro de `mobile/android/`** en vez de `mobile/patches/`.
- **Subir la versión a mano** en build.gradle en vez de `version.json`.
- **Compilar sin `npm run patch`** después de un `cap sync`.
- **Cambiar la firma del APK de la web** sin avisar.
- **Tocar un puente y no el otro.**
- **Subir la clave o su contraseña al repositorio.**
