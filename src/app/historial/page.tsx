"use client";

import dynamic from "next/dynamic";

import { HistorialSkeleton } from "@/components/skeletons";

const HistorialScreen = dynamic(() => import("@/components/screens/historial-screen"), {
  ssr: false,
  loading: () => <HistorialSkeleton />,
});

export default function Page() {
  return <HistorialScreen />;
}
