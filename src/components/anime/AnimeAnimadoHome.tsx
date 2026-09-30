"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fichaAnimeHref,
  type FuenteAnimeExterna,
} from "@/lib/animeExternos";

type Fuente = FuenteAnimeExterna;
type FiltroFuente = "todo" | Fuente;

interface AnimeTitulo {
  source: Fuente;
  external_id: string;
  slug: string;
  title: string;
  cover_url: string | null;
  type: string | null;
  status: string | null;
  description?: string | null;
  genres?: string[];
  total_episodes?: number | null;
  href: string;
}

interface CatalogoRespuesta {
  series?: {
    id?: string | number | null;
    slug: string;
    title: string;
    cover_url?: string | null;
    type?: string | null;
    status?: string | null;
    description?: string | null;
    genres?: string[];
  }[];
  error?: string;
}

interface AnimeConProgreso extends AnimeTitulo {
  resume_href: string | null;
  last_episode_number: string | null;
  last_episode_title: string | null;
  completed: boolean;
}

interface HistorialRespuesta {
  historial?: AnimeConProgreso[];
  continuar?: AnimeConProgreso[];
}

interface BibliotecaItem extends AnimeConProgreso {
  saved?: boolean;
  total_episodes?: number | null;
}

const FUENTES: { id: FiltroFuente; nombre: string }[] = [
  { id: "todo", nombre: "Todo" },
  { id: "jkanime", nombre: "JKAnime" },
  { id: "tioanime", nombre: "TioAnime" },
  { id: "hentaitv", nombre: "HentaiTV" },
];

interface AnimeAnimadoHomeProps {
  adultosHabilitados?: boolean;
}

const RUTAS: Record<Fuente, string> = {
  jkanime: "/api/anime/jkanime?page=1&sort=popularidad",
  tioanime: "/api/anime/tioanime?page=1&sort=recent",
  hentaitv: "/api/anime/hentaitv?page=1&sort=date_desc",
};

const ETIQUETAS: Record<Fuente, string> = {
  jkanime: "JKAnime",
  tioanime: "TioAnime",
  hentaitv: "HentaiTV",
};

const CLASE_BOTON =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border px-4 font-mono text-[11px] font-bold tracking-[0.05em] transition disabled:cursor-wait disabled:opacity-50";

function clave(anime: Pick<AnimeTitulo, "source" | "external_id">) {
  return `${anime.source}:${anime.external_id}`;
}

async function pedirJson<T>(url: string): Promise<T> {
  const respuesta = await fetch(url, { cache: "no-store" });
  const datos = (await respuesta.json().catch(() => ({}))) as T & { error?: string };
  if (!respuesta.ok) throw new Error(datos.error || `Error ${respuesta.status}`);
  return datos;
}

function normalizarCatalogo(source: Fuente, data: CatalogoRespuesta): AnimeTitulo[] {
  return (data.series ?? [])
    .filter((serie) => Boolean(serie.slug && serie.title))
    .map((serie) => ({
      source,
      external_id: serie.slug,
      slug: serie.slug,
      title: serie.title,
      cover_url: serie.cover_url ?? null,
      type: serie.type ?? null,
      status: serie.status ?? null,
      description: serie.description ?? null,
      genres: serie.genres ?? [],
      href: fichaAnimeHref(source, serie.slug, serie.slug),
    }));
}

function normalizarBiblioteca(item: BibliotecaItem): AnimeConProgreso | null {
  if (
    !item ||
    (item.source !== "jkanime" && item.source !== "tioanime" && item.source !== "hentaitv") ||
    !item.external_id
  ) {
    return null;
  }
  const slug = item.slug || item.external_id;
  return {
    ...item,
    slug,
    cover_url: item.cover_url ?? null,
    href: item.href || fichaAnimeHref(item.source, item.external_id, slug),
    resume_href: item.resume_href ?? null,
    last_episode_number: item.last_episode_number ?? null,
    last_episode_title: item.last_episode_title ?? null,
    completed: Boolean(item.completed),
  };
}

function Icono({ nombre, className = "h-5 w-5" }: { nombre: "play" | "search" | "left" | "right" | "bookmark" | "close"; className?: string }) {
  const paths = {
    play: <path d="m8 5 12 7-12 7V5Z" fill="currentColor" stroke="none" />,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></>,
    left: <><path d="m15 18-6-6 6-6" /><path d="M9 12h11" /></>,
    right: <><path d="m9 18 6-6-6-6" /><path d="M4 12h11" /></>,
    bookmark: <path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-3.8L6 21V4.5Z" />,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {paths[nombre]}
    </svg>
  );
}

function AnimeCard({
  anime,
  onOpen,
  progreso,
}: {
  anime: AnimeTitulo;
  onOpen: (anime: AnimeTitulo) => void;
  progreso?: string | null;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(anime)}
      className="group w-[145px] shrink-0 text-left sm:w-[175px] md:w-[195px]"
      aria-label={`Ver detalles de ${anime.title}`}
    >
      <span className="relative block aspect-[2/3] overflow-hidden rounded-xl border border-line bg-[var(--surface-raised)] shadow-sm transition duration-300 group-hover:-translate-y-1 group-hover:border-accent group-hover:shadow-xl group-hover:shadow-accent/10">
        {anime.cover_url ? (
          // Las fuentes entregan dominios variados; se muestra la imagen remota sin restringirla al allowlist de next/image.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={anime.cover_url} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
        ) : (
          <span className="grid h-full place-items-center px-3 text-center text-xs text-subtle">Portada no disponible</span>
        )}
        <span className="absolute left-2 top-2 rounded-full border border-white/10 bg-black/75 px-2.5 py-1 font-mono text-[10px] font-bold text-white backdrop-blur">
          {ETIQUETAS[anime.source]}
        </span>
        {progreso && (
          <span className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
            <span className="block h-full w-1/3 bg-accent-ink" />
          </span>
        )}
      </span>
      <span className="mt-3 block truncate text-sm font-bold text-ink group-hover:text-accent-ink">{anime.title}</span>
      <span className="mt-1 block truncate font-mono text-[10px] uppercase tracking-[0.08em] text-subtle">
        {anime.type || anime.status || "Anime"}{progreso ? ` · Cap. ${progreso}` : ""}
      </span>
    </button>
  );
}

function FilaAnime({
  titulo,
  items,
  onOpen,
  continuacion = false,
}: {
  titulo: string;
  items: AnimeTitulo[];
  onOpen: (anime: AnimeTitulo) => void;
  continuacion?: boolean;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  if (items.length === 0) return null;
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-accent-ink">{continuacion ? "Tu progreso" : "Descubrir"}</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-ink sm:text-2xl">{titulo}</h2>
        </div>
        <div className="hidden gap-2 sm:flex">
          <button type="button" aria-label={`Desplazar ${titulo} a la izquierda`} onClick={() => scroller.current?.scrollBy({ left: -480, behavior: "smooth" })} className="grid h-10 w-10 place-items-center rounded-full border border-line text-subtle transition hover:border-accent hover:text-accent-ink"><Icono nombre="left" /></button>
          <button type="button" aria-label={`Desplazar ${titulo} a la derecha`} onClick={() => scroller.current?.scrollBy({ left: 480, behavior: "smooth" })} className="grid h-10 w-10 place-items-center rounded-full border border-line text-subtle transition hover:border-accent hover:text-accent-ink"><Icono nombre="right" /></button>
        </div>
      </div>
      <div ref={scroller} className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-3 scrollbar-none sm:mx-0 sm:gap-5 sm:px-0">
        {items.map((anime) => (
          <AnimeCard
            key={clave(anime)}
            anime={anime}
            onOpen={onOpen}
            progreso={continuacion ? (anime as AnimeConProgreso).last_episode_number : null}
          />
        ))}
      </div>
    </section>
  );
}

export function AnimeAnimadoHome({ adultosHabilitados = false }: AnimeAnimadoHomeProps) {
  const [catalogos, setCatalogos] = useState<Record<Fuente, AnimeTitulo[]>>({ jkanime: [], tioanime: [], hentaitv: [] });
  const [guardadas, setGuardadas] = useState<AnimeConProgreso[]>([]);
  const [continuar, setContinuar] = useState<AnimeConProgreso[]>([]);
  const [historial, setHistorial] = useState<AnimeConProgreso[]>([]);
  const [fuente, setFuente] = useState<FiltroFuente>("todo");
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<AnimeTitulo[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [seleccionado, setSeleccionado] = useState<AnimeTitulo | null>(null);
  const [favoritos, setFavoritos] = useState<Set<string>>(new Set());
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [destacado, setDestacado] = useState(0);
  const requestId = useRef(0);

  const cargarInicio = useCallback(async () => {
    setCargando(true);
    setError(false);
    const fuentes: Fuente[] = adultosHabilitados
      ? ["jkanime", "tioanime", "hentaitv"]
      : ["jkanime", "tioanime"];
    const resultadosFuentes = await Promise.allSettled(
      fuentes.map(async (source) => ({ source, data: await pedirJson<CatalogoRespuesta>(RUTAS[source]) }))
    );
    const nuevoCatalogo: Record<Fuente, AnimeTitulo[]> = { jkanime: [], tioanime: [], hentaitv: [] };
    let disponibles = 0;
    resultadosFuentes.forEach((resultado) => {
      if (resultado.status !== "fulfilled") return;
      const { source, data } = resultado.value;
      nuevoCatalogo[source] = normalizarCatalogo(source, data);
      disponibles += 1;
    });
    setCatalogos(nuevoCatalogo);
    setError(disponibles === 0);

    const [progreso, biblioteca] = await Promise.allSettled([
      pedirJson<HistorialRespuesta>("/api/anime/externo/historial"),
      pedirJson<BibliotecaItem[]>("/api/anime/externo/biblioteca"),
    ]);
    if (progreso.status === "fulfilled") {
      setContinuar((progreso.value.continuar ?? []).map(normalizarBiblioteca).filter((item): item is AnimeConProgreso => Boolean(item)));
      setHistorial((progreso.value.historial ?? []).map(normalizarBiblioteca).filter((item): item is AnimeConProgreso => Boolean(item)));
    }
    if (biblioteca.status === "fulfilled") {
      const lista = biblioteca.value.map(normalizarBiblioteca).filter((item): item is AnimeConProgreso => Boolean(item));
      setGuardadas(lista);
      setFavoritos(new Set(lista.map(clave)));
    }
    setCargando(false);
  }, [adultosHabilitados]);

  useEffect(() => {
    void cargarInicio();
  }, [cargarInicio]);

  useEffect(() => {
    const id = ++requestId.current;
    const termino = busqueda.trim();
    if (!termino) {
      setResultados([]);
      setBuscando(false);
      return;
    }
    const timer = window.setTimeout(async () => {
      setBuscando(true);
      const fuentes: Fuente[] = adultosHabilitados
        ? ["jkanime", "tioanime", "hentaitv"]
        : ["jkanime", "tioanime"];
      const datos = await Promise.allSettled(
        fuentes.map(async (source) => {
          const params = new URLSearchParams(RUTAS[source].split("?")[1]);
          params.set("q", termino);
          const respuesta = await pedirJson<CatalogoRespuesta>(`/api/anime/${source}?${params}`);
          return normalizarCatalogo(source, respuesta);
        })
      );
      if (id !== requestId.current) return;
      const series = datos.flatMap((resultado) => resultado.status === "fulfilled" ? resultado.value : []);
      setResultados(series);
      setBuscando(false);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [adultosHabilitados, busqueda]);

  useEffect(() => {
    if (!seleccionado) return;
    const cerrarConEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSeleccionado(null);
    };
    window.addEventListener("keydown", cerrarConEscape);
    return () => window.removeEventListener("keydown", cerrarConEscape);
  }, [seleccionado]);

  const disponibles = useMemo(
    () => adultosHabilitados ? FUENTES : FUENTES.filter((item) => item.id !== "hentaitv"),
    [adultosHabilitados]
  );
  const itemsBusqueda = useMemo(
    () => resultados.filter((anime) => fuente === "todo" || anime.source === fuente),
    [resultados, fuente]
  );
  const catalogoVisible = useMemo(() => {
    const todo = [...catalogos.jkanime, ...catalogos.tioanime, ...(adultosHabilitados ? catalogos.hentaitv : [])];
    return fuente === "todo" ? todo : catalogos[fuente];
  }, [adultosHabilitados, catalogos, fuente]);
  const continuarVisible = useMemo(
    () => fuente === "todo" ? continuar : continuar.filter((anime) => anime.source === fuente),
    [continuar, fuente]
  );
  const historialVisible = useMemo(
    () => fuente === "todo" ? historial : historial.filter((anime) => anime.source === fuente),
    [historial, fuente]
  );
  const guardadasVisibles = useMemo(
    () => fuente === "todo" ? guardadas : guardadas.filter((anime) => anime.source === fuente),
    [fuente, guardadas]
  );
  const destacados = useMemo(
    () => continuarVisible.length ? continuarVisible : catalogoVisible.slice(0, 8),
    [catalogoVisible, continuarVisible]
  );
  const actual = destacados.length ? destacados[destacado % destacados.length] : null;
  const enEmision = catalogoVisible.filter((anime) => /emisi[oó]n|ongoing|airing|activo/i.test(anime.status ?? ""));
  const peliculas = catalogoVisible.filter((anime) => /pel[ií]cula|movie|film/i.test(anime.type ?? ""));

  useEffect(() => {
    if (destacados.length < 2 || busqueda.trim()) return;
    const timer = window.setInterval(() => setDestacado((valor) => (valor + 1) % destacados.length), 6500);
    return () => window.clearInterval(timer);
  }, [destacados.length, busqueda]);

  async function alternarBiblioteca(anime: AnimeTitulo) {
    const itemKey = clave(anime);
    // Este panel permite sumar títulos, nunca borrar una serie ya guardada.
    if (favoritos.has(itemKey)) return;
    setGuardando(true);
    setMensaje(null);
    try {
      const respuesta = await fetch("/api/anime/externo/biblioteca", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: anime.source,
          external_id: anime.external_id,
          slug: anime.slug,
          title: anime.title,
          cover_url: anime.cover_url,
          type: anime.type,
          status: anime.status,
          total_episodes: anime.total_episodes ?? null,
        }),
      });
      if (!respuesta.ok) {
        const errorApi = await respuesta.json().catch(() => null) as { error?: string } | null;
        throw new Error(errorApi?.error ?? "No se pudo actualizar tu biblioteca");
      }
      setFavoritos((previo) => {
        const nuevo = new Set(previo);
        nuevo.add(itemKey);
        return nuevo;
      });
      const guardada = normalizarBiblioteca(await respuesta.json() as BibliotecaItem);
      if (guardada) setGuardadas((previo) => [guardada, ...previo.filter((item) => clave(item) !== itemKey)]);
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : "No se pudo actualizar tu biblioteca");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-10 pb-8 sm:space-y-14">
      <header className="space-y-6 border-b border-line pb-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-accent-ink">MangaTotal · reproducción desde las fuentes</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Anime animado</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-subtle">Descubrí series de tus fuentes, retomá donde quedaste y organizá tu biblioteca en MangaTotal.</p>
          </div>
          <Link href="/biblioteca?seccion=anime-animado" className={`${CLASE_BOTON} border-line text-subtle hover:border-accent hover:text-accent-ink`}>
            <Icono nombre="bookmark" className="h-4 w-4" /> Mi biblioteca
          </Link>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Icono nombre="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Buscar una serie…"
              aria-label="Buscar anime animado"
              className="h-12 w-full rounded-lg border border-line bg-[var(--surface)] pl-10 pr-4 text-sm text-ink outline-none transition placeholder:text-subtle focus:border-accent"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0" role="group" aria-label="Filtrar por fuente">
            {disponibles.map(({ id, nombre }) => (
              <button
                key={id}
                type="button"
                onClick={() => setFuente(id)}
                className={`${CLASE_BOTON} min-h-10 shrink-0 px-3 ${fuente === id ? "border-accent bg-[var(--accent-soft)] text-accent-ink" : "border-line text-subtle hover:border-line-strong hover:text-ink"}`}
              >
                {nombre}
              </button>
            ))}
          </div>
        </div>

        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-4" aria-label="Secciones de anime animado">
          <a href="#anime-destacados" className="font-mono text-[11px] font-bold tracking-[0.05em] text-subtle transition hover:text-accent-ink">Destacados</a>
          <a href="#anime-progreso" className="font-mono text-[11px] font-bold tracking-[0.05em] text-subtle transition hover:text-accent-ink">Tu progreso</a>
          <a href="#anime-fuentes" className="font-mono text-[11px] font-bold tracking-[0.05em] text-subtle transition hover:text-accent-ink">Por fuente</a>
          <a href="#anime-catalogo" className="font-mono text-[11px] font-bold tracking-[0.05em] text-accent-ink transition hover:underline">Catálogo y filtros ↓</a>
        </nav>
      </header>

      {busqueda.trim() ? (
        <section className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-accent-ink">Resultados</p>
              <h2 className="mt-1 text-xl font-bold text-ink">“{busqueda.trim()}”</h2>
            </div>
            {buscando && <span className="font-mono text-xs text-subtle">Buscando…</span>}
          </div>
          {buscando && itemsBusqueda.length === 0 ? (
            <div className="rounded-xl border border-line bg-[var(--surface)] p-8 text-center text-sm text-subtle">Buscando en las fuentes…</div>
          ) : itemsBusqueda.length ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {itemsBusqueda.map((anime) => <AnimeCard key={clave(anime)} anime={anime} onOpen={setSeleccionado} />)}
            </div>
          ) : (
            <div className="rounded-xl border border-line bg-[var(--surface)] p-8 text-center">
              <p className="font-bold text-ink">No encontramos esa serie</p>
              <p className="mt-1 text-sm text-subtle">Probá con otro nombre o seleccioná otra fuente.</p>
            </div>
          )}
        </section>
      ) : (
        <>
          {actual && (
            <section id="anime-destacados" className="relative isolate min-h-[390px] overflow-hidden rounded-2xl border border-line bg-[var(--surface)] shadow-xl shadow-black/20 sm:min-h-[440px]">
              {actual.cover_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={actual.cover_url} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover opacity-30 blur-[2px] sm:opacity-40" />
              )}
              <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[var(--background)] via-[var(--background)]/85 to-[var(--background)]/20" />
              <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[var(--background)] via-transparent to-[var(--background)]/15" />
              <div className="flex min-h-[390px] items-end p-5 sm:min-h-[440px] sm:p-10 lg:p-14">
                <div className="max-w-2xl">
                  <div className="mb-4 flex flex-wrap gap-2">
                    <span className="rounded-full border border-accent/40 bg-accent/20 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-accent-ink">{ETIQUETAS[actual.source]}</span>
                    {actual.type && <span className="rounded-full border border-white/15 bg-black/35 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-white">{actual.type}</span>}
                    {actual.status && <span className="rounded-full border border-white/15 bg-black/35 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-white">{actual.status}</span>}
                  </div>
                  <h2 className="line-clamp-3 text-3xl font-black leading-tight tracking-tight text-ink drop-shadow sm:text-5xl">{actual.title}</h2>
                  {actual.description && <p className="mt-4 line-clamp-3 max-w-xl text-sm leading-6 text-ink/80">{actual.description}</p>}
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link href={(actual as AnimeConProgreso).resume_href || actual.href} className={`${CLASE_BOTON} border-accent bg-accent text-[var(--on-accent)] hover:opacity-90`}>
                      <Icono nombre="play" className="h-4 w-4" /> {(actual as AnimeConProgreso).resume_href ? "Continuar viendo" : "Ver capítulos"}
                    </Link>
                    <button type="button" onClick={() => setSeleccionado(actual)} className={`${CLASE_BOTON} border-line bg-black/30 text-ink backdrop-blur hover:border-accent hover:text-accent-ink`}>Detalles</button>
                  </div>
                </div>
              </div>
              {destacados.length > 1 && (
                <div className="absolute bottom-5 right-5 flex items-center gap-2 sm:bottom-8 sm:right-8">
                  <button type="button" aria-label="Destacado anterior" onClick={() => setDestacado((valor) => (valor - 1 + destacados.length) % destacados.length)} className="grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-black/30 text-white backdrop-blur hover:border-accent"><Icono nombre="left" /></button>
                  <span className="px-1 font-mono text-xs text-white">{(destacado % destacados.length) + 1} / {destacados.length}</span>
                  <button type="button" aria-label="Siguiente destacado" onClick={() => setDestacado((valor) => (valor + 1) % destacados.length)} className="grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-black/30 text-white backdrop-blur hover:border-accent"><Icono nombre="right" /></button>
                </div>
              )}
            </section>
          )}

          {cargando ? (
            <div className="grid min-h-28 place-items-center rounded-xl border border-line bg-[var(--surface)] font-mono text-xs text-subtle">Cargando catálogos…</div>
          ) : error ? (
            <div className="rounded-xl border border-line bg-[var(--surface)] p-8 text-center">
              <p className="font-bold text-ink">No se pudieron cargar los catálogos</p>
              <button type="button" onClick={() => void cargarInicio()} className="mt-3 font-mono text-xs font-bold text-accent-ink underline underline-offset-4">Reintentar</button>
            </div>
          ) : (
            <>
              <div id="anime-progreso" className="space-y-10 scroll-mt-24">
                <FilaAnime titulo="Continuar viendo" items={continuarVisible} onOpen={setSeleccionado} continuacion />
                <FilaAnime titulo="Mi lista" items={guardadasVisibles} onOpen={setSeleccionado} />
                <FilaAnime titulo="Lo último que viste" items={historialVisible} onOpen={setSeleccionado} continuacion />
              </div>
              <div id="anime-fuentes" className="space-y-10 scroll-mt-24">
                {fuente === "todo" ? (
                  <>
                    <FilaAnime titulo="Populares en JKAnime" items={catalogos.jkanime} onOpen={setSeleccionado} />
                    <FilaAnime titulo="Novedades de TioAnime" items={catalogos.tioanime} onOpen={setSeleccionado} />
                    {adultosHabilitados && <FilaAnime titulo="Catálogo HentaiTV · +18" items={catalogos.hentaitv} onOpen={setSeleccionado} />}
                  </>
                ) : (
                  <FilaAnime titulo={`Catálogo de ${ETIQUETAS[fuente]}`} items={catalogos[fuente]} onOpen={setSeleccionado} />
                )}
                <FilaAnime titulo="En emisión" items={enEmision} onOpen={setSeleccionado} />
                <FilaAnime titulo="Películas y especiales" items={peliculas} onOpen={setSeleccionado} />
              </div>
              {!catalogos.jkanime.length && !catalogos.tioanime.length && !catalogos.hentaitv.length && (
                <p className="py-8 text-center text-sm text-subtle">No hay series disponibles en las fuentes habilitadas.</p>
              )}
            </>
          )}
        </>
      )}

      {seleccionado && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) setSeleccionado(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="anime-animado-dialog-title" className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl border border-line bg-[var(--surface)] shadow-2xl sm:max-w-3xl sm:rounded-2xl">
            <button type="button" onClick={() => setSeleccionado(null)} aria-label="Cerrar detalles" className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full border border-line bg-[var(--background)]/80 text-ink hover:border-accent"><Icono nombre="close" /></button>
            <div className="grid sm:grid-cols-[220px_1fr]">
              <div className="relative aspect-[2/1] overflow-hidden bg-[var(--surface-raised)] sm:aspect-auto sm:min-h-[350px]">
                {seleccionado.cover_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={seleccionado.cover_url} alt={`Portada de ${seleccionado.title}`} className="absolute inset-0 h-full w-full object-cover" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--surface)] via-transparent to-black/10 sm:bg-gradient-to-r sm:from-transparent sm:to-[var(--surface)]" />
              </div>
              <div className="space-y-5 p-5 sm:p-8">
                <div>
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-accent-ink">{ETIQUETAS[seleccionado.source]}{seleccionado.type ? ` · ${seleccionado.type}` : ""}</p>
                  <h2 id="anime-animado-dialog-title" className="mt-2 text-2xl font-black leading-tight text-ink sm:text-3xl">{seleccionado.title}</h2>
                  {seleccionado.status && <p className="mt-2 text-sm text-subtle">{seleccionado.status}</p>}
                </div>
                {seleccionado.description && <p className="max-h-40 overflow-y-auto whitespace-pre-line text-sm leading-6 text-subtle">{seleccionado.description}</p>}
                {seleccionado.genres && seleccionado.genres.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {seleccionado.genres.slice(0, 8).map((genero) => <span key={genero} className="rounded-full border border-line px-3 py-1 text-xs text-subtle">{genero}</span>)}
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Link href={(seleccionado as AnimeConProgreso).resume_href || seleccionado.href} className={`${CLASE_BOTON} border-accent bg-accent text-[var(--on-accent)] hover:opacity-90`}>
                    <Icono nombre="play" className="h-4 w-4" /> {(seleccionado as AnimeConProgreso).resume_href ? "Continuar" : "Ver capítulos"}
                  </Link>
                  <button type="button" disabled={guardando || favoritos.has(clave(seleccionado))} onClick={() => void alternarBiblioteca(seleccionado)} className={`${CLASE_BOTON} ${favoritos.has(clave(seleccionado)) ? "border-accent bg-[var(--accent-soft)] text-accent-ink" : "border-line text-ink hover:border-accent hover:text-accent-ink"}`}>
                    <Icono nombre="bookmark" className="h-4 w-4" /> {guardando ? "Guardando…" : favoritos.has(clave(seleccionado)) ? "Ya está en mi biblioteca" : "Guardar en mi biblioteca"}
                  </button>
                </div>
                {mensaje && <p role="status" className="text-sm text-red-400">{mensaje}</p>}
                <p className="border-t border-line pt-4 text-xs leading-5 text-subtle">La serie y los capítulos se cargan desde {ETIQUETAS[seleccionado.source]}. MangaTotal no aloja los videos.</p>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
