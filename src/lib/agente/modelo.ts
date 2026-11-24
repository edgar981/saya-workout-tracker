/** La familia sonnet, en su versión más nueva al escribir esto. Se cambia sin tocar código con ANTHROPIC_MODEL. */
export const MODELO_POR_DEFECTO = "claude-sonnet-5-5";

export function modeloDe(env: { ANTHROPIC_MODEL?: string | undefined }): string {
  const valor = env.ANTHROPIC_MODEL?.trim();
  return valor ? valor : MODELO_POR_DEFECTO;
}
