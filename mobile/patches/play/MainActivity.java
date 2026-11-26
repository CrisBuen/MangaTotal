package app.mangatotal.android;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

/**
 * Contenedor de Google Play.
 *
 * A diferencia del APK local no descarga ni instala actualizaciones: Google
 * Play es el único canal de actualización de esta variante. Conserva los
 * puentes de fuentes, pantalla completa, ahorro de batería y gesto de atrás.
 */
public class MainActivity extends BridgeActivity {

    public static MainActivity instancia;

    public void descargarActualizacion(String url) {
        // En la versión de Google Play las actualizaciones se gestionan por la tienda.
    }

    private WebView webViewPrincipal() {
        return this.bridge != null ? this.bridge.getWebView() : null;
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FuentesPlugin.class);
        registerPlugin(PantallaPlugin.class);
        registerPlugin(ActualizacionPlugin.class);
        instancia = this;
        super.onCreate(savedInstanceState);
        // En Play Store (targetSdk 36) el gesto predictivo ignora onBackPressed().
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView webView = webViewPrincipal();
                if (webView != null && webView.canGoBack()) {
                    webView.goBack();
                    return;
                }
                setEnabled(false);
                getOnBackPressedDispatcher().onBackPressed();
                setEnabled(true);
            }
        });
    }

    @Override
    public void onPause() {
        WebView webView = webViewPrincipal();
        if (webView != null) {
            webView.evaluateJavascript("window.__mtFlushProgress && window.__mtFlushProgress();", null);
        }
        super.onPause();
    }

    @Override
    public void onStop() {
        WebView webView = webViewPrincipal();
        // Solo la revisión explícita mantiene los temporizadores activos.
        ActualizacionServicio.visibilidad(webView, false);
        super.onStop();
    }

    @Override
    public void onStart() {
        super.onStart();
        WebView webView = webViewPrincipal();
        ActualizacionServicio.visibilidad(webView, true);
    }

    @Override
    public void onDestroy() {
        stopService(new android.content.Intent(this, ActualizacionServicio.class));
        WebView webView = webViewPrincipal();
        if (webView != null) {
            webView.stopLoading();
            webView.onPause();
        }
        if (instancia == this) {
            instancia = null;
        }
        super.onDestroy();
    }
}
