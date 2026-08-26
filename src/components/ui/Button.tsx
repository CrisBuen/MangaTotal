import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "icon";

const baseClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border text-[11px] font-bold uppercase tracking-[0.1em] transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-50";

const variantClass: Record<ButtonVariant, string> = {
  primary:
    "border-accent bg-accent text-[var(--bg)] shadow-[var(--glow)] hover:border-[var(--accent-hover)] hover:bg-[var(--accent-hover)] active:translate-y-px",
  secondary:
    "border-line bg-panel text-ink hover:border-accent hover:bg-[var(--accent-soft)] active:translate-y-px",
  ghost:
    "border-transparent bg-transparent text-ink hover:border-line hover:bg-[var(--surface-raised)] active:translate-y-px",
  danger:
    "border-danger bg-transparent text-danger hover:bg-danger hover:text-panel active:translate-y-px",
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "px-3.5",
  md: "px-5",
  icon: "w-11 p-0",
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
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      type={type}
      className={buttonStyles({ variant, size, className })}
      {...props}
    />
  );
}
