"use client";

import { useRouter } from "next/navigation";
import { buttonStyles } from "./Button";
import { borrarCachePrivadaAndroid } from "@/lib/androidCache";
import { limpiarActualizacionesBiblioteca } from "@/components/library/ActualizacionesBiblioteca";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        limpiarActualizacionesBiblioteca();
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
