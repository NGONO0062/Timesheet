import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import path from "node:path";

// Tests d'intégration : base PostgreSQL de développement (docker compose up -d),
// données du seed. Lancement : npm run test:int.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname),
      "server-only": path.resolve(import.meta.dirname, "lib/data/__tests__/server-only.ts"),
    },
  },
  test: {
    include: ["**/*.int.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 30_000,
    // .env complet (SMTP vers Mailpit, horloge…), comme l'application.
    env: loadEnv("", import.meta.dirname, ""),
  },
});
