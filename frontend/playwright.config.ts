import { defineConfig, devices } from "@playwright/test";

// Tests de bout en bout de la réécriture, isolés de l'application de développement : l'API
// .NET sur le port 5100 et la base timesheet_api_e2e (recréée et lancée par e2e/global-setup.ts),
// l'interface Vite sur le port 5174, qui relaie /api vers cette API.
const WEB_PORT = 5174;

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  // Le hachage argon2id des connexions est coûteux : deux navigateurs à la fois suffisent.
  workers: 2,
  expect: { timeout: 15_000 },
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    locale: "fr-FR",
    timezoneId: "Africa/Douala",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    { name: "mobile", use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 }, hasTouch: true } },
  ],
  webServer: {
    command: "npm run dev",
    url: `http://localhost:${WEB_PORT}/connexion`,
    env: { TIMESHEET_WEB_PORT: String(WEB_PORT), TIMESHEET_API_URL: "http://localhost:5100" },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
