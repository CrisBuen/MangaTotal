package app.mangatotal.android;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.webkit.CookieManager;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;
import java.util.ArrayList;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

/**
 * Servicio en segundo plano con notificación persistente para descargar capítulos completos
 * directamente al almacenamiento local (/storage/emulated/0/MangaTotal/descargas/...) estilo Mihon.
 * Permite que el usuario salga de la app o bloquee la pantalla sin interrumpir la descarga.
 */
public class DescargaServicio extends Service {

    public static final String CANAL_ID = "mangatotal_descargas";
    public static final int NOTIF_ID = 8520;
    private static final String UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

    private NotificationManager notificationManager;
    private PowerManager.WakeLock wakeLock;
    private ExecutorService executor;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private static javax.net.ssl.SSLSocketFactory trustAllSocketFactory;

    static {
        try {
            TrustManager[] trustAll = new TrustManager[]{
                new X509TrustManager() {
                    public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
                    public void checkClientTrusted(X509Certificate[] certs, String authType) {}
                    public void checkServerTrusted(X509Certificate[] certs, String authType) {}
                }
            };
            SSLContext sc = SSLContext.getInstance("TLS");
            sc.init(null, trustAll, new SecureRandom());
            trustAllSocketFactory = sc.getSocketFactory();
        } catch (Exception ignored) {}
    }

    @Override
    public void onCreate() {
        super.onCreate();
        notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CANAL_ID,
                "Descargas de MangaTotal",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Progreso de descargas de capítulos en segundo plano");
            notificationManager.createNotificationChannel(channel);
        }

        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "MangaTotal:DescargaWakeLock");
            wakeLock.setReferenceCounted(true);
        }

        executor = Executors.newSingleThreadExecutor();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            stopSelf(startId);
            return START_NOT_STICKY;
        }

        final String fuente = intent.getStringExtra("fuente");
        final String serie = intent.getStringExtra("serie");
        final String capitulo = intent.getStringExtra("capitulo");
        final ArrayList<String> urls = intent.getStringArrayListExtra("urls");

        if (urls == null || urls.isEmpty() || serie == null || capitulo == null) {
            stopSelf(startId);
            return START_NOT_STICKY;
        }

        if (wakeLock != null) {
            try {
                wakeLock.acquire(30 * 60 * 1000L); // 30 minutos de seguridad
            } catch (Exception ignored) {}
        }

        try {
            Notification notifInicial = crearNotificacion(serie, capitulo, 0, urls.size(), "Iniciando descarga en segundo plano...");
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIF_ID, notifInicial, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
            } else {
                startForeground(NOTIF_ID, notifInicial);
            }
        } catch (Exception ignored) {}

        mainHandler.post(() -> Toast.makeText(this, "Descargando en segundo plano: " + capitulo, Toast.LENGTH_SHORT).show());

        final int idActual = startId;
        executor.execute(() -> procesarDescarga(fuente != null ? fuente : "MangaTotal", serie, capitulo, urls, idActual));

        return START_NOT_STICKY;
    }

    public static void descargarSinServicio(
        final Context context,
        final String fuente,
        final String serie,
        final String capitulo,
        final ArrayList<String> urls
    ) {
        final Handler handler = new Handler(Looper.getMainLooper());
        handler.post(() -> Toast.makeText(context, "Descargando: " + capitulo, Toast.LENGTH_SHORT).show());
        new Thread(() -> ejecutarDescarga(context, fuente != null ? fuente : "MangaTotal", serie, capitulo, urls, null, handler)).start();
    }

    private void procesarDescarga(String fuente, String serie, String capitulo, ArrayList<String> urls, int startId) {
        try {
            ejecutarDescarga(this, fuente, serie, capitulo, urls, this, mainHandler);
        } finally {
            if (wakeLock != null && wakeLock.isHeld()) {
                try { wakeLock.release(); } catch (Exception ignored) {}
            }
            try { stopForeground(false); } catch (Exception ignored) {}
            stopSelf(startId);
        }
    }

    private static void ejecutarDescarga(
        Context context,
        String fuente,
        String serie,
        String capitulo,
        ArrayList<String> urls,
        DescargaServicio servicio,
        Handler handler
    ) {
        int total = urls.size();
        int descargadas = 0;

        String fLimpia = limpiarCarpeta(fuente);
        String sLimpia = limpiarCarpeta(serie);
        String cLimpio = limpiarCarpeta(capitulo);

        File dirCap = null;
        try {
            File raiz = new File(Environment.getExternalStorageDirectory(), "MangaTotal");
            if (!raiz.exists()) raiz.mkdirs();
            File descargas = new File(raiz, "descargas");
            if (!descargas.exists()) descargas.mkdirs();
            File backups = new File(raiz, "backups");
            if (!backups.exists()) backups.mkdirs();
            File local = new File(raiz, "local");
            if (!local.exists()) local.mkdirs();

            dirCap = new File(descargas, fLimpia + "/" + sLimpia + "/" + cLimpio);
            if (!dirCap.exists()) dirCap.mkdirs();
        } catch (Exception ignored) {}

        String subRutaRelativa = "MangaTotal/descargas/" + fLimpia + "/" + sLimpia + "/" + cLimpio;

        for (int i = 0; i < total; i++) {
            String urlOriginal = urls.get(i);
            boolean exito = false;

            for (int intento = 0; intento < 3; intento++) {
                HttpURLConnection conn = null;
                try {
                    String urlDesenvuelta = urlOriginal;
                    if (urlDesenvuelta.startsWith("/api/externo/imagen") || urlDesenvuelta.contains("/api/externo/imagen?")) {
                        int idxU = urlDesenvuelta.indexOf("u=");
                        if (idxU != -1) {
                            String codificada = urlDesenvuelta.substring(idxU + 2);
                            int idxAmp = codificada.indexOf('&');
                            if (idxAmp != -1) codificada = codificada.substring(0, idxAmp);
                            try {
                                urlDesenvuelta = java.net.URLDecoder.decode(codificada, "UTF-8");
                            } catch (Exception ignoredDec) {}
                        }
                    }

                    String urlCandidata = urlDesenvuelta;
                    if (urlCandidata.startsWith("/")) {
                        urlCandidata = "https://www.mangatotal.com" + urlCandidata;
                    } else if (intento == 2 && !urlCandidata.contains("mangatotal.com/api/externo/imagen")) {
                        urlCandidata = "https://www.mangatotal.com/api/externo/imagen?u=" + URLEncoder.encode(urlDesenvuelta, "UTF-8");
                    }

                    URL u = new URL(urlCandidata);
                    String hostInicial = u.getHost() != null ? u.getHost().toLowerCase(Locale.ROOT) : "";
                    if ((hostInicial.equals("e-hentai.org") || hostInicial.endsWith(".e-hentai.org") ||
                         hostInicial.equals("exhentai.org") || hostInicial.endsWith(".exhentai.org")) &&
                        u.getPath().startsWith("/s/")) {
                        HttpURLConnection connVisor = (HttpURLConnection) u.openConnection();
                        try {
                            connVisor.setConnectTimeout(15000);
                            connVisor.setReadTimeout(15000);
                            connVisor.setInstanceFollowRedirects(true);
                            connVisor.setRequestProperty("User-Agent", UA);
                            connVisor.setRequestProperty("Cookie", "nw=1");
                            connVisor.setRequestProperty("Referer", "https://e-hentai.org/");
                            if (connVisor.getResponseCode() == 200) {
                                java.io.ByteArrayOutputStream bosV = new java.io.ByteArrayOutputStream();
                                try (InputStream inV = connVisor.getInputStream()) {
                                    byte[] bufV = new byte[8192];
                                    int rV;
                                    while ((rV = inV.read(bufV)) != -1) bosV.write(bufV, 0, rV);
                                }
                                String htmlV = bosV.toString("UTF-8");
                                java.util.regex.Matcher mV = java.util.regex.Pattern
                                    .compile("<img[^>]+id=\"img\"[^>]+src=\"([^\"]+)\"")
                                    .matcher(htmlV);
                                if (mV.find()) {
                                    u = new URL(mV.group(1).replace("&amp;", "&"));
                                }
                            }
                        } finally {
                            connVisor.disconnect();
                        }
                    }

                    for (int salto = 0; salto < 3; salto++) {
                        conn = (HttpURLConnection) u.openConnection();
                        if (conn instanceof HttpsURLConnection && trustAllSocketFactory != null) {
                            ((HttpsURLConnection) conn).setSSLSocketFactory(trustAllSocketFactory);
                            ((HttpsURLConnection) conn).setHostnameVerifier((h, s) -> true);
                        }

                        conn.setConnectTimeout(15000);
                        conn.setReadTimeout(20000);
                        conn.setInstanceFollowRedirects(true);
                        conn.setRequestProperty("User-Agent", UA);
                        conn.setRequestProperty("Accept", "image/webp,image/png,image/jpeg,image/*,*/*");

                        try {
                            String cookies = CookieManager.getInstance().getCookie(u.toString());
                            if (cookies != null && !cookies.isEmpty()) {
                                conn.setRequestProperty("Cookie", cookies);
                            }
                        } catch (Exception ignoredCookie) {}

                        String host = u.getHost() != null ? u.getHost().toLowerCase(Locale.ROOT) : "";
                        if (host.contains("hath.network") || host.contains("e-hentai.org") || host.contains("exhentai.org") || host.matches("^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$")) {
                            conn.setRequestProperty("Cookie", "nw=1");
                            conn.setRequestProperty("Referer", "https://e-hentai.org/");
                        } else if (host.contains("gold-usergeneratedcontent.net") || host.contains("hitomi.la")) {
                            conn.setRequestProperty("Referer", "https://hitomi.la/");
                        } else if (host.contains("leercapitulo")) {
                            conn.setRequestProperty("Referer", "https://www.leercapitulo.co/");
                        } else if (host.contains("ikigai")) {
                            conn.setRequestProperty("Referer", "https://visorikigai.gettocaboca.com/");
                            conn.setRequestProperty("Sec-Fetch-Mode", "cors");
                        } else if (host.contains("zonatmo") || host.contains("visortmo") || host.contains("tumangaonline")) {
                            conn.setRequestProperty("Referer", "https://visortmo.com/");
                        } else if (host.contains("catharsis") || host.contains("dig-it.info")) {
                            conn.setRequestProperty("Referer", "https://newcatharsis.dig-it.info/");
                        }

                        int codigo = conn.getResponseCode();
                        if (codigo == 301 || codigo == 302 || codigo == 303 || codigo == 307 || codigo == 308) {
                            String loc = conn.getHeaderField("Location");
                            if (loc != null && !loc.isEmpty()) {
                                u = new URL(u, loc);
                                conn.disconnect();
                                conn = null;
                                continue;
                            }
                        }

                        if (codigo == 200) {
                            String ext = extensionDe(urlOriginal, conn.getContentType());
                            String nombreArchivo = String.format(Locale.ROOT, "%03d.%s", i + 1, ext);

                            try (InputStream in = conn.getInputStream()) {
                                java.io.ByteArrayOutputStream bos = new java.io.ByteArrayOutputStream();
                                byte[] buffer = new byte[32768];
                                int leidos;
                                while ((leidos = in.read(buffer)) != -1) {
                                    bos.write(buffer, 0, leidos);
                                }
                                byte[] bytes = bos.toByteArray();

                                // 1. Intentar escritura directa en /storage/emulated/0/MangaTotal/descargas
                                if (dirCap != null) {
                                    try {
                                        if (!dirCap.exists()) dirCap.mkdirs();
                                        File archivoDestino = new File(dirCap, nombreArchivo);
                                        try (FileOutputStream out = new FileOutputStream(archivoDestino)) {
                                            out.write(bytes);
                                            exito = true;
                                        }
                                    } catch (Exception ignoredDirecto) {}
                                }

                                // 2. Respaldo para edición Play Store (MediaStore.Downloads sin permisos especiales)
                                if (!exito && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                                    try {
                                        String rutaMedia = Environment.DIRECTORY_DOWNLOADS + "/" + subRutaRelativa + "/";
                                        android.content.ContentResolver resolver = context.getContentResolver();
                                        try {
                                            resolver.delete(
                                                android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI,
                                                android.provider.MediaStore.Downloads.RELATIVE_PATH + "=? AND " +
                                                android.provider.MediaStore.Downloads.DISPLAY_NAME + "=?",
                                                new String[]{rutaMedia, nombreArchivo}
                                            );
                                        } catch (Exception ignoredDel) {}

                                        android.content.ContentValues values = new android.content.ContentValues();
                                        values.put(android.provider.MediaStore.Downloads.DISPLAY_NAME, nombreArchivo);
                                        values.put(android.provider.MediaStore.Downloads.MIME_TYPE, "image/" + ("jpg".equals(ext) ? "jpeg" : ext));
                                        values.put(android.provider.MediaStore.Downloads.RELATIVE_PATH, rutaMedia);
                                        android.net.Uri uri = resolver.insert(android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                                        if (uri != null) {
                                            try (java.io.OutputStream out = resolver.openOutputStream(uri)) {
                                                if (out != null) {
                                                    out.write(bytes);
                                                    exito = true;
                                                }
                                            }
                                        }
                                    } catch (Exception ignoredMedia) {}
                                }
                            }
                        }
                        break;
                    }

                    if (exito) break;
                } catch (Exception ignored) {
                    try { Thread.sleep(400); } catch (InterruptedException ignored2) {}
                } finally {
                    if (conn != null) {
                        try { conn.disconnect(); } catch (Exception ignored) {}
                    }
                }
            }

            if (exito) {
                descargadas++;
            }

            int porcentaje = (int) Math.round(((double) (i + 1) / total) * 100);
            String texto = String.format(Locale.ROOT, "%d de %d páginas (%d%%)", i + 1, total, porcentaje);
            if (servicio != null && servicio.notificationManager != null) {
                try {
                    servicio.notificationManager.notify(NOTIF_ID, servicio.crearNotificacion(serie, capitulo, i + 1, total, texto));
                } catch (Exception ignoredNotif) {}
            }
            FuentesPlugin.notificarProgresoDescarga(fuente, serie, capitulo, i + 1, total, porcentaje);
        }

        final int totalFinal = descargadas;
        if (servicio != null && servicio.notificationManager != null) {
            try {
                Notification notifFin = servicio.crearNotificacionCompletada(serie, capitulo, totalFinal);
                servicio.notificationManager.notify(NOTIF_ID, notifFin);
            } catch (Exception ignoredNotif) {}
        }

        FuentesPlugin.notificarDescargaTerminada(fuente, serie, capitulo, totalFinal);

        if (handler != null) {
            handler.post(() -> Toast.makeText(context, "Capítulo guardado (" + totalFinal + " págs.) en MangaTotal/descargas", Toast.LENGTH_LONG).show());
        }
    }

    private Notification crearNotificacion(String serie, String capitulo, int progreso, int total, String texto) {
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(this, 0, openIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification.Builder b = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, CANAL_ID)
            : new Notification.Builder(this);

        b.setContentTitle("MangaTotal · Descargando capítulo")
         .setContentText(serie + " - " + capitulo)
         .setSubText(texto)
         .setSmallIcon(android.R.drawable.stat_sys_download)
         .setContentIntent(pi)
         .setOngoing(true)
         .setOnlyAlertOnce(true);

        if (total > 0) {
            b.setProgress(total, progreso, false);
        } else {
            b.setProgress(0, 0, true);
        }

        return b.build();
    }

    private Notification crearNotificacionCompletada(String serie, String capitulo, int total) {
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(this, 0, openIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification.Builder b = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, CANAL_ID)
            : new Notification.Builder(this);

        b.setContentTitle("Descarga completada ✓")
         .setContentText(serie + " - " + capitulo)
         .setSubText(total + " páginas guardadas en MangaTotal/descargas")
         .setSmallIcon(android.R.drawable.stat_sys_download_done)
         .setContentIntent(pi)
         .setAutoCancel(true);

        return b.build();
    }

    private static String extensionDe(String url, String contentType) {
        if (contentType != null) {
            String ct = contentType.toLowerCase(Locale.ROOT);
            if (ct.contains("webp")) return "webp";
            if (ct.contains("png")) return "png";
            if (ct.contains("gif")) return "gif";
            if (ct.contains("avif")) return "avif";
            if (ct.contains("jpeg") || ct.contains("jpg")) return "jpg";
        }
        try {
            String path = new URL(url.startsWith("/") ? "https://www.mangatotal.com" + url : url).getPath().toLowerCase(Locale.ROOT);
            if (path.endsWith(".webp")) return "webp";
            if (path.endsWith(".png")) return "png";
            if (path.endsWith(".gif")) return "gif";
            if (path.endsWith(".avif")) return "avif";
        } catch (Exception ignored) {}
        return "jpg";
    }

    private static String limpiarCarpeta(String texto) {
        if (texto == null) return "Capitulo";
        String limpio = texto
            .replaceAll("[\\u0000-\\u001f\\u007f-\\u009f\\\\/:*?\"<>|~]", "_")
            .replaceAll("\\.+", ".")
            .replaceAll("\\s+", " ")
            .replaceAll("^[.\\s_]+|[.\\s_]+$", "")
            .trim();
        if (limpio.length() > 64) {
            limpio = limpio.substring(0, 64).replaceAll("^[.\\s_]+|[.\\s_]+$", "").trim();
        }
        if (limpio.isEmpty() || limpio.matches("(?i)^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\\..*)?$")) {
            return "Capitulo";
        }
        return limpio;
    }

    @Override
    public void onDestroy() {
        if (wakeLock != null && wakeLock.isHeld()) {
            try { wakeLock.release(); } catch (Exception ignored) {}
        }
        if (executor != null) executor.shutdownNow();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
