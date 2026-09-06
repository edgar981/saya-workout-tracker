"use client";

import dynamic from "next/dynamic";

import { PlantillaDiaSkeleton } from "@/components/skeletons";

const PlantillaDiaScreen = dynamic(
  () => import("@/components/screens/plantillas-dia-screen"),
  {
    ssr: false,
    loading: () => <PlantillaDiaSkeleton />,
  },
);

export default function Page() {
  return <PlantillaDiaScreen />;
}
