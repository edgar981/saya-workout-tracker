import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// La instancia se construye en el primer pedido, no al importar la ruta (ver
// servidor.ts): `next build` no tiene las variables del login.
export const { GET, POST, PATCH, PUT, DELETE } = toNextJsHandler((request) =>
  getAuth().handler(request),
);
