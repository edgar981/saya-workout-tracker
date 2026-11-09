/**
 * La regla del único correo permitido (DECISIONES.md §14): la app es de un solo
 * usuario y el registro está cerrado a una dirección. Módulo puro: sin
 * `server-only` y sin Better Auth, para que se pueda probar sin servidor.
 *
 * Compara sin mayúsculas ni espacios alrededor. Sin correo permitido
 * configurado (variable ausente o vacía), o con un correo vacío, la respuesta
 * es no: sin la variable no se puede crear ninguna cuenta.
 */
export function esCorreoPermitido(
  correo: string | null | undefined,
  permitido: string | null | undefined,
): boolean {
  const esperado = normalizar(permitido);
  const recibido = normalizar(correo);
  if (esperado === "" || recibido === "") return false;
  return recibido === esperado;
}

function normalizar(valor: string | null | undefined): string {
  return typeof valor === "string" ? valor.trim().toLowerCase() : "";
}
