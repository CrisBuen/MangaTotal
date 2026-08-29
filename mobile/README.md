# MangaTotal para Android (APK)

App Android que muestra MangaTotal a pantalla completa, con su ícono y
splash propios. Igual que la de Windows, carga el sitio publicado, así que
**se actualiza sola con cada deploy**: no hay que reinstalar el APK salvo
que se cambie el contenedor (nombre, ícono, permisos).

Diseñada para pantallas altas tipo Samsung S26 Ultra: la navegación
principal está en una barra inferior al alcance del pulgar y la interfaz
respeta la cámara y la barra de gestos (`safe-area`).

## Qué hay que instalar una sola vez

1. **Android Studio** — https://developer.android.com/studio
   Durante el asistente inicial dejar marcado:
   - Android SDK
   - Android SDK Platform (API 34 o superior)
   - Android SDK Build-Tools
2. **Java (JDK 21)** — viene incluido con Android Studio; no hace falta
   instalarlo aparte.

Después de instalarlo, abrir Android Studio una vez para que termine de
bajar los componentes.

## Generar el APK

```powershell
cd "D:\Pagina Web mangastotal\mobile"
npm install
npm run add:android      # crea la carpeta android/ (solo la primera vez)
npm run sync
```

Luego generar los íconos y el splash a partir de `recursos/`:

```powershell
npx @capacitor/assets generate --android --assetPath recursos
```

Y compilar:

```powershell
npm run open             # abre el proyecto en Android Studio
```

En Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**.

El APK queda en:

```
mobile\android\app\build\outputs\apk\debug\app-debug.apk
```

Ese archivo se puede instalar directo en el teléfono (hay que permitir
"instalar apps de orígenes desconocidos") o compartir.

## Para publicar en Google Play

Se necesita una clave de firma propia y una cuenta de desarrollador
(pago único de 25 USD). Para uso personal el APK firmado en modo debug
alcanza.

## Notas

- La app necesita internet: biblioteca, portadas y progreso viven en el
  servidor.
- Si algún día se usa un dominio propio, actualizar `server.url` en
  `capacitor.config.json` y volver a compilar.

## Notas de compilación (lo que hubo que resolver)

Dos detalles que hacen fallar el build si no se tienen en cuenta:

**1. El JDK de Android Studio es demasiado nuevo.** Android Studio trae un
JDK 25, y el Gradle 8.2 que usa Capacitor 6 no lo soporta (falla con
`Unsupported class file major version 69`). Por eso se usa un JDK 21
aparte, ya descargado en:

```
C:\Users\CrisPC\.jdks\jdk-21.0.12.1+1
```

**2. `local.properties` necesita barras normales.** En ese formato la barra
invertida es un carácter de escape, así que la ruta del SDK debe escribirse
con `/`. El archivo `mobile/android/local.properties` (no va al repositorio)
debe contener:

```
sdk.dir=C:/Users/CrisPC/AppData/Local/Android/Sdk
```

### Comando de compilación ya probado

```powershell
$env:JAVA_HOME = "$env:USERPROFILE\.jdks\jdk-21.0.12.1+1"
cd "D:\Pagina Web mangastotal\mobile\android"
.\gradlew.bat assembleDebug
```

El APK queda en `app\build\outputs\apk\debug\app-debug.apk` y se copia a
`public\descargas\MangaTotal-android.apk` para publicarlo en el sitio.

**Importante:** las actualizaciones directas instaladas hasta la versión
1.8.1 pertenecen a la cadena firmada con el certificado debug original. Un
APK `release` firmado con la clave de Google Play no puede actualizar esas
instalaciones: Android lo rechaza como “conflicto con un paquete”. Para el
APK descargable del sitio se usa siempre `npm run publicar:apk`, que compila
en debug y comprueba la huella y la versión antes de copiarlo. La compilación
de Play Store queda separada en `npm run build:playstore`.

## Parche del gesto "atrás" (`patches/MainActivity.java`)

Por defecto Capacitor no maneja el historial del WebView, así que el gesto
de atrás de Android **cierra la app** en lugar de volver a la pantalla
anterior. `patches/MainActivity.java` corrige eso.

Como la carpeta `android/` no se versiona, **después de cada
`npm run add:android` hay que volver a copiarlo**:

```powershell
Copy-Item patches\MainActivity.java android\app\src\main\java\app\mangatotal\android\MainActivity.java -Force
```

## Publicar una versión nueva de la app

El aviso de actualización dentro de la app se basa en dos números que
tienen que coincidir:

1. `mobile/capacitor.config.json` → `android.appendUserAgent`
   (`MangaTotalApp/<versionCode>`): así la web sabe qué versión está
   instalada.
2. `mobile/android/app/build.gradle` → `versionCode` y `versionName`.

Pasos:

```powershell
# 1. subir el número en los dos lugares de arriba
cd "D:\Pagina Web mangastotal\mobile"
npx cap sync android

# 2. compilar, comprobar la firma compatible y copiar al sitio
$env:JAVA_HOME = "$env:USERPROFILE\.jdks\jdk-21.0.12.1+1"
npm run publicar:apk
```

3. Editar `public/descargas/android-version.json` con el `versionCode`
   nuevo, el `versionName` y la lista de novedades: eso es lo que se muestra
   en el aviso dentro de la app y en Perfil → Aplicación.
4. Commit y push: el aviso aparece solo en los celulares con una versión
   anterior.
