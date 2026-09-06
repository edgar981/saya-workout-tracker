"use client";

import dynamic from "next/dynamic";

import { SessionSkeleton } from "@/components/skeletons";

const SessionScreen = dynamic(() => import("@/components/screens/session-screen"), {
  ssr: false,
  loading: () => <SessionSkeleton />,
});

export default function Page() {
  return <SessionScreen />;
}
