"use client";

import dynamic from "next/dynamic";

import { DineroSkeleton } from "@/components/skeletons";

const DineroScreen = dynamic(() => import("@/components/screens/dinero-screen"), {
  ssr: false,
  loading: () => <DineroSkeleton />,
});

export default function Page() {
  return <DineroScreen />;
}
