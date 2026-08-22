"use client";

import dynamic from "next/dynamic";

// ssr: false no es una optimización: Dexie no existe en el servidor y una
// consulta durante el prerender revienta el build.
const HomeScreen = dynamic(() => import("@/components/screens/home-screen"), {
  ssr: false,
  loading: () => <p className="text-muted-foreground p-6 text-sm">Abriendo…</p>,
});

export default function Page() {
  return <HomeScreen />;
}
