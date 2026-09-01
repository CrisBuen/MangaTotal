"use client";

import { upload } from "@vercel/blob/client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button, buttonStyles } from "@/components/ui/Button";
import { Field, fieldControlClass } from "@/components/ui/Field";
import { SectionHeading, Surface } from "@/components/ui/Surface";

const MAX_ARCHIVOS = 5;
const MAX_ARCHIVO_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BYTES = 15 * 1024 * 1024;
const EXTENSIONES = [
  ".jpg", ".jpeg", ".png", ".webp", ".gif", ".pdf",
  ".txt", ".log", ".csv", ".doc", ".docx",
];

interface Me {
  id: number;
  nickname: string;
  email: string | null;
}

interface Borrador {
  id: "actual";
  categoria: string;
  replyTo: string;
  asunto: string;
  mensaje: string;
  archivos: File[];
}

function abrirBorradores(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const pedido = indexedDB.open("mangatotal-soporte", 1);
    pedido.onupgradeneeded = () => {
      if (!pedido.result.objectStoreNames.contains("borradores")) {
        pedido.result.createObjectStore("borradores", { keyPath: "id" });
      }
    };
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
}

async function leerBorrador(): Promise<Borrador | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await abrirBorradores();
  return new Promise((resolve, reject) => {
    const pedido = db.transaction("borradores", "readonly").objectStore("borradores").get("actual");
    pedido.onsuccess = () => {
      db.close();
      resolve((pedido.result as Borrador | undefined) ?? null);
    };
    pedido.onerror = () => {
      db.close();
      reject(pedido.error);
    };
  });
}

async function guardarBorrador(borrador: Borrador): Promise<void> {
  const db = await abrirBorradores();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("borradores", "readwrite");
    tx.objectStore("borradores").put(borrador);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

async function borrarBorrador(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await abrirBorradores();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("borradores", "readwrite");
    tx.objectStore("borradores").delete("actual");
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

function errorArchivos(archivos: File[]): string | null {
  if (archivos.length > MAX_ARCHIVOS) return `Podés adjuntar hasta ${MAX_ARCHIVOS} archivos.`;
  let total = 0;
  for (const archivo of archivos) {
    const nombre = archivo.name.toLowerCase();
    if (!EXTENSIONES.some((ext) => nombre.endsWith(ext))) {
      return `${archivo.name}: formato no permitido.`;
    }
    if (archivo.size > MAX_ARCHIVO_BYTES) {
      return `${archivo.name}: supera el máximo de 8 MB.`;
    }
    total += archivo.size;
  }
  return total > MAX_TOTAL_BYTES ? "Los adjuntos superan el máximo total de 15 MB." : null;
}

function nombreRuta(nombre: string): string {
  return nombre
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^\\.+/, "")
    .slice(-100) || "adjunto.txt";
}

export default function ConsultaPage() {
  const archivoRef = useRef<HTMLInputElement>(null);
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [categoria, setCategoria] = useState("Error o bug");
  const [replyTo, setReplyTo] = useState("");
  const [asunto, setAsunto] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [archivos, setArchivos] = useState<File[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [estado, setEstado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;
    void (async () => {
      const borrador = await leerBorrador().catch(() => null);
      if (!activo) return;
      if (borrador) {
        setCategoria(borrador.categoria);
        setReplyTo(borrador.replyTo);
        setAsunto(borrador.asunto);
        setMensaje(borrador.mensaje);
        setArchivos(Array.isArray(borrador.archivos) ? borrador.archivos : []);
      }

      const res = await fetch("/api/auth/me").catch(() => null);
      if (!activo) return;
      if (!res?.ok) {
        setMe(null);
        return;
      }
      const actual = (await res.json()) as Me;
      setMe(actual);
      if (!borrador?.replyTo && actual.email) setReplyTo(actual.email);
    })();
    return () => {
      activo = false;
    };
  }, []);

  function agregarArchivos(lista: FileList | null) {
    const siguientes = [...archivos, ...Array.from(lista ?? [])];
    const problema = errorArchivos(siguientes);
    if (problema) {
      setError(problema);
      if (archivoRef.current) archivoRef.current.value = "";
      return;
    }
    setError(null);
    setArchivos(siguientes);
    if (archivoRef.current) archivoRef.current.value = "";
  }

  async function guardar() {
    setError(null);
    setEstado(null);
    const problema = errorArchivos(archivos);
    if (problema) return setError(problema);
    try {
      await guardarBorrador({ id: "actual", categoria, replyTo, asunto, mensaje, archivos });
      setEstado("Borrador guardado en este dispositivo.");
    } catch {
      setError("No se pudo guardar el borrador en este dispositivo.");
    }
  }

  async function limpiar(mensajeEstado = "Formulario y borrador eliminados.") {
    setCategoria("Error o bug");
    setReplyTo("");
    setAsunto("");
    setMensaje("");
    setArchivos([]);
    if (archivoRef.current) archivoRef.current.value = "";
    await borrarBorrador().catch(() => undefined);
    setError(null);
    setEstado(mensajeEstado);
  }

  async function enviar(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setEstado(null);
    if (!me) return setError("Iniciá sesión para enviar la consulta.");
    if (asunto.trim().length < 5) return setError("Escribí un asunto de al menos 5 caracteres.");
    if (mensaje.trim().length < 20) return setError("Contanos el problema con al menos 20 caracteres.");
    const problema = errorArchivos(archivos);
    if (problema) return setError(problema);

    setOcupado(true);
    const subidos: { pathname: string; name: string; size: number }[] = [];
    try {
      for (let i = 0; i < archivos.length; i += 1) {
        setEstado(`Subiendo adjunto ${i + 1} de ${archivos.length}…`);
        const archivo = archivos[i];
        const blob = await upload(
          `_support/${me.id}/${Date.now()}-${i}-${nombreRuta(archivo.name)}`,
          archivo,
          {
            access: "private",
            handleUploadUrl: "/api/soporte/archivos",
            multipart: archivo.size > 4 * 1024 * 1024,
          },
        );
        subidos.push({ pathname: blob.pathname, name: archivo.name, size: archivo.size });
      }

      setEstado("Enviando consulta…");
      const res = await fetch("/api/soporte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoria,
          reply_to: replyTo.trim() || null,
          asunto: asunto.trim(),
          mensaje: mensaje.trim(),
          plataforma: navigator.userAgent,
          attachments: subidos,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo enviar la consulta");

      await limpiar("Consulta enviada correctamente.");
    } catch (err) {
      if (subidos.length > 0) {
        await fetch("/api/soporte/archivos", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pathnames: subidos.map((archivo) => archivo.pathname) }),
        }).catch(() => undefined);
      }
      setEstado(null);
      setError(err instanceof Error ? err.message : "No se pudo enviar la consulta.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8" data-od-id="support-page">
      <SectionHeading
        eyebrow="Ayuda"
        title="Consulta y errores"
        description="Reportá un error, pedí ayuda o enviá una consulta. Podés adjuntar capturas y documentos."
      />

      {me === null && (
        <Surface className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
          <p className="text-sm leading-6 text-subtle">
            Podés preparar y guardar un borrador, pero para enviarlo necesitás iniciar sesión.
          </p>
          <Link href="/login" className={buttonStyles({ variant: "primary" })}>
            Iniciar sesión
          </Link>
        </Surface>
      )}

      <form onSubmit={enviar}>
        <Surface className="space-y-6 p-5 sm:p-7">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="consulta-categoria" label="Tipo de consulta">
              <select
                className={fieldControlClass}
                value={categoria}
                onChange={(event) => setCategoria(event.target.value)}
              >
                <option>Error o bug</option>
                <option>Ayuda</option>
                <option>Consulta</option>
                <option>Otro</option>
              </select>
            </Field>
            <Field
              id="consulta-email"
              label="Correo para responderte"
              hint="Opcional. Si tu cuenta tiene correo, aparece precargado."
            >
              <input
                type="email"
                className={fieldControlClass}
                value={replyTo}
                onChange={(event) => setReplyTo(event.target.value)}
                autoComplete="email"
                placeholder="tu@correo.com"
              />
            </Field>
          </div>

          <Field id="consulta-asunto" label="Asunto">
            <input
              className={fieldControlClass}
              value={asunto}
              onChange={(event) => setAsunto(event.target.value)}
              maxLength={120}
              placeholder="Resumen breve del problema o consulta"
              required
            />
          </Field>

          <Field
            id="consulta-mensaje"
            label="Mensaje"
            hint={`${mensaje.length}/5.000 caracteres`}
          >
            <textarea
              className={`${fieldControlClass} min-h-48 resize-y`}
              value={mensaje}
              onChange={(event) => setMensaje(event.target.value)}
              maxLength={5_000}
              placeholder="Contanos qué pasó, qué esperabas que ocurriera y cómo podemos reproducirlo."
              required
            />
          </Field>

          <Field
            id="consulta-archivos"
            label="Imágenes o documentos"
            hint="Hasta 5 archivos y 15 MB en total. JPG, PNG, WebP, GIF, PDF, TXT, LOG, CSV, DOC o DOCX."
          >
            <input
              ref={archivoRef}
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.txt,.log,.csv,.doc,.docx,image/*"
              className={fieldControlClass}
              onChange={(event) => agregarArchivos(event.target.files)}
            />
          </Field>

          {archivos.length > 0 && (
            <ul className="divide-y divide-line rounded-[10px] border border-line">
              {archivos.map((archivo, index) => (
                <li key={`${archivo.name}-${archivo.lastModified}-${index}`} className="flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{archivo.name}</span>
                  <span className="font-mono text-[11px] text-faint">
                    {(archivo.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                  <button
                    type="button"
                    onClick={() => setArchivos((actuales) => actuales.filter((_, i) => i !== index))}
                    className="min-h-9 px-2 text-sm text-subtle transition hover:text-danger"
                    aria-label={`Quitar ${archivo.name}`}
                  >
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          )}

          {error && <p role="alert" className="text-sm leading-6 text-danger">{error}</p>}
          {estado && <p role="status" className="text-sm leading-6 text-success">{estado}</p>}

          <div className="flex flex-wrap gap-3 border-t border-line pt-5">
            <Button type="submit" variant="primary" loading={ocupado} loadingLabel="Enviando…">
              Enviar
            </Button>
            <Button onClick={guardar} disabled={ocupado}>
              Guardar borrador
            </Button>
            <Button variant="danger" onClick={() => void limpiar()} disabled={ocupado}>
              Borrar todo
            </Button>
          </div>
        </Surface>
      </form>
    </div>
  );
}
