"use client";

import dynamic from "next/dynamic";

const CloseScreen = dynamic(() => import("@/components/screens/close-screen"), {
  ssr: false,
  loading: () => <p className="text-muted-foreground p-6 text-sm">Cargando…</p>,
});

export default function Page() {
  return <CloseScreen />;
}
