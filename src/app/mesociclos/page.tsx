"use client";

import dynamic from "next/dynamic";

import { MesociclosSkeleton } from "@/components/skeletons";

const MesociclosScreen = dynamic(() => import("@/components/screens/mesociclos-screen"), {
  ssr: false,
  loading: () => <MesociclosSkeleton />,
});

export default function Page() {
  return <MesociclosScreen />;
}
