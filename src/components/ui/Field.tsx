import { cloneElement, isValidElement, type ReactElement } from "react";

export const fieldControlClass =
  "min-h-11 w-full rounded-md border border-line-strong bg-panel px-3.5 py-2.5 text-sm text-ink placeholder:text-faint transition-colors hover:border-subtle focus:border-accent-ink focus:outline-none focus:ring-1 focus:ring-accent-ink disabled:cursor-not-allowed disabled:opacity-50";

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
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {control}
      {(error || hint) && (
        <p
          id={descriptionId}
          className={`text-[13px] ${error ? "text-[var(--danger-fg)]" : "text-subtle"}`}
          aria-live={error ? "polite" : undefined}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
