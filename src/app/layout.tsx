import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lector Total",
  description: "Lector privado de manga, manhwa, manhua y doujinshi",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
