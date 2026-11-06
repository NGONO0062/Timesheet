import { defineConfig, devices } from "@playwright/test";

// Tests de bout en bout de la réécriture : l'API .NET (port 5000, base du seed) et
// l'interface Vite (port 5173). Un serveur déjà lancé est réutilisé hors intégration continue.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  // Le hachage argon2id des connexions est coûteux : deux navigateurs à la fois suffisent.
  workers: 2,
  expect: { timeout: 15_000 },
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:5173",
    locale: "fr-FR",
    timezoneId: "Africa/Douala",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    { name: "mobile", use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 }, hasTouch: true } },
  ],
  webServer: [
    {
      command: "dotnet run --project ../backend/TimeSheet.Api/src/TimeSheet.Api --launch-profile Development",
      url: "http://localhost:5000/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      command: "npm run dev",
      url: "http://localhost:5173/connexion",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
