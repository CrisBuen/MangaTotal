package app.mangatotal.android;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.core.content.FileProvider;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.security.MessageDigest;

/**
 * Cuatro cosas que Capacitor no resuelve por su cuenta:
 *
 * 1. El gesto de "atrás" cerraba la app en vez de volver atrás, porque el
 *    historial del WebView no se maneja solo.
 * 2. El WebView ignora las descargas: al tocar una actualización no pasaba
 *    nada.
 * 3. La actualización se baja e instala sin salir de la app: se descarga
 *    con el gestor del sistema y se abre el instalador encima, en vez de
 *    mandar a la persona al navegador.
 * 4. Las fuentes que bloquean a los servidores se piden desde el teléfono,
 *    con el puente de FuentesPlugin.
 */
public class MainActivity extends BridgeActivity {

    private static final String APK_NAME = "MangaTotal-update.apk";
    private static final String APK_MIME = "application/vnd.android.package-archive";
    private static final String APK_URL =
        "https://www.mangatotal.com/descargas/MangaTotal-android.apk";
    private static final String FIRMA_ACTUALIZACIONES =
        "c3f172c18a928831b3d7bbc00343793ec6dae1e44eeb90fab331ef178506700f";

    private long descargaId = -1;
    private BroadcastReceiver receptorDescarga;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // el puente de fuentes tiene que existir antes de que arranque la web
        registerPlugin(FuentesPlugin.class);
        registerPlugin(PantallaPlugin.class);
        super.onCreate(savedInstanceState);

        WebView webView = this.bridge != null ? this.bridge.getWebView() : null;
        if (webView == null) {
            return;
        }

        webView.setDownloadListener(
            (url, userAgent, contentDisposition, mimeType, contentLength) -> descargarActualizacion(url)
        );

        receptorDescarga = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                if (id == descargaId) {
                    if (descargaTerminadaCorrectamente(id)) {
                        instalarActualizacion();
                    } else {
                        avisar("No se pudo descargar la actualización");
                    }
                }
            }
        };

        IntentFilter filtro = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(receptorDescarga, filtro, Context.RECEIVER_EXPORTED);
        } else {
            registerReceiver(receptorDescarga, filtro);
        }
    }

    /** Descarga el APK con el gestor del sistema, mostrando el progreso. */
    private void descargarActualizacion(String url) {
        if (!esUrlActualizacion(url)) {
            avisar("Se bloqueó una descarga que no pertenece a MangaTotal");
            return;
        }

        File destino = new File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), APK_NAME);
        if (destino.exists()) {
            destino.delete();
        }

        // No se usa la dirección que eligió JavaScript: el binario permitido
        // vive en una ruta fija de nuestro dominio.
        DownloadManager.Request pedido = new DownloadManager.Request(Uri.parse(APK_URL));
        pedido.setTitle("MangaTotal");
        pedido.setDescription("Descargando la actualización…");
        pedido.setMimeType(APK_MIME);
        pedido.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
        pedido.setDestinationInExternalFilesDir(this, Environment.DIRECTORY_DOWNLOADS, APK_NAME);

        DownloadManager gestor = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
        if (gestor != null) {
            descargaId = gestor.enqueue(pedido);
        }
    }

    /** Abre el instalador de Android encima de la app, sin salir de ella. */
    private void instalarActualizacion() {
        File apk = new File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), APK_NAME);
        if (!apk.exists()) {
            return;
        }

        if (!apkValido(apk)) {
            apk.delete();
            avisar("La actualización descargada no es una versión válida de MangaTotal");
            return;
        }

        Uri uri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", apk);

        Intent instalar = new Intent(Intent.ACTION_VIEW);
        instalar.setDataAndType(uri, APK_MIME);
        instalar.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        instalar.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(instalar);
    }

    private boolean descargaTerminadaCorrectamente(long id) {
        DownloadManager gestor = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
        if (gestor == null) {
            return false;
        }
        try (Cursor cursor = gestor.query(new DownloadManager.Query().setFilterById(id))) {
            if (!cursor.moveToFirst()) {
                return false;
            }
            int columna = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS);
            return columna >= 0 && cursor.getInt(columna) == DownloadManager.STATUS_SUCCESSFUL;
        }
    }

    private static boolean esUrlActualizacion(String direccion) {
        try {
            Uri url = Uri.parse(direccion);
            return "https".equalsIgnoreCase(url.getScheme())
                && "www.mangatotal.com".equalsIgnoreCase(url.getHost())
                && (url.getPort() == -1 || url.getPort() == 443)
                && "/descargas/MangaTotal-android.apk".equals(url.getPath())
                && url.getUserInfo() == null
                && url.getQuery() == null
                && url.getFragment() == null;
        } catch (Exception ignorado) {
            return false;
        }
    }

    /**
     * Android también comprueba la firma al instalar, pero hacerlo antes de
     * abrir el instalador evita presentar cualquier APK ajeno al usuario.
     */
    @SuppressWarnings("deprecation")
    private boolean apkValido(File apk) {
        try {
            PackageManager pm = getPackageManager();
            PackageInfo candidata;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                candidata = pm.getPackageArchiveInfo(
                    apk.getAbsolutePath(),
                    PackageManager.PackageInfoFlags.of(PackageManager.GET_SIGNING_CERTIFICATES)
                );
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                candidata = pm.getPackageArchiveInfo(
                    apk.getAbsolutePath(),
                    PackageManager.GET_SIGNING_CERTIFICATES
                );
            } else {
                candidata = pm.getPackageArchiveInfo(
                    apk.getAbsolutePath(),
                    PackageManager.GET_SIGNATURES
                );
            }
            if (candidata == null || !getPackageName().equals(candidata.packageName)) {
                return false;
            }

            PackageInfo instalada;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                instalada = pm.getPackageInfo(
                    getPackageName(),
                    PackageManager.PackageInfoFlags.of(0)
                );
            } else {
                instalada = pm.getPackageInfo(getPackageName(), 0);
            }
            long nueva = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                ? candidata.getLongVersionCode()
                : candidata.versionCode;
            long actual = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                ? instalada.getLongVersionCode()
                : instalada.versionCode;
            if (nueva <= actual) {
                return false;
            }

            Signature[] firmas;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                if (candidata.signingInfo == null) {
                    return false;
                }
                firmas = candidata.signingInfo.hasMultipleSigners()
                    ? candidata.signingInfo.getApkContentsSigners()
                    : candidata.signingInfo.getSigningCertificateHistory();
            } else {
                firmas = candidata.signatures;
            }
            if (firmas == null) {
                return false;
            }
            for (Signature firma : firmas) {
                if (FIRMA_ACTUALIZACIONES.equalsIgnoreCase(sha256(firma.toByteArray()))) {
                    return true;
                }
            }
            return false;
        } catch (Exception ignorado) {
            return false;
        }
    }

    private static String sha256(byte[] datos) throws Exception {
        byte[] resumen = MessageDigest.getInstance("SHA-256").digest(datos);
        StringBuilder texto = new StringBuilder(resumen.length * 2);
        for (byte valor : resumen) {
            texto.append(String.format("%02x", valor & 0xff));
        }
        return texto.toString();
    }

    private void avisar(String mensaje) {
        runOnUiThread(() -> Toast.makeText(this, mensaje, Toast.LENGTH_LONG).show());
    }

    @Override
    public void onDestroy() {
        if (receptorDescarga != null) {
            unregisterReceiver(receptorDescarga);
            receptorDescarga = null;
        }
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        WebView webView = this.bridge != null ? this.bridge.getWebView() : null;

        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }

        super.onBackPressed();
    }
}
