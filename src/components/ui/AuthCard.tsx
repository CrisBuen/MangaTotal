import { buttonStyles } from "./Button";
import { fieldControlClass } from "./Field";
import { Surface } from "./Surface";

export function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main
      className="flex min-h-screen items-center justify-center bg-canvas p-4 sm:p-6"
      data-od-id="auth-layout"
    >
      <Surface className="w-full max-w-md border-accent p-7 shadow-[var(--glow)] sm:p-10" data-od-id="auth-card">
        <div className="mb-8 border-b border-line pb-6">
          <p className="mb-4 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
            Acceso privado
          </p>
          <h1 className="font-display text-5xl font-black uppercase leading-[0.88] tracking-[-0.06em] text-ink sm:text-6xl">
            MangaTotal
          </h1>
          <p className="mt-4 text-sm text-subtle">{title}</p>
        </div>
        {children}
      </Surface>
    </main>
  );
}

export const inputClass = fieldControlClass;

export const buttonClass = buttonStyles({ variant: "primary", className: "w-full" });
