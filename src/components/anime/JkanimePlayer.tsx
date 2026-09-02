"use client";

import Hls from "hls.js";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FuenteAnimeExterna } from "@/lib/animeExternos";
import {
  activarReproductorHorizontalAndroid,
  activarPantallaCompleta,
  enAppAndroid,
  pantallaCompletaEsTotal,
  salirReproductorHorizontalAndroid,
  salirPantallaCompleta,
} from "@/lib/pantalla";

interface Fuente {
  id: string;
  label: string;
  kind: "hls" | "mp4" | "embed";
}

interface Reproduccion {
  external_id: string;
  slug: string;
  series_title: string;
  cover_url: string | null;
  total_episodes: number | null;
  episode_id: string;
  episode_number: string;
  episode_title: string;
  poster_url: string | null;
  sources: Fuente[];
  selected_source: string;
  playback:
    | { kind: "hls"; url: string }
    | { kind: "mp4"; url: string }
    | { kind: "embed"; url: string };
}

const OCULTAR_CONTROLES_MS = 5000;
const GUARDAR_CADA_SEGUNDOS = 10;

function reloj(segundos: number): string {
  if (!Number.isFinite(segundos) || segundos < 0) return "0:00";
  const total = Math.floor(segundos);
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const resto = total % 60;
  return horas > 0
    ? `${horas}:${String(minutos).padStart(2, "0")}:${String(resto).padStart(2, "0")}`
    : `${minutos}:${String(resto).padStart(2, "0")}`;
}

interface ReproductorAnimeExternoProps {
  slug: string;
  episode: string;
  source: FuenteAnimeExterna;
  sourceName: string;
}

export function ReproductorAnimeExterno({
  slug,
  episode,
  source,
  sourceName,
}: ReproductorAnimeExternoProps) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const dataRef = useRef<Reproduccion | null>(null);
  const currentRef = useRef(0);
  const durationRef = useRef(0);
  const lastSavedRef = useRef(0);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUiUpdateRef = useRef(0);

  const [data, setData] = useState<Reproduccion | null>(null);
  const [loading, setLoading] = useState(true);
  const [mediaReady, setMediaReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startPosition, setStartPosition] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [sourcesVisible, setSourcesVisible] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [androidPlayer, setAndroidPlayer] = useState(false);

  const guardarProgreso = useCallback((position: number, total: number) => {
    const info = dataRef.current;
    if (!info) return;
    const pos = Math.max(0, Math.round(position));
    const dur = Math.max(0, Math.round(total));
    lastSavedRef.current = pos;
    fetch("/api/anime/externo/progreso", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source,
        external_id: info.external_id,
        slug: info.slug,
        title: info.series_title,
        cover_url: info.cover_url,
        total_episodes: info.total_episodes,
        episode_id: info.episode_id,
        episode_number: info.episode_number,
        episode_title: info.episode_title,
        position_seconds: pos,
        duration_seconds: dur,
      }),
      keepalive: true,
    }).catch(() => {});
  }, [source]);

  const cargar = useCallback(
    async (sourceId?: string, positionOverride?: number) => {
      videoRef.current?.pause();
      setLoading(true);
      setMediaReady(false);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (sourceId) params.set("source", sourceId);
        const suffix = params.size ? `?${params}` : "";
        const res = await fetch(
          `/api/anime/${source}/${encodeURIComponent(slug)}/${encodeURIComponent(episode)}${suffix}`,
          { cache: "no-store" }
        );
        const next = await res.json();
        if (!res.ok) throw new Error(next?.error ?? "No se pudo cargar el episodio");

        let inicio = Math.max(0, positionOverride ?? 0);
        let registrarApertura = false;
        if (positionOverride === undefined) {
          const progressParams = new URLSearchParams({
            source,
            id: next.external_id,
            episode_id: next.episode_id,
          });
          const progressRes = await fetch(
            `/api/anime/externo/progreso?${progressParams}`,
            { cache: "no-store" }
          );
          if (progressRes.ok) {
            const progress = await progressRes.json();
            const posicionGuardada = Math.max(0, Number(progress.position_seconds) || 0);
            const duracionGuardada = Math.max(0, Number(progress.duration_seconds) || 0);
            inicio = progress.completed ? 0 : Math.max(0, Number(progress.position_seconds) || 0);
            registrarApertura =
              !progress.completed && posicionGuardada === 0 && duracionGuardada === 0;
          }
        }

        dataRef.current = next as Reproduccion;
        currentRef.current = inicio;
        lastSavedRef.current = inicio;
        setStartPosition(inicio);
        setCurrentTime(inicio);
        setData(next as Reproduccion);
        // Crea el historial apenas se abre el episodio. Así también queda
        // registrado si la persona sale antes del primer guardado periódico.
        if (registrarApertura) guardarProgreso(0, 0);
        if (next.playback.kind === "embed") setMediaReady(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo cargar el episodio");
      } finally {
        setLoading(false);
      }
    },
    [episode, guardarProgreso, slug, source]
  );

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !data || data.playback.kind === "embed") return;

    hlsRef.current?.destroy();
    hlsRef.current = null;
    video.pause();
    video.removeAttribute("src");
    video.load();
    setMediaReady(false);
    setPlaying(false);
    let espera: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      setError(
        "El reproductor no pudo abrir el video en 20 segundos. Código: media-timeout."
      );
      setControlsVisible(true);
    }, 20_000);

    const terminarEspera = () => {
      if (!espera) return;
      clearTimeout(espera);
      espera = null;
    };

    const iniciar = () => {
      terminarEspera();
      if (startPosition > 0 && Number.isFinite(video.duration)) {
        video.currentTime = Math.min(startPosition, Math.max(0, video.duration - 1));
      }
      setDuration(Number.isFinite(video.duration) ? video.duration : 0);
      durationRef.current = Number.isFinite(video.duration) ? video.duration : 0;
      setMediaReady(true);
      void video.play().catch(() => setControlsVisible(true));
    };
    const errorNativo = () => {
      terminarEspera();
      setError("El dispositivo rechazó el video. Código: media-error.");
      setControlsVisible(true);
    };

    if (data.playback.kind === "mp4") {
      video.src = data.playback.url;
      video.addEventListener("loadedmetadata", iniciar, { once: true });
      video.addEventListener("error", errorNativo, { once: true });
      video.load();
    } else if (Hls.isSupported()) {
      const hls = new Hls({
        // Se mantiene sin worker para que Tauri y Capacitor usen el mismo
        // contexto autenticado al pedir el manifiesto a MangaTotal.
        enableWorker: false,
        lowLatencyMode: false,
        manifestLoadingTimeOut: 15_000,
        manifestLoadingMaxRetry: 1,
        // HentaiTV publica muchas pistas VTT en el maestro, pero su reproductor
        // oficial las deja fuera del parser de hls.js. Hacer lo mismo evita que
        // una pista opcional invalida detenga un episodio que ya cargo bien.
        ...(source === "hentaitv"
          ? {
              enableWebVTT: false,
              enableIMSC1: false,
              enableCEA708Captions: false,
              renderTextTracksNatively: false,
            }
          : {}),
      });
      hlsRef.current = hls;
      hls.on(Hls.Events.MEDIA_ATTACHED, () => hls.loadSource(data.playback.url));
      hls.on(Hls.Events.MANIFEST_PARSED, iniciar);
      hls.on(Hls.Events.ERROR, (_event, details) => {
        const esSubtituloOpcionalHentaitv =
          source === "hentaitv" &&
          details.details === "levelParsingError" &&
          (details.parent === "subtitle" ||
            Boolean(details.url && /\.(?:vtt|srt|ass)(?:[?#]|$)/i.test(details.url)));
        if (esSubtituloOpcionalHentaitv) return;

        if (details.fatal) {
          terminarEspera();
          setError(
            `Esta fuente dejó de responder. Código: ${details.details || details.type}.`
          );
          setControlsVisible(true);
        }
      });
      hls.attachMedia(video);
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari/iOS no siempre tiene MediaSource, pero sí HLS nativo real.
      // Chromium y WebView2 pueden responder "maybe" y fallar al reproducir,
      // por eso esta comprobación debe quedar después de hls.js.
      video.src = data.playback.url;
      video.addEventListener("loadedmetadata", iniciar, { once: true });
      video.addEventListener("error", errorNativo, { once: true });
    } else {
      terminarEspera();
      setError("Este dispositivo no admite reproducción HLS.");
    }

    return () => {
      terminarEspera();
      video.removeEventListener("loadedmetadata", iniciar);
      video.removeEventListener("error", errorNativo);
      hlsRef.current?.destroy();
      hlsRef.current = null;
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [data, source, startPosition]);

  useEffect(() => {
    const nativa = pantallaCompletaEsTotal();
    const android = enAppAndroid();
    setNativeFullscreen(nativa);
    setAndroidPlayer(android);
    if (nativa) {
      if (android) void activarReproductorHorizontalAndroid();
      else void activarPantallaCompleta();
      setIsFullscreen(true);
    } else {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }

    const cambio = () => {
      if (!nativa) setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", cambio);
    return () => {
      document.removeEventListener("fullscreenchange", cambio);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (android) void salirReproductorHorizontalAndroid();
      else void salirPantallaCompleta();
    };
  }, []);

  useEffect(() => {
    const flush = () => guardarProgreso(currentRef.current, durationRef.current);
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [guardarProgreso]);

  const mostrarControles = useCallback(() => {
    if (androidPlayer) setSourcesVisible(false);
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(
      () => setControlsVisible(false),
      OCULTAR_CONTROLES_MS
    );
  }, [androidPlayer]);

  /** En Android el selector es una capa propia: no vuelve a abrir controles. */
  const mostrarFuentesAndroid = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setControlsVisible(false);
    setSourcesVisible(true);
  }, []);

  const alternarControles = () => {
    if (androidPlayer && sourcesVisible) {
      mostrarControles();
      return;
    }
    if (controlsVisible) {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      setControlsVisible(false);
    } else {
      mostrarControles();
    }
  };

  const alternarPlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => {});
    else video.pause();
    mostrarControles();
  };

  const cambiarFuente = async (source: Fuente) => {
    if (!data) return;
    if (source.id === data.selected_source) {
      if (androidPlayer) setSourcesVisible(false);
      return;
    }
    const position = currentRef.current;
    guardarProgreso(position, durationRef.current);
    if (androidPlayer) setSourcesVisible(false);
    await cargar(source.id, position);
    if (androidPlayer) {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      setControlsVisible(false);
    } else {
      mostrarControles();
    }
  };

  const cambiarTiempo = (value: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = value;
    currentRef.current = value;
    setCurrentTime(value);
    mostrarControles();
  };

  const cambiarVolumen = (value: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = value;
    video.muted = value === 0;
    setVolume(value);
    setMuted(value === 0);
  };

  const alternarMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
    mostrarControles();
  };

  const alternarFullscreen = async () => {
    if (androidPlayer) {
      if (isFullscreen) await salirReproductorHorizontalAndroid();
      else await activarReproductorHorizontalAndroid();
    } else if (isFullscreen) await salirPantallaCompleta();
    else await activarPantallaCompleta();
    if (nativeFullscreen) setIsFullscreen((value) => !value);
    mostrarControles();
  };

  const volver = async () => {
    guardarProgreso(currentRef.current, durationRef.current);
    if (androidPlayer) await salirReproductorHorizontalAndroid();
    else await salirPantallaCompleta();
    router.push(`/explorar/${source}/${slug}`);
  };

  const esNativo = data?.playback.kind === "hls" || data?.playback.kind === "mp4";

  return (
    <div
      className={`fixed inset-0 z-[100] h-[100dvh] w-[100dvw] overflow-hidden bg-black text-white ${
        androidPlayer ? "android-anime-horizontal" : ""
      }`}
      onPointerMove={(event) => {
        // Mover el mouse nunca abre las capas. Si el usuario ya las abrió con
        // un clic, el movimiento solo renueva sus cinco segundos de actividad.
        if (controlsVisible && event.pointerType === "mouse") mostrarControles();
      }}
      data-od-id={`${source}-native-player`}
    >
      {data?.poster_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={data.poster_url}
          alt=""
          className="absolute inset-0 h-full w-full scale-105 object-cover opacity-25 blur-2xl"
          referrerPolicy="no-referrer"
        />
      )}

      <div className="absolute inset-0 flex items-center justify-center bg-black">
        {esNativo && (
          <video
            ref={videoRef}
            className="h-full w-full object-contain"
            poster={data.poster_url ?? undefined}
            playsInline
            preload="auto"
            onClick={alternarControles}
            onPlay={() => {
              setPlaying(true);
              guardarProgreso(currentRef.current, durationRef.current);
              mostrarControles();
            }}
            onPause={() => {
              setPlaying(false);
              guardarProgreso(currentRef.current, durationRef.current);
              mostrarControles();
            }}
            onCanPlay={() => setMediaReady(true)}
            onLoadedMetadata={(event) => {
              const total = event.currentTarget.duration;
              setDuration(Number.isFinite(total) ? total : 0);
              durationRef.current = Number.isFinite(total) ? total : 0;
            }}
            onTimeUpdate={(event) => {
              const position = event.currentTarget.currentTime;
              const total = event.currentTarget.duration;
              currentRef.current = position;
              durationRef.current = Number.isFinite(total) ? total : 0;
              const ahora = performance.now();
              // El WebView no necesita redibujar el reproductor cuatro veces
              // por segundo. Los refs conservan precisión para progreso/salida.
              if (!androidPlayer || ahora - lastUiUpdateRef.current >= 500) {
                lastUiUpdateRef.current = ahora;
                setCurrentTime(position);
                setDuration(durationRef.current);
              }
              if (Math.abs(position - lastSavedRef.current) >= GUARDAR_CADA_SEGUNDOS) {
                guardarProgreso(position, durationRef.current);
              }
            }}
            onEnded={() => {
              setPlaying(false);
              guardarProgreso(durationRef.current, durationRef.current);
              setControlsVisible(true);
            }}
          />
        )}

        {data?.playback.kind === "embed" && (
          <iframe
            key={data.playback.url}
            src={data.playback.url}
            title={`${data.selected_source} · ${data.episode_title}`}
            className="h-full w-full border-0"
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            sandbox="allow-same-origin allow-scripts allow-forms allow-presentation allow-downloads"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            onLoad={() => setMediaReady(true)}
          />
        )}
      </div>

      {(loading || !mediaReady) && !error && (
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-black/55">
          <div className="text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/25 border-t-accent" />
            <p className="mt-4 font-mono text-[11px] font-bold tracking-[0.16em] text-white/70">
              Preparando episodio
            </p>
          </div>
        </div>
      )}

      {esNativo && controlsVisible && mediaReady && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            alternarPlay();
          }}
          className="absolute left-1/2 top-1/2 z-30 grid h-20 w-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/70 text-3xl shadow-2xl transition-colors hover:bg-accent hover:text-black"
          aria-label={playing ? "Pausar" : "Reproducir"}
        >
          {playing ? "Ⅱ" : "▶"}
        </button>
      )}

      <div
        className={`absolute inset-x-0 top-0 z-40 bg-black/90 px-3 pb-4 transition-opacity sm:px-6 ${
          controlsVisible ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={volver}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/20 bg-black/45 text-xl  hover:border-line-strong"
            aria-label="Volver a episodios"
          >
            ←
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-base font-bold sm:text-xl">
              {data?.series_title ?? sourceName}
            </p>
            <p className="truncate font-mono text-[11px] tracking-[0.06em] text-white/65">
              {data ? `Episodio ${data.episode_number} · ${data.sources.find((s) => s.id === data.selected_source)?.label ?? "Fuente"}` : "Cargando"}
            </p>
          </div>
          <button
            type="button"
            onClick={alternarFullscreen}
            className="min-h-11 rounded-md border border-white/20 bg-black/45 px-3 font-mono text-[11px] font-bold tracking-[0.1em]  hover:border-line-strong"
          >
            {isFullscreen ? "Salir" : "Pantalla completa"}
          </button>
        </div>
      </div>

      <div
        className={`absolute inset-x-0 bottom-0 z-40 bg-black/90 transition-opacity ${
          androidPlayer ? "px-4 pt-10" : "px-3 pt-16 sm:px-6"
        } ${
          controlsVisible ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        onClick={(event) => event.stopPropagation()}
      >
        {error && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-red-400/35 bg-red-950/75 px-4 py-3 text-sm">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void cargar(data?.selected_source, currentRef.current)}
              className="font-mono text-[11px] font-bold text-white underline"
            >
              Reintentar
            </button>
          </div>
        )}

        {esNativo && (
          <>
            <input
              type="range"
              min={0}
              max={Math.max(duration, 1)}
              step={0.1}
              value={Math.min(currentTime, Math.max(duration, 1))}
              onChange={(event) => cambiarTiempo(Number(event.target.value))}
              className="h-1.5 w-full cursor-pointer accent-[var(--accent)]"
              aria-label="Progreso del episodio"
            />
            <div className="mt-3 flex items-center gap-3">
              {!androidPlayer && (
                <>
                  <button
                    type="button"
                    onClick={alternarPlay}
                    className="grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-white/10 text-lg hover:border-line-strong"
                    aria-label={playing ? "Pausar" : "Reproducir"}
                  >
                    {playing ? "Ⅱ" : "▶"}
                  </button>
                  <button
                    type="button"
                    onClick={alternarMute}
                    className="grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-white/10 text-base hover:border-line-strong"
                    aria-label={muted ? "Activar sonido" : "Silenciar"}
                  >
                    {muted ? "×" : "♪"}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={muted ? 0 : volume}
                    onChange={(event) => cambiarVolumen(Number(event.target.value))}
                    className="hidden w-24 accent-[var(--accent)] sm:block"
                    aria-label="Volumen"
                  />
                </>
              )}
              <span className={`font-mono text-[11px] tabular-nums text-white/75 ${androidPlayer ? "ml-auto" : ""}`}>
                {reloj(currentTime)} / {reloj(duration)}
              </span>
            </div>
          </>
        )}

        {!androidPlayer && <div className="mt-3 border-t border-white/15 pt-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="shrink-0 font-mono text-[11px] font-bold tracking-[0.06em] text-white/45">
              Fuentes
            </span>
            {data?.sources.map((source) => (
              <button
                key={source.id}
                type="button"
                onClick={() => void cambiarFuente(source)}
                className={`min-h-10 shrink-0 rounded-md border px-4 font-mono text-[11px] font-bold tracking-[0.08em] transition ${
                  source.id === data.selected_source
                    ? "border-accent bg-accent text-black"
                    : "border-white/20 bg-white/5 text-white hover:border-line-strong"
                }`}
              >
                {source.label}
              </button>
            ))}
          </div>
          <p className="mt-2 font-mono text-[11px] tracking-[0.1em] text-white/40">
            Reproducción provista por {sourceName} · MangaTotal no aloja el video
          </p>
        </div>}
      </div>

      {androidPlayer && sourcesVisible && (
        <div
          className="absolute inset-x-0 bottom-0 z-50 border-t border-white/20 bg-black/95 px-4 pt-5"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
          onClick={(event) => event.stopPropagation()}
          data-od-id={`${source}-android-sources`}
        >
          <div className="flex items-center gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span className="shrink-0 pr-1 font-mono text-[11px] font-bold tracking-[0.06em] text-white/55">
              Fuentes
            </span>
            {data?.sources.map((source) => (
              <button
                key={source.id}
                type="button"
                onClick={() => void cambiarFuente(source)}
                className={`min-h-11 shrink-0 rounded-md border px-4 font-mono text-[11px] font-bold tracking-[0.08em] transition ${
                  source.id === data.selected_source
                    ? "border-accent bg-accent text-black"
                    : "border-white/25 bg-white/5 text-white"
                }`}
              >
                {source.label}
              </button>
            ))}
          </div>
          <p className="font-mono text-[11px] tracking-[0.1em] text-white/40">
            Reproducción provista por {sourceName} · MangaTotal no aloja el video
          </p>
        </div>
      )}

      {!controlsVisible && !sourcesVisible && (
        <button
          type="button"
          onClick={androidPlayer ? mostrarFuentesAndroid : mostrarControles}
          className="absolute bottom-4 right-3 z-50 min-h-11 rounded-full border border-white/20 bg-black/35 px-4 font-mono text-[11px] font-bold tracking-[0.1em] text-white/60  hover:border-line-strong hover:text-white"
          style={{ marginBottom: "env(safe-area-inset-bottom)" }}
        >
          Fuentes
        </button>
      )}
    </div>
  );
}

export function JkanimePlayer({ slug, episode }: { slug: string; episode: string }) {
  return (
    <ReproductorAnimeExterno
      slug={slug}
      episode={episode}
      source="jkanime"
      sourceName="JKAnime"
    />
  );
}
