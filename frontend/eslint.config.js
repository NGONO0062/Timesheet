import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

// Feature-Sliced Design : une couche n'importe que les couches en dessous d'elle
// (app > pages > widgets > features > entities > shared).
const LAYERS = ["app", "pages", "widgets", "features", "entities", "shared"];
const below = (layer) => LAYERS.slice(LAYERS.indexOf(layer) + 1);
const above = (layer) => LAYERS.slice(0, LAYERS.indexOf(layer) + 1).filter((l) => l !== layer);

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**"] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  reactHooks.configs.flat.recommended,
  { rules: { "@typescript-eslint/no-explicit-any": "error" } },
  // Scripts de contrôle : exécutés par Node.
  { files: ["scripts/**/*.mjs"], languageOptions: { globals: { process: "readonly", console: "readonly", URL: "readonly" } } },
  ...LAYERS.filter((l) => l !== "app").map((layer) => ({
    files: [`src/${layer}/**/*.{ts,tsx}`],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: above(layer).map((l) => `@/${l}/**`).concat(above(layer).map((l) => `@/${l}`)),
              message: `Feature-Sliced Design : « ${layer} » n'importe que ${below(layer).join(", ") || "rien"}.`,
            },
          ],
        },
      ],
    },
  })),
);
