// Avant les tests de bout en bout : une base à eux (timesheet_api_e2e), recréée à chaque
// exécution avec les données de démonstration et la « Division de test », et une API à eux
// (port 5100). L'application de développement (base timesheet_api, ports 5000 et 5173) n'est
// jamais touchée : on peut l'essayer à la main sans fausser les tests, et inversement.
import { execSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const project = fileURLToPath(new URL("../../backend/TimeSheet.Api/src/TimeSheet.Api", import.meta.url));
const E2E_API_PORT = 5100;
const env = {
  ...process.env,
  TimeSheetApi__ConnectionStrings__TimeSheetApi: "Host=localhost;Port=5432;Database=timesheet_api_e2e;Username=timesheet;Password=timesheet",
};

async function healthy(url: string, timeoutMs: number) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // pas encore démarrée
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`L'API de test ne répond pas : ${url}`);
}

export default async function globalSetup() {
  // Compilation : si l'API de développement tourne, ses fichiers sont verrouillés ; on
  // garde alors ce qui est déjà compilé.
  try {
    execSync(`dotnet build "${project}" -nologo -v q`, { stdio: "inherit" });
  } catch {
    console.warn("Compilation impossible (API de développement lancée ?) : la dernière compilation sert aux tests.");
  }
  try {
    // Sortie (requêtes SQL du seed) montrée seulement en cas d'échec.
    execSync(`dotnet run --no-build --project "${project}" --launch-profile Development -- --seed-fresh`, { stdio: "pipe", env });
  } catch (e) {
    const out = e as { stdout?: Buffer; stderr?: Buffer };
    console.error(out.stdout?.toString(), out.stderr?.toString());
    throw e;
  }

  const api = spawn("dotnet", ["run", "--no-build", "--project", project, "--launch-profile", "Development", "--", "--urls", `http://localhost:${E2E_API_PORT}`], {
    env,
    stdio: "ignore",
  });
  await healthy(`http://localhost:${E2E_API_PORT}/api/health`, 120_000);

  return () => {
    // L'arbre entier : dotnet run lance le processus de l'API.
    if (process.platform === "win32" && api.pid) execSync(`taskkill /pid ${api.pid} /T /F`, { stdio: "ignore" });
    else api.kill();
  };
}
