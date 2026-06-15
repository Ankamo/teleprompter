import type { Metadata, Viewport } from "next";
import "./globals.css";

// Configuración de visualización para dispositivos móviles
export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1, // Evita el zoom molesto en iOS al hacer clic en inputs
};

export const metadata: Metadata = {
  title: "Teleprompter Pro",
  description: "Graba tus videos con guion integrado",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Teleprompter Pro",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="bg-black text-white">
      <body>{children}</body>
    </html>
  );
}