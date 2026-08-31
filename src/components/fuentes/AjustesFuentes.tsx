"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Feedback";
import { fieldControlClass } from "@/components/ui/Field";
import { Surface } from "@/components/ui/Surface";
import {
  UA_POR_DEFECTO,
  fuenteNativaDisponible,
  guardarUserAgent,
  limpiarVerificacion,
  puedeResolverDesafio,
  userAgentElegido,
} from "@/lib/fuenteNativa";

/**
 * Ajustes de las fuentes que se leen desde el dispositivo.
 *
 * Solo aparece en las apps: en la web no hay puente nativo y estos dos
 * controles no harían nada. Son los mismos dos que trae Mihon, y por el mismo
 * motivo: cuando una fuente se pone difícil, cambiar el navegador que decimos
 * ser o borrar la verificación y empezar de nuevo suele destrabarla.
 */
export function AjustesFuentes() {
  const [enApp, setEnApp] = useState(false);
  const [ua, setUa] = useState("");
  const [guardado, setGuardado] = useState(false);
  const [limpiando, setLimpiando] = useState(false);
  const [limpio, setLimpio] = useState(false);

  useEffect(() => {
    setEnApp(fuenteNativaDisponible());
    setUa(userAgentElegido() ?? "");
  }, []);

  if (!enApp) return null;

  function guardar(valor: string) {
    setUa(valor);
    guardarUserAgent(valor);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 1500);
  }

  async function limpiar() {
    setLimpiando(true);
    setLimpio(false);
    try {
      setLimpio(await limpiarVerificacion());
    } finally {
      setLimpiando(false);
    }
  }

  return (
    <Surface className="space-y-6 p-6" data-od-id="fuentes-settings">
      <div>
        <h2 className="text-3xl text-ink">Fuentes externas</h2>
        <p className="mt-2 text-[13px] text-subtle">
          Estas páginas se leen desde tu conexión, no desde el servidor. Casi nunca hay que tocar
          nada de acá.
        </p>
      </div>

      <div className="border-t border-line pt-5">
        <p className="text-sm font-bold text-ink">Navegador que decimos ser</p>
        <p className="mt-1 text-[13px] text-subtle">
          Si una fuente deja de responder, pegar acá el de tu navegador suele arreglarlo. Vacío usa
          el de siempre.
        </p>
        <input
          value={ua}
          onChange={(e) => guardar(e.target.value)}
          placeholder={UA_POR_DEFECTO}
          spellCheck={false}
          autoComplete="off"
          className={`${fieldControlClass} mt-3 font-mono text-[11px]`}
        />
        <div className="mt-3 flex flex-wrap items-center gap-4">
          {ua.trim() !== "" && (
            <button
              onClick={() => guardar("")}
              className="text-[13px] text-accent-ink hover:underline"
            >
              Volver al de siempre
            </button>
          )}
          {guardado && <Badge tone="success">Guardado</Badge>}
        </div>
      </div>

      {puedeResolverDesafio() && (
        <div className="flex flex-col justify-between gap-4 border-t border-line pt-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-bold text-ink">Verificación de los sitios</p>
            <p className="mt-1 text-[13px] text-subtle">
              Borra lo que quedó guardado del &ldquo;no soy un robot&rdquo;. Usalo si una fuente se
              trabó pidiéndolo una y otra vez.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {limpio && <Badge tone="success">Listo</Badge>}
            <button
              onClick={limpiar}
              disabled={limpiando}
              className="inline-flex min-h-11 items-center rounded-md border border-line px-4 font-mono text-[11px] font-bold tracking-[0.06em] text-subtle transition hover:border-line-strong hover:text-ink disabled:opacity-60"
            >
              {limpiando ? "Borrando…" : "Empezar de cero"}
            </button>
          </div>
        </div>
      )}
    </Surface>
  );
}
