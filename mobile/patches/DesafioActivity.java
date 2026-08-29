package app.mangatotal.android;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * La ventana donde la persona toca la casilla de Cloudflare.
 *
 * No hay forma de saltearse ese paso desde afuera, y tampoco hace falta: lo
 * resuelve una persona de verdad en un navegador de verdad, que es
 * exactamente lo que Cloudflare quiere comprobar. Acá solo se espera a que
 * aparezca el permiso (cf_clearance) y se cierra sola.
 *
 * El permiso queda en el almacén de cookies del sistema, así que los pedidos
 * que salen del puente lo reusan sin volver a molestar a nadie hasta que
 * vence.
 */
public class DesafioActivity extends Activity {

    public static final String EXTRA_URL = "url";
    public static final String EXTRA_UA = "ua";

    /** Hasta tres minutos: es lo que puede tardar alguien en verla y tocarla. */
    private static final long LIMITE_MS = 180_000L;
    private static final long CADA_MS = 500L;

    private WebView navegador;
    private Handler reloj;
    private Runnable revisar;
    private long desde;
    private boolean terminada;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        final String direccion = getIntent().getStringExtra(EXTRA_URL);
        final String ua = getIntent().getStringExtra(EXTRA_UA);
        if (!FuentesPlugin.direccionPermitida(direccion)) {
            cerrar(false);
            return;
        }

        setContentView(armarPantalla());

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(navegador, true);

        WebSettings ajustes = navegador.getSettings();
        ajustes.setJavaScriptEnabled(true);
        ajustes.setDomStorageEnabled(true);
        ajustes.setUserAgentString(ua);
        ajustes.setLoadWithOverviewMode(true);
        ajustes.setUseWideViewPort(true);
        ajustes.setAllowFileAccess(false);
        ajustes.setAllowContentAccess(false);
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
            ajustes.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        }
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            ajustes.setSafeBrowsingEnabled(true);
        }

        navegador.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !FuentesPlugin.direccionPermitida(request.getUrl().toString());
            }

            @Override
            @SuppressWarnings("deprecation")
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return !FuentesPlugin.direccionPermitida(url);
            }
        });
        navegador.loadUrl(direccion);

        desde = System.currentTimeMillis();
        reloj = new Handler(Looper.getMainLooper());
        revisar = new Runnable() {
            @Override
            public void run() {
                if (terminada) {
                    return;
                }
                if (tienePermiso(direccion)) {
                    CookieManager.getInstance().flush();
                    cerrar(true);
                    return;
                }
                if (System.currentTimeMillis() - desde > LIMITE_MS) {
                    cerrar(false);
                    return;
                }
                reloj.postDelayed(this, CADA_MS);
            }
        };
        reloj.postDelayed(revisar, CADA_MS);
    }

    /** Aviso arriba y el sitio abajo, para que se entienda qué hay que hacer. */
    private ViewGroup armarPantalla() {
        LinearLayout columna = new LinearLayout(this);
        columna.setOrientation(LinearLayout.VERTICAL);
        columna.setBackgroundColor(Color.parseColor("#0a0a0f"));

        TextView aviso = new TextView(this);
        aviso.setText("El sitio pide comprobar que sos una persona.\nTocá la casilla y esta ventana se cierra sola.");
        aviso.setTextColor(Color.parseColor("#e8e8ef"));
        aviso.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f);
        aviso.setGravity(Gravity.CENTER);
        aviso.setPadding(48, 56, 48, 40);
        columna.addView(
            aviso,
            new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        );

        navegador = new WebView(this);
        columna.addView(
            navegador,
            new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f)
        );

        return columna;
    }

    private static boolean tienePermiso(String direccion) {
        String guardadas = CookieManager.getInstance().getCookie(direccion);
        return guardadas != null && guardadas.contains("cf_clearance=");
    }

    private void cerrar(boolean resuelto) {
        if (terminada) {
            return;
        }
        terminada = true;
        if (reloj != null && revisar != null) {
            reloj.removeCallbacks(revisar);
        }
        setResult(resuelto ? RESULT_OK : RESULT_CANCELED);
        finish();
    }

    @Override
    public void onBackPressed() {
        // si la cerró a mano, se corta y la web avisa que no quedó resuelto
        cerrar(false);
    }

    @Override
    protected void onDestroy() {
        if (reloj != null && revisar != null) {
            reloj.removeCallbacks(revisar);
        }
        if (navegador != null) {
            navegador.destroy();
            navegador = null;
        }
        super.onDestroy();
    }
}
