package app.mangatotal.android;

import android.content.pm.ActivityInfo;
import android.view.View;
import android.view.Window;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Pantalla completa de verdad, la que la web no puede pedir.
 *
 * La API de pantalla completa del navegador solo agranda la página dentro de
 * la ventana: la barra de estado de arriba y la de gestos de abajo siguen
 * ahí, tapando la lectura. Esconderlas es cosa del sistema y solo se puede
 * desde el lado nativo.
 *
 * Se usa el modo inmersivo "por deslizamiento": las barras no se ven, pero
 * vuelven un momento si la persona desliza desde el borde. Eso hace falta
 * para poder salir sin quedar encerrado.
 */
@CapacitorPlugin(name = "Pantalla")
public class PantallaPlugin extends Plugin {

    /** Si la lectura estaba en pantalla completa cuando se dejó la app. */
    private boolean inmersivaActiva = false;
    /** Solo los reproductores de video fuerzan paisaje. */
    private boolean horizontalActiva = false;
    private int orientacionAnterior = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED;

    @PluginMethod
    public void inmersiva(PluginCall call) {
        inmersivaActiva = Boolean.TRUE.equals(call.getBoolean("activa", false));
        aplicar(inmersivaActiva);
        call.resolve();
    }

    @PluginMethod
    public void orientacion(PluginCall call) {
        boolean horizontal = Boolean.TRUE.equals(call.getBoolean("horizontal", false));
        if (horizontal && !horizontalActiva) {
            orientacionAnterior = getActivity().getRequestedOrientation();
        }
        horizontalActiva = horizontal;
        aplicarOrientacion(horizontal);
        call.resolve();
    }

    private void aplicarOrientacion(boolean horizontal) {
        getActivity().runOnUiThread(() -> {
            getActivity().setRequestedOrientation(
                horizontal
                    ? ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                    : orientacionAnterior
            );

            // El cambio de orientación puede hacer reaparecer las barras.
            // Se vuelve a aplicar el modo inmersivo cuando el nuevo viewport
            // ya quedó medido, sin recrear el WebView.
            if (horizontal) {
                getActivity().getWindow().getDecorView().postDelayed(() -> {
                    if (horizontalActiva && inmersivaActiva) aplicar(true);
                }, 350);
            }
        });
    }

    private void aplicar(boolean activa) {
        // tocar la ventana solo se puede desde el hilo de la interfaz
        getActivity().runOnUiThread(() -> {
            Window ventana = getActivity().getWindow();
            View raiz = ventana.getDecorView();
            WindowInsetsControllerCompat control = WindowCompat.getInsetsController(ventana, raiz);

            // al esconder las barras, el contenido pasa a ocupar todo el alto
            WindowCompat.setDecorFitsSystemWindows(ventana, !activa);

            if (activa) {
                control.setSystemBarsBehavior(
                    WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                );
                control.hide(WindowInsetsCompat.Type.systemBars());
            } else {
                control.show(WindowInsetsCompat.Type.systemBars());
            }
        });
    }

    /**
     * Al volver de segundo plano el sistema devuelve las barras por su cuenta.
     * Si se estaba leyendo en pantalla completa, se esconden de nuevo; si no,
     * quedaría media pantalla tapada al retomar la lectura.
     */
    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        if (horizontalActiva) aplicarOrientacion(true);
        if (inmersivaActiva) aplicar(true);
    }
}
