"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { buttonStyles } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Feedback";
import { Surface } from "@/components/ui/Surface";

interface ContinueItem {
  series: {
    title: string;
    slug: string;
    cover_image_path: string | null;
  };
  chapter: {
    id: number;
    number: number;
    page_count: number;
  };
  lastPageNumber: number;
}

export function ContinueReading() {
  const [item, setItem] = useState<ContinueItem | null | undefined>(undefined);

  useEffect(() => {
    fetch("/api/progress/continue")
      .then((response) => (response.ok ? response.json() : []))
      .then((rows) => setItem(Array.isArray(rows) && rows.length > 0 ? rows[0] : null))
      .catch(() => setItem(null));
  }, []);

  if (item === null) return null;

  return (
    <section data-od-id="continue-reading">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] font-medium tracking-[0.08em] text-faint">
            Donde lo dejaste
          </p>
          <h2 className="mt-2 font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-[-0.02em] text-ink">
            Continuar leyendo
          </h2>
        </div>
        <Link href="/biblioteca" className="text-[13px] text-subtle transition-colors hover:text-ink">
          Ver historial
        </Link>
      </div>

      {item === undefined ? (
        <Surface className="grid min-h-48 grid-cols-[92px_1fr] gap-5 p-4 sm:grid-cols-[128px_1fr] sm:p-5">
          <Skeleton className="aspect-[2/3] w-full" />
          <div className="flex flex-col justify-center gap-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-64 max-w-full" />
            <Skeleton className="h-3 w-48 max-w-full" />
          </div>
        </Surface>
      ) : (
        <Surface className="grid grid-cols-[92px_1fr] gap-5 p-4 sm:grid-cols-[128px_1fr] sm:p-5">
          <div className="aspect-[2/3] overflow-hidden rounded-[10px] border border-line bg-raised">
            {item.series.cover_image_path && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/images/${item.series.cover_image_path}`}
                alt={item.series.title}
                className="h-full w-full object-cover"
              />
            )}
          </div>
          <div className="flex min-w-0 flex-col justify-center">
            <p className="font-mono text-[11px] font-medium tracking-[0.08em] text-faint">
              Capítulo {item.chapter.number}
            </p>
            <h3 className="mt-2 line-clamp-2 font-display text-xl font-semibold tracking-[-0.02em] text-ink sm:text-2xl">
              {item.series.title}
            </h3>
            <p className="mt-2 text-[13px] text-subtle">
              Página {item.lastPageNumber} de {item.chapter.page_count}
            </p>
            <div className="mt-3 h-0.5 max-w-sm overflow-hidden bg-raised" aria-hidden="true">
              <span
                className="block h-full bg-accent-ink"
                style={{
                  width: `${Math.min(100, Math.max(0, (item.lastPageNumber / Math.max(1, item.chapter.page_count)) * 100))}%`,
                }}
              />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href={`/leer/${item.chapter.id}?page=${item.lastPageNumber}`}
                className={buttonStyles({ variant: "primary" })}
              >
                Continuar capítulo
              </Link>
              <Link
                href={`/serie/${item.series.slug}`}
                className={buttonStyles({ variant: "secondary" })}
              >
                Ver la serie
              </Link>
            </div>
          </div>
        </Surface>
      )}
    </section>
  );
}
