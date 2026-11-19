"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ErrorEnLinea } from "@/components/ui/estados";
import { Fila } from "@/components/ui/fila";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/cliente";
import { MENSAJE_NO_SE_PUDO, esSinRed } from "@/lib/auth/errores";
import { alEntrar } from "@/lib/backup/client";

type Accion = "passkey" | "password" | "crear" | "agregar" | "salir";

/**
 * La cuenta del login en /datos (DECISIONES.md §14). Entrar sólo hace falta para
 * el respaldo del servidor: nada de esto bloquea una pantalla, y sin sesión ni
 * señal la app abre y registra igual. Ninguna acción navega.
 */
export function CuentaPanel({ onEntro }: { onEntro: () => void }) {
  const sesion = authClient.useSession();

  const [crear, setCrear] = useState(false);
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [accion, setAccion] = useState<Accion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const ocupado = accion !== null;

  const correr = async (tipo: Accion, llamada: () => Promise<{ error: unknown }>, alTerminar?: () => void) => {
    setAccion(tipo);
    setError(null);
    setAviso(null);
    try {
      const res = await llamada();
      if (res.error) {
        setError(MENSAJE_NO_SE_PUDO);
      } else {
        alTerminar?.();
      }
    } catch {
      setError(MENSAJE_NO_SE_PUDO);
    } finally {
      setAccion(null);
    }
  };

  const entro = () => {
    alEntrar();
    onEntro();
  };

  const entrarConPasskey = () => void correr("passkey", () => authClient.signIn.passkey(), entro);

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (crear) {
      // El nombre es el mismo correo: Better Auth lo exige y no hay campo de nombre.
      void correr("crear", () => authClient.signUp.email({ email: correo, password: contrasena, name: correo }), entro);
    } else {
      void correr("password", () => authClient.signIn.email({ email: correo, password: contrasena }), entro);
    }
  };

  const agregarPasskey = () =>
    void correr("agregar", () => authClient.passkey.addPasskey(), () => setAviso("Passkey agregado."));

  const salir = () => void correr("salir", () => authClient.signOut());

  const sinRed = sesion.error ? esSinRed(sesion.error) : false;

  return (
    <div className="py-3">
      {sesion.isPending ? (
        <p className="text-[15px] leading-[22px] text-ink2">Consultando la sesión…</p>
      ) : sesion.data ? (
        <ConSesion
          correo={sesion.data.user.email}
          ocupado={ocupado}
          accion={accion}
          onAgregar={agregarPasskey}
          onSalir={salir}
        />
      ) : sesion.error ? (
        <ErrorEnLinea>
          {sinRed
            ? "Sin señal: la sesión se consulta al volver la red."
            : "No se pudo consultar la sesión."}
        </ErrorEnLinea>
      ) : (
        <div>
          {!crear && (
            <Button
              variant="secondary"
              className="w-full"
              disabled={ocupado}
              onClick={entrarConPasskey}
            >
              {accion === "passkey" ? "Entrando…" : "Entrar con passkey"}
            </Button>
          )}

          <form onSubmit={enviar}>
            <div className="mt-5">
              <Label htmlFor="cuenta-correo" className="kicker mb-[9px]">
                Correo
              </Label>
              <Input
                id="cuenta-correo"
                type="email"
                autoComplete="username"
                required
                value={correo}
                disabled={ocupado}
                onChange={(e) => setCorreo(e.target.value)}
              />
            </div>
            <div className="mt-5">
              <Label htmlFor="cuenta-contrasena" className="kicker mb-[9px]">
                Contraseña
              </Label>
              <Input
                id="cuenta-contrasena"
                type="password"
                autoComplete={crear ? "new-password" : "current-password"}
                required
                value={contrasena}
                disabled={ocupado}
                onChange={(e) => setContrasena(e.target.value)}
              />
            </div>

            <Button type="submit" variant="secondary" className="mt-5 w-full" disabled={ocupado}>
              {crear
                ? accion === "crear"
                  ? "Creando la cuenta…"
                  : "Crear la cuenta"
                : accion === "password"
                  ? "Entrando…"
                  : "Entrar con contraseña"}
            </Button>
          </form>

          <Button
            type="button"
            variant="link"
            className="mt-3"
            disabled={ocupado}
            onClick={() => {
              setCrear(!crear);
              setError(null);
            }}
          >
            {crear ? "Ya tengo cuenta" : "Crear la cuenta"}
          </Button>
        </div>
      )}

      {aviso && <p className="mt-3 text-[13px] leading-[18px] text-ink2">{aviso}</p>}
      {error && <ErrorEnLinea className="mt-3">{error}</ErrorEnLinea>}
    </div>
  );
}

function ConSesion({
  correo,
  ocupado,
  accion,
  onAgregar,
  onSalir,
}: {
  correo: string;
  ocupado: boolean;
  accion: Accion | null;
  onAgregar: () => void;
  onSalir: () => void;
}) {
  const passkeys = authClient.useListPasskeys();

  return (
    <div>
      <div className="rounded-[20px] bg-white/[.035] px-4 py-0.5 shadow-[inset_0_0_0_1px_var(--color-hair)]">
        <Fila className="min-h-[52px]" titulo="Sesión iniciada" subtitulo={correo} />
        <Fila
          className="min-h-[52px]"
          titulo="Passkeys en esta cuenta"
          valor={<span className="tabular-nums">{passkeys.data ? passkeys.data.length : "…"}</span>}
        />
      </div>
      <div className="mt-1.5 mb-3 flex flex-wrap items-center gap-2.5">
        <Button variant="secondary" disabled={ocupado} onClick={onAgregar}>
          {accion === "agregar" ? "Agregando…" : "Agregar un passkey"}
        </Button>
        <Button variant="link" disabled={ocupado} onClick={onSalir}>
          {accion === "salir" ? "Saliendo…" : "Salir"}
        </Button>
      </div>
    </div>
  );
}
