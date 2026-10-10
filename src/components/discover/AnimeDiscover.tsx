"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { HeroCarousel } from "./HeroCarousel";
import { MediaRail } from "./MediaRail";
import { DISCOVER_GENRES } from "./DiscoverMenu";
import { EpisodeWatchLink } from "@/components/anime/EpisodeWatchLink";
import { SaveExternalAnimeButton } from "@/components/anime/SaveExternalAnimeButton";
import type { FichaJkanime } from "@/lib/jkanime";
import type { FichaTioanime } from "@/lib/tioanime";

const JkanimeCatalog = dynamic(() => import("@/components/anime/JkanimeCatalog").then(m => m.JkanimeCatalog));
const TioanimeCatalog = dynamic(() => import("@/components/anime/TioanimeCatalog").then(m => m.TioanimeCatalog));
const MiLista = dynamic(() => import("@/components/library/SeccionAnimeExterno").then(m => m.SeccionAnimeExterno));
type Source = "jkanime" | "tioanime";
type Series = { slug: string; title: string; cover_url: string | null; type: string | null; status: string | null };
type Catalog = { series: Series[] };
type Saved = Series & { source: string; external_id: string; href: string; resume_href: string | null; last_episode_number: string | null; last_position_seconds: number; last_duration_seconds: number; completed: boolean };
type Progress = { episode_number: string; position_seconds: number; duration_seconds: number; completed: boolean };
type Detail = FichaJkanime | FichaTioanime;
const SOURCE_NAMES = { jkanime: "JKAnime", tioanime: "TioAnime" };
const TIO_GENRES: Record<string, string> = { "sci-fi": "ciencia-ficcion", "cosas-de-la-vida": "recuentos-de-la-vida", thriller: "suspenso" };

function backdrop(source: Source, cover: string | null) {
  if (source !== "tioanime" || !cover) return null;
  // Ruta publicada por la ficha oficial; no acepta hosts ni URLs arbitrarias.
  const match = /^https:\/\/tioanime\.com\/uploads\/portadas\/(\d+)\.jpg$/.exec(cover);
  return match ? `https://tioanime.com/uploads/fondos/${match[1]}.jpg` : null;
}

function catalogUrl(source: Source, values: Record<string, string> = {}) {
  return `/explorar?${new URLSearchParams({ seccion: "animada", anime_fuente: source, vista: "catalogo", ...values })}`;
}

async function request<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, cache: "no-store" });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.error ?? "La fuente no pudo responder. Probá nuevamente."), { status: res.status });
  return data as T;
}

function Poster({ item, onPreview, saved = false }: { item: Series; onPreview: (item: Series) => void; saved?: boolean }) {
  return <button className="od-media-card" onClick={() => onPreview(item)} aria-label={`Ver ficha de ${item.title}`}>
    <span className="od-media-thumb">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {item.cover_url ? <img src={item.cover_url} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" /> : <span className="od-no-cover">Sin portada</span>}
      <span className="od-media-play" aria-hidden="true">▶</span>
      {saved && <span className="od-saved-badge">✓ En tu lista</span>}
    </span>
    <span className="od-media-title">{item.title}</span>
    <span className="od-media-meta">{[item.type, item.status].filter(Boolean).join(" · ") || "Serie animada"}</span>
  </button>;
}

/** Un riel fuera de pantalla no bloquea el catálogo ni dispara todos los géneros. */
function LazyRail({ title, source, query, load, onPreview, saved }: {
  title: string; source: Source; query: string;
  load: (query: string) => Promise<Catalog>; onPreview: (item: Series) => void; saved: Set<string>;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [data, setData] = useState<Catalog | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!root.current) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: "160px" });
    observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) return;
    let active = true;
    setError("");
    load(query).then(value => { if (active) setData(value); }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [visible, load, query, attempt]);
  return <div ref={root} className="od-lazy-rail">
    <MediaRail title={title} href={catalogUrl(source, Object.fromEntries(new URLSearchParams(query)))}>
      {data?.series.map(item => <Poster key={item.slug} item={item} saved={saved.has(item.slug)} onPreview={onPreview} />)}
      {!data && !error && Array.from({ length: 8 }, (_, i) => <div key={i} className="od-card-skeleton" aria-hidden="true" />)}
    </MediaRail>
    {error && <div className="od-message" role="status"><p>{error}</p><button onClick={() => setAttempt(value => value + 1)}>Reintentar {title}</button></div>}
    {data?.series.length === 0 && <p className="od-message">La fuente no tiene resultados en esta sección. <a href={catalogUrl(source)}>Ver catálogo completo</a></p>}
  </div>;
}

function AnimeSheet({ source, item, close, onLibraryChange }: { source: Source; item: Series; close: () => void; onLibraryChange: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [progressError, setProgressError] = useState(false);
  const closeRef = useRef(close); closeRef.current = close;
  useEffect(() => {
    const node = dialog.current;
    const previousOverflow = document.body.style.overflow;
    const previousUrl = location.pathname + location.search;
    if (location.hash !== "#ficha-anime") history.pushState({ ...history.state, odAnimeSheet: { source, item } }, "", `${previousUrl}#ficha-anime`);
    const back = () => { if (location.hash !== "#ficha-anime") closeRef.current(); };
    window.addEventListener("popstate", back);
    node?.showModal(); document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("popstate", back);
      document.body.style.overflow = previousOverflow;
      node?.close();
      if (location.hash === "#ficha-anime") history.replaceState(history.state, "", previousUrl);
    };
  }, []);
  const dismiss = () => { if (location.hash === "#ficha-anime") history.back(); else close(); };
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(() => controller.abort(), 25000);
    setLoading(true); setError("");
    request<Detail>(`/api/anime/${source}/${encodeURIComponent(item.slug)}?page=${page}`, controller.signal)
      .then(value => { if (active) setDetail(value); })
      .catch(err => { if (active) setError(controller.signal.aborted ? "La fuente tardó demasiado. Podés reintentar o abrir la ficha completa." : err.message); })
      .finally(() => { clearTimeout(timer); if (active) setLoading(false); });
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [source, item.slug, page, attempt]);
  const detailId = detail ? String(detail.id) : null;
  useEffect(() => {
    if (!detailId) return;
    const controller = new AbortController();
    setProgressError(false);
    request<{ episodes: Progress[] }>(`/api/anime/externo/progreso?source=${source}&id=${encodeURIComponent(detailId)}`, controller.signal)
      .then(value => setProgress(value.episodes))
      .catch(err => { if (!controller.signal.aborted && err.status !== 401) setProgressError(true); });
    return () => controller.abort();
  }, [source, detailId]);
  const episodeHref = (number: string) => `/explorar/${source}/${item.slug}/${number}`;
  const latest = progress[0];
  return <dialog ref={dialog} className="od-dialog" aria-labelledby="od-sheet-title" onCancel={event => { event.preventDefault(); dismiss(); }} onClick={event => { if (event.target === event.currentTarget) dismiss(); }}>
    <div className="od-dialog-head">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {item.cover_url && <img src={item.cover_url} alt="" referrerPolicy="no-referrer" />}
      <button className="od-dialog-close" onClick={dismiss} aria-label="Cerrar ficha">×</button>
      <h2 id="od-sheet-title">{detail?.title ?? item.title}</h2>
    </div>
    <div className="od-dialog-body">
      <p className="od-media-meta">{[SOURCE_NAMES[source], detail?.type ?? item.type, detail?.status ?? item.status, detail && `${detail.total_episodes} episodios`].filter(Boolean).join(" · ")}</p>
      <div className="od-hero-actions">
        {latest && !latest.completed && <EpisodeWatchLink replace className="od-primary" href={episodeHref(latest.episode_number)}>▶ Continuar · Ep. {latest.episode_number} · {Math.floor(latest.position_seconds / 60)}:{String(Math.floor(latest.position_seconds % 60)).padStart(2, "0")}</EpisodeWatchLink>}
        <Link replace className="od-outline" href={`/explorar/${source}/${item.slug}`} prefetch={false}>Ficha completa →</Link>
        {detail && <SaveExternalAnimeButton anime={{ source, external_id: String(detail.id), slug: item.slug, title: detail.title, cover_url: detail.cover_url, type: detail.type, status: detail.status, total_episodes: detail.total_episodes }} onChange={onLibraryChange} />}
      </div>
      {detail?.description && <p className="od-synopsis">{detail.description}</p>}
      {detail?.genres && <div className="od-genre-tags">{detail.genres.map(genre => <span key={genre}>{genre}</span>)}</div>}
      <h3>Episodios</h3>
      {progressError && <p role="status">No se pudo consultar tu progreso. Abrí la ficha completa para reintentarlo.</p>}
      {loading && <p role="status">Cargando episodios de {SOURCE_NAMES[source]}…</p>}
      {error && <div role="alert" className="od-message">{error} <button onClick={() => setAttempt(value => value + 1)}>Reintentar</button></div>}
      {!loading && !error && detail?.episodes.map(episode => {
        const watched = progress.find(entry => entry.episode_number === episode.number);
        return <EpisodeWatchLink replace key={episode.id} className="od-episode" href={episodeHref(episode.number)}>
          <span className="od-episode-number">{episode.number}</span><span>{episode.title || `Episodio ${episode.number}`}<small>{watched?.completed ? "Ya visto" : watched?.position_seconds ? `Continuar desde ${Math.floor(watched.position_seconds / 60)}:${String(Math.floor(watched.position_seconds % 60)).padStart(2, "0")}` : "Reproducir en la fuente"}</small></span><span aria-hidden="true">▶</span>
        </EpisodeWatchLink>;
      })}
      {!loading && !error && detail?.episodes.length === 0 && <p>Esta serie todavía no tiene episodios disponibles.</p>}
      {detail && detail.last_page > 1 && <div className="od-pagination"><button disabled={loading || page <= 1} onClick={() => setPage(page - 1)}>← Anterior</button><span>Página {page} de {detail.last_page}</span><button disabled={loading || page >= detail.last_page} onClick={() => setPage(page + 1)}>Siguiente →</button></div>}
    </div>
  </dialog>;
}

export function AnimeDiscover({ source }: { source: Source }) {
  // La barra móvil navega sin recargar: la vista debe seguir la URL, también
  // con Atrás/Adelante. Los filtros internos del catálogo conservan su estado.
  const params = useSearchParams();
  const initial = Object.fromEntries(params);
  const directory = initial.vista === "catalogo";
  const myList = initial.vista === "milista";
  const historyView = initial.vista === "historial";
  const personalView = myList || historyView;
  const listUrl = `/explorar?seccion=animada&anime_fuente=${source}&vista=milista`;
  const historyUrl = `/explorar?seccion=animada&anime_fuente=${source}&vista=historial`;
  const [recent, setRecent] = useState<Series[] | null>(null);
  const [error, setError] = useState("");
  const [library, setLibrary] = useState<Saved[]>([]);
  const [historyItems, setHistoryItems] = useState<Saved[]>([]);
  const [accountError, setAccountError] = useState("");
  const [accountVersion, setAccountVersion] = useState(0);
  const [selected, setSelected] = useState<Series | null>(null);
  useEffect(() => {
    // El gesto Atrás cierra la ficha; Adelante restaura esa misma ficha sin
    // agregar otra entrada. Al reproducir se reemplaza solo la entrada modal.
    const restore = () => {
      const sheet = history.state?.odAnimeSheet;
      setSelected(location.hash === "#ficha-anime" && sheet?.source === source && typeof sheet.item?.slug === "string" ? sheet.item : null);
    };
    restore(); window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [source]);
  const [search, setSearch] = useState("");
  const [attempt, setAttempt] = useState(0);
  // La caché pertenece a esta vista/cuenta; nunca se comparte progreso en una caché pública.
  const requests = useRef(new Map<string, Promise<Catalog>>());
  const controllers = useRef(new Set<AbortController>());
  const load = useCallback((query: string) => {
    const existing = requests.current.get(query);
    if (existing) return existing;
    const controller = new AbortController(); controllers.current.add(controller);
    const timer = setTimeout(() => controller.abort(), 25000);
    const pending = request<Catalog>(`/api/anime/${source}?${query}`, controller.signal)
      .catch(err => { requests.current.delete(query); throw err; })
      .finally(() => { clearTimeout(timer); controllers.current.delete(controller); });
    requests.current.set(query, pending);
    return pending;
  }, [source]);
  useEffect(() => { const active = controllers.current; return () => { active.forEach(controller => controller.abort()); }; }, []);
  useEffect(() => {
    if (directory || personalView) return;
    let active = true; setError("");
    load("page=1").then(data => { if (active) setRecent(data.series); }).catch(err => { if (active) setError(err.name === "AbortError" ? "La fuente tardó demasiado. Reintentá la carga." : err.message); });
    return () => { active = false; };
  }, [load, directory, personalView, attempt]);
  useEffect(() => {
    if (directory || personalView) return;
    const controller = new AbortController();
    setAccountError("");
    Promise.all([
      request<Saved[]>("/api/anime/externo/biblioteca", controller.signal),
      request<{ historial: Saved[]; continuar: Saved[] }>("/api/anime/externo/historial", controller.signal),
    ]).then(([saved, watched]) => {
      // Las referencias antiguas usan el id como ruta cuando no tienen slug,
      // igual que su enlace canónico de biblioteca; nunca abrir /null.
      setLibrary(saved.filter(entry => entry.source === source).map(entry => ({ ...entry, slug: entry.slug || entry.external_id })));
      setHistoryItems([...watched.continuar, ...watched.historial].filter(entry => entry.source === source)
        .filter((entry, i, all) => all.findIndex(other => other.external_id === entry.external_id) === i));
    }).catch(err => {
      if (controller.signal.aborted) return;
      if (err.status === 401) { setLibrary([]); setHistoryItems([]); }
      else setAccountError(err.message);
    });
    return () => controller.abort();
  }, [source, directory, personalView, accountVersion]);
  const savedSlugs = new Set(library.map(entry => entry.slug));
  const continuing = historyItems.filter(entry => !entry.completed && entry.resume_href);
  const title = SOURCE_NAMES[source];
  const genre = (id: string) => source === "tioanime" ? TIO_GENRES[id] ?? id : id;
  return <div className="od-discover" data-od-id="anime-discover">
    <nav className="od-tabs" aria-label="Descubrir anime">
      <a aria-current={!directory && !personalView ? "page" : undefined} href={`/explorar?seccion=animada&anime_fuente=${source}`}>Descubrir</a>
      <a aria-current={directory && (!initial.sort || initial.sort === "recent") && !initial.status ? "page" : undefined} href={catalogUrl(source)}>Todos los títulos</a>
      {source === "jkanime" && <a aria-current={directory && initial.sort === "popularidad" ? "page" : undefined} href={catalogUrl(source, { sort: "popularidad" })}>Populares</a>}
      <a aria-current={directory && initial.status ? "page" : undefined} href={catalogUrl(source, { status: source === "jkanime" ? "emision" : "1" })}>En emisión</a>
      {source === "jkanime" && <a aria-current={directory && initial.sort === "nombre" ? "page" : undefined} href={catalogUrl(source, { sort: "nombre" })}>A–Z</a>}
      <a aria-current={personalView ? "page" : undefined} href={listUrl}>Mi lista</a>
    </nav>
    {personalView ? <>
      <div className="mb-5 flex justify-end"><a className="od-outline" href={historyView ? listUrl : historyUrl}>{historyView ? "← Volver a Mi lista" : "Ver historial"}</a></div>
      <MiLista busqueda={initial.q ?? ""} soloGuardados={myList} soloHistorial={historyView} />
    </> : directory ? <>{source === "jkanime" ? <JkanimeCatalog initial={initial} /> : <TioanimeCatalog initial={initial} />}</> : <>
      <form className="od-discover-tools" action="/explorar" role="search" aria-label={`Buscar en ${title}`}>
        <input type="hidden" name="seccion" value="animada" /><input type="hidden" name="anime_fuente" value={source} /><input type="hidden" name="vista" value="catalogo" />
        <input name="q" value={search} onChange={event => setSearch(event.target.value)} placeholder={`Buscar todas las series de ${title}…`} aria-label={`Buscar todas las series de ${title}`} type="search" />
        <button className="od-outline" type="submit">Buscar →</button>
      </form>
      {recent?.length ? <div className="od-fullbleed"><HeroCarousel heading="h2" items={recent.slice(0, 5).map(item => ({ id: item.slug, title: item.title, image: item.cover_url, poster: true, artworkTitle: item.title, backdrop: backdrop(source, item.cover_url), meta: [title, item.type, item.status].filter(Boolean).join(" · "), href: `/explorar/${source}/${item.slug}`, action: "Ver serie", extra: <button className="od-outline" onClick={() => setSelected(item)}>ⓘ Episodios y detalles</button> }))} /></div> : !error && recent === null ? <div className="od-hero-skeleton" role="status">Cargando novedades de {title}…</div> : null}
      {error && <div className="od-message" role="alert"><p>{error}</p><button onClick={() => setAttempt(value => value + 1)}>Reintentar {title}</button></div>}
      {accountError && <div className="od-message">No se pudo consultar tu lista: {accountError} <button onClick={() => setAccountVersion(value => value + 1)}>Reintentar lista</button></div>}
      {continuing.length > 0 && <MediaRail title="Continuar viendo" wide href={historyUrl}>
        {continuing.map(item => <div className="od-media-card" key={item.external_id}>
          <EpisodeWatchLink className="od-media-thumb" href={item.resume_href!}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {item.cover_url && <img src={item.cover_url} alt={item.title} loading="lazy" referrerPolicy="no-referrer" />}
            <span className="od-media-play" aria-hidden="true">▶</span>
            {item.last_duration_seconds > 0 && <span className="od-media-progress"><span style={{ width: `${Math.min(100, item.last_position_seconds / item.last_duration_seconds * 100)}%` }} /></span>}
          </EpisodeWatchLink>
          <Link className="od-media-title" href={item.href}>{item.title}</Link>
          <span className="od-media-meta">Episodio {item.last_episode_number} · {Math.floor(item.last_position_seconds / 60)}:{String(Math.floor(item.last_position_seconds % 60)).padStart(2, "0")}</span>
        </div>)}
      </MediaRail>}
      {recent && <MediaRail title={`Novedades de ${title}`} href={catalogUrl(source)}>{recent.map(item => <Poster key={item.slug} item={item} onPreview={setSelected} saved={savedSlugs.has(item.slug)} />)}</MediaRail>}
      <section className="od-genres" aria-labelledby="od-genres-title"><h2 id="od-genres-title">¿Qué te gustaría ver?</h2><p>Elegí un género y explorá su catálogo completo.</p><div className="od-genre-grid">{DISCOVER_GENRES.map(([id, label]) => <a key={id} href={catalogUrl(source, { genre: genre(id) })}>{label}<span aria-hidden="true">↗</span></a>)}</div></section>
      {recent && source === "jkanime" && <LazyRail title="Populares en JKAnime" source={source} query="sort=popularidad" load={load} onPreview={setSelected} saved={savedSlugs} />}
      {recent && <LazyRail title="En emisión" source={source} query={`status=${source === "jkanime" ? "emision" : "1"}`} load={load} onPreview={setSelected} saved={savedSlugs} />}
      {library.length > 0 && <MediaRail title="Tu lista" href={listUrl}>{library.map(item => <Poster key={item.external_id} item={item} saved onPreview={setSelected} />)}</MediaRail>}
      {recent && [["accion", "Acción sin pausa"], ["fantasia", "Mundos de fantasía"], ["romance", "Historias de romance"], ["comedia", "Un momento de comedia"], ["sci-fi", "Ciencia ficción"]].map(([id, label]) => <LazyRail key={id} title={label} source={source} query={`genre=${genre(id)}`} load={load} onPreview={setSelected} saved={savedSlugs} />)}
      <div className="od-catalog-cta"><h2>Hay mucho más por descubrir</h2><p>Todos los títulos, filtros por género y episodios disponibles en {title}.</p><a href={catalogUrl(source)} className="od-primary">Explorar catálogo completo →</a></div>
      <p className="od-source-credit">Catálogo, fichas y episodios de <a href={source === "jkanime" ? "https://jkanime.net/" : "https://tioanime.com/"} target="_blank" rel="noopener noreferrer">{title} ↗</a>, con su permiso. Disponibilidad según la fuente.</p>
    </>}
    {selected && <AnimeSheet key={selected.slug} source={source} item={selected} close={() => setSelected(null)} onLibraryChange={() => setAccountVersion(value => value + 1)} />}
  </div>;
}
