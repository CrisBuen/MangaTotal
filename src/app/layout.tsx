import type { Metadata, Viewport } from "next";
import { AnalyticsTracker } from "@/components/analytics/AnalyticsTracker";
import { AndroidUpdateBanner } from "@/components/pwa/AndroidUpdateBanner";
import { DesktopUpdater } from "@/components/pwa/DesktopUpdater";
import { UpdatePrompt } from "@/components/pwa/UpdatePrompt";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.mangatotal.com"),
  title: {
    default: "MangaTotal — Leer manga y ver anime online",
    template: "%s | MangaTotal",
  },
  description:
    "Explora manga, manhwa, manhua y anime en MangaTotal. Descubre series, capítulos y episodios de las fuentes integradas.",
  applicationName: "MangaTotal",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "es_CL",
    siteName: "MangaTotal",
    title: "MangaTotal — Leer manga y ver anime online",
    description:
      "Explora manga, manhwa, manhua y anime. Descubre series, capítulos y episodios de las fuentes integradas.",
  },
  // instalable en iOS desde "Compartir → Agregar a inicio"
  appleWebApp: {
    capable: true,
    title: "MangaTotal",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/mangatotal-v2-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/mangatotal-v2-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/icons/mangatotal-v2-192.png",
    apple: "/icons/mangatotal-v2-apple.png",
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
        <AnalyticsTracker />
        <UpdatePrompt />
        <AndroidUpdateBanner />
        <DesktopUpdater />
      </body>
    </html>
  );
}
