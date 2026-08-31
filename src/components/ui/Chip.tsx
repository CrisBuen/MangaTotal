import type { ButtonHTMLAttributes } from "react";

export function Chip({
  selected = false,
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={`relative inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-[13px] transition-colors after:absolute after:-inset-1 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink ${
        selected
          ? "border-accent bg-[var(--accent-quiet)] text-accent-ink"
          : "border-line-strong bg-transparent text-subtle hover:border-ink hover:text-ink"
      } ${className}`}
      {...props}
    />
  );
}
