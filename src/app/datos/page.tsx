"use client";

import dynamic from "next/dynamic";

import { DataSkeleton } from "@/components/skeletons";

const DataScreen = dynamic(() => import("@/components/screens/data-screen"), {
  ssr: false,
  loading: () => <DataSkeleton />,
});

export default function Page() {
  return <DataScreen />;
}
