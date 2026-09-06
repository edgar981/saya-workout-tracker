import type { Metadata, Viewport } from "next";
import { Archivo, DM_Mono } from "next/font/google";
import "./globals.css";
import { DbBoot } from "@/components/db-boot";
import { SwRegister } from "@/components/sw-register";
import { BackupSync } from "@/components/backup-sync";

// Autoalojadas: next/font descarga los archivos EN BUILD y los sirve desde el
// propio origen (/_next/static/media/*.woff2). No hay <link> a ningún CDN de
// fuentes en runtime — requisito para abrir sin señal (DECISIONES.md). Archivo
// es fuente variable (todo el rango de peso); DM Mono va con sus dos pesos.
const archivo = Archivo({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-archivo",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-dm-mono",
});

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
  themeColor: "#08090a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${archivo.variable} ${dmMono.variable}`}>
      <body className="antialiased">
        <DbBoot />
        <SwRegister />
        <BackupSync />
        {children}
      </body>
    </html>
  );
}
