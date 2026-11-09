import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests de reglas puras (verdict, progress, volumen, musculos): sin DOM, sin Dexie.
// El alias `@` es el mismo que declara `paths` en tsconfig.json.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
