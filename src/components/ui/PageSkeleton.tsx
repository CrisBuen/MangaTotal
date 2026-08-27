import { Skeleton } from "./Feedback";

/**
 * Esqueleto que se dibuja apenas se toca una pestaña, mientras el servidor
 * responde. Es parte del bundle del cliente, así que aparece al instante:
 * es lo que hace que cambiar de sección no se sienta trabado.
 */
export function PageSkeleton({
  titulo = true,
  tarjetas = 10,
}: {
  titulo?: boolean;
  tarjetas?: number;
}) {
  return (
    <div className="space-y-10" aria-busy="true" aria-live="polite">
      {titulo && (
        <div className="space-y-3">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-12 w-72 max-w-full" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: tarjetas }).map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="aspect-[2/3] w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
