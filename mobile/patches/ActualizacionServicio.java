package app.mangatotal.android;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.webkit.WebView;
import java.lang.ref.WeakReference;

/**
 * Mantiene únicamente una revisión solicitada por el usuario. No descarga
 * páginas ni usa servidores propios. La cola web guarda cada ficha terminada;
 * si Android mata el proceso, se retoma al abrir, sin reiniciar desde cero.
 */
public class ActualizacionServicio extends Service {
    public static volatile boolean activo = false;
    private static boolean enSegundoPlano = false;
    private static WeakReference<WebView> vista = new WeakReference<>(null);
    private final Handler reloj = new Handler(Looper.getMainLooper());
    private PowerManager.WakeLock cpu;
    private final Runnable caducado = this::stopSelf;
    private static final String CANAL = "biblioteca";
    private static final int AVISO = 7201;

    public static void visibilidad(WebView webView, boolean visible) {
        vista = new WeakReference<>(webView);
        enSegundoPlano = !visible;
        if (webView == null) return;
        if (visible || activo) {
            webView.resumeTimers(); webView.onResume();
            // Revisar la biblioteca no autoriza reproducir vídeos con la app oculta.
            if (!visible) webView.evaluateJavascript("document.querySelectorAll('video').forEach(v=>v.pause())", null);
        } else {
            webView.onPause(); webView.pauseTimers();
        }
    }

    @Override public void onCreate() {
        super.onCreate();
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel canal = new NotificationChannel(CANAL, "Actualización de biblioteca", NotificationManager.IMPORTANCE_LOW);
            getSystemService(NotificationManager.class).createNotificationChannel(canal);
        }
        cpu = ((PowerManager) getSystemService(POWER_SERVICE)).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "MangaTotal:Biblioteca");
        cpu.setReferenceCounted(false);
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || !activo) { stopSelf(); return START_NOT_STICKY; }
        int total = intent.getIntExtra("total", 0), hechas = intent.getIntExtra("hechas", 0);
        PendingIntent abrir = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder aviso = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CANAL) : new Notification.Builder(this);
        Notification notificacion = aviso.setSmallIcon(android.R.drawable.stat_notify_sync)
            .setContentTitle("MangaTotal · actualizando biblioteca")
            .setContentText(hechas + " de " + total + " series comprobadas")
            .setContentIntent(abrir).setProgress(total, hechas, total == 0)
            .setOngoing(true).setOnlyAlertOnce(true).build();
        if (Build.VERSION.SDK_INT >= 29) startForeground(AVISO, notificacion, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        else startForeground(AVISO, notificacion);
        activo = true;
        // Sin progreso o con una web caída no queda un servicio gastando batería.
        reloj.removeCallbacks(caducado); reloj.postDelayed(caducado, 180000);
        cpu.acquire(180000);
        return START_NOT_STICKY;
    }

    @Override public void onTimeout(int startId, int fgsType) { stopSelf(); }
    @Override public void onTaskRemoved(Intent rootIntent) { stopSelf(); }
    @Override public void onDestroy() {
        activo = false;
        reloj.removeCallbacks(caducado);
        if (cpu != null && cpu.isHeld()) cpu.release();
        stopForeground(true);
        WebView webView = vista.get();
        if (enSegundoPlano && webView != null) { webView.onPause(); webView.pauseTimers(); }
        super.onDestroy();
    }
    @Override public IBinder onBind(Intent intent) { return null; }
}
