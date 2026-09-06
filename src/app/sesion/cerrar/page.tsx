"use client";

import dynamic from "next/dynamic";

import { CloseSkeleton } from "@/components/skeletons";

const CloseScreen = dynamic(() => import("@/components/screens/close-screen"), {
  ssr: false,
  loading: () => <CloseSkeleton />,
});

export default function Page() {
  return <CloseScreen />;
}
