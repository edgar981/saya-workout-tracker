"use client";

import dynamic from "next/dynamic";

import { TiempoSkeleton } from "@/components/skeletons";

const TiempoScreen = dynamic(() => import("@/components/screens/tiempo-screen"), {
  ssr: false,
  loading: () => <TiempoSkeleton />,
});

export default function Page() {
  return <TiempoScreen />;
}
