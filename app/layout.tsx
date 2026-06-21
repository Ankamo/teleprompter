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
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />
        <link rel="apple-touch-icon" href="/window.svg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Teleprompter Pro" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}