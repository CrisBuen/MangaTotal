import type { HTMLAttributes, ReactNode } from "react";

export function Surface({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-[10px] border border-line bg-panel ${className}`}
      {...props}
    />
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  as: Heading = "h1",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <div className="flex flex-col gap-5 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-3xl">
        {eyebrow && (
          <p className="mb-2 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-faint">
            {eyebrow}
          </p>
        )}
        <Heading className="font-display text-[clamp(2rem,4.5vw,3rem)] font-bold normal-case leading-[1.05] tracking-[-0.03em] text-ink">{title}</Heading>
        {description && <p className="mt-3 max-w-2xl text-[15px] leading-6 text-subtle">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
