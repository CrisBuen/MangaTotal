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

Corre sobre **Capacitor 8**, que pide **JDK 17 o posterior** y trae AGP 8.13
y Gradle 8.14.3. Se actualizó desde la 6 para poder apuntar a API 36, que es
lo que exige Google Play; la 6 arrastraba AGP 8.2.1 y el mínimo para el 36 es
8.9.1.

### Dos variantes del mismo código

Se eligen con `--variant` y cambian bastante más que el nombre:

| | APK local | Google Play |
|---|---|---|
| Se arma con | `npm run build:apk` | `npm run build:playstore` |
| Sale | un `.apk` firmado | un `.aab` firmado |
| Se actualiza | sola, descargando el APK | por Google Play |
| `REQUEST_INSTALL_PACKAGES` | lo lleva | **no lo lleva** |
| Contenido +18 | disponible | **bloqueado en el servidor** |
| Panel de administración | disponible | **bloqueado** |

La app se identifica con un marcador en el user agent
(`MangaTotalChannel/local` o `/play`) que escribe `patch.mjs` dentro del
binario. El servidor decide a partir de eso, no de una preferencia que se
pueda cambiar desde JavaScript.

Las dos restricciones de Play no son cosmética: **sacar el interruptor de la
pantalla no alcanza**. `contenidoAdultoPermitido()` en
`src/lib/contentAccess.ts` devuelve `false` para esa variante aunque la
cuenta tenga el +18 activado desde la web, y el middleware corta
`/admin` y `/api/admin`. Si se agrega una ruta que sirva contenido, tiene que
pasar por ese helper y no consultar `showAdultContent` por su cuenta.

El permiso de instalar paquetes queda fuera del manifiesto de Play a
propósito: una app distribuida por la tienda **no puede actualizarse sola**,
y ese permiso además hay que justificarlo en un formulario aparte. El aviso
de actualización también se oculta en esa variante.

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

### Borde a borde: lo que hay que mirar en pantalla

Desde API 36, Android **obliga** al modo borde a borde y ya no deja
desactivarlo: la app dibuja debajo de la barra de estado y de la barra de
gestos siempre. Por eso la variante de Play necesita atención acá y la local,
que sigue en 34, no.

Del lado web ya está resuelto: el layout declara `viewportFit: "cover"` y
el encabezado, la navegación de abajo, los lectores y el reproductor usan
`env(safe-area-inset-*)`. Capacitor 8 es el que le pasa esos valores al
WebView; la 6 no lo hacía, y era otra razón para actualizar.

**El caso que se escapó.** Login y registro no pasan por el layout con
encabezado —el que resuelve las zonas seguras— y su tarjeta va centrada
dentro de un `min-h-screen`. Mientras entra en pantalla se ve bien, pero al
abrirse el teclado el alto disponible se achica, la tarjeta deja de entrar y,
por estar centrada, **se desborda hacia arriba**: el título quedaba tapado por
el reloj. Se corrigió en `AuthCard` con relleno de zona segura. Vale para
cualquier pantalla futura que quede fuera de ese layout.

Compilar no prueba nada de esto. Antes de subir un `.aab` hay que abrirlo en
un teléfono con Android 16 y mirar:

- que el encabezado no quede debajo de la barra de estado;
- que la navegación de abajo no choque con la barra de gestos;
- **login y registro con el teclado abierto**, que fue donde apareció el
  problema;
- que el modo pantalla completa del lector entre y salga bien.

Se puede probar sin desplegar nada y sin pisar la app instalada: se compila
con `applicationIdSuffix` para que convivan las dos, y con
`adb reverse tcp:3000 tcp:3000` el teléfono ve el servidor de la PC. Para eso
hay que apuntar `server.url` al servidor local y permitir `cleartext` en la
copia de `android/`, que es descartable. Los previews de Vercel no sirven:
están detrás de autenticación y el WebView no pasa.

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
- **Tocar los niveles de SDK en `variables.gradle`** en vez de `patch.mjs`:
  se regenera y el cambio se pierde sin avisar.
- **Subir un `.aab` sin abrirlo en un teléfono con Android 16.** El borde a
  borde no se ve al compilar.
- **Servir contenido nuevo sin pasar por `contenidoAdultoPermitido()`**: la
  variante de Play filtra en el servidor, y una ruta que consulte
  `showAdultContent` directo se saltea el filtro.
- **Devolver el permiso `REQUEST_INSTALL_PACKAGES` al manifiesto de Play**, o
  dejar que esa variante se actualice sola. Las dos cosas las prohíbe Google.
- **Compilar sin `npm run patch`** después de un `cap sync`.
- **Cambiar la firma del APK de la web** sin avisar.
- **Tocar un puente y no el otro.**
- **Subir la clave o su contraseña al repositorio.**
