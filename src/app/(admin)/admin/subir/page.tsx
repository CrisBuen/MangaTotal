"use client";

import { upload } from "@vercel/blob/client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { fieldControlClass } from "@/components/ui/Field";

// Por encima de esto, el body no pasa por la función en Vercel (límite ~4.5 MB):
// se sube directo a Blob y el servidor procesa desde ahí.
const DIRECT_UPLOAD_THRESHOLD = 4 * 1024 * 1024;

interface SeriesOption {
  id: number;
  title: string;
  type: string;
}

interface JobStatus {
  id: number;
  status: string;
  error_message: string | null;
  chapterId: number | null;
  series_slug: string | null;
  series_title: string | null;
}

const inputClass = fieldControlClass;

/** Convención opcional de nombre: NombreSerie_Cap01.zip (docs/04 §4.4). */
function parseZipName(name: string): { seriesTitle: string; chapterNumber: string } | null {
  const m = /^(.+?)_[Cc]ap\s*(\d+(?:\.\d+)?)\.zip$/i.exec(name.trim());
  if (!m) return null;
  return { seriesTitle: m[1].replace(/[-_]+/g, " ").trim(), chapterNumber: m[2] };
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function SubirPage() {
  const [seriesList, setSeriesList] = useState<SeriesOption[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [seriesId, setSeriesId] = useState<string>("");
  const [newSeriesTitle, setNewSeriesTitle] = useState("");
  const [type, setType] = useState<"normal" | "adult">("normal");
  const [chapterNumber, setChapterNumber] = useState("");
  const [chapterTitle, setChapterTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<JobStatus | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/series?all=true")
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setSeriesList(d))
      .catch(() => {});
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function onFileChange(f: File | null) {
    setFile(f);
    setJob(null);
    setError(null);
    if (!f) return;
    // Autocompletar serie + capítulo desde el nombre (siempre editable).
    const parsed = parseZipName(f.name);
    if (parsed) {
      if (!chapterNumber) setChapterNumber(parsed.chapterNumber);
      const existing = seriesList.find(
        (s) => s.title.toLowerCase() === parsed.seriesTitle.toLowerCase()
      );
      if (existing) {
        setSeriesId(String(existing.id));
      } else if (!newSeriesTitle) {
        setNewSeriesTitle(parsed.seriesTitle);
      }
    }
  }

  function startPolling(jobId: number) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const res = await fetch(`/api/admin/upload/${jobId}`, { cache: "no-store" });
      if (!res.ok) return;
      const data: JobStatus = await res.json();
      setJob(data);
      if (data.status === "success" || data.status === "error") {
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 2500);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setJob(null);

    if (!file) return setError("Elegí un archivo .zip");
    if (!file.name.toLowerCase().endsWith(".zip")) return setError("Solo se aceptan archivos .zip");
    if (!seriesId && !newSeriesTitle.trim())
      return setError("Elegí una serie existente o escribí el título de una nueva");
    if (!chapterNumber.trim() || !Number.isFinite(parseFloat(chapterNumber)))
      return setError("Número de capítulo inválido (ej: 1, 1.5, 2)");

    setUploading(true);
    try {
      let res: Response | null = null;

      if (file.size > DIRECT_UPLOAD_THRESHOLD) {
        // Subida directa navegador → Vercel Blob (token firmado, solo admin).
        // Solo si el servidor dice "no disponible" (dev local) se cae al modo multipart.
        try {
          const blob = await upload(`_uploads/${Date.now()}.zip`, file, {
            access: "private",
            handleUploadUrl: "/api/admin/upload/blob",
            multipart: true,
            onUploadProgress: ({ percentage }) => setUploadPct(Math.round(percentage)),
          });
          res = await fetch("/api/admin/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              blobPathname: blob.pathname,
              originalFilename: file.name,
              seriesId: seriesId || undefined,
              newSeriesTitle: seriesId ? undefined : newSeriesTitle.trim(),
              type,
              chapterNumber: chapterNumber.trim(),
              chapterTitle: chapterTitle.trim() || undefined,
            }),
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (!msg.includes("no disponible")) {
            setError(`Falló la subida directa: ${msg}`);
            return;
          }
          res = null;
        }
      }

      if (!res) {
        const form = new FormData();
        form.set("file", file);
        if (seriesId) form.set("seriesId", seriesId);
        else form.set("newSeriesTitle", newSeriesTitle.trim());
        form.set("type", type);
        form.set("chapterNumber", chapterNumber.trim());
        if (chapterTitle.trim()) form.set("chapterTitle", chapterTitle.trim());
        res = await fetch("/api/admin/upload", { method: "POST", body: form });
      }

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo subir el archivo");
        return;
      }
      setJob({
        id: data.jobId,
        status: "pending",
        error_message: null,
        chapterId: null,
        series_slug: null,
        series_title: null,
      });
      startPolling(data.jobId);
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setUploading(false);
      setUploadPct(null);
    }
  }

  const processing = uploading || job?.status === "pending" || job?.status === "processing";
  const usesDirectBlob = file !== null && file.size > DIRECT_UPLOAD_THRESHOLD;

  return (
    <div className="space-y-6" data-od-id="admin-upload-page">
      <div className="border-b border-line pb-6">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-ink">
          Ingesta ZIP
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-[-0.03em] text-ink sm:text-4xl">
          Subir capítulo
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-subtle">
          Publicá un archivo exportado de Koharu (.png, .jpg o .webp numeradas) y seguí el
          procesamiento en vivo.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.8fr)] lg:items-start">
        <form
          onSubmit={onSubmit}
          className="space-y-6 rounded-xl border border-line bg-panel p-5 sm:p-6"
          data-od-id="zip-upload-form"
        >
          {/* Dropzone interactiva */}
          <div>
            <label className="mb-2 block font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-subtle">
              Archivo .zip
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
              className="sr-only"
            />
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const dropped = e.dataTransfer.files?.[0] ?? null;
                if (dropped) onFileChange(dropped);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                dragging
                  ? "border-accent bg-[var(--accent-soft)]"
                  : file
                    ? "border-accent/50 bg-[var(--surface-soft)]"
                    : "border-line-strong bg-[var(--surface-soft)] hover:border-accent/60 hover:bg-[var(--surface-raised)]"
              }`}
            >
              {file ? (
                <div className="space-y-2">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg border border-accent/40 bg-[var(--accent-soft)] text-accent-ink">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <path d="M14 2v6h6" />
                    </svg>
                  </div>
                  <p className="break-all font-mono text-sm font-semibold text-ink">{file.name}</p>
                  <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-subtle">
                    <span className="rounded-md border border-line bg-panel px-2 py-0.5 font-mono">
                      {formatSize(file.size)}
                    </span>
                    <span className="rounded-md border border-line bg-panel px-2 py-0.5">
                      {usesDirectBlob ? "Subida directa Blob (>4 MB)" : "Subida estándar"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onFileChange(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="mt-1 text-xs font-semibold text-danger hover:underline"
                  >
                    Quitar archivo
                  </button>
                </div>
              ) : (
                <div className="space-y-2 py-2">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-panel text-accent-ink">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 15V4" />
                      <path d="m7 9 5-5 5 5" />
                      <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-ink">
                    Arrastrá tu archivo .zip acá o hacé clic para elegirlo
                  </p>
                  <p className="text-xs text-subtle">
                    Tip: <code className="font-mono text-accent-ink">NombreSerie_Cap01.zip</code> autocompleta serie y capítulo.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Serie destino */}
          <div className="space-y-4 border-t border-line pt-5">
            <div>
              <label className="mb-2 block font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-subtle">
                Serie destino
              </label>
              <select
                value={seriesId}
                onChange={(e) => setSeriesId(e.target.value)}
                className={inputClass}
              >
                <option value="">— Crear serie nueva —</option>
                {seriesList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} {s.type === "adult" ? "(+18)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {!seriesId && (
              <div className="grid gap-4 rounded-xl border border-line bg-[var(--surface-soft)] p-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-subtle">
                    Título de la serie nueva
                  </label>
                  <input
                    className={inputClass}
                    value={newSeriesTitle}
                    onChange={(e) => setNewSeriesTitle(e.target.value)}
                    placeholder="ej: Mi Serie Favorita"
                  />
                </div>
                <div>
                  <label className="mb-2 block font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-subtle">
                    Sección
                  </label>
                  <div className="flex rounded-lg border border-line bg-panel p-1">
                    {(["normal", "adult"] as const).map((t) => (
                      <button
                        type="button"
                        key={t}
                        onClick={() => setType(t)}
                        className={`min-h-9 flex-1 rounded-md px-3 text-xs font-bold tracking-[0.06em] transition-colors ${
                          type === t
                            ? t === "adult"
                              ? "bg-danger/15 text-danger"
                              : "bg-[var(--accent-soft)] text-accent-ink"
                            : "text-subtle hover:text-ink"
                        }`}
                      >
                        {t === "normal" ? "Normal" : "+18"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Datos del capítulo */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-subtle">
                Número de capítulo
              </label>
              <input
                className={inputClass}
                value={chapterNumber}
                onChange={(e) => setChapterNumber(e.target.value)}
                placeholder="1, 1.5, 2…"
                inputMode="decimal"
              />
            </div>
            <div>
              <label className="mb-2 block font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-subtle">
                Título del capítulo (opcional)
              </label>
              <input
                className={inputClass}
                value={chapterTitle}
                onChange={(e) => setChapterTitle(e.target.value)}
                placeholder='ej: "El encuentro"'
              />
            </div>
          </div>

          {/* Barra de progreso si sube a Blob */}
          {uploading && uploadPct !== null && (
            <div className="space-y-1.5">
              <div className="flex justify-between font-mono text-xs text-accent-ink">
                <span>Subiendo archivo directo…</span>
                <span>{uploadPct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-raised)]">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${uploadPct}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-danger/50 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={processing}
            loading={processing}
            loadingLabel={
              uploading
                ? uploadPct !== null
                  ? `Subiendo… ${uploadPct}%`
                  : "Subiendo…"
                : "Procesando capítulo…"
            }
            variant="primary"
            className="w-full rounded-lg"
            data-od-id="zip-upload-submit"
          >
            Subir y procesar capítulo
          </Button>
        </form>

        {/* Columna lateral: estado en vivo + guía rápida */}
        <aside className="space-y-5">
          {job && (
            <div
              className={`rounded-xl border p-5 text-sm ${
                job.status === "success"
                  ? "border-success/50 bg-success/10 text-success"
                  : job.status === "error"
                    ? "border-danger/50 bg-danger/10 text-danger"
                    : "border-warning/50 bg-warning/10 text-warning"
              }`}
              role="status"
            >
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] opacity-85">
                Ingesta #{job.id}
              </p>
              {job.status === "pending" || job.status === "processing" ? (
                <p className="mt-2 font-semibold">Procesando páginas y generando registro…</p>
              ) : job.status === "success" ? (
                <div className="mt-2 space-y-3">
                  <p className="font-semibold">
                    Capítulo publicado correctamente en{" "}
                    <span className="text-ink">{job.series_title ?? "la biblioteca"}</span>.
                  </p>
                  {job.series_slug && (
                    <Link
                      href={`/serie/${job.series_slug}`}
                      prefetch={false}
                      className="inline-flex items-center gap-1 rounded-lg border border-success/50 bg-panel px-3 py-1.5 text-xs font-bold text-ink hover:border-success"
                    >
                      Abrir ficha de la serie →
                    </Link>
                  )}
                </div>
              ) : (
                <p className="mt-2 font-semibold">Error: {job.error_message ?? "desconocido"}</p>
              )}
            </div>
          )}

          <div className="rounded-xl border border-line bg-panel p-5">
            <h2 className="text-sm font-bold text-ink">Guía de formato</h2>
            <ul className="mt-3 space-y-2.5 text-xs leading-5 text-subtle">
              <li className="flex gap-2">
                <span className="font-mono text-accent-ink">01</span>
                <span>
                  Acepta paquetes <code className="font-mono text-ink">.zip</code> con imágenes{" "}
                  <code className="font-mono text-ink">.png</code>,{" "}
                  <code className="font-mono text-ink">.jpg</code> o{" "}
                  <code className="font-mono text-ink">.webp</code> numeradas en orden.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-mono text-accent-ink">02</span>
                <span>
                  Nombrar como <code className="font-mono text-ink">TituloSerie_Cap01.zip</code>{" "}
                  completa automáticamente la serie y el número.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-mono text-accent-ink">03</span>
                <span>
                  Archivos de más de <strong className="text-ink">4 MB</strong> se transfieren
                  directo a almacenamiento temporal sin saturar el límite de body de Vercel.
                </span>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
