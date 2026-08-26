"use client";

import { upload } from "@vercel/blob/client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { fieldControlClass } from "@/components/ui/Field";
import { SectionHeading } from "@/components/ui/Surface";

// por encima de esto, el body no pasa por la función en Vercel (límite ~4.5 MB):
// se sube directo a Blob y el servidor procesa desde ahí
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

export default function SubirPage() {
  const [seriesList, setSeriesList] = useState<SeriesOption[]>([]);
  const [file, setFile] = useState<File | null>(null);
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
    // autocompletar serie + capítulo desde el nombre (siempre editable)
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
      const res = await fetch(`/api/admin/upload/${jobId}`);
      if (!res.ok) return;
      const data: JobStatus = await res.json();
      setJob(data);
      if (data.status === "success" || data.status === "error") {
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 2000);
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
        // subida directa navegador → Vercel Blob (token firmado, solo admin);
        // solo si el servidor dice "no disponible" (dev local) se cae al
        // modo multipart de abajo — cualquier otro error se muestra
        try {
          // nombre seguro: el nombre real del zip viaja en originalFilename
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
      setJob({ id: data.jobId, status: "pending", error_message: null, chapterId: null, series_slug: null, series_title: null });
      startPolling(data.jobId);
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setUploading(false);
      setUploadPct(null);
    }
  }

  const processing = uploading || job?.status === "pending" || job?.status === "processing";

  return (
    <div className="mx-auto max-w-3xl space-y-10" data-od-id="admin-upload-page">
      <SectionHeading
        eyebrow="Ingesta ZIP"
        title="Subir capítulo"
        description="Publicá un archivo exportado de Koharu y seguí su procesamiento."
      />
      <div className="border-l-2 border-line pl-4">
        <p className="text-sm text-subtle">
          Subí el .zip exportado de Koharu (páginas .png/.jpg/.webp numeradas). Convención
          opcional de nombre: <code className="font-bold text-ink">NombreSerie_Cap01.zip</code>{" "}
          autocompleta el formulario.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-line bg-panel p-6" data-od-id="zip-upload-form">
        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-ink">Archivo .zip</label>
          <input
            type="file"
            accept=".zip"
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
            className="w-full rounded-xl border border-line bg-panel p-2 text-sm text-subtle file:mr-3 file:min-h-11 file:rounded-lg file:border file:border-accent file:bg-[var(--accent-soft)] file:px-3 file:text-xs file:font-bold file:uppercase file:text-accent hover:file:bg-[var(--accent)] hover:file:text-canvas"
          />
        </div>

        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-ink">Serie existente</label>
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
          <>
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-ink">
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
              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-ink">Sección</label>
              <div className="flex rounded-xl border border-line bg-panel p-1">
                {(["normal", "adult"] as const).map((t) => (
                  <button
                    type="button"
                    key={t}
                    onClick={() => setType(t)}
                    className={`min-h-11 flex-1 px-3 text-xs font-bold uppercase tracking-[0.08em] transition ${
                      type === t ? "rounded-lg bg-[var(--accent-soft)] text-accent shadow-[var(--glow)]" : "rounded-lg text-subtle hover:bg-[var(--surface-raised)] hover:text-ink"
                    }`}
                  >
                    {t === "normal" ? "Normal" : "+18"}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-ink">
              Número de capítulo
            </label>
            <input
              className={inputClass}
              value={chapterNumber}
              onChange={(e) => setChapterNumber(e.target.value)}
              placeholder="1, 1.5, 2..."
              inputMode="decimal"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-ink">
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

        {error && <p className="border-l-2 border-danger pl-3 text-sm text-danger" role="alert">{error}</p>}

        <Button
          disabled={processing}
          variant="primary"
          className="w-full"
          data-od-id="zip-upload-submit"
        >
          {uploading
            ? uploadPct !== null
              ? `Subiendo... ${uploadPct}%`
              : "Subiendo..."
            : processing
              ? "Procesando..."
              : "Subir y procesar"}
        </Button>
      </form>

      {job && (
        <div
          className={`rounded-xl border p-4 text-sm ${
            job.status === "success"
              ? "border-success text-success"
              : job.status === "error"
                ? "border-danger text-danger"
                : "border-warning text-warning"
          }`}
          role="status"
        >
          {job.status === "pending" || job.status === "processing" ? (
            <p>Procesando ingesta #{job.id}…</p>
          ) : job.status === "success" ? (
            <p>
              Capítulo publicado en{" "}
              {job.series_slug ? (
                <Link href={`/serie/${job.series_slug}`} className="font-semibold underline">
                  {job.series_title ?? "la serie"}
                </Link>
              ) : (
                "la biblioteca"
              )}
              .
            </p>
          ) : (
            <p>Error: {job.error_message ?? "desconocido"}</p>
          )}
        </div>
      )}
    </div>
  );
}
