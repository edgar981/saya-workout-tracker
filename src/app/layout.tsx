import type { Metadata, Viewport } from "next";
import "./globals.css";
import { DbBoot } from "@/components/db-boot";
import { SwRegister } from "@/components/sw-register";
import { BackupSync } from "@/components/backup-sync";

export const metadata: Metadata = {
  title: "saya-tracker",
  description: "Registro de entrenamiento. Local-first, funciona sin señal.",
  applicationName: "saya-tracker",
  appleWebApp: {
    capable: true,
    title: "saya",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className="antialiased">
        <DbBoot />
        <SwRegister />
        <BackupSync />
        {children}
      </body>
    </html>
  );
}
