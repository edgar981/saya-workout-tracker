"use client";

import dynamic from "next/dynamic";

import { SessionDetailSkeleton } from "@/components/skeletons";

const SessionDetailScreen = dynamic(
  () => import("@/components/screens/session-detail-screen"),
  {
    ssr: false,
    loading: () => <SessionDetailSkeleton />,
  },
);

export default function Page() {
  return <SessionDetailScreen />;
}
