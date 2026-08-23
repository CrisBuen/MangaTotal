"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SeriesCard, type SeriesSummary } from "@/components/library/SeriesCard";

interface ContinueItem {
  series: { id: number; title: string; slug: string; type: string; cover_image_path: string | null };
  chapter: { id: number; number: number; page_count: number };
  lastPageNumber: number;
}

interface Announcement {
  id: number;
  title: string;
  body: string;
  created_at: string;
}

interface Me {
  nickname?: string;
  show_adult_content?: boolean;
}

interface TagChip {
  id: number;
  name: string;
  slug: string;
  series_count: number;
}

type Filter = "todo" | "normal" | "adult" | "favoritos";

export default function BibliotecaPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [series, setSeries] = useState<SeriesSummary[] | null>(null);
  const [continues, setContinues] = useState<ContinueItem[]>([]);
  const [news, setNews] = useState<Announcement[] | null>(null);
  const [filter, setFilter] = useState<Filter>("todo");
  const [search, setSearch] = useState("");
  const [tags, setTags] = useState<TagChip[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  const loggedIn = Boolean(me?.nickname);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMe(d ?? {}))
      .catch(() => setMe({}));
    fetch("/api/progress/continue")
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setContinues(d))
      .catch(() => {});
    fetch("/api/announcements")
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setNews(d))
      .catch(() => setNews([]));
    fetch("/api/tags")
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setTags(d))
      .catch(() => {});
    // restaurar el estado desde la URL: pestaña activa, tag y búsqueda
    // (así "atrás" desde una serie vuelve a la misma sección)
    const params = new URLSearchParams(window.location.search);
    const urlFilter = params.get("f");
    if (urlFilter && ["normal", "adult", "favoritos"].includes(urlFilter)) {
      setFilter(urlFilter as Filter);
    }
    const urlTag = params.get("tag");
    if (urlTag) setSelectedTag(urlTag);
    const urlSearch = params.get("q");
    if (urlSearch) setSearch(urlSearch);
    setRestored(true);
  }, []);

  // reflejar el estado en la URL (replaceState: no ensucia el historial)
  useEffect(() => {
    if (!restored) return;
    const url = new URL(window.location.href);
    if (filter !== "todo") url.searchParams.set("f", filter);
    else url.searchParams.delete("f");
    if (selectedTag) url.searchParams.set("tag", selectedTag);
    else url.searchParams.delete("tag");
    if (search.trim()) url.searchParams.set("q", search.trim());
    else url.searchParams.delete("q");
    window.history.replaceState(null, "", url.toString());
  }, [restored, filter, selectedTag, search]);

  // el filtro por tag muestra catálogo aunque la pestaña sea "Todo"
  const showCatalog = filter !== "todo" || selectedTag !== null;

  const load = useCallback(async () => {
    if (!showCatalog) return;
    const params = new URLSearchParams();
    if (filter === "normal" || filter === "adult") params.set("type", filter);
    if (filter === "favoritos") params.set("favorites", "true");
    if (search.trim()) params.set("search", search.trim());
    if (selectedTag) params.set("tag", selectedTag);
    const res = await fetch(`/api/series?${params}`);
    if (res.ok) setSeries(await res.json());
  }, [filter, search, selectedTag, showCatalog]);

  function toggleTag(slug: string) {
    setSelectedTag(selectedTag === slug ? null : slug);
  }

  useEffect(() => {
    setSeries(null);
    const t = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, search, filter, selectedTag]);

  const filters: { key: Filter; label: string }[] = [
    { key: "todo", label: "Todo" },
    { key: "normal", label: "Normal" },
    ...(me?.show_adult_content ? [{ key: "adult" as Filter, label: "+18" }] : []),
    ...(loggedIn ? [{ key: "favoritos" as Filter, label: "★ Favoritos" }] : []),
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">Biblioteca</h1>
        <div className="flex gap-1 rounded-lg bg-zinc-900 p-1">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-md px-3 py-1 text-sm transition ${
                filter === f.key ? "bg-violet-600 text-white" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {filter !== "todo" && (
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar serie..."
            className="ml-auto w-full max-w-xs rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm placeholder-zinc-500 outline-none focus:border-violet-500"
          />
        )}
      </div>

      {!showCatalog ? (
        <>
          <section>
            <h2 className="mb-3 text-lg font-semibold text-zinc-200">Noticias</h2>
            {news === null ? (
              <p className="py-8 text-center text-sm text-zinc-500">Cargando...</p>
            ) : news.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-800 py-12 text-center text-zinc-500">
                <p className="text-lg">No hay noticias por ahora</p>
                <p className="mt-1 text-sm">
                  Acá van a aparecer los anuncios y las novedades de la página.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {news.map((n) => (
                  <article
                    key={n.id}
                    className="rounded-xl border border-zinc-800 bg-zinc-900 p-5"
                  >
                    <div className="mb-1 flex items-baseline justify-between gap-3">
                      <h3 className="font-semibold text-zinc-100">{n.title}</h3>
                      <span className="shrink-0 text-xs text-zinc-500">
                        {new Date(n.created_at).toLocaleDateString("es-AR", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    <p className="whitespace-pre-line text-sm text-zinc-300">{n.body}</p>
                  </article>
                ))}
              </div>
            )}
          </section>

          {!loggedIn && (
            <section className="rounded-xl border border-violet-900/50 bg-violet-950/20 p-5 text-center">
              <p className="text-sm text-zinc-300">
                <Link href="/registro" className="font-semibold text-violet-400 hover:underline">
                  Creá tu cuenta
                </Link>{" "}
                o{" "}
                <Link href="/login" className="font-semibold text-violet-400 hover:underline">
                  iniciá sesión
                </Link>{" "}
                para leer, guardar tu progreso y marcar favoritos.
              </p>
            </section>
          )}
        </>
      ) : (
        <>
          {tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-medium uppercase text-zinc-500">Tags</span>
              {tags.map((t) => (
                <button
                  key={t.id}
                  onClick={() => toggleTag(t.slug)}
                  className={`rounded-full border px-2.5 py-0.5 text-xs transition ${
                    selectedTag === t.slug
                      ? "border-violet-500 bg-violet-600/20 text-violet-300"
                      : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-violet-500 hover:text-violet-300"
                  }`}
                >
                  {t.name} <span className="text-zinc-500">{t.series_count}</span>
                </button>
              ))}
              {selectedTag && (
                <button
                  onClick={() => toggleTag(selectedTag)}
                  className="rounded-full px-2 py-0.5 text-xs text-zinc-500 hover:text-zinc-300"
                >
                  ✕ limpiar
                </button>
              )}
            </div>
          )}

          {/* "Continuar leyendo" vive dentro de su catálogo (Normal o +18), nunca en Todo */}
          {loggedIn &&
            (filter === "normal" || filter === "adult") &&
            continues.some((c) => c.series.type === filter) && (
              <section>
                <h2 className="mb-3 text-lg font-semibold text-zinc-200">Continuar leyendo</h2>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {continues
                    .filter((c) => c.series.type === filter)
                    .map((c) => (
                      <Link
                        key={c.series.id}
                        href={`/leer/${c.chapter.id}?page=${c.lastPageNumber}`}
                        className="w-32 shrink-0 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 transition hover:border-violet-600"
                      >
                        <div className="aspect-[2/3] bg-zinc-800">
                          {c.series.cover_image_path && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={`/api/images/${c.series.cover_image_path}`}
                              alt={c.series.title}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          )}
                        </div>
                        <div className="p-2">
                          <p className="truncate text-xs font-medium">{c.series.title}</p>
                          <p className="text-[11px] text-zinc-500">
                            Cap. {c.chapter.number} · pág. {c.lastPageNumber}/{c.chapter.page_count}
                          </p>
                        </div>
                      </Link>
                    ))}
                </div>
              </section>
            )}

          {series === null ? (
            <p className="py-12 text-center text-zinc-500">Cargando...</p>
          ) : series.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-800 py-16 text-center text-zinc-500">
              {filter === "favoritos" ? (
                <>
                  <p className="mb-1 text-lg">Todavía no tenés favoritos</p>
                  <p className="text-sm">Marcá una serie con ★ y va a quedar guardada acá.</p>
                </>
              ) : (
                <>
                  <p className="mb-1 text-lg">No hay series en esta sección</p>
                  <p className="text-sm">Pronto se va a agregar contenido nuevo.</p>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {series.map((s) => (
                <SeriesCard key={s.id} series={s} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
