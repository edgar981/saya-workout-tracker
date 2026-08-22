"use client";

import dynamic from "next/dynamic";

const SessionDetailScreen = dynamic(
  () => import("@/components/screens/session-detail-screen"),
  {
    ssr: false,
    loading: () => <p className="text-muted-foreground p-6 text-sm">Cargando…</p>,
  },
);

export default function Page() {
  return <SessionDetailScreen />;
}
