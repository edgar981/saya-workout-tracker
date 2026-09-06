"use client";

import dynamic from "next/dynamic";

import { HomeSkeleton } from "@/components/skeletons";

// ssr: false no es una optimización: Dexie no existe en el servidor y una
// consulta durante el prerender revienta el build. El `loading` es el esqueleto
// del home, no un texto suelto (§3.6): la etapa de carga del chunk ya pinta el
// layout, y el screen reusa el mismo esqueleto mientras el liveQuery resuelve.
const HomeScreen = dynamic(() => import("@/components/screens/home-screen"), {
  ssr: false,
  loading: () => <HomeSkeleton />,
});

export default function Page() {
  return <HomeScreen />;
}
