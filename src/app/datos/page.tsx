"use client";

import dynamic from "next/dynamic";

const DataScreen = dynamic(() => import("@/components/screens/data-screen"), {
  ssr: false,
  loading: () => <p className="text-muted-foreground p-6 text-sm">Cargando…</p>,
});

export default function Page() {
  return <DataScreen />;
}
