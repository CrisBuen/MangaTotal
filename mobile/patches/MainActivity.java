package app.mangatotal.android;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

/**
 * Dos ajustes que Capacitor no trae de fábrica:
 *
 * 1. El gesto de "atrás" cerraba la app en vez de volver a la pantalla
 *    anterior, porque el historial del WebView no se maneja solo.
 * 2. El WebView no descarga archivos: al tocar el APK de una actualización
 *    no pasaba nada. Ahora la descarga se delega al sistema, que la muestra
 *    en la barra de notificaciones y ofrece instalarla.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView webView = this.bridge != null ? this.bridge.getWebView() : null;
        if (webView == null) {
            return;
        }

        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            Intent descarga = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            descarga.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(descarga);
        });
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
