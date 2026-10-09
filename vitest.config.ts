import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname) },
  },
  test: {
    include: ["**/*.test.ts", "**/*.test.tsx"],
    // .claude/ : dossier local de Claude Code (worktrees), jamais testé.
    exclude: ["node_modules/**", ".next/**", ".claude/**", "e2e/**", "design/**", "**/*.int.test.ts"],
    environment: "node",
    env: { TZ: "UTC" },
  },
});
