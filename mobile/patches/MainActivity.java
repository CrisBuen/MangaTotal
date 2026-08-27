package app.mangatotal.android;

import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

/**
 * Sin esto, el gesto de "atrás" de Android cierra la app en vez de volver
 * a la pantalla anterior: Capacitor no maneja el historial del WebView por
 * su cuenta. Acá se navega hacia atrás mientras haya historial y recién en
 * la primera pantalla se deja salir de la app.
 */
public class MainActivity extends BridgeActivity {

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
