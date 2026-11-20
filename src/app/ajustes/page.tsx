"use client";

import dynamic from "next/dynamic";

import { AjustesSkeleton } from "@/components/skeletons";

const AjustesScreen = dynamic(() => import("@/components/screens/ajustes-screen"), {
  ssr: false,
  loading: () => <AjustesSkeleton />,
});

export default function Page() {
  return <AjustesScreen />;
}
