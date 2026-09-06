"use client";

import dynamic from "next/dynamic";

import { CatalogoSkeleton } from "@/components/skeletons";

const CatalogoScreen = dynamic(() => import("@/components/screens/catalogo-screen"), {
  ssr: false,
  loading: () => <CatalogoSkeleton />,
});

export default function Page() {
  return <CatalogoScreen />;
}
