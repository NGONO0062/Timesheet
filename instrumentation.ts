// Au démarrage du serveur : une configuration dangereuse en production arrête tout,
// plutôt que de servir des liens faux ou une connexion sans mot de passe.
import { productionConfigProblems } from "@/lib/demo";

export function register() {
  const problems = productionConfigProblems(process.env);
  if (problems.length) throw new Error(`Configuration refusée :\n- ${problems.join("\n- ")}`);
}
