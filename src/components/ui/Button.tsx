import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const baseClass =
  "inline-flex items-center justify-center gap-2 rounded-md border text-sm font-medium normal-case tracking-normal transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-45";

const variantClass: Record<ButtonVariant, string> = {
  primary:
    "border-accent bg-accent text-[var(--on-accent)] hover:border-line-strong-ink hover:bg-[var(--accent-press)] active:bg-[var(--accent-press)]",
  secondary:
    "border-line-strong bg-panel text-ink hover:border-ink hover:bg-raised active:bg-raised",
  ghost:
    "border-transparent bg-transparent text-subtle hover:bg-raised hover:text-ink active:bg-raised",
  danger:
    "border-danger bg-transparent text-[var(--danger-fg)] hover:bg-danger hover:text-white active:bg-danger",
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3",
  md: "min-h-11 px-4",
  lg: "min-h-[3.25rem] px-6",
  icon: "h-11 w-11 p-0",
};

export function buttonStyles({
  variant = "secondary",
  size = "md",
  className = "",
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return `${baseClass} ${variantClass[variant]} ${sizeClass[size]} ${className}`.trim();
}

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  type = "button",
  loading = false,
  loadingLabel,
  disabled,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingLabel?: string;
  children?: ReactNode;
}) {
  return (
    <button
      type={type}
      className={buttonStyles({ variant, size, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
          aria-hidden="true"
        />
      )}
      {loading ? loadingLabel ?? children : children}
    </button>
  );
}
