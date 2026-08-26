import type { HTMLAttributes, ReactNode } from "react";

export function Surface({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl border border-line bg-[color-mix(in_oklch,var(--surface)_90%,transparent)] backdrop-blur-sm ${className}`}
      {...props}
    />
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6 border-b border-line pb-8 sm:flex-row sm:items-end sm:justify-between sm:pb-10">
      <div className="max-w-3xl">
        {eyebrow && (
          <p className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-5xl font-black uppercase leading-[0.92] tracking-[-0.055em] text-ink sm:text-6xl lg:text-7xl">{title}</h1>
        {description && <p className="mt-4 max-w-2xl text-sm leading-6 text-subtle sm:text-base">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
