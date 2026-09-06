import { HomeSkeleton } from "@/components/skeletons";

// Límite de Suspense a nivel de ruta (§4): se pinta en t0 al empezar la
// navegación y cierra la congelación en que la pantalla vieja quedaba montada
// mientras el router resolvía. El `loading` de `dynamic()` llega tarde por
// construcción (está dentro de la página). Reusa el esqueleto de skeletons.tsx.
export default function Loading() {
  return <HomeSkeleton />;
}
