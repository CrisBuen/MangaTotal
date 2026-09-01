package app.mangatotal.android;

import android.content.Intent;
import android.webkit.CookieManager;
import android.webkit.WebStorage;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

import javax.net.ssl.HttpsURLConnection;

/**
 * Puente para leer las fuentes que bloquean a los servidores.
 *
 * Hace lo mismo que el puente de Windows, con los mismos nombres, así que la
 * web de arriba no distingue una plataforma de la otra:
 *
 *   · traerPagina        pide la página desde la conexión del teléfono
 *   · enviarJson         usa el buscador JSON oficial de una fuente
 *   · resolverDesafio    abre el "no soy un robot" de Cloudflare
 *   · limpiarVerificacion borra el permiso cuando queda trabado
 *
 * El permiso que entrega Cloudflare (cf_clearance) es una cookie que el
 * navegador esconde de JavaScript, pero Android la guarda en su propio
 * almacén y desde ahí sí se puede leer. Por eso la verificación la resuelve
 * una persona en una ventana de verdad y los pedidos siguientes reusan lo que
 * quedó guardado, igual que hace Mihon.
 */
@CapacitorPlugin(name = "Fuentes")
public class FuentesPlugin extends Plugin {

    /**
     * El mismo user agent para la ventana de verificación y para los pedidos:
     * Cloudflare ata su permiso al navegador que lo resolvió, así que si no
     * coinciden, el permiso no sirve.
     */
    private static final String UA_NAVEGADOR =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

    /** Solo las fuentes integradas: el puente no es un navegador de uso libre. */
    private static final String[] PERMITIDOS = {
        "newcatharsis.dig-it.info",
        // donde Catharsis guarda sus imágenes (direct-new-catha, ...)
        "catharsisfood.com",
        "leercapitulo.co",
        // CDN donde viven las páginas de LeerCapítulo (lc3-cdn, lc7-cdn, ...)
        "t34798ndc.com",
        "zonatmo.net",
        "cdn.zonatmo.to",
        "visorikigai.gettocaboca.com",
        "viralikigai.milkchoco.online",
        "image2.ikigaimangas.cloud",
        "image3.ikigaimangas.cloud",
    };

    private static final int TIEMPO_ESPERA_MS = 20000;
    private static final int MAX_REDIRECCIONES = 5;
    private static final int MAX_RESPUESTA_BYTES = 20 * 1024 * 1024;

    @PluginMethod
    public void traerPagina(final PluginCall call) {
        final String direccion = call.getString("url", "");
        final String ua = uaDe(call.getString("userAgent"));

        new Thread(() -> {
            HttpsURLConnection conexion = null;
            try {
                URL destino = new URL(direccion);
                for (int salto = 0; salto <= MAX_REDIRECCIONES; salto++) {
                    if (!direccionPermitida(destino)) {
                        call.reject("Dirección de fuente no permitida");
                        return;
                    }

                    conexion = (HttpsURLConnection) destino.openConnection();
                    conexion.setInstanceFollowRedirects(false);
                    conexion.setConnectTimeout(TIEMPO_ESPERA_MS);
                    conexion.setReadTimeout(TIEMPO_ESPERA_MS);
                    conexion.setRequestProperty("User-Agent", ua);
                    conexion.setRequestProperty("Accept-Language", "es-ES,es;q=0.9");
                    conexion.setRequestProperty(
                        "Accept",
                        "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.9,*/*;q=0.8"
                    );

                    // el permiso de Cloudflare vive en el almacén de cookies del
                    // sistema: lo dejó ahí la ventana de verificación
                    String cookies = CookieManager.getInstance().getCookie(destino.toString());
                    if (cookies != null && !cookies.isEmpty()) {
                        conexion.setRequestProperty("Cookie", cookies);
                    }

                    int estado = conexion.getResponseCode();
                    if (esRedireccion(estado)) {
                        String ubicacion = conexion.getHeaderField("Location");
                        conexion.disconnect();
                        conexion = null;
                        if (ubicacion == null || ubicacion.trim().isEmpty() || salto == MAX_REDIRECCIONES) {
                            call.reject("La fuente devolvió una redirección inválida");
                            return;
                        }
                        destino = new URL(destino, ubicacion);
                        continue;
                    }

                    // Cloudflare pide verificar que hay una persona: la ventana la
                    // abre la web llamando a resolverDesafio
                    if (estado == 403 || estado == 503) {
                        call.reject("DESAFIO:" + destino.getHost());
                        return;
                    }
                    if (estado < 200 || estado >= 300) {
                        call.reject("La fuente respondió " + estado);
                        return;
                    }

                    JSObject salida = new JSObject();
                    salida.put("status", estado);
                    salida.put("data", leer(conexion.getInputStream()));
                    call.resolve(salida);
                    return;
                }
            } catch (Exception e) {
                call.reject(mensaje(e));
            } finally {
                if (conexion != null) {
                    conexion.disconnect();
                }
            }
        }).start();
    }

    /**
     * POST limitado para el buscador oficial de Ikigai.
     *
     * No es un proxy abierto: conserva la lista blanca de dominios, limita el
     * cuerpo y solo permite el identificador alfanumérico que espera Qwik.
     */
    @PluginMethod
    public void enviarJson(final PluginCall call) {
        final String direccion = call.getString("url", "");
        final String cuerpo = call.getString("body", "");
        final String qrl = call.getString("qrl", "");
        final String ua = uaDe(call.getString("userAgent"));

        if (!direccionPermitida(direccion)) {
            call.reject("Dirección de fuente no permitida");
            return;
        }
        if (!qrl.matches("[A-Za-z0-9_-]{1,128}")) {
            call.reject("Identificador de búsqueda inválido");
            return;
        }

        final byte[] bytes = cuerpo.getBytes(StandardCharsets.UTF_8);
        if (bytes.length > 128 * 1024) {
            call.reject("El pedido de búsqueda es demasiado grande");
            return;
        }

        new Thread(() -> {
            HttpsURLConnection conexion = null;
            try {
                URL destino = new URL(direccion);
                conexion = (HttpsURLConnection) destino.openConnection();
                conexion.setInstanceFollowRedirects(false);
                conexion.setConnectTimeout(TIEMPO_ESPERA_MS);
                conexion.setReadTimeout(TIEMPO_ESPERA_MS);
                conexion.setRequestMethod("POST");
                conexion.setDoOutput(true);
                conexion.setFixedLengthStreamingMode(bytes.length);
                conexion.setRequestProperty("User-Agent", ua);
                conexion.setRequestProperty("Accept-Language", "es-ES,es;q=0.9");
                conexion.setRequestProperty("Content-Type", "application/qwik-json");
                conexion.setRequestProperty("Accept", "application/json, application/qwik-json, text/plain");
                conexion.setRequestProperty("X-QRL", qrl);

                String cookies = CookieManager.getInstance().getCookie(destino.toString());
                if (cookies != null && !cookies.isEmpty()) {
                    conexion.setRequestProperty("Cookie", cookies);
                }

                try (OutputStream salida = conexion.getOutputStream()) {
                    salida.write(bytes);
                }

                int estado = conexion.getResponseCode();
                if (estado == 403 || estado == 503) {
                    call.reject("DESAFIO:" + destino.getHost());
                    return;
                }
                if (estado < 200 || estado >= 300) {
                    call.reject("La fuente respondió " + estado);
                    return;
                }

                JSObject salida = new JSObject();
                salida.put("status", estado);
                salida.put("data", leer(conexion.getInputStream()));
                call.resolve(salida);
            } catch (Exception e) {
                call.reject(mensaje(e));
            } finally {
                if (conexion != null) {
                    conexion.disconnect();
                }
            }
        }).start();
    }

    @PluginMethod
    public void resolverDesafio(PluginCall call) {
        String direccion = call.getString("url", "");
        if (!direccionPermitida(direccion)) {
            call.reject("Dirección de verificación no permitida");
            return;
        }

        Intent intent = new Intent(getContext(), DesafioActivity.class);
        intent.putExtra(DesafioActivity.EXTRA_URL, direccion);
        intent.putExtra(DesafioActivity.EXTRA_UA, uaDe(call.getString("userAgent")));
        startActivityForResult(call, intent, "alVolverDelDesafio");
    }

    @ActivityCallback
    private void alVolverDelDesafio(PluginCall call, ActivityResult resultado) {
        if (call == null) {
            return;
        }
        JSObject salida = new JSObject();
        salida.put("ok", resultado != null && resultado.getResultCode() == android.app.Activity.RESULT_OK);
        call.resolve(salida);
    }

    @PluginMethod
    public void limpiarVerificacion(PluginCall call) {
        CookieManager gestor = CookieManager.getInstance();
        gestor.removeAllCookies(null);
        gestor.flush();
        WebStorage.getInstance().deleteAllData();
        call.resolve();
    }

    /** El user agent a usar: el que eligió la persona, o el nuestro. */
    private static String uaDe(String elegido) {
        return elegido != null && !elegido.trim().isEmpty() ? elegido.trim() : UA_NAVEGADOR;
    }

    public static boolean direccionPermitida(String direccion) {
        try {
            return direccionPermitida(new URL(direccion));
        } catch (Exception ignorado) {
            return false;
        }
    }

    public static boolean direccionPermitida(URL destino) {
        if (
            destino == null ||
            !"https".equalsIgnoreCase(destino.getProtocol()) ||
            destino.getUserInfo() != null ||
            (destino.getPort() != -1 && destino.getPort() != 443)
        ) {
            return false;
        }
        return permitido(destino.getHost());
    }

    private static boolean permitido(String host) {
        if (host == null) {
            return false;
        }
        String normalizado = host.toLowerCase(Locale.ROOT);
        for (String p : PERMITIDOS) {
            if (normalizado.equals(p) || normalizado.endsWith("." + p)) {
                return true;
            }
        }
        return false;
    }

    private static String leer(InputStream entrada) throws Exception {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        byte[] trozo = new byte[8192];
        int leidos;
        int total = 0;
        while ((leidos = entrada.read(trozo)) != -1) {
            total += leidos;
            if (total > MAX_RESPUESTA_BYTES) {
                entrada.close();
                throw new IOException("La fuente respondió un archivo demasiado grande");
            }
            buffer.write(trozo, 0, leidos);
        }
        entrada.close();
        return buffer.toString("UTF-8");
    }

    private static boolean esRedireccion(int estado) {
        return estado == 301 || estado == 302 || estado == 303 || estado == 307 || estado == 308;
    }

    /** Sin conexión el mensaje del sistema viene vacío, y así no se entiende. */
    private static String mensaje(Exception e) {
        String texto = e.getMessage();
        return texto != null && !texto.isEmpty() ? texto : e.getClass().getSimpleName();
    }
}
