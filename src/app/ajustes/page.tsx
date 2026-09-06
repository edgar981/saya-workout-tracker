import AjustesScreen from "@/components/screens/ajustes-screen";

// Sin `dynamic(ssr:false)`: /ajustes no consulta Dexie, así que se prerenderiza
// y abre al instante, sin esqueleto ni etapa de carga.
export default function Page() {
  return <AjustesScreen />;
}
