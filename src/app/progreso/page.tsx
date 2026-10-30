"use client";

import dynamic from "next/dynamic";

import { ProgresoSkeleton } from "@/components/skeletons";

const ProgresoScreen = dynamic(() => import("@/components/screens/progreso-screen"), {
  ssr: false,
  loading: () => <ProgresoSkeleton />,
});

export default function Page() {
  return <ProgresoScreen />;
}
