import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { passkey } from "@better-auth/passkey";
import { prisma } from "@/lib/prisma";
import { esCorreoPermitido } from "./correo-permitido";

/**
 * El login, mitad de servidor (DECISIONES.md §14).
 *
 * La instancia se construye en el PRIMER USO, no al importar el módulo: la
 * llamada a `betterAuth` arranca su contexto en una promesa que valida el
 * secreto (better-auth/dist/context/create-context.mjs:39-46, 80), y con
 * `NODE_ENV=production` sin `BETTER_AUTH_SECRET` esa promesa se rechaza. `next
 * build` corre sin estas variables y no puede romperse por ellas.
 */

/** Sesión de 30 días, que se renueva una vez por día de uso. */
const SESION_SEGUNDOS = 30 * 24 * 60 * 60; // 2592000
const RENOVACION_SEGUNDOS = 24 * 60 * 60; // 86400
const SECRETO_MIN_CARACTERES = 32;

function variable(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor || valor.trim() === "") {
    throw new Error(`Falta la variable de entorno ${nombre} (ver .env.example).`);
  }
  return valor;
}

function crearAuth() {
  const secreto = variable("BETTER_AUTH_SECRET");
  if (secreto.length < SECRETO_MIN_CARACTERES) {
    throw new Error(
      `BETTER_AUTH_SECRET debe tener al menos ${SECRETO_MIN_CARACTERES} caracteres.`,
    );
  }
  const baseURL = variable("BETTER_AUTH_URL");
  const direccion = new URL(baseURL);

  return betterAuth({
    appName: "Saya",
    secret: secreto,
    // La dirección pública exacta de cada entorno. Es también la única
    // dirección de confianza: no se declara `trustedOrigins`.
    baseURL,
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    emailAndPassword: { enabled: true },
    databaseHooks: {
      user: {
        create: {
          // `emailAndPassword.disableSignUp` cerraría también la primera
          // cuenta (better-auth/dist/api/routes/sign-up.mjs:145), así que el
          // registro queda abierto y este hook rechaza a todo correo que no
          // sea el de AUTH_ALLOWED_EMAIL.
          before: async (usuario) => {
            if (!esCorreoPermitido(usuario.email, process.env.AUTH_ALLOWED_EMAIL)) {
              throw new APIError("FORBIDDEN", {
                message: "El registro está cerrado.",
              });
            }
          },
        },
      },
    },
    session: {
      expiresIn: SESION_SEGUNDOS,
      updateAge: RENOVACION_SEGUNDOS,
    },
    // En Vercel cada función es su propia memoria: el límite va en la base.
    rateLimit: { enabled: true, storage: "database" },
    telemetry: { enabled: false },
    plugins: [
      passkey({
        rpID: direccion.hostname,
        rpName: "Saya",
        origin: direccion.origin,
        authenticatorSelection: { userVerification: "required" },
        registration: { requireSession: true },
      }),
    ],
  });
}

let instancia: ReturnType<typeof crearAuth> | undefined;

/** La instancia de Better Auth, construida en el primer uso. */
export function getAuth() {
  instancia ??= crearAuth();
  return instancia;
}
