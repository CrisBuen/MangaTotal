"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Surface } from "@/components/ui/Surface";
import type { ResumenMihon } from "@/lib/mihonImportacion";

export function ImportarMihon() {
  const worker = useRef<Worker | null>(null);
  const cancelar = useRef(false);
  const ocupado = useRef(false);
  const [resumen, setResumen] = useState<ResumenMihon | null>(null);
  const [error, setError] = useState("");
  const [leyendo, setLeyendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [elegidas, setElegidas] = useState<string[]>([]);
  const [avance, setAvance] = useState(0);
  const [resultado, setResultado] = useState<{ creadas: number; conservadas: number; omitidas: number } | null>(null);
  useEffect(() => () => { worker.current?.terminate(); cancelar.current = true; }, []);

  function analizar(archivo?: File) {
    if (!archivo || ocupado.current) return;
    worker.current?.terminate();
    setResumen(null); setResultado(null); setError(""); setLeyendo(true); setAvance(0);
    try {
      const w = new Worker(new URL("../../lib/mihon.worker.ts", import.meta.url));
      worker.current = w;
      w.onmessage = (e: MessageEvent<{ resumen?: ResumenMihon; error?: string }>) => {
        setLeyendo(false); w.terminate();
        if (e.data.error) { setError(e.data.error); return; }
        if (e.data.resumen) {
          setResumen(e.data.resumen);
          setElegidas([...new Set(e.data.resumen.entradas.map((s) => s.source))]);
        }
      };
      w.onerror = () => { setLeyendo(false); setError("No se pudo analizar el archivo. Actualizá la app o el navegador."); w.terminate(); };
      w.postMessage(archivo);
    } catch { setLeyendo(false); setError("Este navegador no permite analizar el respaldo localmente."); }
  }

  async function importar() {
    if (!resumen || ocupado.current) return;
    const entradas = resumen.entradas.filter((e) => elegidas.includes(e.source));
    if (!entradas.length) return;
    ocupado.current = true; cancelar.current = false;
    setGuardando(true); setError(""); setAvance(0);
    const cuenta = { creadas: 0, conservadas: 0, omitidas: 0 };
    setResultado({ ...cuenta });
    try {
      for (let i = 0; i < entradas.length; i += 25) {
        if (cancelar.current) break;
        const respuesta = await fetch("/api/externo/importar-mihon", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entradas: entradas.slice(i, i + 25) }),
          signal: AbortSignal.timeout(60000),
        });
        const d = await respuesta.json().catch(() => null);
        if (!respuesta.ok || !d) throw new Error(d?.error ?? "La conexión se interrumpió. Podés reintentar sin duplicados.");
        cuenta.creadas += d.creadas; cuenta.conservadas += d.conservadas; cuenta.omitidas += d.omitidas.length;
        setResultado({ ...cuenta }); setAvance(Math.min(i + 25, entradas.length));
      }
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo terminar la importación"); }
    finally { ocupado.current = false; setGuardando(false); }
  }
  const total = resumen?.entradas.filter((e) => elegidas.includes(e.source)).length ?? 0;
  return <section aria-labelledby="importar-mihon-titulo">
    <h2 id="importar-mihon-titulo" className="mb-5 font-display text-3xl font-bold text-ink">Importar desde Mihon</h2>
    <Surface className="space-y-4 p-5">
      <p className="text-sm text-subtle">
        Elegí un respaldo .tachibk o .proto.gz. El archivo se analiza en tu dispositivo.
        Solo se envían las series compatibles y su punto de lectura cuando confirmás.
      </p>
      <label className="block text-sm font-semibold">
        Respaldo de Mihon (máximo 20 MB)
        <input type="file" accept=".tachibk,.gz" disabled={guardando} className="mt-2 block w-full text-sm"
          onChange={(e) => analizar(e.target.files?.[0])} />
      </label>
      <p className="text-xs text-subtle">
        Crealo con Biblioteca, Capítulos e Historial. Dejá desmarcado «Incluir datos privados».
        Las preferencias y credenciales se ignoran aunque estén dentro del archivo.
      </p>
      {leyendo && <p role="status">Analizando respaldo localmente…</p>}
      {resumen && <>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="mb-2 text-left font-semibold">Biblioteca encontrada en el respaldo</caption>
            <thead><tr><th className="py-2">Fuente</th><th>Guardadas</th><th>Compatibles</th><th>Duplicadas</th></tr></thead>
            <tbody>{resumen.fuentes.map((f) => <tr key={f.nombre} className="border-t border-line">
              <td className="py-2 pr-4">{f.nombre}</td><td>{f.guardadas}</td><td>{f.compatibles}</td><td>{f.duplicadas}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <p className="text-sm text-subtle">
          {resumen.conProgreso} series tienen un punto de lectura compatible.
          {resumen.sinProgresoCompatible > 0 && " En " + resumen.sinProgresoCompatible + " solo se puede guardar la serie: el enlace antiguo del capítulo no coincide."}
          {" "}{resumen.soloHistorial} entradas que no estaban guardadas quedan fuera.
        </p>
        <p className="text-sm text-subtle">
          Se importa el último capítulo y la página, no todas las marcas de capítulos leídos,
          categorías, descargas ni seguimientos. Las fuentes no compatibles se omiten.
          Olympus se verifica por ID en su catálogo actual antes de guardar.
        </p>
        <fieldset disabled={guardando} className="flex flex-wrap gap-4">
          <legend className="mb-2 text-sm font-semibold">Fuentes a importar</legend>
          {[...new Set(resumen.entradas.map((e) => e.source))].map((source) => <label key={source} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={elegidas.includes(source)} onChange={(e) =>
              setElegidas((actual) => e.target.checked ? [...actual, source] : actual.filter((f) => f !== source))} />
            {source}
          </label>)}
        </fieldset>
        <p className="text-sm font-semibold">Las series ya presentes conservan su progreso. No se elimina nada.</p>
        <Button onClick={importar} disabled={guardando || !total}>
          {guardando ? "Importando…" : "Confirmar e importar " + total + " series"}
        </Button>
        {guardando && <Button variant="secondary" onClick={() => { cancelar.current = true; }}>Detener después de este lote</Button>}
        {resultado && <div role="status" className="space-y-2 text-sm">
          <progress className="w-full" value={avance} max={total || 1} aria-label="Series procesadas" />
          <p>{avance} / {total} procesadas. {resultado.creadas} nuevas, {resultado.conservadas} ya presentes, {resultado.omitidas} no encontradas en la fuente.</p>
          {!guardando && <Link href="/biblioteca" className="text-accent underline">Ver biblioteca</Link>}
        </div>}
      </>}
      {error && <p role="alert" className="text-sm text-[var(--danger-fg)]">{error}</p>}
    </Surface>
  </section>;
}
