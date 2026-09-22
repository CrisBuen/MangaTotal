"use client";

import { useCallback, useEffect, useRef, useState, type TouchEvent } from "react";
import { enAppAndroid } from "@/lib/pantalla";

/** Un gesto desde arriba refresca solo la ficha abierta, sin recorrer la biblioteca. */
export function useRefrescoSerie(cargar: () => Promise<void>) {
  const [android, setAndroid] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  const [desplazamiento, setDesplazamiento] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);
  const inicio = useRef<number | null>(null);
  const ocupado = useRef(false);

  useEffect(() => setAndroid(enAppAndroid()), []);

  const refrescar = useCallback(async () => {
    if (ocupado.current) return;
    ocupado.current = true;
    setRefrescando(true);
    setAviso(null);
    try {
      let temporizador: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          cargar(),
          new Promise<never>((_, reject) => {
            temporizador = setTimeout(() => reject(new Error("La fuente está tardando. Podés reintentar.")), 20_000);
          }),
        ]);
        setAviso("Capítulos actualizados");
      } finally {
        if (temporizador) clearTimeout(temporizador);
      }
    } catch (error) {
      setAviso(error instanceof Error ? error.message : "No se pudo actualizar. Intentá de nuevo.");
    } finally {
      ocupado.current = false;
      setRefrescando(false);
      setDesplazamiento(0);
    }
  }, [cargar]);

  const gesto = {
    onTouchStart(event: TouchEvent<HTMLDivElement>) {
      inicio.current = android && window.scrollY < 12 && !ocupado.current ? event.touches[0]?.clientY ?? null : null;
    },
    onTouchMove(event: TouchEvent<HTMLDivElement>) {
      if (inicio.current === null) return;
      setDesplazamiento(Math.min(90, Math.max(0, (event.touches[0]?.clientY ?? inicio.current) - inicio.current)));
    },
    onTouchEnd() {
      if (inicio.current !== null && desplazamiento >= 70) void refrescar();
      inicio.current = null;
      setDesplazamiento(0);
    },
  };
  return { android, refrescando, desplazamiento, aviso, refrescar, gesto };
}
