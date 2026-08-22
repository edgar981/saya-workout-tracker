import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

// eslint-config-next 16 ya exporta flat config, así que no hace falta
// FlatCompat — que además revienta con un error de estructura circular al
// intentar validar el plugin de react.
const eslintConfig = [
  { ignores: [".next/**", "out/**", "node_modules/**", "public/sw.js"] },
  ...nextCoreWebVitals,
  ...nextTypescript,
];

export default eslintConfig;
