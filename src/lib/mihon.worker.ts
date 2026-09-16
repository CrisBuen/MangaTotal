import { leerMihon } from "./mihonFormato";
import { prepararMihon } from "./mihonImportacion";
// El respaldo se descomprime en este dispositivo y fuera del hilo de la interfaz.
self.onmessage = async (evento: MessageEvent<Blob>) => {
  try { self.postMessage({ resumen: prepararMihon(await leerMihon(evento.data)) }); }
  catch (error) { self.postMessage({ error: error instanceof Error ? error.message : "No se pudo leer el respaldo" }); }
};
