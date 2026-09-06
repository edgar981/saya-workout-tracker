"use client";

import dynamic from "next/dynamic";

import { EjercicioSkeleton } from "@/components/skeletons";

const EjercicioScreen = dynamic(() => import("@/components/screens/ejercicio-screen"), {
  ssr: false,
  loading: () => <EjercicioSkeleton />,
});

export default function Page() {
  return <EjercicioScreen />;
}
