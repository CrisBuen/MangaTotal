package app.mangatotal.android;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.webkit.WebView;
import androidx.core.content.FileProvider;
import com.getcapacitor.BridgeActivity;
import java.io.File;

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
                    instalarActualizacion();
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
        File destino = new File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), APK_NAME);
        if (destino.exists()) {
            destino.delete();
        }

        DownloadManager.Request pedido = new DownloadManager.Request(Uri.parse(url));
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

        Uri uri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", apk);

        Intent instalar = new Intent(Intent.ACTION_VIEW);
        instalar.setDataAndType(uri, APK_MIME);
        instalar.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        instalar.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(instalar);
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
