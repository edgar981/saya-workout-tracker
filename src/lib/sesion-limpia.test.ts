import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/** SAYA-R2-7: los dos archivos de Sesión que nada importaba ya no existen. */
const raiz = join(__dirname, "..", "..");

describe("Sesión sin archivos sin uso", () => {
  it.each(["src/components/session/set-group.tsx", "src/components/session/set-row.tsx"])(
    "%s no existe",
    (ruta) => {
      expect(existsSync(join(raiz, ruta))).toBe(false);
    },
  );
});
