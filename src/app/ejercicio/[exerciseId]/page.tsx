"use client";

import dynamic from "next/dynamic";

const EjercicioScreen = dynamic(() => import("@/components/screens/ejercicio-screen"), {
  ssr: false,
  loading: () => <p className="text-muted-foreground p-6 text-sm">Cargando…</p>,
});

export default function Page() {
  return <EjercicioScreen />;
}
