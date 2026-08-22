"use client";

import dynamic from "next/dynamic";

const SessionScreen = dynamic(() => import("@/components/screens/session-screen"), {
  ssr: false,
  loading: () => <p className="text-muted-foreground p-6 text-sm">Abriendo la sesión…</p>,
});

export default function Page() {
  return <SessionScreen />;
}
