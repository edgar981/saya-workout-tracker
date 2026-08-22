"use client";

import dynamic from "next/dynamic";

const HistorialScreen = dynamic(() => import("@/components/screens/historial-screen"), {
  ssr: false,
  loading: () => <p className="text-muted-foreground p-6 text-sm">Cargando…</p>,
});

export default function Page() {
  return <HistorialScreen />;
}
