import type { Metadata, Viewport } from "next";
import { AndroidUpdateBanner } from "@/components/pwa/AndroidUpdateBanner";
import { DesktopUpdater } from "@/components/pwa/DesktopUpdater";
import { UpdatePrompt } from "@/components/pwa/UpdatePrompt";
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
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/icons/icon-192.png",
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
        <UpdatePrompt />
        <AndroidUpdateBanner />
        <DesktopUpdater />
      </body>
    </html>
  );
}
