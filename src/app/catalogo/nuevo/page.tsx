"use client";

import dynamic from "next/dynamic";

import { CatalogoNuevoSkeleton } from "@/components/skeletons";

const CatalogoNuevoScreen = dynamic(
  () => import("@/components/screens/catalogo-nuevo-screen"),
  {
    ssr: false,
    loading: () => <CatalogoNuevoSkeleton />,
  },
);

export default function Page() {
  return <CatalogoNuevoScreen />;
}
