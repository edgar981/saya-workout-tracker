import { createAuthClient } from "better-auth/react";
import { passkeyClient } from "@better-auth/passkey/client";

/**
 * El cliente del login (DECISIONES.md §14), mitad de navegador.
 *
 * Sin `baseURL`: en el navegador Better Auth resuelve al mismo origen, con
 * `window.location.origin` + `/api/auth`
 * (better-auth/dist/utils/url.mjs:88, client/config.mjs:25), así que no hace
 * falta una variable `NEXT_PUBLIC_` ni una dirección escrita aquí.
 */
export const authClient = createAuthClient({
  plugins: [passkeyClient()],
});
