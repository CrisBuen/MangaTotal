import Image from "next/image";
import { buttonStyles } from "./Button";
import { fieldControlClass } from "./Field";
import { Surface } from "./Surface";

export function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main
      className="flex min-h-screen items-center justify-center bg-canvas p-4 sm:p-6"
      data-od-id="auth-layout"
    >
      <Surface className="w-full max-w-md p-7 sm:p-10" data-od-id="auth-card">
        <div className="mb-8 border-b border-line pb-6">
          <Image
            src="/icons/mangatotal-logo-transparent.png"
            alt=""
            width={48}
            height={48}
            priority
            unoptimized
            className="mb-5 h-12 w-12 object-contain"
          />
          <p className="mb-3 font-mono text-[11px] font-medium tracking-[0.08em] text-faint">
            Acceso privado
          </p>
          <h1 className="font-display text-[clamp(2.25rem,8vw,3rem)] font-bold leading-none tracking-[-0.035em] text-ink">
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
