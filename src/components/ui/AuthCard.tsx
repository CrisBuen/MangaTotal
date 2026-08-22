export function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-xl">
        <h1 className="mb-1 text-center text-2xl font-bold text-violet-400">Lector Total</h1>
        <p className="mb-6 text-center text-sm text-zinc-400">{title}</p>
        {children}
      </div>
    </main>
  );
}

export const inputClass =
  "w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-violet-500";

export const buttonClass =
  "w-full rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50";
