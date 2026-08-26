import { cloneElement, isValidElement, type ReactElement } from "react";

export const fieldControlClass =
  "min-h-11 w-full rounded-xl border border-line bg-[color-mix(in_oklch,var(--surface)_88%,transparent)] px-3.5 py-2.5 text-sm text-ink placeholder:text-subtle transition hover:border-accent focus:border-accent focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)] disabled:cursor-not-allowed disabled:opacity-50";

export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactElement<{
    id?: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
  }>;
}) {
  const descriptionId = hint || error ? `${id}-description` : undefined;
  const control = isValidElement(children)
    ? cloneElement(children, {
        id: children.props.id ?? id,
        "aria-describedby": children.props["aria-describedby"] ?? descriptionId,
        "aria-invalid": children.props["aria-invalid"] ?? Boolean(error),
      })
    : children;

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-xs font-bold uppercase tracking-[0.08em] text-ink">
        {label}
      </label>
      {control}
      {(error || hint) && (
        <p
          id={descriptionId}
          className={`text-xs ${error ? "text-danger" : "text-subtle"}`}
          aria-live={error ? "polite" : undefined}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
