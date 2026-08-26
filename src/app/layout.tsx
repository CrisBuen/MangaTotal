import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "MangaTotal",
    template: "%s · MangaTotal",
  },
  description: "Biblioteca privada de manga, manhwa, manhua y doujinshi",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-ES">
      <body>{children}</body>
    </html>
  );
}
