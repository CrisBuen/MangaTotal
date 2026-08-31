package app.mangatotal.android;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

/**
 * Contenedor de Google Play.
 *
 * A diferencia del APK local no descarga ni instala actualizaciones: Google
 * Play es el único canal de actualización de esta variante. Conserva los
 * puentes de fuentes, pantalla completa, ahorro de batería y gesto de atrás.
 */
public class MainActivity extends BridgeActivity {

    private WebView webViewPrincipal() {
        return this.bridge != null ? this.bridge.getWebView() : null;
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FuentesPlugin.class);
        registerPlugin(PantallaPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onStop() {
        WebView webView = webViewPrincipal();
        if (webView != null) {
            webView.onPause();
            webView.pauseTimers();
        }
        super.onStop();
    }

    @Override
    public void onStart() {
        super.onStart();
        WebView webView = webViewPrincipal();
        if (webView != null) {
            webView.resumeTimers();
            webView.onResume();
        }
    }

    @Override
    public void onDestroy() {
        WebView webView = webViewPrincipal();
        if (webView != null) {
            webView.stopLoading();
            webView.onPause();
        }
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        WebView webView = webViewPrincipal();
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }
}
