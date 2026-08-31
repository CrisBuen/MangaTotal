import type { ReactNode } from "react";

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "success" | "warning" | "danger";
}) {
  const tones = {
    neutral: "border-line bg-[var(--surface-soft)] text-subtle",
    accent: "border-accent bg-[var(--accent-soft)] text-accent-ink",
    success: "border-success bg-[color-mix(in_oklch,var(--success)_12%,transparent)] text-success",
    warning: "border-warning bg-[color-mix(in_oklch,var(--warning)_12%,transparent)] text-warning",
    danger: "border-danger bg-[color-mix(in_oklch,var(--danger)_12%,transparent)] text-danger",
  };

  return (
    <span
      className={`inline-flex min-h-6 items-center rounded-full border px-2.5 font-mono text-[11px] font-medium tracking-[0.06em] ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <span
      className={`block animate-pulse rounded-md bg-raised motion-reduce:animate-none ${className}`}
      aria-hidden="true"
    />
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-[10px] border border-line bg-panel px-6 py-12 text-center">
      <span
        className="mb-5 grid h-10 w-10 place-items-center rounded-md border border-line-strong text-subtle"
        aria-hidden="true"
      >
        <span className="h-3 w-3 rounded-sm border border-current" />
      </span>
      <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-subtle">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
