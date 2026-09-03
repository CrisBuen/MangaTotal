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

### Los niveles de SDK también salen de `patch.mjs`

Por el mismo motivo que la versión: `mobile/android/variables.gradle` lo
regenera Capacitor con sus valores por defecto, así que **editarlo a mano no
sirve** — el cambio se pierde en la próxima regeneración y nadie se entera
hasta que Play Console rechaza el paquete.

`patch.mjs` los escribe según la variante:

| | APK local | Google Play |
|---|---|---|
| `targetSdkVersion` | 34 | **36** |
| `compileSdkVersion` | 36 | 36 |
| `minSdkVersion` | 24 | 24 |

**Por qué el local se queda en 34.** Desde API 36 Android obliga al modo
borde a borde y ya no deja desactivarlo: la app dibuja debajo de la barra de
estado siempre. La web está preparada (`viewportFit: "cover"` y
`env(safe-area-inset-*)` en el encabezado, la navegación y los lectores),
pero es un cambio visible que solo necesita la variante de la tienda.

**Por qué `minSdk` subió a 24.** Lo exige Capacitor 8. Deja fuera Android 5.0
y 5.1, en las dos variantes; no hay forma de evitarlo sin quedarse en
Capacitor 6, que no puede compilar contra API 36.

### Compilar el paquete de Google Play

Requisitos de Capacitor 8: **JDK 17**, Android Studio Otter (2025.2.1) o
posterior, y la plataforma **API 36** instalada desde el SDK Manager (con
tener la 34 no alcanza).

```bash
cd mobile
npm install                  # trae Capacitor 8
rm -rf android               # se regenera con las plantillas nuevas
npx cap add android
npm run build:playstore      # aplica la variante play y arma el .aab
```

Al regenerar `android/` se pierde **`local.properties`**, que es de cada
máquina y no se versiona. Sin ese archivo Gradle corta con *SDK location not
found*. Se vuelve a crear con una línea:

```
sdk.dir=C:/Users/<usuario>/AppData/Local/Android/Sdk
```

(Abrir el proyecto una vez en Android Studio también lo genera solo.)

El `.aab` sale en `mobile/android/app/build/outputs/bundle/release/`.

**Probar en un teléfono de verdad antes de subir.** Lo que hay que mirar:
que el encabezado no quede tapado por la barra de estado, que la navegación
de abajo no quede debajo de los botones del sistema, y que el modo pantalla
completa del lector siga entrando y saliendo bien. Compilar sin errores no
prueba nada de eso.

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
