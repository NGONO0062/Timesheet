import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      // Aucune requête Prisma hors de la couche d'accès aux données (PROMPT.md §7).
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@prisma/client",
              message: "Passez par la couche d'accès aux données (lib/data).",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["lib/data/**", "prisma/**"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    ignores: [".next/**", "node_modules/**", ".claude/**", "design/**", "playwright-report/**", "test-results/**", "next-env.d.ts"],
  },
];

export default config;
