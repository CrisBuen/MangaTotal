"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
      }}
      className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
    >
      Salir
    </button>
  );
}
