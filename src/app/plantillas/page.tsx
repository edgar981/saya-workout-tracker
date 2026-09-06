"use client";

import dynamic from "next/dynamic";

import { PlantillasSkeleton } from "@/components/skeletons";

const PlantillasScreen = dynamic(() => import("@/components/screens/plantillas-screen"), {
  ssr: false,
  loading: () => <PlantillasSkeleton />,
});

export default function Page() {
  return <PlantillasScreen />;
}
