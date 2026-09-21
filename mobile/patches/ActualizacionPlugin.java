package app.mangatotal.android;

import android.Manifest;
import android.content.Intent;
import android.os.Build;
import android.net.Uri;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(name = "Actualizacion", permissions = {
    @Permission(alias = "notificaciones", strings = { Manifest.permission.POST_NOTIFICATIONS })
})
public class ActualizacionPlugin extends Plugin {
    private boolean permisoSolicitado = false;

    @PluginMethod
    public void estado(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            // El puente solo es para la interfaz propia, nunca para un sitio abierto.
            Uri uri = Uri.parse(getBridge().getWebView().getUrl());
            if (!"https".equals(uri.getScheme()) ||
                !("www.mangatotal.com".equals(uri.getHost()) || "mangatotal.com".equals(uri.getHost()))) {
                call.reject("Origen no permitido"); return;
            }
            boolean activo = Boolean.TRUE.equals(call.getBoolean("activo", false));
            if (activo && Build.VERSION.SDK_INT >= 33 && !permisoSolicitado &&
                getPermissionState("notificaciones") == PermissionState.PROMPT) {
                permisoSolicitado = true;
                requestPermissionForAlias("notificaciones", call, "permisoNotificacion");
                return;
            }
            aplicar(call);
        });
    }

    @PermissionCallback
    private void permisoNotificacion(PluginCall call) { aplicar(call); }

    private void aplicar(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            boolean activo = Boolean.TRUE.equals(call.getBoolean("activo", false));
            Intent intent = new Intent(getContext(), ActualizacionServicio.class);
            if (!activo) {
                ActualizacionServicio.activo = false;
                getContext().stopService(intent);
                call.resolve(); return;
            }
            try {
                int total = Math.max(0, Math.min(18000, call.getInt("total", 0)));
                intent.putExtra("total", total);
                intent.putExtra("hechas", Math.max(0, Math.min(total, call.getInt("hechas", 0))));
                ActualizacionServicio.activo = true;
                if (Build.VERSION.SDK_INT >= 26) getContext().startForegroundService(intent);
                else getContext().startService(intent);
                call.resolve();
            } catch (RuntimeException e) {
                ActualizacionServicio.activo = false;
                call.reject("Android no permitió mantener el trabajo en segundo plano");
            }
        });
    }
}
