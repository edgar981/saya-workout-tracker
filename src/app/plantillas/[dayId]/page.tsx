"use client";

import dynamic from "next/dynamic";

const PlantillaDiaScreen = dynamic(
  () => import("@/components/screens/plantillas-dia-screen"),
  {
    ssr: false,
    loading: () => <p className="text-muted-foreground p-6 text-sm">Cargando…</p>,
  },
);

export default function Page() {
  return <PlantillaDiaScreen />;
}
