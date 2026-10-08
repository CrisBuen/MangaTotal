"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

export interface AdminUser {
  id: number;
  nickname: string;
  is_admin: boolean;
  show_adult_content: boolean;
  email: string | null;
  email_verified: boolean;
  created_at: string;
}

type Accion = "rol" | "recuperar" | "eliminar";

export function UserSettingsDialog({ user, onClose, onUpdated, onDeleted }: {
  user: AdminUser;
  onClose: () => void;
  onUpdated: (user: AdminUser) => void;
  onDeleted: (id: number) => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const enCurso = useRef(false);
  const tituloId = useId();
  const descripcionId = useId();
  const claveId = useId();
  const [accion, setAccion] = useState<Accion | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [password, setPassword] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [confirmacion, setConfirmacion] = useState("");

  useEffect(() => {
    const elemento = dialogo.current;
    elemento?.showModal();
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      elemento?.close();
      document.body.style.overflow = overflowAnterior;
    };
  }, []);

  function cerrar() {
    if (enCurso.current) return;
    // Al desmontar el menú se descarta la única copia mostrada de la clave.
    setPassword(null);
    dialogo.current?.close();
    onClose();
  }

  function preparar(nueva: Accion) {
    setAccion(nueva);
    setError(null);
    setMensaje(null);
    setConfirmacion("");
  }

  async function ejecutar() {
    if (!accion || enCurso.current || (accion === "eliminar" && confirmacion !== user.nickname)) return;
    enCurso.current = true;
    setOcupado(true);
    setError(null);
    setMensaje(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}${accion === "recuperar" ? "/recovery" : ""}`, {
        method: accion === "recuperar" ? "POST" : accion === "rol" ? "PATCH" : "DELETE",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        ...(accion !== "eliminar" ? {
          body: JSON.stringify(accion === "recuperar" ? { confirm: true } : { is_admin: !user.is_admin }),
        } : {}),
      });
      const data = res.status === 204 ? {} : await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo completar la acción.");
      if (accion === "recuperar") {
        if (typeof data.password !== "string" || !data.password) throw new Error("No se recibió la contraseña nueva.");
        setPassword(data.password);
        setCopiado(false);
      } else if (accion === "eliminar") {
        onDeleted(user.id);
        return;
      } else {
        onUpdated(data.user);
        setMensaje(user.is_admin ? "La cuenta ahora tiene el rol de lector." : "La cuenta ahora es administradora.");
      }
      setAccion(null);
    } catch (error) {
      // No se reintenta automáticamente: una respuesta perdida puede haber
      // cambiado la clave y repetirla generaría otra distinta.
      setError(error instanceof Error ? error.message : "No se pudo completar la acción.");
    } finally {
      enCurso.current = false;
      setOcupado(false);
    }
  }

  async function copiar() {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopiado(true);
      setError(null);
    } catch {
      setError("No se pudo copiar automáticamente. Seleccioná la contraseña y copiala manualmente.");
    }
  }

  const etiquetaRol = user.is_admin ? "Quitar admin" : "Hacer admin";

  // La página usa space-y en sus hijos: el margen prioritario mantiene el
  // diálogo centrado aunque se inserte dentro de ese contenedor.
  return (
    <dialog
      ref={dialogo}
      aria-labelledby={tituloId}
      aria-describedby={descripcionId}
      onCancel={(event) => { event.preventDefault(); cerrar(); }}
      className="!m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-line bg-panel p-5 text-ink shadow-2xl backdrop:bg-black/70 sm:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-1 font-mono text-[11px] uppercase tracking-wider text-accent-ink">Administración de cuenta</p>
          <h2 id={tituloId} className="break-words text-2xl font-bold">Ajustes · {user.nickname}</h2>
        </div>
        <Button variant="ghost" size="icon" aria-label="Cerrar ajustes" disabled={ocupado} onClick={cerrar}>×</Button>
      </div>
      <p id={descripcionId} className="mt-3 break-words text-sm text-subtle">
        {user.is_admin ? "Administrador" : "Lector"} · {user.email ? `${user.email} (${user.email_verified ? "verificado" : "pendiente"})` : "Sin correo asociado"}
      </p>

      {error && <p role="alert" className="mt-5 rounded-md border border-danger p-3 text-sm text-danger">{error}</p>}
      {mensaje && <p role="status" className="mt-5 text-sm text-accent-ink">{mensaje}</p>}

      {password ? (
        <section className="mt-6 space-y-4 rounded-xl border border-accent bg-[var(--accent-soft)] p-4">
          <h3 className="font-bold text-accent-ink" role="status">Contraseña recuperada</h3>
          <p className="text-sm leading-6 text-subtle">La contraseña nueva ya está guardada en la cuenta de <strong className="text-ink">{user.nickname}</strong>. La biblioteca y el progreso se conservan.</p>
          <label htmlFor={claveId} className="block text-sm font-semibold">Contraseña nueva</label>
          <input id={claveId} type="text" readOnly value={password} autoComplete="off" spellCheck={false}
            onFocus={(event) => event.currentTarget.select()}
            className="w-full rounded-md border border-line bg-canvas p-3 font-mono text-base text-ink" />
          <Button onClick={copiar} className="w-full">{copiado ? "Copiada" : "Copiar contraseña"}</Button>
          <p className="text-sm leading-6 text-subtle">Entregala solo al dueño de la cuenta por un medio privado. Después de entrar, debe cambiarla en <strong className="text-ink">Perfil → Cambiar contraseña</strong>.</p>
          <p className="text-xs leading-5 text-subtle">Se muestra únicamente en este menú. Al cerrarlo no podrás consultarla otra vez. Las sesiones anteriores se cerraron; el correo no se marcó como verificado.</p>
          <Button variant="primary" onClick={cerrar} className="w-full">Listo, cerrar</Button>
        </section>
      ) : accion ? (
        <section className="mt-6 space-y-4 rounded-xl border border-line bg-canvas p-4" aria-busy={ocupado}>
          <h3 className="text-lg font-semibold">
            {accion === "recuperar" ? "¿Generar una contraseña nueva?" : accion === "eliminar" ? "¿Eliminar esta cuenta?" : `¿${etiquetaRol}?`}
          </h3>
          <p className="text-sm leading-6 text-subtle">
            {accion === "recuperar"
              ? `Se reemplazará la contraseña de ${user.nickname} y se cerrarán sus sesiones. No necesita correo verificado. Sus series, favoritos y progreso no se borrarán.`
              : accion === "eliminar"
                ? "Esta acción es permanente: se eliminarán la cuenta, su biblioteca, favoritos y progreso. No se puede deshacer."
                : user.is_admin
                  ? "La cuenta perderá el acceso a la administración y continuará como lector."
                  : "La cuenta podrá administrar usuarios y contenido, incluyendo eliminar cuentas y restablecer contraseñas."}
          </p>
          {accion === "eliminar" && <label className="block space-y-2 text-sm">
            <span>Escribí <strong>{user.nickname}</strong> para confirmar:</span>
            <input value={confirmacion} onChange={(event) => setConfirmacion(event.target.value)} disabled={ocupado} autoComplete="off"
              className="w-full rounded-md border border-line bg-panel p-3 text-ink" />
          </label>}
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={() => { setAccion(null); setError(null); }} disabled={ocupado}>Cancelar</Button>
            <Button variant={accion === "eliminar" ? "danger" : "primary"} onClick={ejecutar}
              loading={ocupado} loadingLabel="Procesando…" disabled={accion === "eliminar" && confirmacion !== user.nickname}>
              {accion === "recuperar" ? "Generar contraseña" : accion === "eliminar" ? "Eliminar definitivamente" : etiquetaRol}
            </Button>
          </div>
        </section>
      ) : (
        <div className="mt-6 divide-y divide-line rounded-xl border border-line">
          <section className="space-y-3 p-4">
            <h3 className="font-semibold">Acceso a la cuenta</h3>
            <p className="text-sm leading-6 text-subtle">Generá una contraseña aleatoria si el usuario perdió el acceso, incluso si no tiene correo verificado.</p>
            <Button variant="primary" onClick={() => preparar("recuperar")} className="w-full">Recuperar contraseña</Button>
          </section>
          <section className="space-y-3 p-4">
            <h3 className="font-semibold">Permisos</h3>
            <p className="text-sm text-subtle">{user.is_admin ? "Volver esta cuenta a lector." : "Otorgar acceso a la administración."}</p>
            <Button onClick={() => preparar("rol")} className="w-full">{etiquetaRol}</Button>
          </section>
          <section className="space-y-3 p-4">
            <h3 className="font-semibold">Eliminar cuenta</h3>
            <p className="text-sm text-subtle">Eliminación permanente de la cuenta y sus datos guardados.</p>
            <Button variant="danger" onClick={() => preparar("eliminar")} className="w-full">Eliminar cuenta</Button>
          </section>
        </div>
      )}
    </dialog>
  );
}
