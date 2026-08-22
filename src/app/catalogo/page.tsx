"use client";

import dynamic from "next/dynamic";

const CatalogoScreen = dynamic(() => import("@/components/screens/catalogo-screen"), {
  ssr: false,
  loading: () => <p className="text-muted-foreground p-6 text-sm">Cargando…</p>,
});

export default function Page() {
  return <CatalogoScreen />;
}
