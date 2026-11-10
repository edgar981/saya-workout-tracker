"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/cliente";
import { textoDeError } from "@/lib/auth/errores";
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
        setError(textoDeError(res.error));
      } else {
        alTerminar?.();
      }
    } catch (err) {
      setError(textoDeError(err));
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

  const sinRed = sesion.error ? textoDeError(sesion.error) === "Sin señal." : false;

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <KeyRound className="size-4" />
        <span className="text-sm font-medium">Cuenta</span>
      </div>

      <p className="text-muted-foreground text-xs">
        Entrar sólo hace falta para el respaldo del servidor. La app abre y registra igual sin sesión ni señal.
      </p>

      {sesion.isPending ? (
        <p className="text-muted-foreground text-xs">Consultando la sesión…</p>
      ) : sesion.data ? (
        <ConSesion
          correo={sesion.data.user.email}
          ocupado={ocupado}
          accion={accion}
          onAgregar={agregarPasskey}
          onSalir={salir}
        />
      ) : sesion.error ? (
        <p className="text-muted-foreground text-xs">
          {sinRed
            ? "Sin señal: la sesión se consulta al volver la red."
            : `No se pudo consultar la sesión: ${textoDeError(sesion.error)}`}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {!crear && (
            <Button variant="outline" size="sm" disabled={ocupado} onClick={entrarConPasskey}>
              {accion === "passkey" ? "Entrando…" : "Entrar con passkey"}
            </Button>
          )}

          <form className="flex flex-col gap-3" onSubmit={enviar}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cuenta-correo">Correo</Label>
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
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cuenta-contrasena">Contraseña</Label>
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

            {crear && (
              <p className="text-muted-foreground text-xs">
                Sólo el correo permitido puede tener cuenta. Guarda la contraseña en tu gestor: es la vuelta si el
                passkey falla.
              </p>
            )}

            <Button type="submit" size="sm" disabled={ocupado}>
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
            variant="ghost"
            size="sm"
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

      {aviso && <p className="text-muted-foreground text-xs">{aviso}</p>}
      {error && <p className="text-destructive text-xs">{error}</p>}
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
    <div className="flex flex-col gap-3">
      <div className="bg-muted/40 flex flex-col gap-0.5 rounded-md px-3 py-2 text-xs">
        <span>Sesión iniciada: {correo}</span>
        <span className="text-muted-foreground">Passkeys en esta cuenta: {passkeys.data ? passkeys.data.length : "…"}</span>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" disabled={ocupado} onClick={onAgregar}>
          {accion === "agregar" ? "Agregando…" : "Agregar un passkey"}
        </Button>
        <Button variant="ghost" size="sm" disabled={ocupado} onClick={onSalir}>
          {accion === "salir" ? "Saliendo…" : "Salir"}
        </Button>
      </div>
    </div>
  );
}
