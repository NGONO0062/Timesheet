// Avant les tests : « Division de test » remise à zéro (comptes *.e2e@exemple.com).
// CX Expertise, les données de démonstration, n'est jamais modifiée par les tests.
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const api = fileURLToPath(new URL("../../backend/TimeSheet.Api/src/TimeSheet.Api", import.meta.url));

export default function globalSetup() {
  const run = (build: boolean) =>
    execSync(`dotnet run ${build ? "" : "--no-build "}--project "${api}" --launch-profile Development -- --seed-e2e`, { stdio: "inherit" });
  try {
    // L'API tourne peut-être déjà (fichiers verrouillés) : on réutilise ce qui est compilé.
    run(false);
  } catch {
    run(true);
  }
}
