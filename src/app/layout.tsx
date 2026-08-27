import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegistrar } from "@/components/pwa/ServiceWorkerRegistrar";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "MangaTotal",
    template: "%s · MangaTotal",
  },
  description: "Biblioteca privada de manga, manhwa, manhua y doujinshi",
  applicationName: "MangaTotal",
  // instalable en iOS desde "Compartir → Agregar a inicio"
  appleWebApp: {
    capable: true,
    title: "MangaTotal",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0f",
  // el lector usa toda la pantalla en el celular
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-ES">
      <body>
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
