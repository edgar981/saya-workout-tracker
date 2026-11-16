"use client";

import dynamic from "next/dynamic";

import { CuerpoSkeleton } from "@/components/skeletons";

const CuerpoScreen = dynamic(() => import("@/components/screens/cuerpo-screen"), {
  ssr: false,
  loading: () => <CuerpoSkeleton />,
});

export default function Page() {
  return <CuerpoScreen />;
}
