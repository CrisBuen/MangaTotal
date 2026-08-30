"use client";

import { useRouter } from "next/navigation";
import { buttonStyles } from "./Button";
import { borrarCachePrivadaAndroid } from "@/lib/androidCache";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        await borrarCachePrivadaAndroid();
        router.push("/login");
        router.refresh();
      }}
      className={buttonStyles({ variant: "ghost", size: "sm" })}
      data-od-id="logout-button"
    >
      Salir
    </button>
  );
}
